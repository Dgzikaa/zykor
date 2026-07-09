-- Modelo CARTÃO do ContaHub (desde 06/07/2026): o telefone/nome do cliente passou a vir em
-- cht_fonea/cht_nome (antes era cli_fone/cli_nome). cht_fonea vem sem formato e com o país:
-- "556191815680" = 55 + DDD 61 + 91815680 (SEM o 9º dígito). ~70% dos pagamentos passaram a vir
-- SÓ com cht_fonea → clientes estavam se perdendo (clientes ativos subcontados).
--
-- Guardamos os campos crus; o contahub-processor normaliza cht_fonea pro padrão cli_fone
-- (61-991815680, prepend "9") e PREENCHE cli_fone/cliente quando vazios — assim todo o pipeline
-- que já usa cli_fone (clientes ativos, match) contabiliza certinho, sem mudar mais nada.
-- Backfill 06–08/07 já reprocessado; de hoje em diante o sync diário faz automático.
ALTER TABLE bronze.bronze_contahub_financeiro_pagamentosrecebidos
  ADD COLUMN IF NOT EXISTS cht_fonea text,
  ADD COLUMN IF NOT EXISTS cht_nome  text;
