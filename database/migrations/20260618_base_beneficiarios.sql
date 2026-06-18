-- 2026-06-18 — Base-mestre de beneficiários (fundação da automação de pagamentos).
-- O Conta Azul não guarda PIX e tem fornecedores duplicados/sem CPF; a integração é
-- pós-mar/2025, então NÃO dá pra gravar PIX/dados bancários no CA via API. Logo a fonte
-- de verdade de pagamentos (PIX, CPF, vínculo, histórico por pessoa) vive no Zykor.
--
-- Modelo (medallion respeitado): OPERACIONAL no schema de domínio (financial); a parte
-- ANALÍTICA/consumo (silver.beneficiario_unificado + gold.pagamentos_por_beneficiario)
-- vem depois, lendo daqui + do bronze do CA. Espelho contábil intacto: a unificação NÃO
-- altera valor/categoria/competência — só agrupa o "quem".

CREATE TABLE IF NOT EXISTS financial.beneficiarios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bar_id              integer NOT NULL,
  nome                text NOT NULL,
  cpf_cnpj            text,
  tipo                text NOT NULL DEFAULT 'fornecedor',  -- freela | fornecedor | socio | outro
  funcao              text,
  chave_pix           text,
  tipo_chave          text,
  valor_padrao        numeric(12,2),
  categoria_id        text,
  categoria_nome      text,
  contaazul_pessoa_id text,                                 -- fornecedor canônico no CA
  ativo               boolean NOT NULL DEFAULT true,
  observacao          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_benef_bar ON financial.beneficiarios(bar_id, ativo, nome);
CREATE UNIQUE INDEX IF NOT EXISTS idx_benef_doc ON financial.beneficiarios(bar_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND btrim(cpf_cnpj) <> '';

-- De-para: vários pessoa_id do CA (duplicados) -> 1 beneficiário canônico (centraliza histórico).
CREATE TABLE IF NOT EXISTS financial.beneficiario_contaazul_map (
  bar_id              integer NOT NULL,
  contaazul_pessoa_id text NOT NULL,
  beneficiario_id     uuid NOT NULL REFERENCES financial.beneficiarios(id) ON DELETE CASCADE,
  origem              text DEFAULT 'manual',                -- manual | auto_nome | auto_doc | auto_pix
  criado_em           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bar_id, contaazul_pessoa_id)
);
CREATE INDEX IF NOT EXISTS idx_benef_map_benef ON financial.beneficiario_contaazul_map(beneficiario_id);
