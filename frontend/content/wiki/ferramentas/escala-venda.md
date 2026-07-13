---
title: Escala × Venda
area: ferramentas
slug: escala-venda
route: /operacional/escala-produtividade
description: Cruza quantas pessoas estavam batendo ponto em cada hora do dia com a venda média daquela hora, para achar horas com gente demais ou de menos em relação à demanda.
order: 130
icon: UsersRound
---

# Escala × Venda

## Visão geral

A tela **Escala × Venda** compara, hora a hora, quanta gente estava trabalhando (ponto do **Tangerino**) com quanto o bar vendeu naquela mesma faixa de horário (venda do **ContaHub**). O objetivo é responder uma pergunta prática de quem monta escala: **em quais horas do dia sobra gente para a venda que existe, e em quais horas a equipe está no aperto?**

Cada hora do dia recebe um indicador de **produtividade** (venda média dividida por pessoa naquela hora) e uma classificação de escala: *gente demais*, *gente de menos* ou *equilibrado*. Assim o gestor consegue redistribuir turnos: puxar gente das horas onde a venda não justifica o time e reforçar as horas em que poucas pessoas estão segurando muita venda.

É uma ferramenta de **leitura e diagnóstico** — não edita escala nem lança ponto. Serve para dono, gerente e quem faz a escala semanal olharem o padrão médio de um período (30 ou 90 dias) e ajustarem a alocação de pessoas.

## Como acessar

No menu lateral, abra o grupo **Ferramentas** e clique em **Escala × Venda** (ícone de pessoas). A rota é `/operacional/escala-produtividade`.

A tela exige a permissão de módulo **gestao**. Sem ela, o item não aparece no menu e a rota fica bloqueada. É necessário ter um **bar selecionado** no seletor de bar — sem bar ativo a tela mostra apenas "Selecione um bar".

## Passo a passo

**Ler o diagnóstico do período**
1. Selecione o bar no seletor no topo do sistema.
2. Entre em **Ferramentas → Escala × Venda**.
3. A tela já carrega os últimos **90 dias** por padrão.
4. Olhe primeiro os quatro cards no topo (pico de gente, produtividade mediana, horas com gente demais, horas apertadas) para ter o resumo.
5. Desça para o gráfico **Gente × Venda por hora** e para a tabela **Detalhe por hora** para ver hora a hora.

**Trocar o período de análise**
1. No canto superior esquerdo há um botão com duas opções: **30d** e **90d**.
2. Clique em **30d** para olhar o comportamento mais recente ou **90d** para uma média mais estável.
3. A tela recarrega automaticamente com o novo período.

**Interpretar as cores**
1. No gráfico, cada barra é uma hora do dia. A **cor da barra** indica a escala versus demanda.
2. **Vermelho** = gente demais para a venda daquela hora.
3. **Azul** = pouca gente para a venda (aperto).
4. **Verde** = equilibrado.
5. A **linha amarela** sobre as barras é a venda média daquela hora.

Não há exportação, edição ou aprovação nesta tela — ela é só de consulta.

## Colunas e cálculos

Os quatro cards no topo (HeroRow):

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Pico de gente | A hora do dia com mais pessoas em média e quantas pessoas | Hora com maior valor de `pessoas` na tabela combinada | `kpis.pico_gente` (função `fn_escala_produtividade`) |
| Produtividade mediana | Venda média por pessoa por hora, no meio da distribuição | Mediana (percentil 50) da produtividade de todas as horas que tiveram venda | `kpis.prod_mediana` |
| Horas com gente demais | Quantas horas do dia estão classificadas como "sobra" | Contagem de horas onde produtividade < 0,5 × mediana **e** pessoas ≥ 2 **e** venda > 0 | `kpis.horas_sobra` |
| Horas apertadas | Quantas horas do dia estão classificadas como "aperto" | Contagem de horas onde produtividade > 1,8 × mediana **e** venda > 0 | `kpis.horas_aperto` |

Tabela **Detalhe por hora** (uma linha por hora do dia, mostrando apenas horas com pessoas ou venda):

| Coluna / Indicador | O que mostra | Como é calculado | Fonte |
|---|---|---|---|
| Hora | A hora do dia (ex.: 20h) | `hora` (0 a 23) extraída dos intervalos de ponto e das horas de venda | `por_hora[].hora` |
| Pessoas | Média de pessoas trabalhando naquela hora do dia | Para cada dia conta funcionários distintos ativos naquela hora; depois tira a média entre os dias do período. Arredondado a 1 casa | `por_hora[].pessoas` — `bronze_tangerino_punch` |
| Venda média | Venda média daquela hora do dia | Soma a venda por dia+hora do ContaHub e tira a média entre os dias. Arredondado para inteiro | `por_hora[].vendas` — `bronze_contahub_avendas_vendasdiahoraanalitico` |
| R$/pessoa·h | Produtividade: quanto cada pessoa "gera" de venda por hora | Venda média da hora ÷ pessoas da hora. Se não havia gente, fica em branco (—) | `por_hora[].prod` |
| Escala | Rótulo colorido do estado da hora | Ver regra de status abaixo | `por_hora[].status` |

