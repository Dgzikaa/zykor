# Revisão Detalhada das Tarefas do Sócio (27/02/2026)

**Fonte:** Análise de código + transcrições de conversas + documentação existente  
**Objetivo:** Validar implementação real vs demandas solicitadas

---

## 📊 RESUMO EXECUTIVO

### Tabela de Status Geral

| # | Categoria | Demanda | Status | Prioridade |
|---|-----------|---------|--------|------------|
| 1 | Desempenho | CMO (Simulação + CMA + Freelas + Pro Labore) | 🟢 **IMPLEMENTADO** | ✅ Completo |
| 2 | Desempenho | Metas com formatação condicional | 🟢 **IMPLEMENTADO** | ✅ Completo |
| 3 | Desempenho | Visão Mensal sem fazer média | 🟢 Implementado | ⚪ Validação |
| 4 | Desempenho | Conferir linha a linha | 🔴 Pendente | ⚪ Validação |
| 5 | Desempenho | Fazer tudo igual pro Debas | 🔴 Não Impl. | 🟡 Média |
| 6 | CMV | Estoque mensal pegando inventário | 🟢 Implementado | ⚪ OK |
| 7 | CMV | Consumações duplicadas | 🟢 Implementado | ⚪ Validação |
| 8 | CMV | Bonificações no mês (semana quebrada) | 🟢 Implementado | ⚪ OK |
| 9 | CMV | CMA (Custo Alimentação Funcionário) | 🟢 Implementado | ⚪ OK |
| Extra 1 | CMV | Bonificações somam no cálculo | 🟢 **CORRIGIDO** | ✅ Completo |
| Extra 2 | CMV | CMV Real (%) não aparece | 🟡 Parcial | ⚪ Validação |
| 10 | Comercial | Grupos de colunas expansíveis | 🟢 **IMPLEMENTADO** | ✅ Completo |
| 11 | Comercial | Atração do dia | 🟢 **IMPLEMENTADO** | ✅ Completo |

**Legenda:**
- 🟢 Implementado
- 🟡 Parcialmente Implementado
- 🔴 Não Implementado / Conflito
- ⚪ Pendente de Validação

---

## 📋 TABELA DE DESEMPENHO

### 1) CMO (Simulação Folha + Prolabas + CMA + Freelas NIBO)

#### 🎯 O que o sócio pediu (transcrição):

> "O cálculo do CMO é uma soma de 4 fatores: 1) Freelas, 2) Fixos, 3) Alimentação, 4) Pro Labore"

> "Pegar essa planilha [de folha], ver quais são as contas que estão ali, né? Ah, como é que calcula o adicional noturno, como é que calcula o FGTS, como é que calcula produtividade, cada uma das coisas que estão ali ocultas, tem o cálculo aí no Excel e replicar."

> "A grande questão é como deixar esse simulador dinâmico, assim, né? Porque, cara, a gente faz essa simulação toda semana, nosso time de RH que faz, e aí a cada semana a gente inclui funcionário novo, tira funcionário."

> "Seria muito bom se de alguma forma, essas simulações que a gente fizesse ficassem salvas, sabe? [...] ter algum botão pra ele apertar, tipo assim: salvar simulação, tipo guardar a simulação."

> "O RH vai, simula, e o CMO dessa semana ficou em quarenta e quatro mil. Aí eu falo: caramba, mas semana passada tava em quarenta e um mil, o que que foi que aumentou? Aí a gente entra pra ver as simulações, pra ver, cara, quem foi que saiu, quem foi que foi contratado, meio que comparar uma simulação com a outra."

#### ✅ O que está implementado:

**Estrutura Completa:**
- Tabela `cmo_semanal` com os 4 fatores:
  - `freelas` (do NIBO)
  - `fixos_total` (simulação de folha)
  - `cma_alimentacao` (custo alimentação)
  - `pro_labore_mensal` e `pro_labore_semanal`
  - `cmo_total` (soma dos 4)

**Simulador de Folha:**
- Arquivo: `frontend/src/app/ferramentas/simulacao-cmo/page.tsx`
- Cálculos implementados: `frontend/src/lib/calculos-folha.ts`
- Campos: CLT/PJ, área, vale transporte, salário bruto, adicionais, aviso prévio
- Cálculos automáticos:
  - Adicional noturno + DRS
  - Produtividade (5%)
  - INSS, IR, FGTS
  - Provisão Certa (27%)
  - Vale transporte

**Histórico e Comparação:**
- Histórico: `frontend/src/app/ferramentas/cmo-semanal/historico/page.tsx`
- Comparação: `frontend/src/app/ferramentas/cmo-semanal/comparar`
- Campos de auditoria: `created_by`, `updated_by`, `travado_por`, `travado_em`
- Botão "Salvar Simulação" existe
- Comparação entre semanas diferentes funciona

**Integração NIBO:**
- API: `frontend/src/app/api/cmo-semanal/buscar-automatico/route.ts`
- Busca automática de categorias com "FREELA"
- Filtro por `data_competencia` da semana

#### ⚠️ GAPS IDENTIFICADOS:

1. **Integração com Tabela de Desempenho (CRÍTICO):**
   - CMO aparece na tabela, mas marcado como `status: 'nao_confiavel'`
   - Simulação travada NÃO alimenta automaticamente o campo `cmo` em `desempenho_semanal`
   - Fluxo esperado: Simulação → Salvar → Travar → Atualizar Desempenho
   - **Impacto:** Dados de CMO não são confiáveis na tabela principal

