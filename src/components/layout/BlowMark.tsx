import { cn } from "@/lib/utils";

/** Marca do hub: o anel laranja da bLOw (o "O" do logo) com um ponto de radar no centro. */
export function BlowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="#D74015" strokeWidth="8" />
      <circle cx="32" cy="32" r="6" fill="#375542" className="origin-center animate-pulse" />
    </svg>
  );
}
