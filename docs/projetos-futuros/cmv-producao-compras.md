# CMV / Produção / Compras

> **Não são 5 projetos soltos — é 1 sistema** sobre a **Ficha Técnica** (a explosão receita→insumo).
> Construída a ficha técnica, os outros 4 destravam quase de graça.
>
> **~40% já existe:** insumos mestre, custo do cardápio (`produto_custo_manual` / menu_engineering),
> **Sugestão de Compras (no ar)**, **Contagem de Estoque (no ar)**, CMV semanal/mensal (schema `financial`).

## Cadeia de dependência
```
Ficha Técnica (ingrediente → preparo → finalização → produto) + de-para ContaHub/Yuzer
   └→ CMV Teórico ponderado  (vira automático no cmv-semanal)
   └→ Cálculo de Desvios     (precisa silver diária: venda → saída de insumo)
        └→ Planejamento de Produção (média 6 sem + estoque + calendário)
             └→ Planejamento de Compras (mesma lógica, p/ insumo, atrelado à produção)
```

---

## CMV Teórico (Fichas Técnicas) — a base
**Tipo:** Gestão · **Dificuldade: ~2–3**

Telas de cadastro (planilhas de origem):
1. **Base de ingredientes** — `https://docs.google.com/spreadsheets/d/1mAVk0YJEx6HiWc2Dx87ea6pqKsrBc-AdCGSjn_KU59I` aba `base_ingredientes`
2. **Cadastro de produções** (uso dos ingredientes) — `https://docs.google.com/spreadsheets/d/1klPn-uVLKeoJ9UA9TkiSYqa7sV7NdUdDEELdgd1q4b8` gid 349126794
3. **Ficha técnica dos preparos** — mesma planilha, gid 898207454
4. **Ficha técnica das finalizações** — gid 1059081379
5. **Resumo / cardápio** (CMV teórico calculado) — gid 656782210
   - CMV teórico = **preço de custo ÷ preço de venda**; o custo é a **soma da ficha técnica**.

**De-para ContaHub** (código interno ↔ código ContaHub/Yuzer) — gid 341119908.
- Resolve casos como **caipirinha vs caipirinha HH**: mesmo produto, mesmo custo, preço de venda
  diferente → CMV diferente. Casa o que está no ContaHub com o cadastro de produto.

**Ainda precisa ter:**
- CMV teórico **ponderado por dia/semana/mês** com base nas vendas.
- Aba que mostra **produtos vendidos sem ficha técnica / fora do de-para**.
- **Versionamento** de ficha técnica (gravar toda alteração de custo/composição).
- **Alertas inteligentes:** CMV que ficou absurdo por mudança de custo nos pedidos; comparação da
  base de ingredientes com o **Vmarket** (preço cadastrado faz sentido com os pedidos?).
- **Resultado:** no CMV semanal, o **CMV teórico vira automático**.

## Cálculo de Desvios
**Tipo:** Gestão · **Dificuldade: ~3** (exige silver nova)
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1ltPEONfL7hqf_DsAQHuTpSGGvyxfHQ0dOO3064V_fts` (gid 1414538761)

Desvio = vendi 50, deveria sair 50; se saiu 52 → desvio de 2. Compara o que tinha em estoque,
vendeu, e quanto sobrou no fim da semana.
- **Exige uma silver nova:** explodir cada venda em **saída de insumo** (gin tônica → gin + tônica +
  ...; tilápia empanada → insumos do preparo), rodando **diariamente**. É pipeline medallion, que já
  sabemos fazer.
- **Dream:** contei estoque dia 1; quando for contar dia 8 (segunda de manhã), já ter rodado quanto
  vendi e quanto comprei, e mostrar **quanto deveria ter**.

## Planejamento de Produção
**Tipo:** Gestão · **Dificuldade: ~3**
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1klPn-uVLKeoJ9UA9TkiSYqa7sV7NdUdDEELdgd1q4b8` (gid 349126794)

Saída das últimas 6 semanas → média pra próxima → vê o estoque → mostra a diferença → sugere produzir.
- Ex.: caldinho de feijão rende ~4kg; em estoque só 1,5kg; precisa de 12kg na semana → sugere produzir 3.
- **Calendário com regra de prioridade:** estoque baixo → produz o quanto antes (terça); estoque com
  folga → empurra pra quinta/fim de semana.
- Coluna **"dias de estoque"** (quanto o estoque atual aguenta).
- Liga ao **Controle de Produção** (planejado × produzido de fato — ver o princípio Planejado×Realizado no README).

## Planejamento de Compras
**Tipo:** Gestão · **Dificuldade: ~3** (é a evolução da Sugestão de Compras já feita)
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1mAVk0YJEx6HiWc2Dx87ea6pqKsrBc-AdCGSjn_KU59I` (gid 0)

Posterior à produção, mesma lógica para insumo: média de 6 semanas + estoque → sugere compra.
- Ex.: preciso de 200kg de limão na semana, tenho 1kg → comprar 199kg.
- **Soma duas contas:** insumo usado direto (limão no kibe, cortado) + insumo usado em preparo
  (limão na carne moída) → soma os dois.
- **Atrelado à produção:** se não vou produzir, não tem por que comprar. Esse link produção↔compra
  precisa existir.