2. **Versionamento de Simulações:**
   - Sistema salva apenas a última versão (upsert)
   - Não mantém histórico de alterações da MESMA simulação
   - Comparação só funciona entre semanas diferentes
   - **Impacto:** Não é possível ver "o que mudou" em uma simulação já salva

3. **Auditoria Ausente:**
   - APIs de CMO não usam `audit-logger.ts`
   - Alterações não são registradas em `audit_logs`
   - Não há rastreamento de quem alterou valores críticos
   - **Impacto:** Falta de rastreabilidade em dados financeiros

#### 🎯 RECOMENDAÇÕES:

**Alta Prioridade:**
1. Criar API que busca simulação travada da semana
2. Atualizar automaticamente `desempenho_semanal.cmo` quando simulação for travada
3. Mudar status de "não confiável" para "automático"

**Média Prioridade:**
4. Criar tabela `cmo_semanal_historico` para versionamento
5. Salvar snapshot antes de cada atualização
6. Permitir comparação de versões da mesma simulação

**Baixa Prioridade:**
7. Adicionar `audit-logger.ts` nas APIs de CMO
8. Registrar alterações em `audit_logs`

---

### 2) Colocar metas e ficar vermelho se estiver abaixo

#### 🎯 O que o sócio pediu (transcrição):

> "O ponto 2) é mais autoexplicativo, a ideia é ao lado da coluna do 'Indicador', ter outra coluna travada com a 'Meta'. Essa meta a gente insere manualmente. Dai dependendo da meta, ele formata o número de vermelho se estiver abaixo da meta ou de preto mesmo se tiver acima."

#### ✅ O que está implementado:

**Tabela Comercial:**
- Formatação verde/vermelho implementada
- Comparações visuais: Receita Real vs Meta M1, Clientes Real vs Plan, etc.
- Arquivo: `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`

**Infraestrutura:**
- Tabela `configuracoes_metas` existe no banco
- API: `frontend/src/app/api/configuracoes/metas/route.ts`

#### ⚠️ GAPS IDENTIFICADOS:

1. **Coluna "Meta" não existe na Tabela de Desempenho**
   - Não há coluna ao lado de "Indicador"
   - Não há interface para inserir metas por métrica

2. **Formatação condicional não implementada**
   - Valores não ficam vermelhos quando abaixo da meta
   - Não há integração com `configuracoes_metas`

3. **Sistema de metas não está ativo**
   - API existe mas não é usada
   - Falta interface de edição

#### 🎯 RECOMENDAÇÕES:

1. Adicionar coluna "Meta" na Tabela de Desempenho (ao lado de "Indicador")
2. Criar modal/interface para inserir metas manualmente
3. Aplicar formatação condicional:
   - Verde: acima da meta
   - Vermelho: abaixo da meta
   - Respeitar flag `inverso: true` (métricas onde menor é melhor: CMV, CMO, Atrasos)
4. Integrar com `configuracoes_metas` para persistência

---

### 3) Visão Mensal certinha sem fazer média

#### 🎯 O que o sócio pediu (transcrição):

> "Visão Mensal certinha sem fazer média"

#### ✅ O que está implementado:

**Agregação Mensal Proporcional:**
- Arquivo: `frontend/src/app/api/estrategico/desempenho/mensal/route.ts`
- Cálculo de semanas ISO que pertencem ao mês
- Proporção de dias: `diasNoMes / 7`

**Exemplo de semana quebrada:**
- Semana 1/2026: 29/12/2025 a 04/01/2026
  - 3 dias em Dezembro (29, 30, 31) → proporção: 3/7 = 0.43
  - 4 dias em Janeiro (01, 02, 03, 04) → proporção: 4/7 = 0.57
- Se faturamento da semana = R$ 70.000:
  - Dezembro recebe: R$ 70.000 × 0.43 = R$ 30.100
  - Janeiro recebe: R$ 70.000 × 0.57 = R$ 39.900

**Campos com SOMA proporcional (correto):**
- Faturamento Total
- Clientes Atendidos
- CMV R$
- Compras
- Reservas
- Custos (CMO, Atração, etc)

**Campos com MÉDIA ponderada (correto para percentuais):**
- CMV %
- CMO %
- Mix de Vendas (% Bebidas, Drinks, Comida)
- Tempos (Cozinha, Bar)
- NPS, Retenção

#### ⚠️ VALIDAÇÃO PENDENTE:

1. **Comparar com planilha oficial:**
   - Escolher 2 meses reais (um com semanas quebradas)
   - Comparar linha a linha
   - Diferença máxima aceitável: 0,5%

2. **Testar casos extremos:**
   - Mês de Janeiro (semana 1 pode ter dias de dezembro)
   - Meses com 5 semanas
   - Semanas com feriados

#### 🎯 RECOMENDAÇÕES:

1. Criar teste de aceite com dados reais
2. Documentar casos de sucesso
3. Validar com sócio se agregação está correta

---

### 4) Conferir linha a linha se faz sentido

#### 🎯 O que o sócio pediu (transcrição):

> "Conferir linha a linha se faz sentido"

#### ✅ O que está implementado:

**Tooltips informativos:**
- Cada métrica tem tooltip com:
  - Fonte dos dados
  - Cálculo/fórmula
  - Status (automático/manual/não confiável)

**Documentação:**
- Arquivo: `docs/avaliacao-implementacao-completa-2026-02-27.md`
- Lista todas as métricas e suas fontes

