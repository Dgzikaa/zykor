# Análise Detalhada de Consumos - Semana 13
## Bar Ordinário (23/03 a 29/03/2026)

## Resumo Executivo

### Valores Encontrados vs Esperados:

| Categoria | Total Desconto (Preço Venda) | Esperado (Planilha) | % Atingido | Diferença |
|-----------|------------------------------|---------------------|------------|-----------|
| **ARTISTAS** | R$ 9.469,70 | R$ 10.970,80 | **86,3%** | -R$ 1.501,10 |
| **SOCIOS** | R$ 2.786,07 | R$ 3.099,47 | **89,9%** | -R$ 313,40 |
| **CLIENTES** | R$ 3.984,82 | R$ 4.323,80 | **92,2%** | -R$ 338,98 |
| **FUNCIONARIOS** | R$ 1.853,19 | R$ 846,38 | **219%** | +R$ 1.006,81 |

### Descobertas Importantes:

1. **Fonte de dados correta**: `contahub_analitico` com `desconto > 0` e `valorfinal = 0`
2. **Não usar fator de 35%**: Os valores estão próximos usando o preço de venda direto
3. **Funcionários está classificando demais**: 219% do esperado (precisa ajustar filtros)
4. **Faltam ~10-15% dos valores**: Podem estar em mesas não classificadas ou com padrões diferentes

---

## Detalhamento por Categoria

### ARTISTAS (R$ 9.469,70 - 86% do esperado)

**Mesas identificadas:**
- X DozeporOito: R$ 2.441,75 (85 itens)
- X Elas que toquem: R$ 1.088,85 (43 itens)
- X Sambadona: R$ 989,95 (41 itens)
- X Pe no Chao: R$ 948,10 (38 itens)
- X Samba da Tia Zelia: R$ 863,00 (42 itens)
- X Banda Dudu: R$ 608,90 (22 itens)
- X 7naRoda: R$ 508,90 (24 itens)
- X Boka de Sergipe: R$ 501,15 (17 itens)
- X Bonsai: R$ 438,00 (20 itens)
- X Breno Alves: R$ 403,15 (18 itens)
- X segunda da resenha: R$ 303,60 (9 itens)
- X Paulo Victor: R$ 150,75 (5 itens)
- X DJ CAJU: R$ 97,80 (4 itens)
- X Dj Negrita: R$ 65,95 (1 item)
- X Dj Afrika: R$ 59,85 (3 itens)

**Faltam**: R$ 1.501,10 (13,7%)

---

### SOCIOS (R$ 2.786,07 - 90% do esperado)

**Mesas identificadas:**
- 1897 (Sócio Gonza): R$ 436,10 (18 itens)
- X DIOGO: R$ 479,65 (19 itens)
- X- Gonza: R$ 439,80 (20 itens)
- X-corbal: R$ 323,55 (9 itens)
- X-Corbal: R$ 310,35 (20 itens)
- X cadu: R$ 263,70 (6 itens)
- X-Viny: R$ 203,22 (14 itens)
- X luan: R$ 89,95 (1 item)
- X-Luan: R$ 49,95 (1 item)
- X-Diego: R$ 39,95 (1 item)
- X dudu: R$ 7,95 (1 item)
- Outros: R$ 141,90

**Faltam**: R$ 313,40 (10,1%)

---

### CLIENTES (R$ 3.984,82 - 92% do esperado)

**Padrões identificados:**
- Aniversariantes (muitas mesas numéricas): ~R$ 2.500
- X Aniversariante: R$ 332,45
- X Aniversario: R$ 158,75
- 026 (Aniversario Cadu): R$ 400,00
- 01207 (Aniversário): R$ 100,00 + R$ 399,00 produtos
- Mesa magica: R$ 128,65
- X mesa magica: R$ 26,95
- X-aniversario: R$ 63,90
- 0310 (Nct): R$ 115,00 (não classificado ainda)
- 0585, 1139 (Ambev): R$ 64,43 + R$ 33,92
- 1659 (MOAI): R$ 416,20 (não classificado ainda)

**Faltam**: R$ 338,98 (7,8%)

---

### FUNCIONARIOS (R$ 1.853,19 - 219% do esperado!)

**PROBLEMA**: Está classificando DEMAIS! Esperado: R$ 846,38

**Mesas identificadas:**
- X Wendel: R$ 270,73
- X NATALIA: R$ 202,55
- X Nato: R$ 139,85
- Xslu: R$ 87,45
- X Kauan: R$ 39,83
- X Ana bia: R$ 64,66
- X Teixeira: R$ 30,57
- X Phelipe: R$ 32,95
- X Andreia: R$ 32,90
- X Jhonny: R$ 20,99
- E muitos outros...

**Possíveis causas:**
1. Wendel, Natalia, Nato podem ser SÓCIOS, não funcionários
2. Alguns nomes podem ser CLIENTES
3. Precisa revisar a lista de nomes de funcionários

---

## Mesas Não Classificadas (R$ 441,00)

Principais:
- **1766**: R$ 122,70 (sem motivo)
- **0818**: R$ 100,00 (sem motivo)
- **1925**: R$ 85,85 (sem motivo)
- Outros: R$ 132,45

---

## Conclusões e Próximos Passos:

### 1. Fator de Custo:
**NÃO usar 35%**. Os valores estão muito próximos usando o **preço de venda direto** como CMV dos consumos.

### 2. Ajustes Necessários:

**a) FUNCIONARIOS - Remover falsos positivos:**
- Wendel, Natalia, Nato → Podem ser SÓCIOS ou CLIENTES
- Verificar se Ana bia, Kauan, Teixeira, Jhonny são realmente funcionários

**b) CLIENTES - Adicionar:**
- "Nct" (R$ 115,00)
- "MOAI" (R$ 416,20)

**c) Investigar mesas sem motivo:**
- 1766 (R$ 122,70)
- 0818 (R$ 100,00)
- 1925 (R$ 85,85)

### 3. Perguntas para Você:

1. **Wendel, Natalia, Nato** - São sócios, funcionários ou clientes?
2. **MOAI** - O que é? (R$ 416,20)
3. **Nct** - O que é? (R$ 115,00)
4. **Bonsai** - É artista? (R$ 438,00)
5. As mesas numéricas sem motivo (1766, 0818, 1925) - São o quê?
