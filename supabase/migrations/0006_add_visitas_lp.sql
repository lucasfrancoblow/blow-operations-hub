-- Visitas na landing page (ação "landing_page_view" do Meta Ads) — já era calculado
-- no workflow extrair-dados-meta, mas nunca chegava a ser gravado aqui. Junto com
-- cliques_link (já existe) dá pra derivar Connect Rate e CPV no hub, do jeito que
-- CPL/CPQL/CPRA já são derivados de resultados/valor_usado.

alter table ad_metrics_daily
  add column if not exists visitas_lp numeric;
