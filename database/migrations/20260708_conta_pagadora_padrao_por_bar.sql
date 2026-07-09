-- Conta pagadora PADRÃO por bar (pré-selecionada na tela, mas trocável).
ALTER TABLE bronze.bronze_contaazul_contas_financeiras
  ADD COLUMN IF NOT EXISTS pagadora_padrao boolean NOT NULL DEFAULT false;

-- Garante no máximo 1 padrão por bar: zera antes de setar.
UPDATE bronze.bronze_contaazul_contas_financeiras SET pagadora_padrao = false WHERE bar_id IN (3,4);
UPDATE bronze.bronze_contaazul_contas_financeiras SET pagadora_padrao = true
WHERE contaazul_id IN (
  '609d7158-ffe4-4df6-9270-fc742b288dd7',  -- bar 3: Ordinário Inter
  '1742dbb6-0ef2-443a-96ac-6ac0c1d5174a'   -- bar 4: Descubra Inter
);
