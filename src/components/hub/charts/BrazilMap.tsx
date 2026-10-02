"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";

import { BR_MAP_SIZE, BR_UF_CENTERS, BR_UF_PATHS } from "@/lib/brasil-map-data";
import type { LeadRecente } from "@/lib/leads-recentes";
import { cn } from "@/lib/utils";

const REGIONS = {
  Norte: ["AC", "AM", "AP", "PA", "RO", "RR", "TO"],
  Nordeste: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MS", "MT"],
  Sudeste: ["ES", "MG", "RJ", "SP"],
  Sul: ["PR", "RS", "SC"],
} as const;
type RegionName = keyof typeof REGIONS;

const REGION_OF: Record<string, RegionName> = Object.fromEntries(
  (Object.entries(REGIONS) as Array<[RegionName, readonly string[]]>).flatMap(([region, ufs]) =>
    ufs.map((uf) => [uf, region] as const),
  ),
);

const UF_NAMES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

const int = (n: number) => n.toLocaleString("pt-BR");

interface UfStat {
  total: number;
  sql: number;
  cities: Map<string, number>;
}

function fillFor(total: number, max: number, dimmed: boolean) {
  if (total === 0) return "var(--color-muted)";
  // raiz quadrada: um estado gigante (SP) não apaga a diferença entre os pequenos
  const pct = Math.round(25 + 75 * Math.sqrt(total / max));
  return `color-mix(in oklab, var(--color-primary) ${dimmed ? Math.round(pct * 0.45) : pct}%, var(--color-muted))`;
}

/** Mapa do Brasil por estado: cor = quantidade de leads. Clicar num estado abre a região
 * dele (ranking dos estados) e as cidades do estado; as abas de região fazem o mesmo. */
