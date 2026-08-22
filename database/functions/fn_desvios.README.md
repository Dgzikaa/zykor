# gold.fn_desvios — princípio "registro manda" (22/08/2026)

Mudança combinada com o Gonza no mesmo dia em que o Plano de Produção mudou. **Um princípio só,
valendo nas duas telas:**

> **Produção REGISTRADA → a demanda do filho vem do registro** (execução, na data real).
> **Produção NÃO registrada → a demanda do filho vem da explosão das vendas.**

## O que mudou

1. `expl` carrega **`via_registrada`** e `producao_por_produto` passa a somar só o caminho que
   **não** atravessou produção registrada.
2. CTE nova **`real_prod_preparo`**: o consumo de preparo-dentro-de-preparo lançado na execução.
   Era descartado pelo filtro `insumo_codigo !~* '^p[cd]'` e não entrava em lugar nenhum — 135
   linhas com `qtd_real` preenchida nos últimos 60 dias, em 32 produções. Dado bom no lixo.
3. A saída teórica de uma produção vira `teorico_prod + real_prod_preparo`. As duas parcelas nunca
   contam a mesma coisa, porque a primeira exclui exatamente os pares que a segunda cobre.

## A armadilha (custou uma versão)

A 1ª versão cortava a explosão por **qualquer pai registrado**. Resultado: `Carne Recheio Pastel de
Carne` (bar 4) caiu de 16,66 kg de saída para **0,004** e virou R$ 475 de perda inventada — a
execução do Pastel de Carne existia, mas **não tinha lançado o consumo do recheio**. Sem os dois
lados, sobra buraco.

**Regra final: o corte é por PAR pai→filho** (`par_registrado`), não por pai. Só troca a venda pelo
registro quando o registro daquele filho existe; senão cai no fallback da venda.

## Unidade

`producao_execucao_insumo.qtd_real` está na **unidade da ficha** (g/ml) — conferido: Pastel Carne
19 un × 35 g = 665 e o registro diz 665. Por isso a divisão é por `fator_contagem`, igual à do
`teorico_prod`.

## Detector de lançamento torto

O modelo novo EXPÔE erro de digitação na execução (antes ficava escondido atrás da venda). Varredura
que achou 5 casos desde 01/06 — usar de novo quando um desvio de preparo parecer absurdo:

```sql
select pe.bar_id, (pe.inicio at time zone 'America/Sao_Paulo')::date dia, pb.codigo pai,
       pe.responsavel_nome, pei.insumo_codigo filho, pei.qtd_real,
       round(pe.rendimento_real / nullif(pb.rendimento,0) * fi.quantidade, 1) esperado
  from operations.producao_execucao_insumo pei
  join operations.producao_execucao pe on pe.id = pei.execucao_id
  join public.producao_base pb on pb.id = pe.producao_id
  join public.producao_base fb on upper(fb.codigo) = upper(pei.insumo_codigo) and fb.bar_id = pe.bar_id
  join public.producao_ficha_item fi on fi.producao_id = pb.id and fi.producao_ref = fb.id
 where pei.qtd_real is not null and pe.rendimento_real > 0
   and (pei.qtd_real < 0.2 * (pe.rendimento_real / nullif(pb.rendimento,0) * fi.quantidade)
     or pei.qtd_real > 5.0 * (pe.rendimento_real / nullif(pb.rendimento,0) * fi.quantidade));
```

## Snapshot do antes

`operations._desvio_antes_20260822` guarda o desvio das produções (20/07–17/08, os 2 bares) ANTES
da mudança, pra comparar. Pode ser dropada depois que o time validar.

---

# Saídas → aba Produções: direta × indireta (22/08/2026)

Gonza: *"aqui nas Saídas, na aba de Produções, ficaria separado uma coluna de saída direta e outra
de indireta. Então ficaria no Moscow Mule, saída direta 30ml e indireta 17,5ml"*.

- `silver.producao_por_produto` (view) ganhou **`qtd_por_produto_direta`** = o recorte de nível 0,
  o que está escrito na ficha do produto VENDIDO.
- `silver.fn_consumo_producao_periodo` devolve `qtd_base` + `qtd_base_direta`.
- `silver.fn_consumo_producao_por_produto` devolve `por_produto_direta` / `qtd_direta`.

Validado no Xarope de Gengibre (bar 3, 10–16/08):

| produto | direta/un | indireta/un |
|---|---:|---:|
| Moscow Mule | 30 ml | 17,5 ml (pela Espuma) |
| Maria Bonita | 0 | 63,64 ml (100 % pelo Refrigerante) |
| Arlequim / Penicillin | 15 ml | 0 |

**Por que a lista passou a calcular AO VIVO** em vez de ler `silver.consumo_producao_dia`: o total e
a parte direta precisam sair da mesma passada, senão dá pra um ficar defasado do outro. Conferido
antes de trocar — matview × ao vivo, 80 códigos, **0 divergências**, 227 ms. A matview continua
existindo para quem já a consome.