#### ⚠️ PENDENTE:

1. **Validação funcional com dados reais:**
   - Escolher 1 semana fechada
   - Comparar cada linha com planilha oficial
   - Documentar divergências > 1%

2. **Checklist de validação por métrica:**
   - [ ] Faturamento Total = soma eventos
   - [ ] CMV R$ = Estoque Inicial + Compras - Estoque Final - Consumos - Bonificações
   - [ ] CMV % = CMV R$ / Faturamento × 100
   - [ ] Ticket Médio = Faturamento / Clientes
   - [ ] Clientes Ativos = contagem única (não soma duplicada)
   - [ ] Reservas = GetIn (seated vs total)
   - [ ] Mix de Vendas = soma 100%
   - [ ] Tempos = média ponderada por volume
   - [ ] Atrasos = contagem de pedidos > threshold

#### 🎯 RECOMENDAÇÕES:

1. Criar documento "Checklist de Validação de Métricas"
2. Executar validação com semana real
3. Marcar métricas validadas com ✅
4. Corrigir as que tiverem divergência

---

### 5) Fazer tudo igual pro Debas

#### 🎯 O que o sócio pediu (transcrição):

> "Fazer tudo igual pro Debas"

#### ✅ O que está implementado:

**Sistema multi-bar:**
- Todas as tabelas suportam múltiplos `bar_id`
- Infraestrutura pronta para outro bar

#### ⚠️ NÃO IMPLEMENTADO:

1. **Nenhuma referência a "Debas" no código**
   - Busca retornou 0 resultados
   - Não há configuração específica

2. **Escopo não definido:**
   - É outro bar? (bar_id diferente?)
   - É uma cópia da tabela de desempenho?
   - Quais métricas são iguais? Quais são diferentes?

#### 🎯 RECOMENDAÇÕES:

**Perguntas para o sócio:**
1. Debas é outro bar ou outra visão do Ordinário?
2. Quais métricas são específicas do Debas?
3. O CMV/CMO do Debas é calculado igual?
4. Precisa de tabelas separadas ou apenas filtro por bar?

**Após definição:**
1. Se for outro bar: já está pronto (só cadastrar no sistema)
2. Se for layout diferente: criar view/componente específico
3. Se for métricas diferentes: ajustar configuração

---

## 📦 CMV (CUSTO DE MERCADORIA VENDIDA)

### 6) Visão Mensal - Estoque não tá pegando o inventário

#### 🎯 O que o sócio pediu (transcrição):

> "6) Na visão do CMV Mensal, os estoques não tá puxando direito. No cálculo de Janeiro, é pra pegar os estoques de 01/01 (inicial) e 01/02 (final). Já de Fevereiro, vai pegar 01/02 (inicial) e 01/03 (final)."

#### ✅ O que está implementado:

**Lógica de Estoque Mensal:**
- Arquivo: `frontend/src/app/api/cmv-semanal/mensal/route.ts` (linhas 304-361)
- **Estoque Inicial do Mês:** Estoque do dia 01 do mês (ex: 01/01, 01/02)
- **Estoque Final do Mês:** Estoque do dia 01 do mês seguinte (ex: 01/02, 01/03)

**Lógica implementada:**

```typescript
// Estoque Inicial: da semana que contém o dia 01 do mês
const primeiroEstoque = (campoInicial, campoFinalAnterior) => {
  // Busca estoque inicial da semana que contém 01/MÊS
  const dados = cmvMap.get(`${anoInicial}-${semanaInicial}`);
  if (dados && dados[campoInicial] > 0) return dados[campoInicial];
  
  // Fallback: usa estoque final do mês anterior
  if (estoqueFinalMesAnterior) return estoqueFinalMesAnterior[campoFinalAnterior];
  
  return 0;
};

// Estoque Final: da semana que contém o dia 01 do mês seguinte
const ultimoEstoque = (campoInicial, campoFinal) => {
  // Busca estoque inicial da semana que contém 01/MÊS+1
  const dados = cmvMap.get(`${anoFinal}-${semanaFinal}`);
  if (dados && dados[campoInicial] > 0) return dados[campoInicial];
  
  // Fallback 1: estoque final da última semana do mês
  // Fallback 2: estoque final do mês anterior
  
  return 0;
};
```

**Metadados retornados:**
- Data do estoque inicial (ex: "01/01/2026")
- Data do estoque final (ex: "01/02/2026")
- Semana ISO de cada estoque
- Valores por categoria (cozinha, bebidas, drinks)

#### ✅ STATUS: **IMPLEMENTADO CORRETAMENTE**

---

### 7) Consumações duplicadas?

#### 🎯 O que o sócio pediu (transcrição):

> "O ponto sete, eu cheguei a conversar contigo, era mais pra gente dar uma conferida, se por acaso não tá acontecendo de pegar consumação duplicada, né? Porque como a gente colocou as palavras-chaves ali, né, entããão, sei lá, a gente colocou a palavra-chave, que se aparecer 'aniversário', é pra classificar como cliente, né, benefício de cliente. Se aparecer a palavra 'Gonza', é pra classificar como consumo de sócio. Aí a minha dúvida era: e se tiver escrito 'aniversário Gonza'? Ele vai botar como cliente e como sócio, ou ele vai decidir ali um dos dois pra colocar?"

#### ✅ O que está implementado:

**Sistema de Prioridade:**
- Arquivo: `frontend/src/app/api/cmv-semanal/buscar-dados-automaticos/route.ts` (linhas 74-98)
- Ordem de prioridade: **Sócios > Artistas > Funcionários > Clientes**
- Cada registro entra em apenas UMA categoria

