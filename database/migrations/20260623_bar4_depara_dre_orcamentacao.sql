-- Bar 4 (Deboche): completa o de-para de DRE e Orçamentação.
-- Os 2 de-paras são GLOBAIS (por nome de categoria, sem bar_id). O bar 4 usava
-- alguns nomes próprios que não estavam mapeados → sumiam dos relatórios.
-- Aplicado em produção 2026-06-23 via MCP. Mapeamento espelha o bar 3.
--
-- ⚠️ REVISAR com o sócio: "Despesas Grupo Bizu" foi posta em Despesas
--    Administrativas por padrão (é custo de grupo/universidade) — reclassificar
--    se for não-operacional/inter-empresa.

-- DRE (financial.dre_categoria_macro) — só faltavam 2
insert into financial.dre_categoria_macro (categoria_nome, categoria_macro, ordem_macro, ordem_sub, sinal, observacao) values
  ('Administrativo Local', 'Despesas Administrativas', 6, 6, -1, 'bar 4 Deboche (análogo a Administrativo Ordinário)'),
  ('Despesas Grupo Bizu', 'Despesas Administrativas', 6, 7, -1, 'bar 4 — REVISAR classificação (grupo/Bizu)')
on conflict do nothing;

-- Orçamentação (meta.categoria_zykor_map) — faltavam 8
insert into meta.categoria_zykor_map (categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, observacao) values
  ('CUSTO COMIDAS', 'Custo Comida', 'Custo insumos (CMV)', 'despesa', false, 'bar 4'),
  ('Administrativo Local', 'Administrativo Local', 'Despesas Administrativas', 'despesa', false, 'bar 4'),
  ('Despesas Financeiras', 'Despesas Financeiras', 'Não Operacionais', 'despesa', false, 'bar 4'),
  ('Outros Sócios', 'Outros Sócios', 'Não Operacionais', 'despesa', false, 'bar 4'),
  ('[Investimento] Outros Investimentos', '[Investimento] Outros Investimentos', null, null, true, 'bar 4 — investimento ignorado no resultado'),
  ('Despesas Grupo Bizu', 'Despesas Grupo Bizu', 'Despesas Administrativas', 'despesa', false, 'bar 4 — REVISAR classificação'),
  ('LOCACOES OPERACAO', 'Locações Operação', 'Despesas Operacionais', 'despesa', false, 'bar 4'),
  ('ACESSORIOS SALAO', 'Acessórios Salão', 'Despesas Operacionais', 'despesa', false, 'bar 4')
on conflict do nothing;

-- Depois do de-para da Orçamentação, refrescar o gold:
--   select public.cron_refresh_gold_orcamentacao_diario();
-- (DRE lê bronze ao vivo, não precisa refresh.)
