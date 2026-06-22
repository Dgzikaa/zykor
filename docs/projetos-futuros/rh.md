# RH

> **O Cadastro de Funcionário é a pedra angular** — destrava praticamente todo o resto do RH
> (e da Operação). Os itens de operação que dependem do cadastro (Plano Operacional, Freelas,
> Escala) estão em [operacao.md](operacao.md).

---

## Cadastro de Funcionário (dossiê completo) — PEDRA ANGULAR
**Tipo:** Ferramenta · **Dificuldade: ~2 (módulo completo), faseável**

Registro único por funcionário: documentos (carteira de trabalho, exame admissional, contrato),
**banco de documentos** + **dossiê** (tempo de casa, última avaliação, advertências, faltas,
atestados, férias, datas de entrada/saída) + **alertas** + alimenta o CMO.

- **Fases:**
  - **v1 (Dif ~3):** cadastro + banco de documentos (com storage) + datas de entrada/saída.
  - **v2 (Dif ~2):** dossiê (avaliações, advertências, atestados, faltas, férias — cada um uma tabelinha).
  - **v3 (Dif ~4, barato depois da base):** alertas (sem exame admissional, contrato em branco,
    férias vencendo, muita hora extra).
- **Destrava:** CMO (datas entrada/saída → quase automático), Conferência de Folha (vira o "deveria
  ser"), Avaliação de Desempenho, Controle de Ponto, Escala, Provisões. Automatiza a **"Equipe"** no
  Desempenho semanal.
- **TO-CHECK: API da SOLIDES** — se expõe os dados, **importamos** em vez de recadastrar tudo na mão
  (e talvez puxe avaliações/ponto que já estão lá). Pode derrubar bastante o esforço do v1.
- **LGPD:** documento, salário, atestado médico = dados sensíveis → acesso restrito a RH (usar o
  resolver de permissão por módulo que já temos).

## Pesquisas de RH (felicidade, marca empregadora, feedback do gestor)
**Tipo:** Ferramenta · **Dificuldade: ~3 (v1)**

Motor genérico de pesquisas internas: cadastra tipo + banco de perguntas + cadência + amostragem
(ex.: 5 de 12 perguntas aleatórias por semana), dispara automático e registra **disparo + respostas**.

- **Reusa muito:** motor de NPS (já faz pra clientes), checklist, Web Push, cron.
- **2 decisões-chave:**
  1. **Canal de entrega** — WhatsApp tem risco de ban → e-mail, push ou link no app.
  2. **Anonimato** — pesquisa de clima precisa ser anônima pra ter resposta honesta. Modela registrar
     *que* fulano respondeu (controle de adesão), mas **desacoplado** da resposta em si.
- **Depende parcial** do Cadastro de Funcionário (lista de destinatários).
- **PAYOFF IMEDIATO:** auto-alimenta a coluna `gold.desempenho.nota_felicidade_equipe` (hoje
  preenchida na mão na tela `/estrategico/desempenho`).
- Valor = série temporal do clima (eNPS interno). Alimenta a Avaliação de Desempenho.

## Avaliação de Desempenho / Calibração — capstone do RH
**Tipo:** Ferramenta · **Dificuldade: ~3 (a camada; depende de Pesquisas + Cadastro)**
🖼️ Print: `docs/calibracao.png`

3 etapas:
1. **Auto-avaliação** (formulário — comportamento + performance, marcar X + campo aberto).
2. **Avaliação do líder** (mesmos critérios, outro link).
3. **Reunião de calibração:** o **card** junta auto × líder por critério + fit cultural + atributos de
   performance + faltas/atestados/advertências/tempo de casa + avaliação final calibrada + missões do
   trimestre. (Ex. do print: Katriny Sena, Aux. Financeiro, 5 meses.)

- **Reusa:** o motor de **Pesquisas** (os 2 formulários) e o **Cadastro** (o dossiê).
- O card **gera automático** a partir dos 2 links + os dados que já temos.
- **Precisa:** template de critérios **por cargo** (Aux. Financeiro tem atributos próprios).
- **Build Cadastro + Pesquisas antes.**

## Controle de Ponto
**Tipo:** Ferramenta · **Dificuldade: ~2**

Registro de ponto / banco de horas. Forte candidato a **integrar com a Solides** (se ela bate o ponto).
Alimenta os alertas do Cadastro (muita hora extra) e a aderência da Escala.

## Universidade (Bizu) — repositório de treinamento
**Tipo:** Ferramenta · **Dificuldade: ~4 (v1) · BAIXA urgência inicial**

Central que encaminha livro/curso, tipo repositório; marca quando funcionário entrou/concluiu.
- v1 simples: CRUD de itens de treino + atribuir a funcionário + marcar concluído. Reusa storage de
  documentos + base de funcionário.
- Vira LMS de verdade (trilhas, quiz, certificado) só se evoluir (Dif ~2). Começar como repositório.

## Conferência de Folha de Pagamento
**Tipo:** Ferramenta · **Dificuldade: ~3 (v1 histórico)**

Ler o PDF que a contabilidade gera e comparar **"como deveria ser" × "como veio"** (por funcionário:
salário, proventos, descontos, encargos).
- **Ler o PDF deixou de ser o gargalo** — o LLM (Claude) lê PDF nativo e extrai estruturado.
- **Gargalo virou o "deveria ser":**
  - **(a) Histórico** (mais rápido): "João veio R$X nos últimos 3 meses, esse mês R$Y → sinaliza".
    Mesmo motor do pente fino. Não depende de cadastro novo.
  - **(b) Cadastro de Funcionário** (mais completo): comparar com salário/contrato esperado.
- Versão "regra cheia" (conferir INSS/FGTS/IRRF pela CLT) = Dif ~2, arriscada (recria o cálculo da contabilidade).
- **🔗 Mesma fonte das Provisões** (o PDF da contabilidade) — ver [financeiro.md](financeiro.md).
