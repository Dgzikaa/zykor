-- Orçamentação: linha "Contratos" (Não Operacionais) vira "Contratos Cashback Mensal"
-- e passa a PUXAR do Conta Azul (antes só vinha do dre_manual / manual).
--
-- Causa: as categorias reais do CA ("Contrato Cashback Mensal" no bar 3 / "Contratos
-- Cashback Mensal" no bar 4) não estavam no de-para meta.categoria_zykor_map → ficavam
-- desmapeadas no gold (categoria_zykor = nome cru, bloco NULL) e não somavam em CONTRATOS.
--
-- Fix em 3 partes (frontend: sub ganha gold:['CONTRATOS'] no orcamentacao-service.ts):
--   1) de-para: mapear as categorias reais do CA -> CONTRATOS (Não Operacionais, receita)
--   2) renomear a planilha (preserva planejado/projetado)
--   3) refresh do gold (público.refresh_orcamento_gold por bar) — feito via MCP no período 2024-12..2026-12

-- 1) de-para
insert into meta.categoria_zykor_map (categoria_ca, categoria_zykor, bloco_dre, tipo_zykor, ignorar, bar_id)
values
  ('Contrato Cashback Mensal',  'CONTRATOS', 'Não Operacionais', 'receita', false, null),
  ('Contratos Cashback Mensal', 'CONTRATOS', 'Não Operacionais', 'receita', false, null)
on conflict do nothing;

-- 2) planilha: renomeia a categoria (planejado/projetado seguem com o novo nome)
update orcamento_planilha
   set categoria_nome = 'Contratos Cashback Mensal'
 where categoria_nome = 'Contratos' and bar_id in (3,4);

-- 3) refresh (rodar após o de-para):
--   select public.refresh_orcamento_gold(3, '2024-12-01', '2026-12-31');
--   select public.refresh_orcamento_gold(4, '2024-12-01', '2026-12-31');