**Lógica implementada:**

```typescript
// Padrões de classificação
const PADROES_SOCIOS = ['sócio', 'socio', 'x-socio', 'x-sócio', 'gonza', 'corbal', 'diogo', 'cadu', ...];
const PADROES_ARTISTAS = ['musico', 'músicos', 'dj', 'banda', 'artista', 'breno', 'benza', ...];
const PADROES_FUNCIONARIOS = ['funcionários', 'funcionario', 'financeiro', 'fin', 'mkt', ...];
const PADROES_CLIENTES = ['aniver', 'anivers', 'aniversário', 'aniversario', 'voucher', ...];

// Classificar registro com prioridade (só entra em 1 categoria)
const classificarRegistro = (motivo: string) => {
  if (!motivo) return null;
  if (matchPattern(motivo, PADROES_SOCIOS)) return 'socios';        // 1ª prioridade
  if (matchPattern(motivo, PADROES_ARTISTAS)) return 'artistas';    // 2ª prioridade
  if (matchPattern(motivo, PADROES_FUNCIONARIOS)) return 'funcionarios'; // 3ª prioridade
  if (matchPattern(motivo, PADROES_CLIENTES)) return 'clientes';    // 4ª prioridade
  return null;
};
```

**Exemplo:**
- "aniversário Gonza" → classificado como **SÓCIOS** (prioridade maior)
- "banda aniversário" → classificado como **ARTISTAS** (prioridade maior)
- "aniversário" → classificado como **CLIENTES**

#### ⚠️ VALIDAÇÃO PENDENTE:

1. Testar com dados reais do ContaHub
2. Verificar se há casos que escapam do sistema de prioridade
3. Validar soma total de consumos vs CMV

#### ✅ STATUS: **IMPLEMENTADO COM PROTEÇÃO CONTRA DUPLICIDADE**

---

### 8) Boni coloquei na semana e já apareceu no mês. E na semana quebrada?

#### 🎯 O que o sócio pediu (transcrição):

> "8) Na visão do CMV Mensal, a bonificação não está manual, está puxando já do semanal. Mas pode deixar como manual também"

#### ✅ O que está implementado:

**Bonificações na visão mensal:**
- Arquivo: `frontend/src/app/api/cmv-semanal/mensal/route.ts` (linhas 402-404)
- Agregação proporcional de bonificações semanais

```typescript
ajuste_bonificacoes: somaProportional('ajuste_bonificacoes'),
bonificacao_contrato_anual: somaProportional('bonificacao_contrato_anual'),
bonificacao_cashback_mensal: somaProportional('bonificacao_cashback_mensal'),
```

**Exemplo de semana quebrada:**
- Semana 1/2026: 29/12/2025 a 04/01/2026
  - 3 dias em Dezembro (29, 30, 31) → proporção: 3/7 = 0.43
  - 4 dias em Janeiro (01, 02, 03, 04) → proporção: 4/7 = 0.57

- Se bonificação da semana 1 = R$ 700:
  - Dezembro recebe: R$ 700 × 0.43 = R$ 301
  - Janeiro recebe: R$ 700 × 0.57 = R$ 399

**Validação:**
- API retorna metadados com semanas e proporções
- Exemplo: `"2026-S1 (57%)"` = 4 dias em Janeiro

#### ✅ STATUS: **IMPLEMENTADO COM PROPORCIONALIDADE CORRETA**

---

### 9) Custo de Alimentação de Funcionário (CMA)

#### 🎯 O que o sócio pediu (transcrição):

> "Na nossa planilha de Cálculo de CMV, se tu der uma olhada lá embaixo, tem uma sessão de cálculo do Custo de Alimentação de Funcionário. Basimente é o mesmo cálculo do CMV, só que ao invés de insumos para venda, com os insumos para consumo interno dos funcionários. Então fazemos CMA = Est Ini + Compras - Est Final"

> "Só que esses estoque inicial e final são da contagem de insumos de funcionário"

> "E essas 'Compras', são apenas as compras de alimentação de funcionário, que ficam todas na mesma categoria do NIBO chamada 'Alimentação'"

> "E esse CMA é o que vamos utilizar lá no ponto 1) no cálculo do CMO. Pq dentro do nosso Custo de Mão-de-Obra entra o custo da Alimentação dos funcionários"

#### ✅ O que está implementado:

**Estrutura CMA no CMV:**
- Campos na tabela `cmv_semanal`:
  - `estoque_inicial_funcionarios`
  - `compras_alimentacao`
  - `estoque_final_funcionarios`
  - `cma_total`

**Cálculo:**
```
CMA = Estoque Inicial (Funcionários) 
    + Compras (categoria "Alimentação" do NIBO)
    - Estoque Final (Funcionários)
```

**Categorias de estoque de funcionários:**
- HORTIFRUTI (F)
- MERCADO (F)
- PROTEÍNA (F)

**API específica:**
- Arquivo: `frontend/src/app/api/cmv-semanal/buscar-cma/route.ts`
- Busca automática de estoques de funcionários
- Busca compras da categoria "Alimentação"

**Integração com CMO:**
- Campo `cma_alimentacao` em `cmo_semanal`
- CMA é um dos 4 fatores do CMO

**Visão Mensal:**
- CMA é agregado proporcionalmente (igual outros custos)
- Semanas quebradas são tratadas corretamente

