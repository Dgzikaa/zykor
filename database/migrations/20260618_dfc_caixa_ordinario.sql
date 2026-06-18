-- 2026-06-18 — DFC (Demonstrativo de Fluxo de Caixa) por CAIXA. Foco: bar 3.
--
-- Abordagem (decisão do sócio): derivar a DFC da MESMA base do CA, sem reclassificar
-- à mão. Cada lançamento já tem categoria; o grupo DFC (Operacional/Investimento/
-- Financiamento) vem de um de-para. A diferença pra DRE é o eixo de data: DFC = CAIXA
-- (data_pagamento), DRE = competência. Categorias de AJUSTE (consumação, variação de
-- estoque, bonificações, ajustes manuais, saldo inicial) NÃO entram (não são caixa).
--
-- Join case-insensitive (o CA tem 'Recursos Humanos' e 'RECURSOS HUMANOS', etc.).

CREATE TABLE IF NOT EXISTS meta.categoria_dfc_map (
  categoria_ca   text PRIMARY KEY,
  grupo_dfc      text NOT NULL CHECK (grupo_dfc IN ('OPERACIONAL','INVESTIMENTO','FINANCIAMENTO','AJUSTE')),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO meta.categoria_dfc_map (categoria_ca, grupo_dfc) VALUES
 ('Dinheiro','OPERACIONAL'),('Stone Crédito','OPERACIONAL'),('Stone Pix','OPERACIONAL'),('Stone Débito','OPERACIONAL'),
 ('Pix Direto na Conta','OPERACIONAL'),('Receita de Eventos','OPERACIONAL'),('Outras Receitas','OPERACIONAL'),
 ('Receitas Financeiras','OPERACIONAL'),('Custo Drinks','OPERACIONAL'),('Custo Comida','OPERACIONAL'),('Custo Bebidas','OPERACIONAL'),
 ('Custo Outros','OPERACIONAL'),('Materiais de Limpeza e Descartáveis','OPERACIONAL'),('PRO LABORE','OPERACIONAL'),
 ('ALIMENTAÇÃO','OPERACIONAL'),('Atrações Programação','OPERACIONAL'),('FREELA COZINHA','OPERACIONAL'),
 ('Administrativo Ordinário','OPERACIONAL'),('Recursos Humanos','OPERACIONAL'),('FREELA ATENDIMENTO','OPERACIONAL'),
 ('Materiais Operação','OPERACIONAL'),('Outros Operação','OPERACIONAL'),('FREELA SEGURANÇA','OPERACIONAL'),
 ('MANUTENÇÃO','OPERACIONAL'),('Utensílios','OPERACIONAL'),('GÁS','OPERACIONAL'),('FREELA LIMPEZA','OPERACIONAL'),
 ('FREELA BAR','OPERACIONAL'),('Marketing Produção','OPERACIONAL'),('VALE TRANSPORTE','OPERACIONAL'),
 ('ALUGUEL/CONDOMÍNIO/IPTU','OPERACIONAL'),('FREELA BRIGADISTA','OPERACIONAL'),('ACESSORIOS SALAO','OPERACIONAL'),
 ('LOCACOES OPERACAO','OPERACIONAL'),('SALARIO FUNCIONARIOS','OPERACIONAL'),('COMISSÃO 10%','OPERACIONAL'),
 ('PROVISÃO TRABALHISTA','OPERACIONAL'),('Marketing Mídia','OPERACIONAL'),('Produção Eventos','OPERACIONAL'),
 ('Estorno','OPERACIONAL'),('LUZ','OPERACIONAL'),('TAXA MAQUININHA','OPERACIONAL'),('INTERNET','OPERACIONAL'),
 ('TENDA','OPERACIONAL'),('EQUIPAMENTOS OPERACAO','OPERACIONAL'),('IMPOSTO','OPERACIONAL'),('ADICIONAIS','OPERACIONAL'),
 ('Outros Sócios','OPERACIONAL'),('Contrato Cashback Mensal','OPERACIONAL'),('Escritório Central','OPERACIONAL'),
 ('ÁGUA','OPERACIONAL'),('Marketing Disparos','OPERACIONAL'),('Despesas Financeiras','OPERACIONAL'),('PROVISÃO FISCAL','OPERACIONAL'),
 ('[Investimento] Equipamentos','INVESTIMENTO'),('[Investimento] Outros Investimentos','INVESTIMENTO'),
 ('[Investimento] Obras','INVESTIMENTO'),('[Investimento] Consultoria','INVESTIMENTO'),
 ('[Investimento] Investimento Inicial Abertura do Bar','INVESTIMENTO'),('[Investimento] Equipamentos R','INVESTIMENTO'),
 ('Transferência de Saída','FINANCIAMENTO'),('Transferência de Entrada','FINANCIAMENTO'),('Dividendos','FINANCIAMENTO'),('Contratos Anuais','FINANCIAMENTO'),
 ('Variação de Estoque','AJUSTE'),('[Consumação] Benefício Clientes','AJUSTE'),('[Consumação] Artistas','AJUSTE'),
 ('[Consumação] Sócios','AJUSTE'),('[Consumação] Funcionários Operação','AJUSTE'),('[CONSUMAÇÃO] AJUSTE CMV','AJUSTE'),
 ('[Consumação] Funcionários Escritório','AJUSTE'),('Ajuste Bonificações','AJUSTE'),
 ('[Manual] Ajuste Receita Virada do Mês','AJUSTE'),('Saldo Inicial','AJUSTE')
ON CONFLICT (categoria_ca) DO UPDATE SET grupo_dfc=EXCLUDED.grupo_dfc, atualizado_em=now();

CREATE OR REPLACE FUNCTION public.get_dfc_por_ano(p_bar_id integer, p_ano integer)
 RETURNS TABLE(mes date, grupo_dfc text, categoria text, entradas numeric, saidas numeric, net numeric)
 LANGUAGE sql STABLE
 SET search_path TO 'public','meta','bronze','pg_catalog'
AS $function$
  SELECT
    date_trunc('month', l.data_pagamento)::date AS mes,
    m.grupo_dfc,
    COALESCE(NULLIF(TRIM(l.categoria_nome),''),'(sem categoria)') AS categoria,
    ROUND(SUM(CASE WHEN l.tipo='RECEITA' THEN COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto) ELSE 0 END)::numeric,2) AS entradas,
    ROUND(SUM(CASE WHEN l.tipo='DESPESA' THEN COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto) ELSE 0 END)::numeric,2) AS saidas,
    ROUND(SUM((CASE WHEN l.tipo='RECEITA' THEN 1 ELSE -1 END) * COALESCE(NULLIF(l.valor_pago,0), l.valor_bruto))::numeric,2) AS net
  FROM bronze.bronze_contaazul_lancamentos l
  JOIN meta.categoria_dfc_map m ON upper(btrim(m.categoria_ca)) = upper(btrim(l.categoria_nome))
  WHERE l.bar_id = p_bar_id
    AND l.excluido_em IS NULL
    AND m.grupo_dfc <> 'AJUSTE'
    AND l.data_pagamento >= make_date(p_ano,1,1)
    AND l.data_pagamento < make_date(p_ano+1,1,1)
  GROUP BY 1, 2, 3;
$function$;
GRANT EXECUTE ON FUNCTION public.get_dfc_por_ano(integer,integer) TO authenticated, service_role, anon;
