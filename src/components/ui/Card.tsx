export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(27,33,29,.06),0_4px_14px_rgba(27,33,29,.06)] ${className}`}
    >
      {children}
    </div>
  );
}
