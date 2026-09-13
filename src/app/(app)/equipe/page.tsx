import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ClinicInvite, Nutritionist } from "@/lib/types";
import { inviteMember } from "./actions";
import { MemberActions } from "./MemberActions";

export default async function EquipePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("id", user!.id)
    .single<Nutritionist>();

  if (!me) return null;

  const isOwner = me.clinic_id === me.id;

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("nutritionists")
      .select("id, full_name, crn, clinic_id")
      .eq("clinic_id", me.clinic_id)
      .order("full_name")
      .returns<Pick<Nutritionist, "id" | "full_name" | "crn" | "clinic_id">[]>(),
    isOwner
      ? supabase
          .from("clinic_invites")
          .select("*")
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
          .returns<ClinicInvite[]>()
      : Promise.resolve({ data: [] as ClinicInvite[] }),
  ]);

  if (isOwner && me.plan !== "clinica") {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">Equipe</h1>
        <p className="rounded-xl border border-warning bg-warning-soft p-4 text-sm text-warning">
          Atender com vários profissionais na mesma carteira de pacientes faz parte do plano Clínica.{" "}
          <Link href="/configuracoes" className="font-bold underline">
            Ver planos em Configurações
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">Equipe</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        {isOwner
          ? "Profissionais com acesso compartilhado aos pacientes desta clínica."
          : "Você faz parte desta clínica e compartilha a carteira de pacientes."}
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Profissionais ({members?.length ?? 0})</h2>
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
          {members?.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 last:border-none"
            >
              <div>
                <b className="block text-sm">{member.full_name}</b>
                <span className="text-xs text-[var(--ink-soft)]">CRN {member.crn || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                {member.id === me.clinic_id ? (
                  <Badge tone="success">responsável</Badge>
                ) : (
                  <Badge tone="neutral">profissional</Badge>
                )}
                {isOwner && member.id !== me.id && <MemberActions memberId={member.id} kind="member" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-semibold">Convidar profissional</h2>
            <form action={inviteMember} className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <label className="min-w-[220px] flex-1">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                  E-mail do profissional
                </span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="colega@clinica.com"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                />
              </label>
              <Button type="submit">Enviar convite</Button>
            </form>
            <p className="mt-2 text-[11px] text-[var(--ink-faint)]">
              O profissional precisa ter (ou criar) uma conta com esse mesmo e-mail para aceitar.
            </p>
          </section>

          {invites && invites.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Convites pendentes</h2>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3 last:border-none"
                  >
                    <div>
                      <b className="block text-sm">{invite.email}</b>
                      <span className="text-xs text-[var(--ink-soft)]">
                        expira em {new Date(invite.expires_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <MemberActions memberId={invite.id} kind="invite" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
