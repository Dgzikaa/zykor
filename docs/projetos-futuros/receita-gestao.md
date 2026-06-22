# Receita / Marketing e Gestão

---

## CRM + Disparos (substituir o Umbler)
**Tipo:** Ferramenta · **Dificuldade: código ~3; o gargalo é a Meta (semanas de burocracia)**

Fazer os disparos de WhatsApp nós mesmos, pelo **caminho OFICIAL: WhatsApp Business Platform /
Cloud API da Meta**. (NÃO automatizar número normal = ban — ver `project_alertas_discord_*`.)

**Como funciona o processo:**
1. Meta Business + verificação da empresa (CNPJ) → criar uma **WABA** (WhatsApp Business Account).
2. **Número dedicado** à API (não pode estar no app do WhatsApp ao mesmo tempo).
3. **Templates pré-aprovados** pra mensagem que você inicia; texto livre só na **janela de 24h** após
   o cliente responder.
4. **Opt-in obrigatório.** Disparo frio mata a qualidade.
5. **Tiers de qualidade:** começa com limite (1k/dia) e escala (10k→100k→ilimitado); cai com spam/block.
6. **Custo:** paga a Meta por conversa/mensagem (mais barato que o markup do Umbler em escala).

- **Chance de aprovação:** alta pra utilidade/transacional (NPS, reserva, status) a quem deu opt-in;
  marketing tem mais escrutínio.
- **Complexidade real:** o código é médio (REST send + webhook, já fazemos integrações). O custo real é
  o **onboarding/verificação na Meta + aprovação de templates + disciplina de opt-in/qualidade** =
  **semanas de burocracia, não dev.** → começar a verificação/WABA **já**, em paralelo.
- **Alternativa:** um BSP mais barato que o Umbler (Twilio, 360dialog, Gupshup) — gerencia a parte chata.
- **CRM (Dif ~2–3):** a base já existe (schema `crm`, `cliente_visitas`, clube de membros). Falta
  segmentação + histórico + a caixa de entrada (inbox). O CRM define *pra quem*; o Cloud API faz o *envio*.

## Previsão de Demanda
**Tipo:** Ferramenta · **Dificuldade: ~3 (v1) — bem posicionado**

Prever quantas pessoas virão por dia, pra sair do "chute".

- **Já temos metade da base:** `cl_real` histórico + **público médio por artista** (do painel de
  Artistas que construímos — o preditor mais forte) + dia da semana + reservas (GetIn).
- **Abordagem recomendada — modelo TRANSPARENTE (baseline + fatores), NÃO caixa-preta** (o sócio
  precisa confiar/entender o número):
  > Estimativa = base do dia da semana + efeito da atração + sinal de reservas + calendário + tendência.

  Ex. sexta com Benzadeus: base 400 + Benza +200 + reservas +50 = ~650. Sem Benza, tira o +200 e soma o
  grupo menor escalado. ML pesado entra depois só pra refinar.
- **"Nível competidor":** não acessamos dados de concorrente; é um bom modelo nos **nossos** dados +
  somar fontes externas grátis (feriado, evento da cidade, clima).
- **Parâmetros extensíveis (catálogo de fatores + marcar dias):** chuva, feriado, artista,
  **telão/transmissão**, eventos externos (Oscar, final NBA, final Brasileirão). 3 tipos:
  1. **Sabidos com antecedência** (artista, feriado, telão programado, evento agendado) — melhores pro forecast.
  2. **Previsíveis** (chuva → API de previsão do tempo).
  3. **Só sabidos depois** (clima real, no-show) — só explicam, não preveem.
  - Arquitetura = catálogo de parâmetros (CRUD) + marcar cada dia → o modelo **aprende o efeito de cada
    fator**. "Se alimenta" = quanto mais dias marcados, melhor.
  - **Caveat honesto:** fator novo com 1–2 ocorrências tem sinal fraco (usa o palpite do sócio); de ~4–5
    repetições aprende sozinho. Aprende com a marcação, não nasce sabendo.
- **Cuidado:** no-show do GetIn não é confiável (~40% dos "no-show" foram ao bar) → usar o cruzamento
  reserva × presença.

## Trello / Notion (gestão de tarefas)
**Tipo:** Ferramenta · **2 níveis**

- **Nível 1 — criar tarefas (Dif ~3):** mirar **Trello/Kanban, NÃO Notion completo** (blocos/docs/
  databases = produto inteiro). Kanban com cards/responsável/status/prazo resolve 90%.
- **Nível 2 — casar com OKRs e gerar demandas por área (Dif ~2–3, o OURO):** conecta no **organizador**
  (`/estrategico/organizador`, onde estão os OKRs) → cascata Objetivo → KR → iniciativa → **tarefas
  automáticas por área**. O LLM ajuda a decompor um objetivo em tarefas sugeridas. Depende de OKRs
  estruturados + nível 1 existir.
- **Make-vs-buy:** nível 1 é commodity (Trello existe pronto e barato). O que **só o Zykor faz** é o
  nível 2 (estratégia → execução com os dados deles). Avaliar usar um kanban simples/existente e
  investir o esforço no nível 2.

## Painel de Indicadores por Setor
**Tipo:** Ferramenta · **Dificuldade: ~3 (o framework)**

Um painel por área (financeiro, RH, etc.) com os indicadores **só daquele setor** (lançamentos
atrasados, adesão de checklist, metas...).

- **É AGREGADOR/cockpit, não fonte de dado** — consome o que os outros projetos produzem, fatiado por
  setor (atrasos ← Auditoria CA; checklists ← Checklist; metas ← Organizador/OKR; CMV/NPS/fat ← gold).
  A riqueza cresce conforme automatizamos os outros itens.
- **Recomendação:** **1 motor de painel templado** (sistema de tiles) configurado por setor — **não 5
  painéis separados**. v1 mistura tiles automáticos (o que já temos) + inputs manuais que viram
  automáticos depois.
- **Distinção de 3 dashboards (não confundir):**
  1. **Gestão à Vista TV** = operacional, near-live (ver [operacao.md](operacao.md)).
  2. **Desempenho semanal** = já existe.
  3. **Painel por Setor** (este) = gestão estratégica setorizada.
- **Uso real:** artefato da **imersão trimestral** — mostra o gap da meta → amarra com o nível 2 do
  Trello (cascata de demandas entre áreas) + OKRs → fecha o ciclo **meta → diagnóstico → ação**.