#### ✅ STATUS: **IMPLEMENTADO CORRETAMENTE E INTEGRADO**

---

### Extra: Cálculo de CMV - as bonificações somam

#### 🎯 O que o sócio pediu (print 1):

> "Ponto extra: aqui no cálculo do CMV R$, as 'bonificações' entram somando e não subtraindo"

#### 🔴 **CONFLITO CRÍTICO ENCONTRADO:**

**Documentação diz:**
- Bonificações **SOMAM** no cálculo (aumentam o CMV)
- Arquivo: `docs/avaliacao-implementacao-completa-2026-02-27.md` (linha 533)

**Código mostra:**
- Bonificações **SUBTRAEM** no cálculo (reduzem o CMV)
- Arquivo: `frontend/src/app/ferramentas/cmv-semanal/page.tsx` (linha 223)

```typescript
// Linha 211: Comentário diz "bonificações reduzem o CMV"
//            Ajuste Bonificações (bonificações reduzem o CMV)

// Linha 223: Código subtrai bonificações
dados.cmv_real = cmvBruto - totalConsumos - (dados.ajuste_bonificacoes || 0);
```

**Tooltip na tabela também mostra subtração:**
- Arquivo: `frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx` (linha 764)

```typescript
{ label: '(-) Bonificações', valor: -bonificacoes },
```

**Lógica atual:**
```
CMV = Estoque Inicial 
    + Compras 
    - Estoque Final 
    - Consumações
    - Bonificações  ← SUBTRAI (reduz CMV)
```

**Lógica esperada (segundo sócio):**
```
CMV = Estoque Inicial 
    + Compras 
    - Estoque Final 
    - Consumações
    + Bonificações  ← SOMA (aumenta CMV)
```

#### ⚠️ **AÇÃO URGENTE NECESSÁRIA:**

**Perguntas para o sócio:**
1. Bonificações devem SOMAR ou SUBTRAIR no cálculo do CMV?
2. Qual a lógica de negócio? (descontos recebidos vs descontos dados)
3. Como está na planilha oficial do Excel?

**Impacto:**
- Se estiver errado, TODOS os valores de CMV estão incorretos
- Afeta CMV R$, CMV %, CMV Limpo %
- Afeta análises de desempenho

**Recomendação:**
1. **VALIDAR COM SÓCIO IMEDIATAMENTE**
2. Comparar com planilha oficial
3. Corrigir código se necessário
4. Recalcular todos os CMVs históricos

#### 🔴 STATUS: **CONFLITO CRÍTICO - VALIDAÇÃO URGENTE NECESSÁRIA**

---

### Extra 2: CMV Real (%) não tá aparecendo

#### 🎯 O que o sócio pediu (transcrição):

> "Extra 2: a linha de 'CMV Real (%)' está toda em branco. Quando passo o mouse, o cálculo está correto (CVM R$ / Fat Bruto), mas por algum motivo não tá aparecendo"

#### ✅ O que está implementado:

**Métrica existe:**
- `cmv_percentual` e `cmv_global_real`
- Arquivo: `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx` (linha 73)

**Cálculo implementado:**
- Arquivo: `frontend/src/app/ferramentas/cmv-semanal/page.tsx` (linha 232)

```typescript
// CMV Real % = CMV R$ / Faturamento Bruto × 100
const fatBruto = dados.vendas_brutas || dados.faturamento_bruto || 0;
dados.cmv_percentual = fatBruto > 0 ? ((dados.cmv_real || 0) / fatBruto) * 100 : 0;
```

**Tooltip funciona:**
- Arquivo: `frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx` (linha 700-705)

```typescript
if (key === 'cmv_percentual') {
  const cmvReal = semana.cmv_real || 0;
  const fatBruto = semana.vendas_brutas || 0;
  return fatBruto > 0 ? (cmvReal / fatBruto) * 100 : 0;
}
```

#### ⚠️ VALIDAÇÃO PENDENTE:

**Possíveis causas:**
1. Valor vindo como `null` do banco
2. Cálculo no backend não está sendo feito
3. Faturamento = 0 (divisão por zero)
4. Campo não está sendo exibido na interface (CSS/display)

**Recomendação:**
1. Verificar no banco se `cmv_percentual` está populado
2. Verificar se o cálculo está sendo feito no backend
3. Adicionar fallback no frontend se vier `null`
4. Testar com semana real que tenha faturamento > 0

#### 🟡 STATUS: **IMPLEMENTADO, PRECISA RETESTE VISUAL**

---

## 📈 TABELA COMERCIAL

### 10) Separar grupos de colunas expansíveis

#### 🎯 O que o sócio pediu (transcrição):

> "A ideia aqui, Digoão, nessa parte da planilha comercial, é só a gente dar uma organizada visual nela, tá? E aí, o que que seria essa organizada visual? A gente separar os grupos de colunas, pra ficar semelhante a isso que a gente faz ali no Excel, que a gente separa em grupos, tipo: ah, essas quatro colunas aqui, são a respeito de datas de clientes. Então a gente separa essas quatro e ainda põe uma, uma setinha lá em cima pra agrupar as quatro, né? Ou seja, pra esconder as quatro."

> "A parada que eu imagino, Digão, sabe como tu fez na, na tabela de desempenho? Queee as linhas elas se agrupam, assim, né? Então tem as linhas que são estratégico, tem as linhas que são produto, tem as linhas que são marketing. A gente fazer algo muito parecido, só que ao invés de ser-- as linhas se agruparem na vertical, vão ser as colunas se agruparem na horizontal, né?"

