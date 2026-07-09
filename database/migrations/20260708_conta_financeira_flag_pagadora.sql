-- Flag "pagadora": conta válida como pagadora de PIX/pagamentos no Zykor.
-- Restringe o dropdown "Conta Pagadora" às contas operacionais de cada bar
-- (fora investimentos/aplicações/contas de outro CNPJ). Sobrevive ao sync do CA
-- (o upsert não toca nesta coluna).
ALTER TABLE bronze.bronze_contaazul_contas_financeiras
  ADD COLUMN IF NOT EXISTS pagadora boolean NOT NULL DEFAULT false;

UPDATE bronze.bronze_contaazul_contas_financeiras SET pagadora = true
WHERE contaazul_id IN (
  -- bar 3 (Ordinário): OrdiBar Inter, Ordinário BB, Ordinário Inter
  '86213fcf-52aa-4c2e-9359-79a8641397a2',
  '5e0290a7-87ed-4a31-ac8d-88f107d20d8a',
  '609d7158-ffe4-4df6-9270-fc742b288dd7',
  -- bar 4 (Descubra): Descubra Inter, DSCBR Inter, Descubra BB
  '1742dbb6-0ef2-443a-96ac-6ac0c1d5174a',
  'bd5e3685-b9eb-49b0-a8f3-30dba4598a6c',
  '113908af-35fb-447e-a9c4-9532e9f289ba'
);
