"use client";
// Origem: 21st.dev · sh20raj/cyberpunk-hud-radar (canvas, varredura + ping), adaptado ao
// tema claro da bLOw e alimentado com leads reais do PipeRun.
//
// Leitura: cada SETOR é um lugar de inscrição (Form/LP/campanha); a COR é o canal
// (Meta pago, Meta orgânico, Google, sem UTM); o RAIO é a idade — lead recém-chegado fica
// na borda e vai se aproximando do centro conforme envelhece.

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { parsePipeRunDate, type LeadRecente } from "@/lib/leads-recentes";
import { cn } from "@/lib/utils";

export const CHANNEL_COLORS: Record<string, string> = {
  "Meta (pago)": "#D74015",
  "Meta (orgânico)": "#EDA100",
  Google: "#2A78D6",
  "Sem UTM": "#8A8F98",
  "Outra origem": "#375542",
};
const colorFor = (origin: string) => CHANNEL_COLORS[origin] ?? "#375542";

const MAX_BLIPS = 400;
/** Limite de pontos por setor: importações em massa viram uma mancha ilegível. */
const MAX_PER_SECTOR = 45;
const MAX_SECTORS = 8;

interface Blip {
  lead: LeadRecente;
  x: number; // 0..1 relativo ao raio
  y: number;
  sector: number;
  fresh: boolean;
  pulse: number;
  theta: number;
}

