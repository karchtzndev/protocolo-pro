import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import type { Nutritionist } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("id", user.id)
    .single<Nutritionist>();

  if (!nutritionist) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        nutritionistName={nutritionist.full_name}
        crn={nutritionist.crn}
        planLabel={
          nutritionist.subscription_status === "active"
            ? "Plano Profissional"
            : nutritionist.subscription_status === "trialing"
              ? "Período de teste"
              : "Assinatura pendente"
        }
      />
      <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 pb-24 md:px-8 md:py-7 md:pb-10">
        {children}
      </main>
    </div>
  );
}