Regra do campo **Escala / status** (calculada no SQL, mesma lógica no gráfico e na tabela):

| Status | Rótulo na tela | Cor | Condição |
|---|---|---|---|
| `sobra` | Gente demais | Vermelho | produtividade < 0,5 × mediana **e** pessoas ≥ 2 |
| `aperto` | Gente de menos | Azul | produtividade > 1,8 × mediana |
| `ok` | Equilibrado | Verde | qualquer hora com venda que não caia em sobra nem aperto |
| `fechado` | — (não exibe rótulo) | Cinza | produtividade nula **ou** venda = 0 |

Gráfico **Gente × Venda por hora**: as **barras** representam `pessoas` (com a cor definida pelo `status` da hora) e a **linha amarela** representa `vendas` (venda média da hora).

## Filtros e opções

| Filtro / opção | Efeito |
|---|---|
| Seletor de bar (topo do sistema) | Define qual bar é analisado. Todo o cálculo é feito para o `bar_id` selecionado. |
| Período **30d / 90d** | Janela de dias considerada (padrão 90). A API aceita de 7 a 365 dias, mas a tela só oferece os botões de 30 e 90. |

Não há filtro por funcionário, por dia da semana nem por categoria — a análise sempre agrega por **hora do dia** dentro do período escolhido.

## Regras e detalhes importantes

- **Ponto vem taggeado como bar_id=4.** Todo registro de ponto do Tangerino chega marcado como Deboche (`bar_id=4`). Por isso a função **não confia nessa tag**: ela deriva o bar real pelo **local do Tangerino** (campo `interessePlace` do payload — "Ordinário Bar" ou "Deboche Bar"). Se o registro não tem local, cai para o **bar dominante do funcionário** (onde ele bate ponto na maioria das vezes).
- **Média por hora do dia, não por data.** O cálculo não junta dia com dia: para cada hora conta as pessoas por dia e depois tira a média entre os dias. Isso evita desalinhar o corte gerencial do bar.
- **Turno aberto ganha +4h.** Se o funcionário bateu entrada mas não bateu saída, o sistema assume 4 horas de turno.
- **Turnos longos são descartados.** Intervalos maiores que 16 horas (provável esquecimento de bater a saída) são ignorados para não inflar as horas.
- **Fuso horário.** As batidas de ponto (epoch em milissegundos) são convertidas para o horário de Brasília (America/Sao_Paulo) antes de gerar as horas.
- **Venda por hora.** A venda usa `vd_dtgerencial` (data gerencial) e a hora no formato "HH:00" da tabela analítica de vendas por dia/hora do ContaHub, filtrada por `bar_id`.
- **Mediana só de horas com venda.** A produtividade mediana (base das classificações) considera apenas horas com produtividade calculável e venda > 0.
- **Estado vazio.** Se não há dados de ponto para o bar/período, a tela mostra "Sem dados de ponto para este bar/período." A tabela só lista horas que tiveram pessoas ou venda.
- **Arredondamentos.** Pessoas com 1 casa decimal; venda e produtividade em reais inteiros (sem centavos).
- **Somente leitura e automático.** Nada aqui é manual: tudo vem do ETL de ponto (Tangerino) e de venda (ContaHub).

## Dúvidas frequentes

**O que significa "gente demais" (vermelho)?**
Naquela hora do dia a produtividade média (venda por pessoa) ficou abaixo de metade da mediana e havia pelo menos 2 pessoas. Ou seja, a venda existente não justifica o tamanho do time — candidata a enxugar escala.

**E "gente de menos" (azul)?**
A produtividade ficou muito acima da mediana (mais de 1,8×), sinal de que pouca gente segurou muita venda. Pode ser hora de reforçar o time.

**Por que a produtividade aparece em branco em algumas horas?**
Porque não havia ninguém batendo ponto naquela hora (pessoas = 0), então não dá para dividir a venda por pessoa.

**Os números são de um dia específico?**
Não. São médias por hora do dia ao longo do período escolhido (30 ou 90 dias). Servem para ver o padrão, não um plantão isolado.

**Por que o ponto do Ordinário aparece aqui se tudo vem marcado como Deboche?**
Porque a função corrige o bar pelo local real do registro no Tangerino, ignorando a tag `bar_id=4` que vem errada de origem.

**Consigo editar a escala por aqui?**
Não. A tela é só de diagnóstico. O ajuste da escala é feito fora do sistema, com base no que ela aponta.

## Fonte dos dados

- **Função SQL:** `operations.fn_escala_produtividade(p_bar_id, p_dias)` — consolida ponto × venda e devolve `por_hora`, `kpis` e `meta`.
- **Ponto:** `bronze.bronze_tangerino_punch` — integração **Tangerino** (batidas de ponto; bar real derivado do local `interessePlace`).
- **Venda:** `bronze.bronze_contahub_avendas_vendasdiahoraanalitico` — integração **ContaHub** (venda por dia e hora).
- **API:** `/api/operacional/escala-produtividade` (chama a RPC com service_role, autenticação de usuário obrigatória).
