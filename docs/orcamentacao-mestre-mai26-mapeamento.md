# Mapeamento da Aba "2026 Ajustado 3 (Mai26)" — BP Ordinário

Extraído em 2026-05-25 via MCP Google Drive (file 1Sp-O33Tv1SBzkd_o0uo0lbvWJNVJZ-Ot).

Use isto como referência ao reescrever `/estrategico/orcamentacao` no Sprint 3.

## Estrutura por dia da semana (Seg/Ter/Qua/Qui/Sex/Sab/Dom)

| Linha | Seg | Ter | Qua | Qui | Sex | Sab | Dom |
|-------|-----|-----|-----|-----|-----|-----|-----|
| Vezes no Mes | 4.3 | 4.3 | 4.3 | 4.3 | 4.3 | 4.3 | 4.3 |
| Custo Programacao (cache base) | R$ 0 | R$ 1.000 | R$ 0 | R$ 0 | R$ 2.200 | R$ 2.000 | R$ 3.500 |
| Custo Cache (total) | R$ 2.000 | R$ 4.000 | R$ 6.000 | R$ 4.000 | R$ 22.200 | R$ 20.000 | R$ 14.000 |
| Pessoas | 120 | 200 | 460 | 250 | 1.000 | 1.212 | 550 |
| Tkt Medio Bar | R$ 85 | R$ 83 | R$ 83 | R$ 83 | R$ 85 | R$ 85 | R$ 83 |
| Tkt Medio Entrada | R$ 18 | R$ 18 | R$ 23 | R$ 18 | R$ 23 | R$ 23 | R$ 18 |
| Faturamento Entrada | 2.160 | 3.600 | 10.580 | 4.500 | 23.000 | 27.876 | 9.900 |
| Faturamento Bar | 10.200 | 16.600 | 38.180 | 20.750 | 85.000 | 103.020 | 45.650 |
| Faturamento do Dia | 12.360 | 20.200 | 48.760 | 25.250 | 108.000 | 130.896 | 55.550 |

## DRE Mensal 2026 (Ordinário)

### Indicadores
- BreakEven: **R$ 1.610.889,08**
- Custo Fixo Total: **-R$ 959.850,67**
- Margem Contribuicao: **59.6%**
- N Pessoas/mes: **16.305,6**
- Tkt Medio Bar (mes): **R$ 84,23**
- Tkt Medio Entrada (mes): **R$ 21,52**
- CMV alvo: **32%**

### Receitas
| Categoria | Linha | Valor | % |
|-----------|-------|-------|---|
| Receita Bar | Faturamento Bar | R$ 1.373.420,00 | |
| Receita Bilheteria | Faturamento Couvert | R$ 350.948,80 | 20.4% |
| Receita Buteco | (vazio) | - | - |
| **RECEITA TOTAL** |  | **R$ 1.724.368,80** | 100% |

### Despesas
| Bloco | Linha | Valor | % | Subtotal % |
|-------|-------|-------|---|------------|
| Despesas Variaveis | IMPOSTO | -R$ 94.840,28 | 5.5% | 40.4% |
|  | Comissao | -R$ 119.487,54 | 6.9% |  |
|  | Tx Maquininha | -R$ 36.211,74 | 2.1% |  |
| Custo Insumos (CMV) | CMV Bar | -R$ 446.361,50 | 25.9% |  |
| Mao-de-Obra | CMO Fixo | -R$ 170.000,00 | 9.9% | 19.4% |
|  | Freela | -R$ 100.000,00 | 5.8% |  |
|  | PRO LABORE | -R$ 64.000,00 | 3.7% |  |
| Despesas Comerciais | Programacao Artistica | -R$ 310.460,00 | 18.0% | 25.0% |
|  | Custos de evento variavel | -R$ 80.000,00 | 4.6% |  |
|  | Marketing | -R$ 41.384,85 | 2.4% |  |
| Despesas Administrativas | Administrativo | -R$ 83.974,75 | 4.9% | 7.1% |
| Despesas Operacionais | Materiais, Utens, Limp | -R$ 37.936,11 | 2.2% |  |
| Despesas Ocupacao | ALUGUEL/COND/IPTU | -R$ 37.000,00 | 2.1% | 4.2% |
|  | Manutencao | -R$ 13.794,95 | 0.8% |  |
|  | AGUA | -R$ 9.500,00 | 0.6% |  |
|  | GAS | -R$ 3.500,00 | 0.2% |  |
|  | INTERNET | -R$ 800,00 | 0.0% |  |
|  | LUZ | -R$ 7.500,00 | 0.4% |  |
| CONTRATOS | (receita) | +R$ 36.211,74 | -2.1% |  |
| **Resultado** | EBITDA | **+R$ 103.828,81** | **6.0%** |  |

