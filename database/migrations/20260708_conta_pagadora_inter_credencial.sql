-- A CONTA PAGADORA determina a credencial Inter de onde sai o PIX. Antes usava o padrão
-- do bar p/ qualquer conta (2 pagamentos saíram ambos do Ordinário Inter). Agora cada conta
-- Inter aponta pra sua credencial (api_credentials.id).
ALTER TABLE bronze.bronze_contaazul_contas_financeiras
  ADD COLUMN IF NOT EXISTS inter_credencial_id integer;

UPDATE bronze.bronze_contaazul_contas_financeiras SET inter_credencial_id = 150
  WHERE contaazul_id = '609d7158-ffe4-4df6-9270-fc742b288dd7';  -- Ordinário Inter → cred 150
UPDATE bronze.bronze_contaazul_contas_financeiras SET inter_credencial_id = 151
  WHERE contaazul_id = '86213fcf-52aa-4c2e-9359-79a8641397a2';  -- OrdiBar Inter → cred 151
UPDATE bronze.bronze_contaazul_contas_financeiras SET inter_credencial_id = 152
  WHERE contaazul_id IN (
    '1742dbb6-0ef2-443a-96ac-6ac0c1d5174a',  -- Descubra Inter → cred 152
    'bd5e3685-b9eb-49b0-a8f3-30dba4598a6c'   -- DSCBR Inter → cred 152
  );