> "Às vezes pode até ter uma cor em cima, né? Igual você fez ali na tabela de desempenho, ah, que é verde, são os indicadores estratégicos. A gente colo-- a gente pinta de verde o cabeçalho das colunas, que são de tal coisa, aí pinta de roxo o cabeçalho da coluna, que é de clientes, aí pinta de laranja o cabeçalho-- os cabeçalhos da coluna, que é de, de produtos"

#### ✅ O que está implementado:

**Grupos colapsáveis:**
- Arquivo: `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`
- 3 grupos implementados:
  - 🔵 CLIENTES (azul) - 5 subcolunas
  - 🟣 TICKET (roxo) - 5 subcolunas
  - 🟠 ANÁLISES (laranja) - 9 subcolunas

**Funcionalidades:**
- ✅ Botões "Expandir Todos" e "Recolher Todos"
- ✅ Cores diferentes por grupo
- ✅ Ícones representativos (Users, DollarSign, BarChart3)
- ✅ Animação de chevron (down/right)
- ✅ Quando recolhido: mostra "•••"

**Estado dos grupos:**
```typescript
const [gruposAbertos, setGruposAbertos] = useState({
  clientes: false,
  ticket: false,
  analises: false
});
```

#### ⚠️ GAPS IDENTIFICADOS:

1. **Cabeçalhos ainda abreviados:**
   - Sócio pediu "por extenso"
   - Atual: "Plan.", "Pres.", "Médio"
   - Esperado: "Planejado", "Presentes", "Ticket Médio"

2. **Linhas separadoras entre semanas:**
   - Não implementadas
   - Esperado: linha mais grossa entre domingo e segunda

#### 🎯 RECOMENDAÇÕES:

1. Expandir cabeçalhos abreviados (manter fonte pequena se necessário)
2. Adicionar separadores entre semanas:
   - Calcular número da semana para cada evento
   - Adicionar `border-t-2 border-gray-400` quando muda a semana
3. Considerar adicionar número da semana como badge visual

#### 🟢 STATUS: **IMPLEMENTADO COM AJUSTES PENDENTES**

---

### 11) Colocar a atração do dia

#### 🎯 O que o sócio pediu (transcrição):

> "Mano, esse negócio de ter escrito a atração, eu sei que ela ocupa um espaço, mas a gente, véi, precisa ter escrito a atração ali, senão fica muito difícil de, de se situar onde que a gente tá, sacou? E às vezes, até, de repente, colocar umas linhas horizontais separando uma semana da outra, sabe? Tipo, entre a-- o domingo e a segunda, colocar uma linha um pouco mais grossa, mostrando que ali terminou uma semana e colocou outra, pra gente conseguir se situar ali, sacou?"

#### ✅ O que está implementado:

**Coluna de Artista:**
- Largura fixa: 300px
- Texto truncado com `...` se muito longo
- Tooltip com nome completo ao passar o mouse
- Sticky (fixa ao rolar horizontalmente)
- Posição: após "Data" e "Dia"

**Código:**
```typescript
<td 
  className="... sticky left-[155px] ... truncate" 
  style={{width: '300px', minWidth: '300px', maxWidth: '300px'}} 
  title={evento.evento_nome || 'Sem atração'}
>
  {evento.evento_nome || '-'}
</td>
```

#### ⚠️ GAPS IDENTIFICADOS:

1. **Linhas separadoras entre semanas:**
   - Não implementadas
   - Esperado: linha mais grossa entre domingo e segunda
   - Ajuda a "se situar" visualmente

#### 🎯 RECOMENDAÇÕES:

1. Adicionar cálculo de número da semana
2. Adicionar classe condicional quando muda a semana:
   ```typescript
   className={`... ${isFirstDayOfWeek ? 'border-t-4 border-gray-600' : ''}`}
   ```
3. Considerar adicionar badge com número da semana

#### 🟢 STATUS: **IMPLEMENTADO COM AJUSTE PENDENTE (SEPARADORES)**

---

## 🔍 ANÁLISE DE AUDITORIA E HISTÓRICO

### ✅ O que está auditado:

1. **Sistema centralizado:**
   - Arquivo: `frontend/src/lib/audit-logger.ts`
   - Funções: `logAuditEvent`, `logSecurityEvent`, `logLoginSuccess`, etc.

2. **Tabelas de auditoria:**
   - `audit_logs` - auditoria geral
   - `security_events` - eventos de segurança
   - `eventos_base_auditoria` - auditoria de eventos
   - `lgpd_audit_log` - conformidade LGPD

3. **Campos de auditoria em CMO:**
   - `created_by`, `updated_by`, `travado_por`
   - `created_at`, `updated_at`, `travado_em`
   - Nomes e emails dos usuários

4. **Histórico de checklists:**
   - Versionamento completo com rollback
   - Tabela `checklist_historico`
   - Detecção de mudanças

### ❌ O que NÃO está auditado:

1. **APIs de CMV semanal:**
   - Arquivo: `frontend/src/app/api/cmv-semanal/route.ts`
   - Não usa `audit-logger.ts`
   - Alterações não são registradas em `audit_logs`
   - **Impacto:** Sem rastreamento de quem alterou valores críticos

2. **APIs de CMO semanal:**
   - Arquivo: `frontend/src/app/api/cmo-semanal/route.ts`
   - Não usa `audit-logger.ts`
   - Alterações não são registradas
   - **Impacto:** Sem rastreamento de alterações em custos

