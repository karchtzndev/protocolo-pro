"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "▦" },
      { href: "/crm", label: "CRM", icon: "🗂" },
      { href: "/pacientes", label: "Pacientes", icon: "◔" },
      { href: "/agendamentos", label: "Agendamentos", icon: "📅" },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { href: "/receitas", label: "Receitas", icon: "🍳" },
      { href: "/broadcast", label: "Broadcast", icon: "📣" },
      { href: "/planos", label: "Planos", icon: "💳" },
    ],
  },
  {
    label: "Conta",
    items: [
      { href: "/equipe", label: "Equipe", icon: "👥" },
      { href: "/links", label: "Links de Pacientes", icon: "⛓" },
      { href: "/configuracoes", label: "Configurações", icon: "⚙" },
    ],
  },
];

const allItems = sections.flatMap((s) => s.items);
// Os 4 mais usados no dia a dia ficam fixos na barra do celular; o resto
// entra na aba "Mais" — 10 itens não cabem numa barra de navegação de telefone.
const MOBILE_PRIMARY = ["/dashboard", "/pacientes", "/agendamentos", "/crm"];
const mobilePrimaryItems = allItems.filter((i) => MOBILE_PRIMARY.includes(i.href));
const mobileMoreItems = allItems.filter((i) => !MOBILE_PRIMARY.includes(i.href));

export function Sidebar({
  nutritionistName,
  crn,
  planLabel,
}: {
  nutritionistName: string;
  crn: string;
  planLabel: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = mobileMoreItems.some((i) => pathname.startsWith(i.href));

  return (
    <>
      <aside className="hidden md:flex w-[220px] shrink-0 flex-col gap-1 bg-brand-strong text-brand-on p-4">
        <div className="flex items-center gap-2.5 pb-4 mb-1 border-b border-white/10">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-white/15 font-display text-sm font-bold">
            {initials(nutritionistName)}
          </div>
          <div className="min-w-0">
            <b className="block truncate text-sm font-semibold">{nutritionistName}</b>
            <span className="block text-[11px] opacity-65">{crn}</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-3.5 overflow-y-auto py-1">
          {sections.map((section) => (
            <div key={section.label}>
              <span className="mb-1 block px-2.5 text-[10px] font-bold uppercase tracking-wider opacity-50">
                {section.label}
              </span>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition ${
                        active ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="w-[18px] shrink-0 text-center text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="rounded-lg border border-white/20 bg-white/5 p-2.5 text-[11.5px]">
          <b className="block text-xs mb-0.5">{planLabel}</b>
        </div>
      </aside>

      {moreOpen && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-[64px] left-0 right-0 rounded-t-2xl bg-[var(--surface)] p-3 pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-[var(--border)]" />
            <div className="grid grid-cols-3 gap-1.5">
              {mobileMoreItems.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] font-semibold ${
                      active ? "bg-accent-soft text-accent-strong" : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="text-center leading-tight">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-stretch justify-around border-t border-[var(--border-soft)] bg-[var(--surface)] px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {mobilePrimaryItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[10.5px] font-semibold ${
                active ? "text-brand" : "text-[var(--ink-faint)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5 text-[10.5px] font-semibold ${
            moreOpen || moreActive ? "text-brand" : "text-[var(--ink-faint)]"
          }`}
        >
          <span className="text-base">{moreOpen ? "✕" : "⋯"}</span>
          Mais
        </button>
      </nav>
    </>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
