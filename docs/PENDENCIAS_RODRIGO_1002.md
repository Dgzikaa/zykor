# Pendências e Investigação – 10/02/2026

Documento consolidando os pontos levantados pelo Rodrigo e o resultado da análise técnica.

**Revisão 10/02** – Status atualizado. **Revisão 11/02** – Notificação "Sem evento amanhã" corrigida (timezone Brasília); Revisão NIBO sem competência implementada.

---

## 1. Analítico Eventos – Faturamento por hora 07.02 não aparece

**Status: ✅ CORRIGIDO**

A correção foi aplicada em `api/ferramentas/horario-pico/route.ts`: a API consulta `contahub_fatporhora` **antes** de `verificarBarAberto`. Se houver dados em fatporhora para a data, o dia é considerado aberto e o gráfico é exibido, mesmo quando `contahub_analitico` ainda não tiver sync.

### Causa original
A API `/api/ferramentas/horario-pico` usa `verificarBarAberto()` antes de buscar dados. Se o bar for considerado fechado, retorna antes com `fatamento_por_hora: []` e não chega a consultar `contahub_fatporhora`.

Para datas passadas, o status de aberto vem de `contahub_analitico`: se não houver movimento, o dia é marcado como fechado. Assim, se:
- o sync do ContaHub ainda não tiver rodado para 07.02, ou
- houver atraso na população de `contahub_analitico`,

o dia 07.02 fica como "bar fechado" e o faturamento por hora não é exibido, mesmo que existam dados em `contahub_fatporhora`.

---

## 2. Disparo de NPS pela Umbler – dentro do Zykor

### Estado atual
- Umbler: CRM em `/crm/umbler`, campanhas, conversas
- NPS: sync via planilha (`google-sheets-sync` action `nps` e `nps-reservas`)

Hoje não existe fluxo de disparo de NPS via Umbler integrado ao Zykor.

### O que fazer
- Definir regras (quem, quando, qual mensagem)
- Criar rota/edge function para disparar NPS via API Umbler
- Interface no Zykor para configurar e disparar (ou agendar)

---

## 3. Excel Desempenho vs NPS – notas não batem + retroativo

### Problemas
- Valores de NPS no Excel de desempenho não coincidem com o que está no sistema
- Necessidade de retroativo
- Separar fontes: reservas no GetIn e geral na planilha

### Pontos técnicos
- NPS geral: `google-sheets-sync` com `action: 'nps'` (planilha)
- NPS reservas: `google-sheets-sync` com `action: 'nps-reservas'` (planilha)
- GetIn: existe `api/getin/sync-retroativo`; verificar se já traz NPS de reservas

### Ações
1. Conferir se há NPS de reservas no GetIn e se está sendo consumido
2. Avaliar migração: NPS reservas do GetIn e NPS geral da planilha
3. Revisar retroativo na planilha (intervalo de datas, formato)
4. Garantir que Excel de desempenho e Zykor usem a mesma fonte ou que o Zykor seja a fonte oficial

---

## 4. CMV Ordinário – vários pontos

### 4.0 Agendamentos sem data_competencia – Revisão

**Status: ✅ Feito** – Tab "Revisão NIBO" em Ferramentas → Agendamento. Pré-carrega agendamentos com `data_competencia` null, paginação 500, botão "Carregar mais". Para o financeiro revisar e preencher no NIBO.

### 4.1 Valor de Compras não bate com planilha
- Compras vêm de `nibo_agendamentos` com filtro por `data_competencia`
- Possíveis problemas:
  - NIBO desatualizado → conferir `api/nibo/sync`
  - Uso de competência vs data de criação → ver item 4.2

### 4.2 Retroativo: competência ou criação?
- Hoje: `nibo_agendamentos` com `data_competencia` entre `dataInicio` e `dataFim`
- Se a planilha usa data de criação/lançamento, os valores não vão bater
- Solução: deixar configurável ou alinhar critério com a planilha