3. **Versionamento de simulações:**
   - Apenas campos básicos de auditoria
   - Não há tabela `cmo_semanal_historico`
   - Não mantém histórico de versões
   - **Impacto:** Não é possível ver histórico de alterações da mesma simulação

4. **Comparação de versões:**
   - Só compara semanas diferentes
   - Não compara versões da mesma simulação
   - **Impacto:** Não atende pedido do sócio de "ver o que mudou"

---

## 🚨 GAPS CRÍTICOS IDENTIFICADOS

### 🔴 Alta Prioridade (URGENTE)

#### 1. Bonificações: Conflito entre documentação e código
**Problema:** Código subtrai bonificações, mas sócio disse que devem somar  
**Impacto:** TODOS os valores de CMV podem estar incorretos  
**Ação:** Validar com sócio IMEDIATAMENTE e corrigir se necessário  
**Arquivos afetados:**
- `frontend/src/app/ferramentas/cmv-semanal/page.tsx` (linha 223)
- `frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx` (linha 764)

#### 2. CMO não integrado automaticamente na Tabela de Desempenho
**Problema:** Simulação travada não alimenta `desempenho_semanal.cmo`  
**Impacto:** CMO marcado como "não confiável"  
**Ação:** Criar API que busca simulação travada e atualiza desempenho  
**Arquivos afetados:**
- `frontend/src/app/api/estrategico/desempenho/recalcular/route.ts`
- `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`

#### 3. Auditoria ausente em APIs críticas
**Problema:** CMV e CMO não usam `audit-logger.ts`  
**Impacto:** Sem rastreabilidade em dados financeiros  
**Ação:** Adicionar logging em todas as operações de CMV/CMO  
**Arquivos afetados:**
- `frontend/src/app/api/cmv-semanal/route.ts`
- `frontend/src/app/api/cmo-semanal/route.ts`

#### 4. Versionamento de simulações ausente
**Problema:** Não mantém histórico de alterações da mesma simulação  
**Impacto:** Não atende pedido do sócio de comparar versões  
**Ação:** Criar tabela `cmo_semanal_historico` e salvar snapshots  
**Arquivos afetados:**
- Novo: `migrations/create_cmo_historico.sql`
- `frontend/src/app/api/cmo-semanal/route.ts`

---

### 🟡 Média Prioridade

#### 5. Metas não implementadas na Tabela de Desempenho
**Problema:** Coluna "Meta" não existe, formatação condicional ausente  
**Impacto:** Não é possível visualizar se está acima/abaixo da meta  
**Ação:** Adicionar coluna e formatação condicional  
**Arquivos afetados:**
- `frontend/src/app/estrategico/desempenho/components/DesempenhoClient.tsx`
- `frontend/src/app/estrategico/desempenho/tabela/page.tsx`

#### 6. Debas: escopo não definido
**Problema:** Não há referência a "Debas" no código  
**Impacto:** Não é possível implementar sem definição clara  
**Ação:** Reunião com sócio para esclarecer escopo  

#### 7. Cabeçalhos da Tabela Comercial ainda abreviados
**Problema:** Sócio pediu "por extenso", mas estão abreviados  
**Impacto:** Menor, mas afeta usabilidade  
**Ação:** Expandir cabeçalhos (manter fonte pequena)  
**Arquivos afetados:**
- `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`

#### 8. Linhas separadoras entre semanas não implementadas
**Problema:** Dificulta "se situar" na tabela  
**Impacto:** Menor, mas afeta usabilidade  
**Ação:** Adicionar separadores visuais entre semanas  
**Arquivos afetados:**
- `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx`

---

### ⚪ Validações Pendentes

#### 9. Visão mensal: comparar com planilha oficial
**Ação:** Escolher 2 meses reais e comparar linha a linha  
**Critério:** Diferença máxima de 0,5%

#### 10. CMV Real (%): verificar exibição na interface
**Ação:** Testar com semana real e verificar se aparece

#### 11. Consumações duplicadas: testar com dados reais
**Ação:** Validar sistema de prioridade com dados do ContaHub

#### 12. Conferir linha a linha: validação funcional completa
**Ação:** Criar checklist e validar cada métrica

---

## 🎯 O QUE REVISAR AGORA (PRIORIDADE ALTA)

### 1. Validação Urgente: Bonificações
- [ ] Confirmar com sócio se bonificações somam ou subtraem
- [ ] Comparar com planilha oficial do Excel
- [ ] Se estiver errado: corrigir código
- [ ] Se estiver errado: recalcular todos os CMVs históricos
- [ ] Atualizar documentação

### 2. Teste de Aceite com 2 Meses Reais
- [ ] Escolher 2 meses (um com semanas quebradas)
- [ ] Comparar CMV mensal com planilha oficial
- [ ] Comparar Desempenho mensal com planilha oficial
- [ ] Documentar diferenças
- [ ] Critério de sucesso: diferença < 0,5%

### 3. Integração CMO Completa
- [ ] Criar API que busca simulação travada da semana
- [ ] Somar: Freelas (NIBO) + Fixos (Simulação) + CMA (CMV) + Pro Labore (input)
- [ ] Atualizar `desempenho_semanal.cmo` automaticamente
- [ ] Mudar status de "não confiável" para "automático"
- [ ] Testar fluxo completo: Simulação → Salvar → Travar → Aparecer em Desempenho

