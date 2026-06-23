-- DFC do Deboche (bar 4): garante o grupo_dfc de cada categoria conforme o sócio.
-- O de-para meta.categoria_dfc_map é GLOBAL e o join é case-insensitive mas
-- SENSÍVEL A ACENTO — vários nomes do Deboche não batiam (CUSTO COMIDAS ≠ Custo
-- Comida; SALÁRIO FUNCIONÁRIOS ≠ SALARIO FUNCIONARIOS; UTENSILIOS ≠ Utensílios)
-- e sumiam do DFC. grupo_dfc='AJUSTE' é excluído do fluxo de caixa.
-- Aplicado em produção 2026-06-23 via MCP. DFC lê ao vivo (RPC) — sem refresh.
--
-- NOTA: 'Despesas Grupo Bizu' = AJUSTE no DFC (excluído do caixa) por decisão do
--       sócio, embora no DRE/Orçamentação esteja em Despesas Administrativas.
-- NOTA: 'Materiais para Revenda' não estava na lista do sócio mas tinha baixa
--       (sumindo do DFC) — mapeado como OPERACIONAL; revisar se for outro grupo.

insert into meta.categoria_dfc_map (categoria_ca, grupo_dfc)
select v.categoria_ca, v.grupo_dfc from (values
  ('Adm','OPERACIONAL'),
  ('Atrações/Eventos','OPERACIONAL'),
  ('CUSTO COMIDAS','OPERACIONAL'),
  ('SALÁRIO FUNCIONÁRIOS','OPERACIONAL'),
  ('UTENSILIOS','OPERACIONAL'),
  ('Contratos Cashback Mensal','OPERACIONAL'),
  ('Produção de Eventos','OPERACIONAL'),
  ('Administrativo Local','OPERACIONAL'),
  ('Materiais para Revenda','OPERACIONAL'),
  ('[Investimento] Escritório Central','INVESTIMENTO'),
  ('[Investimento] Receitas','INVESTIMENTO'),
  ('Empréstimos de Bancos','FINANCIAMENTO'),
  ('Empréstimos de Sócios','FINANCIAMENTO'),
  ('Despesas Grupo Bizu','AJUSTE'),
  ('[Consumação] Aniversários','AJUSTE'),
  ('[Consumação] Influencers','AJUSTE'),
  ('[Consumação] Relacionamento','AJUSTE')
) v(categoria_ca, grupo_dfc)
where not exists (select 1 from meta.categoria_dfc_map m
                  where upper(btrim(m.categoria_ca)) = upper(btrim(v.categoria_ca)));

-- Conflito: Contratos Anuais era FINANCIAMENTO; sócio quer INVESTIMENTO (de-para global).
update meta.categoria_dfc_map set grupo_dfc='INVESTIMENTO'
where upper(btrim(categoria_ca))=upper(btrim('Contratos Anuais')) and grupo_dfc<>'INVESTIMENTO';