### Coluna "VS BP ANTERIOR" (delta vs cenario base)
Cada linha tem coluna de delta vs BP anterior + % do delta sobre receita total. Exemplos:
- IMPOSTO delta: -R$ 6.417,66 (0.00%)
- Comissao delta: -R$ 8.327,47 (0.02%)
- Tx Maquininha delta: -R$ 7.273,43 (0.30%)
- CMV delta: -R$ 31.108,35 (0.06%) ... ate "ganho de R$ 63.557,89"
- Programacao Artistica delta: -R$ 37.410,00 (1.02%) "XXXX Solucao: achar 6k por semana de cache"
- Marketing delta: -R$ 7.623,49 (0.30%) "Solucao1: Gerir budget total com Consumacao"

### Solucoes anotadas (texto da planilha)
- Artistico: Achar 6k de cache por semana
- Producao e Material Operacao: Explodir categorias e definir budgets de cada linha
- Marketing: Gerir o Budget total com consumacoes
- Mudar o pagamento da Meta para semanal
- Mudar o beneficio da semana pra R$100
- Separar tipos de beneficio

## Diferencas vs estrutura atual do Zykor (`orcamentacao-service.ts`)

| Diferenca | Atual no Zykor | Planilha mestre |
|-----------|---------------|-----------------|
| Bloco Variaveis | "IMPOSTO/TX MAQ/COMISSAO" agregado | Separado em 3 linhas: IMPOSTO, Comissao, Tx Maquininha |
| Bloco Mao-de-obra | 8 linhas (CUSTO-EMPRESA, ADICIONAIS, 5 freelas separados, PRO LABORE) | 3 linhas: CMO Fixo, Freela (consolidado), PRO LABORE |
| Bloco Comercial | 3 linhas (Marketing, Atracoes, Producao Eventos) | 3 linhas: Programacao Artistica, Custos evento variavel, Marketing |
| Bloco Operacional | 5 linhas (Materiais, Estorno, Equipamentos, Mat. Limpeza, Utensilios) | 1 linha: "Materiais, Utens, Limp" agregada |
| Bloco Adm | 4 linhas (Escritorio, Adm Ordinario, RH, Vale Transporte) | 1 linha: Administrativo |
| Receitas | RECEITA BRUTA + CONTRATOS | Bar + Bilheteria + Buteco (futuro) |
| CONTRATOS | dentro de Receitas | linha separada (positiva, abate custo) |

**Implicacao:** o mapeamento ContaAzul → linhas do Zykor precisa ser **reescrito** porque a granularidade da planilha mestre eh diferente. As 75 categorias do `CATEGORIAS_MAP` precisam ser reagrupadas para bater com a planilha:
- Comissao isolada de Tx Maquininha (atualmente sao a mesma linha)
- Freelas todos colapsados em 1 linha
- Operacional/Administrativo todos colapsados

## Visao por dia da semana

O modelo da planilha **planeja faturamento e custo por DIA DA SEMANA** (4.3 ocorrencias/mes). Isso permite:
- Tkt medio diferente por dia (Sex/Sab mais alto)
- Custo de cache por dia (programacao mais cara Sex/Sab)
- Numero de pessoas previsto por dia

Hoje o Zykor mostra apenas total mensal (Planejado/Projetado/Realizado). Para alinhar com a planilha precisa adicionar drill por dia da semana.

## Aba alternativa "2026 - DeathNote de Custo Gonza"

Tem cenario alternativo logo abaixo na mesma aba, com:
- BreakEven mais baixo: R$ 1.324.192,69
- Custo Fixo Total: -R$ 807.180,52
- Margem Contribuicao: 61.0%
- Receita Total: R$ 1.607.684,00
- Margem Liquida final: maior (linha incompleta no extracto)
- Anotacao: "Sex+Sab 200k, Seg-Qui 90k"

Eh um cenario "DeathNote" (corte) — sem usar agora, mas vale guardar como referencia.