### 4.3 Consulta mais de uma categoria / Compras
- **Compras TOTAL** = Cozinha + Bebidas + Drinks + Outros (soma das 4)
- **Drill-down**: ao clicar em "Custo Cozinha" → modal com só compras de cozinha; ao clicar em "TOTAL" (compras_periodo) → modal com TODAS as compras
- Não há problema de "múltiplas categorias" – o fluxo está correto

### 4.4 Mapeamento Categorias NIBO

**Problema real:** 3 arquivos usam listas DIFERENTES de categorias para o mesmo conceito (Comida, Bebidas, Drinks, Outros):

| Arquivo | Comida | Bebidas | Drinks | Outros |
|---------|--------|---------|--------|--------|
| `cmv-semanal-auto` | includes('CUSTO COMIDA') | includes('CUSTO BEBIDA') | includes('CUSTO DRINK') | includes('CUSTO OUTRO') |
| `buscar-dados-automaticos` | exato 'custo comida' | 'custo bebidas' OU 'custo outros' | exato 'custo drinks' | fixo 0 |
| `detalhes/route` (drill-down) | Cozinha, COMIDA, ALIMENTAÇÃO | BEBIDAS, Cerveja, Vinho | DESTILADOS, DRINKS | exclui os 3 |

**Consequência:** O total do cálculo pode não bater com o que aparece no drill-down; cada lugar considera um conjunto diferente de categorias do NIBO. Solução: unificar em um único mapeamento centralizado.

### 4.5 CMV Real copiando o teórico – fórmula

**Status: ✅ CORRIGIDO** – `cmv-semanal-auto` calcula `cmv_percentual = cmv_real / vendas_brutas × 100`. Tabela exibe "CMV Real (%)" corretamente.

- Fórmula: **CMV Real % = (CMV R$) / Faturamento Bruto × 100**
- Hoje: `cmv_limpo_percentual = cmv_real / faturamento_cmvivel`
- `faturamento_cmvivel` = vendas líquidas (bruto - couvert - gorjeta)
- Ajuste: para “CMV Real %” usar **faturamento bruto** (`vendas_brutas` / `faturamento_bruto`), não `faturamento_cmvivel`

### 4.6 NPS reservas Ordinário – retroativo
- Mesmo tema do item 3, aplicado ao NPS de reservas do Ordinário
- Ver GetIn e planilha para retroativo

---

## 5. Resumo de ações técnicas

| # | Item                        | Status    | Observação |
|---|-----------------------------|-----------|------------|
| 1 | Faturamento 07.02           | ✅ Feito  | Fallback fatporhora implementado |
| 2 | NPS Umbler no Zykor         | ⏳ Pendente | Criar rota/edge + interface para disparo via Umbler |
| 3 | NPS desempenho vs planilha  | ⏳ Pendente | Fontes: nps (planilha), nps_reservas (planilha). GetIn traz nps_answered/nps_url apenas |
| 4a| Compras CMV vs planilha     | ⏳ Pendente | NIBO usa `data_competencia`. API `api/nibo/sync` chama Edge `nibo-sync` |
| 4b| Múltiplas categorias        | ✅ OK | TOTAL = soma das 4; drill-down TOTAL mostra todas |
| 4c| Categorias inconsistente   | ⏳ Pendente | 3 arquivos com listas diferentes – unificar mapeamento |
| 4d| CMV Real %                  | ✅ Feito  | cmv_percentual = CMV R$ / Fat. Bruto |
| 4e| NPS reservas Ordi retroativo| ⏳ Pendente | sync-nps-reservas lê planilha. GetIn não popula nps_reservas |

---

## 6. Arquivos relevantes

- Horário pico: `api/ferramentas/horario-pico/route.ts`, `lib/helpers/calendario-helper.ts`
- CMV: `backend/supabase/functions/cmv-semanal-auto/index.ts`, `ferramentas/cmv-semanal/`
- NIBO: `api/nibo/sync/route.ts`, tabela `nibo_agendamentos`
- NPS: `api/nps/sync/route.ts`, `api/nps/sync-reservas/route.ts`
- GetIn: `api/getin/sync-retroativo/route.ts`
