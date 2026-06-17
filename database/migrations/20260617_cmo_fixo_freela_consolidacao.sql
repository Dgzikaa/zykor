-- 2026-06-17 — Orçamentação: Mão-de-Obra consolidada em 2 linhas (CMO Fixo / CMO Freela)
--
-- Decisão do sócio: o bloco Mão-de-Obra vira só 2 linhas na Orçamentação:
--   CMO Fixo   = CUSTO-EMPRESA FUNCIONÁRIOS + ADICIONAIS + ALIMENTAÇÃO + PRÓ-LABORE
--   CMO Freela = FREELA Atendimento/Bar/Cozinha/Limpeza/Brigadista/Segurança
--
-- O REALIZADO já agrega sozinho (a estrutura no orcamentacao-service.ts soma as
-- mesmas categorias do gold). Aqui migramos o PLANEJADO/PROJETADO das linhas
-- antigas (somando por bar/ano/mês) pras 2 novas, pra não perder o planejamento.

INSERT INTO meta.orcamento_planilha (bar_id, ano, mes, categoria_nome, valor_planejado, valor_projetado, fonte_planejado, fonte_projetado, atualizado_em)
SELECT bar_id, ano, mes, 'CMO Fixo',
       SUM(COALESCE(valor_planejado,0)), SUM(COALESCE(valor_projetado,0)), 'manual','manual', NOW()
FROM meta.orcamento_planilha
WHERE categoria_nome IN ('CUSTO-EMPRESA FUNCIONÁRIOS','ADICIONAIS','ALIMENTAÇÃO','PRO LABORE')
GROUP BY bar_id, ano, mes
ON CONFLICT (bar_id, ano, mes, categoria_nome) DO UPDATE SET
  valor_planejado = EXCLUDED.valor_planejado, valor_projetado = EXCLUDED.valor_projetado, atualizado_em = NOW();

INSERT INTO meta.orcamento_planilha (bar_id, ano, mes, categoria_nome, valor_planejado, valor_projetado, fonte_planejado, fonte_projetado, atualizado_em)
SELECT bar_id, ano, mes, 'CMO Freela',
       SUM(COALESCE(valor_planejado,0)), SUM(COALESCE(valor_projetado,0)), 'manual','manual', NOW()
FROM meta.orcamento_planilha
WHERE categoria_nome IN ('FREELA ATENDIMENTO','FREELA BAR','FREELA COZINHA','FREELA LIMPEZA','FREELA BRIGADISTA','FREELA SEGURANÇA')
GROUP BY bar_id, ano, mes
ON CONFLICT (bar_id, ano, mes, categoria_nome) DO UPDATE SET
  valor_planejado = EXCLUDED.valor_planejado, valor_projetado = EXCLUDED.valor_projetado, atualizado_em = NOW();
