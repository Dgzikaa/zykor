# Operação

> O fluxo de operação é **um só**: prever → dimensionar → escalar → custear → comparar.
> ```
> Previsão de Demanda  →  Plano Operacional  →  Escala + Freelas  →  CMO  →  (planejado × realizado)
> ```
> (Previsão de Demanda está em [receita-gestao.md](receita-gestao.md).)

---

## Plano Operacional (dimensionamento de equipe) — o miolo do fluxo
**Tipo:** Gestão · **Dificuldade: ~4 (a conta é trivial)**
🔗 Planilha: `https://docs.google.com/spreadsheets/d/123f2fy0lQN-lWXMu4BT2mJApy9Dgtww5JHyDXQWJkyQ` (gid 1973737039)

Planeja a semana: input de faturamento/pessoas por dia → calcula quantos de cada papel (garçom,
cumim, host, ASG, bartender, barback, cozinha, headcount ops) → custo.

**Conta (determinística):**
- Pessoas = faturamento ÷ ticket médio do dia (ou input direto × giro **1,3**).
- Equipe por papel = pessoas ÷ eficiência.
- Custo = equipe × diária do freela.

**Parâmetros (não mexer):**
| | |
|---|---|
| Giro / lotação | 1,3 |
| Ticket médio | seg 103 · ter 103 · qua 106 · qui 105 · sex 113 · sáb 103 · dom 105 |
| Eficiência (pessoas por colaborador) | garçom 38 · cumim 47 · host 150 · asg 125 · bar 125 · back 150 · coz 150 · seg 110 · bri 600 |
| Diária freela | garçom 170 · cumim 130 · host 120 · asg 130 · bar 160 · back 130 · cozinha 130 · seg/bri 190 |

**O valor está nas conexões** (sozinho é só uma calculadora):
- **Entrada:** hoje o faturamento é chutado → a **Previsão de Demanda** alimenta automático.
- **Saída → CMO:** o custo de pessoal = mão de obra (o CMO já existe).
- **Saída → Escala/Freelas:** a quantidade por papel define os slots a preencher.
- Depois compara **planejado × realizado** (dimensionei 17, escalei 16, custou Y).
- É o item **mais barato dos 4** → bom ponto de partida pra amarrar o fluxo.

## Controle de Freelas
**Tipo:** Gestão · **Dificuldade: ~3 (~70% cola de coisas prontas)**
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1AtbYTwvlHu4PLL8giPcipfsYOYFnqZiv3ELOptI1bwA` (gid 901738503)

Cadastrar freela (na tela de Cadastro de Funcionário, tipo "freela") + valor por função + escalar os
dias que foi → soma a semana → **agendamento automático na segunda** do total + histórico.

- **Reusa MUITO:**
  - Motor de pagamento/agendamento já existe (`FreelaTab` + `NovoFreelaDialog` + PIX Inter → CA). O
    "agendamento automático na segunda" = cron que soma a escala da semana e cria o pedido.
  - **"Quanto já pagamos pra ele"** já está nos **Beneficiários** (`total_pago` por pessoa).
  - Valor por função = os parâmetros do **Plano Operacional**.
  - Freela = pessoa do **Cadastro de Funcionário**.
- **Novo (pouco):** a escala (marcar dias), a soma → agendamento, e faltas + **nota por dia** (pra
  saber bônus/contratação).
- Fecha o loop do Plano Operacional (dimensionado × escalado = planejado × realizado).

## Escala da Equipe — capstone da operação
**Tipo:** Gestão · **Dificuldade: ~3 (item mais "UI-heavy" da operação)**
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1AtbYTwvlHu4PLL8giPcipfsYOYFnqZiv3ELOptI1bwA` (gid 1872543059)

Grade de quem trabalha/folga, entrada/saída, abre/fecha — 9h/dia, 44h/semana, distribuindo folgas.

- **v1:** grade manual com **contadores e alertas** (somatório 44h por pessoa, flag de conflito,
  marca abre/fecha). "Facilitar montar" = ver os totais e erros na hora.
- **v2:** auto-sugestão/otimização (distribui folgas respeitando 44h, equilibra abre/fecha, considera
  banco de horas).
- **Roster = visão dos funcionários ATIVOS** — admitiu entra, demitiu some (auto-sync com o Cadastro;
  não manter duas listas).
