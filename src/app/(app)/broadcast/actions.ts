"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import type { Patient } from "@/lib/types";

export async function sendBroadcast(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const tagsCsv = String(formData.get("tags") || "").trim();
  if (!title || !body) throw new Error("Título e mensagem são obrigatórios.");

  const filterTags = tagsCsv
    ? Array.from(new Set(tagsCsv.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)))
    : [];

  let query = supabase.from("patients").select("*").eq("nutritionist_id", user.id).neq("status", "inativo");
  if (filterTags.length) query = query.overlaps("tags", filterTags);

  const { data: recipients } = await query.returns<Patient[]>();
  const recipientCount = recipients?.length ?? 0;

  const { data: broadcast, error } = await supabase
    .from("broadcasts")
    .insert({ nutritionist_id: user.id, title, body, filter_tags: filterTags, recipient_count: recipientCount })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  redirect(`/broadcast?sent=${broadcast.id}`);
}