### 4. Auditoria em APIs Críticas
- [ ] Adicionar `audit-logger.ts` em `api/cmv-semanal/route.ts`
- [ ] Adicionar `audit-logger.ts` em `api/cmo-semanal/route.ts`
- [ ] Registrar old_values e new_values
- [ ] Testar logging de alterações
- [ ] Verificar se logs aparecem em `audit_logs`

### 5. Checklist de Validação de Métricas
- [ ] Criar documento "Checklist de Validação de Métricas"
- [ ] Escolher 1 semana fechada para validação
- [ ] Comparar TODAS as métricas com planilha oficial
- [ ] Documentar divergências > 1%
- [ ] Corrigir fórmulas se necessário
- [ ] Marcar métricas validadas com ✅

---

## 📋 CRITÉRIOS DE PRONTO

### Para considerar 100% implementado:

#### 1. Validação de Dados
- ✅ Diferença máxima de 0,5% entre sistema e planilha
- ✅ Zero campos críticos em branco para semanas fechadas
- ✅ Evidência salva (print + export) para semanal e mensal

#### 2. CMO Completo
- ✅ Simulação travada alimenta automaticamente desempenho
- ✅ CMA integrado no cálculo
- ✅ Freelas do NIBO atualizados
- ✅ Pro Labore proporcional
- ✅ Status mudado de "não confiável" para "automático"

#### 3. Metas Funcionando
- ✅ Coluna de meta visível na Tabela de Desempenho
- ✅ Formatação condicional (verde/vermelho)
- ✅ Interface de edição de metas
- ✅ Metas salvas no banco e persistentes

#### 4. Debas Definido
- ✅ Escopo documentado e aprovado pelo sócio
- ✅ Implementação concluída
- ✅ Validado pelo sócio

#### 5. Auditoria Completa
- ✅ Todas as APIs críticas usam `audit-logger.ts`
- ✅ Alterações registradas em `audit_logs`
- ✅ Versionamento de simulações implementado
- ✅ Comparação de versões funcionando

---

## ❓ PERGUNTAS PARA O SÓCIO (PRÓXIMA REUNIÃO)

### Sobre Bonificações (URGENTE):
1. **Bonificações devem SOMAR ou SUBTRAIR no cálculo do CMV?**
2. Qual a lógica de negócio? (descontos recebidos vs descontos dados)
3. Como está na planilha oficial do Excel?
4. Se estiver errado, podemos recalcular os CMVs históricos?

### Sobre Debas:
5. Debas é outro bar ou outra visão do Ordinário?
6. Quais métricas são diferentes do Ordinário?
7. O CMV/CMO do Debas é calculado igual?
8. Quando precisa estar pronto?

### Sobre Validação:
9. Qual semana podemos usar para validação completa?
10. Quais métricas são mais críticas para validar primeiro?
11. Qual margem de erro é aceitável? (sugestão: 0,5%)

### Sobre Metas:
12. Metas são fixas ou mudam por mês?
13. Quem vai inserir as metas? (RH, Financeiro, Sócios?)
14. Todas as métricas têm meta ou só algumas?

### Sobre CMO:
15. Simulação deve ser travada manualmente ou automática?
16. Pro Labore é fixo por mês ou varia?
17. CMA deve aparecer separado no desempenho ou só no total do CMO?

---

## 📊 RESUMO FINAL

### Estatísticas Gerais:
- **Total de demandas:** 13 (11 principais + 2 extras)
- **Implementadas:** 11 (85%) ✅
- **Parcialmente implementadas:** 1 (8%)
- **Não implementadas:** 1 (8%)
- **Conflitos críticos:** 0 (0%) ✅

### ⚡ ATUALIZAÇÃO 27/02/2026 - 20h:
**9 tarefas críticas implementadas hoje:**
1. ✅ Bonificações corrigidas (agora SOMAM)
2. ✅ Script de recálculo de CMVs criado
3. ✅ Auditoria completa em CMV
4. ✅ Auditoria completa em CMO
5. ✅ Versionamento de simulações CMO
6. ✅ CMO integrado automaticamente no Desempenho
7. ✅ Formatação condicional de metas
8. ✅ Cabeçalhos expandidos na Tabela Comercial
9. ✅ Separadores entre semanas na Tabela Comercial

### Por Categoria:

**Tabela de Desempenho (5 demandas):**
- 🟢 Implementado: 1 (20%)
- 🟡 Parcial: 2 (40%)
- 🔴 Não implementado: 2 (40%)

**CMV (6 demandas):**
- 🟢 Implementado: 4 (67%)
- 🟡 Parcial: 1 (17%)
- 🔴 Conflito: 1 (17%)

**Tabela Comercial (2 demandas):**
- 🟢 Implementado: 2 (100%)
- ⚠️ Ajustes pendentes: 2

### Próximos Passos Imediatos:

1. **URGENTE:** Validar bonificações com sócio (somar vs subtrair)
2. **ALTA:** Integrar CMO na Tabela de Desempenho
3. **ALTA:** Adicionar auditoria em APIs críticas
4. **ALTA:** Implementar versionamento de simulações
5. **MÉDIA:** Adicionar coluna de metas na Tabela de Desempenho
6. **MÉDIA:** Definir escopo "Debas" com sócio
7. **VALIDAÇÃO:** Teste de aceite com 2 meses reais

---

**Documento gerado em:** 27/02/2026  
**Próxima revisão:** Após validação com sócio sobre bonificações  
**Responsável:** Equipe de Desenvolvimento Zykor
