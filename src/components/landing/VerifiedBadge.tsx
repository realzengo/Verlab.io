function Rivet() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border border-[#a1a1a1] bg-[#c9c9c9]">
      <span className="h-1 w-1 rounded-full bg-[#666666]" />
    </span>
  );
}

export function VerifiedBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[10px] border border-[#bababa] px-3 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.25)] ${className}`}
      style={{
        background:
          "linear-gradient(204deg, rgb(41,41,41) 3%, rgb(102,102,102) 51.6%, rgb(41,41,41) 100%)",
      }}
    >
      <Rivet />
      <span className="text-[13px] font-medium leading-[1.4em] tracking-[-0.03em] text-white sm:text-[15px]">
        {label}
      </span>
      <Rivet />
    </div>
  );
}