- **"Padrão de escala"** = template recorrente por pessoa (ex.: Marcelo ter/qui/sex/sáb, abre sexta)
  que **pré-preenche** a grade → não começa do zero, só ajusta o que muda; tudo sobreescrevível manual.
- **Conexões:** Plano Operacional dá o "quantos" → Escala dá "quem/quando" → envia por wpp/push (item
  de disparos) → **Solides (ponto): aderência escala × ponto = planejado × realizado + banco de horas**
  (mesmo TO-CHECK da API Solides) → CMO.

## Checklist (substituir o Konklui)
**Tipo:** Ferramenta · **Dificuldade: ~3 (v1)**
🖼️ Print: `docs/checklistexemplo.png` (Connect Team — Checklist Financeiro Diário, itens Sim/Não, analytics de adesão)

Checklists por área + periodicidade (diário/semanal/mensal) com prazo, foto, assinatura + **dashboard
de adesão** (de 20 enviados, 18 ok; média; linha que mais falha) + **notificação = o diferencial**.

- **Notificação (o "full HD" que o Konklui não faz):** cobrar o **não-preenchimento** no prazo
  (watchdog tipo `vigia_*`: deu 17h, faltou o checklist da área X → push/Discord). O "preencheu →
  confirma" é trivial; o "faltou → cobra" é só comparar esperado × recebido no horário.
- **Fundação parcial já existe:** tabelas `checklist_` + API (o frontend de execução foi removido na
  faxina por estar sem uso).
- **É primo da Pesquisa de RH** (formulário recorrente com prazo) → **mesmo motor de forms**, pensar juntos.
- **🔑 Sinergia com a Auditoria do CA:** vários itens do checklist financeiro (conciliação CA, conferir
  vencidos, atualizar DRE) são o que o Zykor já automatiza → futuro auto-marca/cruza.
- Lógica **área → gestor → funcionário** depende do Cadastro de Funcionário (começar com mapa manual).

## Cardápio Digital (substituir o Getin, R$200/mês)
**Tipo:** Ferramenta · **Dificuldade: por camada (ver abaixo)**

Cardápio com produtos/fotos/preço + QR code.

- **v1 — vitrine (Dif ~3):** **dirigida pelo ContaHub** (já ingerimos os produtos → desativar no
  ContaHub some do cardápio = **viável**) + enriquecida no Zykor (fotos/descrição).
- **CRITICIDADE (recomendação técnica):** o cardápio é uma página **pública e de leitura** → fazer
  como **snapshot estático em CDN/edge** (atualiza on-change, valida antes de publicar). **Não precisa
  servidor secundário** — se o back-end cair, o cache continua no ar. Preço seguro pelo publish
  controlado. O difícil de manter no ar é a parte *transacional*, não a *vitrine*.
- **v1.5 — inteligência de vitrine (Dif ~3, DIFERENCIAL):** janelas de horário (HH 20h–21h aparece e
  fecha sozinho), promoções automáticas, e — o ouro — **mostrar primeiro os produtos de bom CMV**
  (Getin/iFood não sabem a margem; o Zykor sabe).
- **v2 — pedido transacional (Dif ~1–2, meses):** cliente pede direto (estilo Noru), promoção
  relâmpago, pagamento. **Aqui a disponibilidade fica difícil** (transacional) e muda a operação →
  manter **separado** da vitrine.
- Justificativa de construir = os diferenciais (ContaHub + CMV merchandising + controle), não os R$200/mês.

## Dashboard Gestão à Vista ao vivo (TV)
**Tipo:** Ferramenta · **Dificuldade: ~3 (fundação pronta)**

TV com indicadores: vendas acumuladas, pessoas na casa, tempo de cozinha/drinks.

- **O "ContaHub não tem API" NÃO é bloqueio** — o Zykor inteiro já vive disso: puxamos o ContaHub
  pelos endpoints internos de query, num cron (`contahub-sync-automatico`). Os dados já entram:
  produto×hora (qry95), `cl_real` (pessoas), `t_coz`/`t_bar` (tempos).
- **Não é "ao vivo ao segundo" — é near-live (atraso de minutos)**, o que é suficiente pra uma TV.
- **Falta:** (1) sync apertado só dos KPIs do dia, a cada 1–2 min em horário de operação; (2) página
  kiosk/TV (números grandes, auto-refresh, sem login).
- **Cuidados:** respeitar o lock do ContaHub (`porproduto` triplica se sync roda em paralelo) e a
  fragilidade dos endpoints sem contrato (já vale pro pipeline todo).