export function BrazilMap({ leads }: { leads: LeadRecente[] }) {
  const reduce = useReducedMotion();
  const [selectedUf, setSelectedUf] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionName | null>(null);
  const [hoverUf, setHoverUf] = useState<string | null>(null);

  const { stats, withUf, withoutUf } = useMemo(() => {
    const m = new Map<string, UfStat>();
    let without = 0;
    for (const l of leads) {
      const uf = l.uf && UF_NAMES[l.uf] ? l.uf : null;
      if (!uf) {
        without += 1;
        continue;
      }
      const cur = m.get(uf) ?? { total: 0, sql: 0, cities: new Map<string, number>() };
      cur.total += 1;
      if (l.isSql) cur.sql += 1;
      const city = l.cidade?.trim();
      if (city) cur.cities.set(city, (cur.cities.get(city) ?? 0) + 1);
      m.set(uf, cur);
    }
    return { stats: m, withUf: leads.length - without, withoutUf: without };
  }, [leads]);

  const max = Math.max(1, ...[...stats.values()].map((s) => s.total));
  const region: RegionName | null = selectedUf ? REGION_OF[selectedUf]! : selectedRegion;

  const regionTotals = useMemo(
    () =>
      (Object.keys(REGIONS) as RegionName[]).map((name) => ({
        name,
        total: REGIONS[name].reduce((s, uf) => s + (stats.get(uf)?.total ?? 0), 0),
      })),
    [stats],
  );

  const regionRows = region
    ? REGIONS[region]
        .map((uf) => ({ uf, total: stats.get(uf)?.total ?? 0 }))
        .sort((a, b) => b.total - a.total)
    : [];
  const regionMax = Math.max(1, ...regionRows.map((r) => r.total));

  const selectedStat = selectedUf ? stats.get(selectedUf) : undefined;
  const cities = selectedStat
    ? [...selectedStat.cities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  const pickUf = (uf: string) => {
    setSelectedRegion(null);
    setSelectedUf((cur) => (cur === uf ? null : uf));
  };
  const pickRegion = (name: RegionName) => {
    setSelectedUf(null);
    setSelectedRegion((cur) => (cur === name ? null : name));
  };
  const clear = () => {
    setSelectedUf(null);
    setSelectedRegion(null);
  };

  const hover = hoverUf ?? selectedUf;
  const hoverStat = hover ? stats.get(hover) : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <div>
        <div className="relative mx-auto w-full max-w-[26rem]">
          <svg
            viewBox={`0 0 ${BR_MAP_SIZE.width} ${BR_MAP_SIZE.height}`}
            className="h-auto w-full"
            role="group"
            aria-label="Mapa do Brasil com leads por estado"
          >
            {Object.entries(BR_UF_PATHS).map(([uf, d]) => {
              const total = stats.get(uf)?.total ?? 0;
              const active = selectedUf === uf;
              const dimmed = region !== null && REGION_OF[uf] !== region;
              return (
                <motion.path
                  key={uf}
                  d={d}
                  fill={fillFor(total, max, dimmed)}
                  stroke={active ? "var(--color-foreground)" : "var(--color-card)"}
                  strokeWidth={active ? 2.2 : 1}
                  strokeLinejoin="round"
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`${UF_NAMES[uf]}: ${int(total)} leads`}
                  className="cursor-pointer outline-none transition-[filter] hover:brightness-110 focus-visible:brightness-125"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  onMouseEnter={() => setHoverUf(uf)}
                  onMouseLeave={() => setHoverUf(null)}
                  onFocus={() => setHoverUf(uf)}
                  onBlur={() => setHoverUf(null)}
                  onClick={() => pickUf(uf)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      pickUf(uf);
                    }
                  }}
                />
              );
            })}
            {Object.entries(BR_UF_CENTERS).map(([uf, [x, y]]) =>
              (stats.get(uf)?.total ?? 0) > 0 ? (
                <text
                  key={uf}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none fill-foreground text-[9px] font-semibold"
                >
                  {uf}
                </text>
              ) : null,
            )}
          </svg>
        </div>
        <p className="mt-2 min-h-5 text-center text-sm text-muted-foreground">
          {hover ? (
            <>
              <b className="text-foreground">{UF_NAMES[hover]}</b> · {int(hoverStat?.total ?? 0)}{" "}
              leads
            </>
          ) : (
            "Passe o mouse ou clique em um estado"
          )}
        </p>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-2">
          {regionTotals.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => pickRegion(r.name)}
              aria-pressed={region === r.name}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                region === r.name
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {r.name} <span className="tabular-nums opacity-80">{int(r.total)}</span>
            </button>
          ))}
          {region && (
            <button
              type="button"
              onClick={clear}
              className="rounded-full px-3 py-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>

        {region ? (
          <div className="space-y-5">
            <ul className="space-y-2">
              {regionRows.map((r) => (
                <li key={r.uf}>
                  <button
                    type="button"
                    onClick={() => pickUf(r.uf)}
                    className={cn(
                      "grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-lg px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
                      selectedUf === r.uf && "bg-muted",
                    )}
                  >
                    <span className="font-semibold">{r.uf}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${(r.total / regionMax) * 100}%` }}
                      />
                    </span>
                    <span className="font-semibold tabular-nums">{int(r.total)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedUf && (
              <div className="rounded-xl border border-border/70 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h4 className="font-display text-sm font-semibold">{UF_NAMES[selectedUf]}</h4>
                  <span className="text-xs text-muted-foreground">
                    {int(selectedStat?.total ?? 0)} leads · {int(selectedStat?.sql ?? 0)} SQL
                  </span>
                </div>
                {cities.length ? (
                  <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {cities.map(([city, n]) => (
                      <li key={city} className="flex justify-between gap-3">
                        <span className="truncate text-muted-foreground">{city}</span>
                        <span className="font-medium tabular-nums">{n}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma cidade informada.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <b className="text-foreground">{int(withUf)}</b> leads com estado informado
              {withoutUf > 0 && <> · {int(withoutUf)} sem estado no PipeRun</>}.
            </p>
            <p>Clique em um estado para abrir a região e as cidades dele.</p>
          </div>
        )}
      </div>
    </div>
  );
}
