-- 2026-06-18 — Unificação de beneficiários (Fase 2/3): camada de consumo (medallion).
-- silver.beneficiario_canonico: cada pessoa do CA -> chave canônica, na ordem de confiança:
--   1) de-para MANUAL (financial.beneficiario_contaazul_map) — curadoria humana p/ nomes parecidos
--   2) DOCUMENTO (CPF/CNPJ) igual
--   3) NOME normalizado igual (consolida os duplicados óbvios automaticamente)
-- gold.pagamentos_por_beneficiario (matview): histórico/controle por pessoa (total, qtd,
--   primeiro/último pagamento, qtos cadastros do CA foram fundidos). Espelho contábil intacto —
--   só agrupa o "quem", não muda valor/categoria.
-- Refresh diário via cron 'refresh-pagamentos-por-beneficiario' (09:25 UTC).

CREATE OR REPLACE VIEW silver.beneficiario_canonico AS
SELECT
  l.bar_id,
  l.pessoa_id AS contaazul_pessoa_id,
  COALESCE(
    'B:'||m.beneficiario_id::text,
    'D:'||NULLIF(regexp_replace(COALESCE(pe.documento,''),'\D','','g'),''),
    'N:'||lower(btrim(l.pessoa_nome))
  ) AS canonical_key,
  l.pessoa_nome AS nome,
  NULLIF(regexp_replace(COALESCE(pe.documento,''),'\D','','g'),'') AS documento,
  m.beneficiario_id
FROM (SELECT DISTINCT bar_id, pessoa_id, pessoa_nome FROM bronze.bronze_contaazul_lancamentos
      WHERE pessoa_id IS NOT NULL AND pessoa_nome IS NOT NULL) l
LEFT JOIN bronze.bronze_contaazul_pessoas pe ON pe.contaazul_id = l.pessoa_id AND pe.bar_id = l.bar_id
LEFT JOIN financial.beneficiario_contaazul_map m ON m.contaazul_pessoa_id = l.pessoa_id::text AND m.bar_id = l.bar_id;

DROP MATERIALIZED VIEW IF EXISTS gold.pagamentos_por_beneficiario;
CREATE MATERIALIZED VIEW gold.pagamentos_por_beneficiario AS
SELECT
  l.bar_id,
  c.canonical_key,
  max(l.pessoa_nome)                                            AS nome,
  max(c.documento)                                             AS documento,
  count(DISTINCT l.pessoa_id)                                  AS qtd_cadastros_ca,
  count(*) FILTER (WHERE l.valor_pago > 0)                     AS qtd_pagamentos,
  COALESCE(sum(l.valor_pago) FILTER (WHERE l.valor_pago > 0),0) AS total_pago,
  min(l.data_pagamento) FILTER (WHERE l.valor_pago > 0)        AS primeiro_pgto,
  max(l.data_pagamento) FILTER (WHERE l.valor_pago > 0)        AS ultimo_pgto
FROM bronze.bronze_contaazul_lancamentos l
JOIN silver.beneficiario_canonico c ON c.bar_id=l.bar_id AND c.contaazul_pessoa_id=l.pessoa_id
WHERE l.excluido_em IS NULL AND l.tipo='DESPESA'
GROUP BY l.bar_id, c.canonical_key;
CREATE UNIQUE INDEX idx_pag_benef ON gold.pagamentos_por_beneficiario(bar_id, canonical_key);

-- cron de refresh (idempotente)
SELECT cron.unschedule('refresh-pagamentos-por-beneficiario')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-pagamentos-por-beneficiario');
SELECT cron.schedule('refresh-pagamentos-por-beneficiario', '25 9 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY gold.pagamentos_por_beneficiario$$);
