"use client";

import { useState } from "react";

export function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      {/* Abas com underline — desktop/tablet */}
      <div className="hidden sm:flex gap-5 border-b border-[var(--border-soft)] mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`pb-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
              active === t.id
                ? "text-brand border-brand"
                : "text-[var(--ink-faint)] border-transparent hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Abas viram botões — mobile */}
      <div className="flex sm:hidden flex-wrap gap-2 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              active === t.id
                ? "bg-brand text-brand-on border-brand"
                : "border-[var(--border)] text-[var(--ink-soft)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab?.content}
    </div>
  );
}