function hash01(n: number, salt: number): number {
  const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function timeAgo(createdAt: string): string {
  const min = Math.max(
    0,
    Math.round((Date.now() - parsePipeRunDate(createdAt).getTime()) / 60_000),
  );
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export interface RadarSector {
  label: string;
  total: number;
}

export function LeadRadar({
  leads,
  onSelect,
  className,
}: {
  leads: LeadRecente[];
  onSelect?: (lead: LeadRecente) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [hover, setHover] = useState<{ blip: Blip; px: number; py: number } | null>(null);

  const { sectors, blips } = useMemo(() => {
    const list = leads.slice(0, MAX_BLIPS);
    const counts = new Map<string, number>();
    for (const l of list) counts.set(l.inscricao, (counts.get(l.inscricao) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked.slice(0, MAX_SECTORS - 1);
    const restTotal = ranked.slice(MAX_SECTORS - 1).reduce((s, [, n]) => s + n, 0);
    const sectors: RadarSector[] = [
      ...top.map(([label, total]) => ({ label, total })),
      ...(restTotal > 0 ? [{ label: "Outros", total: restTotal }] : []),
    ];
    const index = new Map(top.map(([label], i) => [label, i] as const));
    const k = Math.max(1, sectors.length);
    const now = Date.now();
    // Raio pela posição na fila (mais recente → borda), não pela idade absoluta: importações
    // em massa colocam centenas de leads no mesmo minuto e amontoariam tudo no centro.
    const byRecency = [...list].sort(
      (a, b) => parsePipeRunDate(b.createdAt).getTime() - parsePipeRunDate(a.createdAt).getTime(),
    );

    const shown = new Map<number, number>();
    const visible = byRecency.filter((lead) => {
      const sector = index.get(lead.inscricao) ?? sectors.length - 1;
      const n = shown.get(sector) ?? 0;
      shown.set(sector, n + 1);
      return n < MAX_PER_SECTOR;
    });
    const rankVisible = new Map(visible.map((l, i) => [l.id, i] as const));
    const blips: Blip[] = visible.map((lead) => {
      const sector = index.get(lead.inscricao) ?? sectors.length - 1;
      const age = Math.max(0, now - parsePipeRunDate(lead.createdAt).getTime());
      const radius =
        0.14 + 0.8 * (1 - (rankVisible.get(lead.id) ?? 0) / Math.max(1, visible.length - 1));
      const span = (Math.PI * 2) / k;
      const theta = -Math.PI / 2 + sector * span + span * (0.12 + 0.76 * hash01(lead.id, 1));
      return {
        lead,
        sector,
        x: Math.cos(theta) * radius,
        y: Math.sin(theta) * radius,
        fresh: age < 10 * 60_000,
        pulse: 0.2,
        theta,
      };
    });
    return { sectors, blips };
  }, [leads]);

  const blipsRef = useRef<Blip[]>(blips);
  blipsRef.current = blips;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.floor(el.getBoundingClientRect().width)));
    ro.observe(el);
    setSize(Math.floor(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 50) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.46;
    const k = Math.max(1, sectors.length);
    let angle = -Math.PI / 2;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const dark = document.documentElement.classList.contains("dark");
      const grid = dark ? "rgba(255,255,255,0.20)" : "rgba(55,85,66,0.22)";
      const label = dark ? "rgba(255,255,255,0.75)" : "rgba(55,85,66,0.7)";

      // Anéis de alcance
      ctx.lineWidth = 1;
      ctx.strokeStyle = grid;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (R / 4) * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Divisórias dos setores + numeração na borda
      ctx.fillStyle = label;
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let s = 0; s < k; s++) {
        const a0 = -Math.PI / 2 + (s * Math.PI * 2) / k;
        const a1 = -Math.PI / 2 + ((s + 0.5) * Math.PI * 2) / k;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * Math.cos(a0), cy + R * Math.sin(a0));
        ctx.stroke();
        if (k > 1 || sectors.length > 0) {
          ctx.fillText(String(s + 1), cx + (R + 13) * Math.cos(a1), cy + (R + 13) * Math.sin(a1));
        }
      }

      // Cone de varredura
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      grad.addColorStop(0, "rgba(215,64,21,0.30)");
      grad.addColorStop(1, "rgba(215,64,21,0.02)");
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, angle - 0.55, angle);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
      ctx.strokeStyle = "#D74015";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Blips
      for (const b of blipsRef.current) {
        const bx = cx + b.x * R;
        const by = cy + b.y * R;
        let diff = (angle - b.theta) % (Math.PI * 2);
        if (diff < 0) diff += Math.PI * 2;
        if (diff < 0.18) b.pulse = 1;
        else b.pulse = Math.max(0.25, b.pulse - 0.012);

        const color =
          dark && b.lead.origin === "Outra origem" ? "#7FB394" : colorFor(b.lead.origin);
        const r = b.fresh ? 5 : 3.5;
        if (b.pulse > 0.4 || b.fresh) {
          const wave = b.fresh ? (frame % 90) / 90 : 1 - b.pulse;
          ctx.beginPath();
          ctx.arc(bx, by, r + wave * 16, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = Math.max(0, 0.55 - wave * 0.55);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.45 + b.pulse * 0.55;
        ctx.shadowColor = color;
        ctx.shadowBlur = b.pulse * 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Centro
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#9FC4AA" : "#375542";
      ctx.fill();

      if (!reduce) {
        angle += 0.018;
        frame += 1;
        raf = requestAnimationFrame(draw);
      }
    };
    let raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, sectors, reduce]);

  function nearest(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const R = size * 0.46;
    let best: { blip: Blip; d: number } | null = null;
    for (const b of blipsRef.current) {
      const d = Math.hypot(size / 2 + b.x * R - px, size / 2 + b.y * R - py);
      if (d < 11 && (!best || d < best.d)) best = { blip: b, d };
    }
    return best ? { blip: best.blip, px, py } : null;
  }

  const channels = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of blips) m.set(b.lead.origin, (m.get(b.lead.origin) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [blips]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]",
        className,
      )}
    >
      <div ref={wrapRef} className="relative mx-auto aspect-square w-full max-w-[34rem]">
        <canvas
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="cursor-crosshair"
          role="img"
          aria-label={`Radar com ${blips.length} leads por local de inscrição`}
          onPointerMove={(e) => setHover(nearest(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const hit = nearest(e);
            if (hit) onSelect?.(hit.blip.lead);
          }}
        />
        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-56 rounded-xl border border-border bg-popover p-3 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(8, hover.px + 14), Math.max(8, size - 232)),
              top: Math.min(Math.max(8, hover.py + 14), Math.max(8, size - 110)),
            }}
          >
            <p className="truncate text-sm font-semibold">{hover.blip.lead.title}</p>
            <p className="mt-0.5 text-muted-foreground">
              {hover.blip.lead.inscricao} · {timeAgo(hover.blip.lead.createdAt)}
            </p>
            <p className="mt-1">
              <span className="font-medium">{hover.blip.lead.stageName}</span>
              <span className="text-muted-foreground"> · {hover.blip.lead.pipelineName}</span>
            </p>
            {(hover.blip.lead.cidade || hover.blip.lead.uf) && (
              <p className="text-muted-foreground">
                {[hover.blip.lead.cidade, hover.blip.lead.uf].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-5 text-sm">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Onde se inscreveram
          </p>
          <ol className="space-y-1.5">
            {sectors.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.total}</span>
              </li>
            ))}
            {sectors.length === 0 && (
              <li className="text-muted-foreground">Sem leads no período.</li>
            )}
          </ol>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Canal (cor)
          </p>
          <ul className="space-y-1.5">
            {channels.map(([origin, total]) => (
              <li key={origin} className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: colorFor(origin) }}
                />
                <span className="min-w-0 flex-1 truncate">{origin}</span>
                <span className="tabular-nums text-muted-foreground">{total}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Na borda: mais recentes. Para dentro: mais antigos. Anel pulsando: menos de 10 min.
        </p>
      </div>
    </div>
  );
}
