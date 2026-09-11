"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/pacientes", label: "Pacientes", icon: "◔" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙" },
  { href: "/links", label: "Links de Pacientes", icon: "⛓" },
];

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

  return (
    <>
      <aside className="hidden md:flex w-[212px] shrink-0 flex-col gap-0.5 bg-brand-strong text-brand-on p-4">
        <div className="flex items-center gap-2.5 pb-4 mb-3 border-b border-white/10">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-white/15 font-display text-sm font-bold">
            {initials(nutritionistName)}
          </div>
          <div>
            <b className="block text-sm font-semibold">{nutritionistName}</b>
            <span className="block text-[11px] opacity-65">{crn}</span>
          </div>
        </div>

        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium ${
                active ? "bg-white/15 font-semibold text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="w-[18px] text-center text-sm">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="flex-1" />
        <div className="rounded-lg border border-white/20 bg-white/5 p-2.5 text-[11.5px]">
          <b className="block text-xs mb-0.5">{planLabel}</b>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex justify-around border-t border-[var(--border-soft)] bg-[var(--surface)] px-1 pb-2 pt-1.5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10.5px] font-semibold ${
                active ? "text-brand" : "text-[var(--ink-faint)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
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
