import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = 'gemini-1.5-pro-latest'

interface SQLRequest {
  bar_id: number
  pergunta: string
  tipo?: 'consulta' | 'analise' | 'otimizacao'
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { bar_id, pergunta, tipo = 'consulta' }: SQLRequest = await req.json()
    const startTime = Date.now()

    // 1. MAPEAR ESQUEMA COMPLETO DO BANCO (tabelas reais)
    const esquemaBanco = `
# ESQUEMA COMPLETO DO BANCO DE DADOS - ZYKOR (SGB)

## 1. DADOS OPERACIONAIS

### bars (Cadastro de Bares)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único do bar |
| nome | VARCHAR | Nome do estabelecimento |
| cnpj | VARCHAR | CNPJ |
| endereco | TEXT | Endereço completo |
| ativo | BOOLEAN | Se está ativo |
| config | JSONB | Configurações específicas |
| metas | JSONB | Metas configuradas |

### usuarios_bar (Usuários por Bar)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| user_id | UUID FK | Referência auth.users |
| email | VARCHAR | Email do usuário |
| nome | VARCHAR | Nome completo |
| role | VARCHAR | Papel (admin, gerente, etc) |
| nivel_acesso | TEXT | Nível de permissão |
| modulos_permitidos | JSONB | Módulos liberados |
| ativo | BOOLEAN | Se está ativo |

---

## 2. EVENTOS (TABELA PRINCIPAL PARA FATURAMENTO DIÁRIO)

### eventos_base (Consolidado diário - TABELA MAIS IMPORTANTE)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_evento | DATE | Data do evento/dia |
| dia_semana | VARCHAR | Dia da semana (Segunda, Terça...) |
| semana | INTEGER | Número da semana no ano |
| nome | VARCHAR | Nome do evento |
| artista | VARCHAR | Nome do artista/banda |
| genero | VARCHAR | Gênero musical |
| ativo | BOOLEAN | Se está ativo |
| **METAS E PLANEJAMENTO** |
| m1_r | NUMERIC | Meta de faturamento (M1) |
| cl_plan | INTEGER | Clientes planejados |
| res_p | INTEGER | Reservas planejadas |
| lot_max | INTEGER | Lotação máxima |
| te_plan | NUMERIC | Ticket entrada planejado |
| tb_plan | NUMERIC | Ticket bebida planejado |
| c_artistico_plan | NUMERIC | Custo artístico planejado |
| **VALORES REALIZADOS** |
| real_r | NUMERIC | Faturamento real total |
| cl_real | INTEGER | Clientes reais (PAX) |
| res_tot | INTEGER | Reservas totais |
| te_real | NUMERIC | Ticket entrada real |
| tb_real | NUMERIC | Ticket bebida real |
| t_medio | NUMERIC | Ticket médio geral |
| c_art | NUMERIC | Custo artístico real |
| c_prod | NUMERIC | Custo produção |
| **MÉTRICAS CALCULADAS** |
| percent_art_fat | NUMERIC | % artístico sobre faturamento |
| percent_b | NUMERIC | % bebidas |
| percent_d | NUMERIC | % drinks |
| percent_c | NUMERIC | % comidas |
| t_coz | NUMERIC | Tempo médio cozinha (min) |
| t_bar | NUMERIC | Tempo médio bar (min) |
| fat_19h | NUMERIC | Faturamento até 19h |
| fat_19h_percent | NUMERIC | % do faturamento até 19h |
| **INTEGRAÇÃO SYMPLA/YUZER** |
| sympla_liquido | NUMERIC | Valor líquido Sympla |
| sympla_checkins | INTEGER | Check-ins Sympla |
| yuzer_liquido | NUMERIC | Valor líquido Yuzer |
| yuzer_ingressos | NUMERIC | Ingressos Yuzer |
| **FATURAMENTO DETALHADO** |
| faturamento_couvert | NUMERIC | Faturamento de couvert |
| faturamento_bar | NUMERIC | Faturamento do bar |

---

## 3. VENDAS E PRODUTOS (CONTAHUB)

### contahub_analitico (Vendas detalhadas por produto)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| trn_dtgerencial | DATE | Data gerencial |
| ano | INTEGER | Ano |
| mes | INTEGER | Mês |
| prd | TEXT | Código produto |
| prd_desc | TEXT | **Nome do produto** |
| grp_desc | TEXT | **Categoria/Grupo** |
| qtd | NUMERIC | Quantidade vendida |
| valorfinal | NUMERIC | Valor final da venda |
| custo | NUMERIC | Custo unitário |
| desconto | NUMERIC | Desconto aplicado |
| loc_desc | TEXT | Local da venda |
| tipovenda | TEXT | Tipo de venda |
| vd_mesadesc | TEXT | Mesa/comanda |

### contahub_fatporhora (Faturamento por hora)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| vd_dtgerencial | DATE | Data gerencial |
| hora | INTEGER | Hora (0-23) |
| dds | INTEGER | Dia da semana (1-7) |
| dia | TEXT | Nome do dia |
| qtd | NUMERIC | Quantidade de vendas |
| valor | NUMERIC | Valor total na hora |

### contahub_pagamentos (Formas de pagamento)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| dt_gerencial | DATE | Data gerencial |
| dt_transacao | DATE | Data da transação |
| cli | INTEGER | ID cliente |
| cliente | TEXT | Nome cliente |
| meio | TEXT | Meio de pagamento (Crédito, Débito, PIX, Dinheiro) |
| cartao | TEXT | Bandeira do cartão |
| valor | NUMERIC | Valor bruto |
| taxa | NUMERIC | Taxa cobrada |
| perc | NUMERIC | Percentual da taxa |
| liquido | NUMERIC | Valor líquido |

### contahub_periodo (Comandas e clientes)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| dt_gerencial | DATE | Data gerencial |
| cli_nome | TEXT | Nome do cliente |
| cli_email | TEXT | Email do cliente |
| cli_fone | TEXT | Telefone (original) |
| cli_fone_norm | TEXT | Telefone normalizado |
| pessoas | NUMERIC | Pessoas na mesa |
| qtd_itens | NUMERIC | Itens pedidos |
| vr_pagamentos | NUMERIC | Valor total pago |
| vr_produtos | NUMERIC | Valor em produtos |
| vr_couvert | NUMERIC | Valor do couvert |
| vr_desconto | NUMERIC | Desconto aplicado |
| semana | INTEGER | Semana do ano |

---

## 4. DESEMPENHO SEMANAL

### desempenho_semanal (Métricas consolidadas por semana)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| ano | INTEGER | Ano |
| numero_semana | INTEGER | Número da semana |
| data_inicio | DATE | Início da semana |
| data_fim | DATE | Fim da semana |
| **FATURAMENTO** |
| faturamento_total | FLOAT | Faturamento total |
| faturamento_entrada | FLOAT | Faturamento couvert |
| faturamento_bar | FLOAT | Faturamento bar |
| faturamento_cmovivel | FLOAT | Faturamento c/ CMV |
| meta_semanal | NUMERIC | Meta da semana |
| atingimento | NUMERIC | % de atingimento |
| **CLIENTES** |
| clientes_atendidos | INTEGER | Total clientes |
| clientes_ativos | INTEGER | Clientes ativos |
| reservas_totais | INTEGER | Reservas feitas |
| reservas_presentes | INTEGER | Reservas confirmadas |
| **TICKETS** |
| ticket_medio | FLOAT | Ticket médio geral |
| tm_entrada | FLOAT | Ticket médio entrada |
| tm_bar | FLOAT | Ticket médio bar |
| **CUSTOS (% sobre faturamento)** |
| cmv | FLOAT | CMV em R$ |
| cmv_teorico | FLOAT | CMV teórico % |
| cmv_limpo | FLOAT | CMV limpo % |
| cmv_global_real | FLOAT | CMV global real % |
| cmv_rs | FLOAT | CMV em reais |
| cmo | FLOAT | CMO % |
| cmo_custo | FLOAT | CMO em R$ |
| custo_atracao_faturamento | FLOAT | % artístico |
| **DESPESAS** |
| imposto | FLOAT | Impostos |
| comissao | FLOAT | Comissões |
| pro_labore | FLOAT | Pró-labore |
| ocupacao | FLOAT | Ocupação |
| adm_fixo | FLOAT | ADM fixo |
| marketing_fixo | FLOAT | Marketing fixo |
| atracoes_eventos | FLOAT | Atrações |
| **OPERACIONAL** |
| tempo_saida_bar | FLOAT | Tempo saída bar (min) |
| tempo_saida_cozinha | FLOAT | Tempo saída cozinha (min) |
| qtde_itens_bar | INTEGER | Itens bar |
| qtde_itens_cozinha | INTEGER | Itens cozinha |
| stockout_comidas | FLOAT | Stockout comidas % |
| stockout_drinks | FLOAT | Stockout drinks % |
| **MARKETING** |
| o_num_posts | INTEGER | Nº posts orgânicos |
| o_alcance | INTEGER | Alcance orgânico |
| o_engajamento | FLOAT | Engajamento % |
| m_valor_investido | FLOAT | Investimento ADS |
| m_cliques | INTEGER | Cliques ADS |
| m_ctr | FLOAT | CTR % |
| **SATISFAÇÃO** |
| nps_reservas | FLOAT | NPS reservas |
| nota_felicidade_equipe | FLOAT | Felicidade equipe |
| media_avaliacoes_google | FLOAT | Média Google |
| **RETENÇÃO** |
| perc_clientes_novos | FLOAT | % clientes novos |
| retencao_1m | FLOAT | Retenção 1 mês |
| retencao_2m | FLOAT | Retenção 2 meses |

---

## 5. FINANCEIRO (NIBO)

### nibo_agendamentos (Contas a pagar/receber)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| nibo_id | VARCHAR | ID no NIBO |
| bar_id | INTEGER FK | Referência ao bar |
| tipo | VARCHAR | 'receita' ou 'despesa' |
| status | VARCHAR | 'pendente', 'pago', 'atrasado' |
| valor | NUMERIC | Valor original |
| valor_pago | NUMERIC | Valor efetivamente pago |
| data_vencimento | DATE | Data de vencimento |
| data_pagamento | DATE | Data do pagamento |
| data_competencia | DATE | **Data de competência (usar para relatórios)** |
| descricao | TEXT | Descrição do lançamento |
| categoria_nome | VARCHAR | **Categoria (usar para DRE)** |
| stakeholder_nome | VARCHAR | Fornecedor/Cliente |

---

## 6. ESTOQUE E INSUMOS

### insumos (Cadastro de insumos)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| codigo | VARCHAR | Código interno |
| nome | VARCHAR | Nome do insumo |
| categoria | VARCHAR | Categoria |
| unidade_medida | VARCHAR | Unidade (kg, L, un) |
| custo_unitario | NUMERIC | Custo por unidade |
| ativo | BOOLEAN | Se está ativo |

### estoque_insumos (Contagens de estoque)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_contagem | DATE | Data da contagem |
| categoria | TEXT | Categoria do item |
| descricao | TEXT | Descrição do item |
| estoque_anterior | NUMERIC | Estoque anterior |
| estoque_atual | NUMERIC | Estoque contado |
| diferenca | NUMERIC | Diferença |
| preco_unitario | NUMERIC | Preço unitário |
| valor_estoque | NUMERIC | Valor total |

### receitas (Fichas técnicas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| receita_codigo | TEXT | Código da receita |
| receita_nome | TEXT | Nome da receita |
| receita_categoria | TEXT | Categoria |
| rendimento_esperado | NUMERIC | Rendimento em unidades |

---

## 7. YUZER (EVENTOS E INGRESSOS)

### yuzer_eventos (Eventos no sistema Yuzer)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| evento_id | INTEGER | ID do evento no Yuzer |
| nome_evento | TEXT | Nome do evento |
| data_inicio | TIMESTAMP | Data/hora início |
| data_fim | TIMESTAMP | Data/hora fim |
| status | VARCHAR | Status do evento |

### yuzer_produtos (Vendas de produtos no Yuzer)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| evento_id | INTEGER | ID do evento |
| data_evento | DATE | **Data do evento (usar para filtros)** |
| produto_id | INTEGER | ID do produto |
| produto_nome | TEXT | Nome do produto |
| quantidade | INTEGER | Quantidade vendida |
| valor_total | NUMERIC | Valor total vendido |
| categoria | VARCHAR | Categoria (se definida) |
| eh_ingresso | BOOLEAN | Se é ingresso/entrada |

### yuzer_pagamento (Faturamento do Yuzer por dia)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| evento_id | INTEGER | ID do evento |
| data_evento | DATE | Data do evento |
| faturamento_bruto | NUMERIC | **Faturamento bruto Yuzer** |
| valor_liquido | NUMERIC | **Valor líquido (após taxas)** |
| credito | NUMERIC | Vendas em crédito |
| debito | NUMERIC | Vendas em débito |
| pix | NUMERIC | Vendas em PIX |
| dinheiro | NUMERIC | Vendas em dinheiro |

### yuzer_fatporhora (Faturamento por hora)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| evento_id | INTEGER | ID do evento |
| data_evento | DATE | Data do evento |
| hora | INTEGER | Índice da hora |
| hora_formatada | TEXT | Hora formatada (DD/MM/YYYY HH:00) |
| faturamento | NUMERIC | Faturamento na hora |
| vendas | INTEGER | Quantidade de vendas |

### VIEW: yuzer_produtos_categorizado (Produtos com categorização automática)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ... | | Mesmas colunas de yuzer_produtos + |
| categoria_auto | VARCHAR | **Categoria automática: BILHETERIA, CERVEJA, DRINKS, COMIDA, NAO_ALCOOLICO, OUTROS** |

### VIEW: yuzer_resumo_por_categoria (Resumo por dia e categoria)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| bar_id | INTEGER | Referência ao bar |
| evento_id | INTEGER | ID do evento |
| data_evento | DATE | Data do evento |
| bilheteria | NUMERIC | **Total ingressos/couvert** |
| cerveja | NUMERIC | **Total cervejas** |
| drinks | NUMERIC | **Total drinks** |
| comida | NUMERIC | **Total comidas** |
| nao_alcoolico | NUMERIC | **Total não alcoólicos** |
| outros | NUMERIC | **Total outros** |
| total_bruto | NUMERIC | **Total geral** |
| total_bebidas | NUMERIC | Cerveja + Drinks |
| total_consumo | NUMERIC | Tudo exceto bilheteria |

---

## 8. SYMPLA (VENDA DE INGRESSOS ONLINE)

### sympla_eventos (Eventos no Sympla)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| evento_sympla_id | VARCHAR | ID do evento no Sympla |
| nome_evento | TEXT | Nome do evento |
| data_inicio | TIMESTAMP | Data/hora início |
| data_fim | TIMESTAMP | Data/hora fim |

### sympla_resumo (Resumo de vendas Sympla)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| evento_sympla_id | VARCHAR | ID do evento |
| receita_total | NUMERIC | **Receita total Sympla** |
| checkins_realizados | INTEGER | **Check-ins feitos** |
| ingressos_vendidos | INTEGER | Total vendidos |

---

## 9. RESERVAS (GETIN)

### getin_reservas (Reservas de mesas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| reservation_id | VARCHAR | ID da reserva no GetIn |
| customer_name | VARCHAR | Nome do cliente |
| customer_email | VARCHAR | Email |
| customer_phone | VARCHAR | Telefone |
| reservation_date | DATE | Data da reserva |
| reservation_time | TIME | Horário |
| people | INTEGER | Número de pessoas |
| status | VARCHAR | Status (confirmada, no_show, etc) |
| no_show | BOOLEAN | Se foi no-show |
| nps_answered | BOOLEAN | Se respondeu NPS |

---

## 10. FEEDBACKS CONSOLIDADOS

### feedback_artistas (Feedbacks de artistas/bandas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| artista_nome | TEXT | Nome do artista/banda |
| data_feedback | DATE | Data do feedback |
| camarim_satisfacao | VARCHAR | Satisfação com camarim |
| camarim_localizacao | VARCHAR | Opinião sobre localização |
| banheiro_satisfacao | VARCHAR | Satisfação com banheiro |
| fechamento_cego_necessario | BOOLEAN | Se precisa de fechamento |
| seguranca_necessaria | BOOLEAN | Se precisa mais segurança |
| feedback_texto | TEXT | Texto do feedback |
| sugestoes | TEXT | Sugestões dadas |
| elogios | TEXT | Elogios recebidos |
| problemas_identificados | TEXT | Problemas identificados |
| coletado_por | VARCHAR | Quem coletou |
| prioridade | INTEGER | Prioridade (1-3) |
| status | VARCHAR | Status (pendente, analisado, etc) |

### nps (NPS coletado por funcionários sobre clientes)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_pesquisa | DATE | Data da pesquisa |
| funcionario_nome | TEXT | Nome do funcionário |
| setor | TEXT | Setor |
| nps_geral | NUMERIC | NPS geral (0-10) |
| nps_ambiente | NUMERIC | NPS ambiente |
| nps_atendimento | NUMERIC | NPS atendimento |
| nps_limpeza | NUMERIC | NPS limpeza |
| nps_musica | NUMERIC | NPS música |
| nps_comida | NUMERIC | NPS comida |
| nps_drink | NUMERIC | NPS drink |
| nps_preco | NUMERIC | NPS preço |
| comentarios | TEXT | Comentários dos clientes |

### nps_reservas (Voz do Cliente - NPS das reservas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_pesquisa | DATE | Data da pesquisa |
| nota | NUMERIC | Nota NPS (0-10) |
| dia_semana | TEXT | Dia da semana |
| comentarios | TEXT | Comentário do cliente |

### pesquisa_felicidade (Pesquisa de felicidade dos funcionários)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_pesquisa | DATE | Data da pesquisa |
| funcionario_nome | TEXT | Nome do funcionário |
| setor | TEXT | Setor |
| eu_comigo_engajamento | INTEGER | Engajamento (0-5) |
| eu_com_empresa_pertencimento | INTEGER | Pertencimento (0-5) |
| eu_com_colega_relacionamento | INTEGER | Relacionamento (0-5) |
| eu_com_gestor_lideranca | INTEGER | Liderança (0-5) |
| justica_reconhecimento | INTEGER | Reconhecimento (0-5) |
| media_geral | NUMERIC | Média geral (0-5) |

### VIEW: feedback_consolidado (TODOS os feedbacks unificados)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| tipo_feedback | VARCHAR | **'artista', 'cliente', 'funcionario_nps', 'funcionario_felicidade'** |
| bar_id | INTEGER FK | Referência ao bar |
| data | DATE | Data do feedback |
| nome_respondente | TEXT | Quem respondeu |
| setor | TEXT | Setor (se aplicável) |
| avaliacao_resumo | VARCHAR | Classificação (promotor, neutro, detrator, satisfeito, etc) |
| nota_numerica | INTEGER | Nota convertida para escala 0-10 |
| comentario | TEXT | Comentário/feedback |
| sugestoes | TEXT | Sugestões |
| elogios | TEXT | Elogios |
| problemas | TEXT | Problemas identificados |
| status | VARCHAR | Status do feedback |
| prioridade | INTEGER | Prioridade (1=alta, 3=baixa) |

### VIEW: feedback_resumo_mensal (Resumo mensal por tipo)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| bar_id | INTEGER FK | Referência ao bar |
| mes | DATE | Mês (truncado) |
| tipo_feedback | VARCHAR | Tipo do feedback |
| total_respostas | INTEGER | Total de respostas |
| media_nota | NUMERIC | Média das notas |
| positivos | INTEGER | Feedbacks positivos |
| negativos | INTEGER | Feedbacks negativos |
| alta_prioridade | INTEGER | Feedbacks urgentes |

### VIEW: feedback_resumo_semanal (Resumo semanal por tipo)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| bar_id | INTEGER FK | Referência ao bar |
| semana | DATE | Semana (truncada) |
| tipo_feedback | VARCHAR | Tipo do feedback |
| total_respostas | INTEGER | Total de respostas |
| media_nota | NUMERIC | Média das notas |
| positivos | INTEGER | Feedbacks positivos |
| negativos | INTEGER | Feedbacks negativos |

---

## 11. ESTOQUE E RUPTURAS

### contahub_stockout (Rupturas de estoque - produtos em falta)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_stockout | DATE | Data da ruptura |
| codigo_produto | TEXT | Código do produto |
| nome_produto | TEXT | Nome do produto em falta |
| categoria | TEXT | Categoria do produto |
| horario_inicial | TEXT | Hora que começou a faltar |
| horario_final | TEXT | Hora que voltou (ou NULL) |
| tempo_ruptura_min | INTEGER | Tempo em minutos sem produto |

### cmv_semanal (CMV calculado por semana)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data_inicio | DATE | Início da semana |
| data_fim | DATE | Fim da semana |
| cmv_percentual | NUMERIC | CMV percentual (meta menor que 34%) |
| custo_total | NUMERIC | Custo total |
| faturamento | NUMERIC | Faturamento da semana |
| cmv_teorico | NUMERIC | CMV teórico percentual |
| cmv_limpo | NUMERIC | CMV limpo percentual |

---

## 12. CALENDÁRIO E PLANEJAMENTO

### calendario_operacional (Planejamento de eventos futuros)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| data | DATE | Data planejada |
| dia_semana | TEXT | Dia da semana |
| status | VARCHAR | Status (confirmado, planejado, cancelado) |
| artista | TEXT | Artista ou banda confirmado |
| genero | TEXT | Gênero musical |
| meta_faturamento | NUMERIC | Meta para o dia |
| observacoes | TEXT | Notas e observações |

---

## 13. METAS E OKRs

### organizador_okrs (OKRs definidos)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| periodo | TEXT | Período (trimestre) |
| objetivo | TEXT | Objetivo estratégico |
| key_result | TEXT | Key Result mensurável |
| meta_valor | NUMERIC | Valor da meta |
| atual_valor | NUMERIC | Valor atual |
| status | VARCHAR | Status (on_track, at_risk, off_track) |

### organizador_visao (Visão do negócio)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| tipo | TEXT | Tipo (missao, visao, valores, big_bets) |
| conteudo | TEXT | Conteúdo |

---

## 14. REDES SOCIAIS (WINDSOR e INSTAGRAM)

### windsor_instagram_followers (Seguidores Instagram)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| date | DATE | Data da medição |
| followers_count | INTEGER | Total de seguidores |
| follows_count | INTEGER | Seguindo |
| media_count | INTEGER | Posts no perfil |

### windsor_instagram_followers_daily (Variação diária)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| date | DATE | Data |
| followers_gained | INTEGER | Seguidores ganhos no dia |
| followers_lost | INTEGER | Seguidores perdidos |
| net_change | INTEGER | Variação líquida |

### windsor_instagram_stories (Métricas de Stories)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| date | DATE | Data |
| impressions | INTEGER | Impressões |
| reach | INTEGER | Alcance |
| replies | INTEGER | Respostas |
| taps_forward | INTEGER | Avançou |
| taps_back | INTEGER | Voltou |
| exits | INTEGER | Saiu |

### google_reviews (Avaliações do Google Maps - Apify)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| review_id | TEXT UNIQUE | ID único da avaliação no Google |
| name | TEXT | Nome do avaliador |
| text | TEXT | Texto da avaliação |
| stars | INTEGER | Nota de 1 a 5 estrelas |
| published_at_date | TIMESTAMPTZ | Data de publicação |
| likes_count | INTEGER | Curtidas na avaliação |
| review_url | TEXT | URL da avaliação |
| response_from_owner_text | TEXT | Resposta do proprietário |
| categories_food | NUMERIC | Nota para comida (1-5) |
| categories_service | NUMERIC | Nota para serviço (1-5) |
| categories_atmosphere | NUMERIC | Nota para atmosfera (1-5) |

---

## 15. CRM E CAMPANHAS

### crm_campanhas (Campanhas de marketing)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| nome | TEXT | Nome da campanha |
| tipo | VARCHAR | Tipo (email, whatsapp, sms) |
| status | VARCHAR | Status |
| data_inicio | DATE | Início |
| data_fim | DATE | Fim |
| total_enviados | INTEGER | Total enviados |
| aberturas | INTEGER | Aberturas |
| cliques | INTEGER | Cliques |

### crm_segmentacao (Segmentos de clientes)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| nome | TEXT | Nome do segmento |
| criterios | JSONB | Critérios de segmentação |
| total_clientes | INTEGER | Clientes no segmento |

---

## 16. EVENTOS EXTERNOS E CONCORRÊNCIA

### eventos_concorrencia (Eventos concorrentes na cidade)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | INTEGER PK | ID único |
| bar_id | INTEGER FK | Bar de referência |
| data | DATE | Data do evento |
| nome_evento | TEXT | Nome do evento |
| local | TEXT | Local (ex: Mané Garrincha) |
| tipo | VARCHAR | Tipo (show, jogo, festival) |
| impacto_esperado | VARCHAR | alto, medio, baixo |
| artista_principal | TEXT | Artista principal |
| observacoes | TEXT | Observações |

---

## 17. AGENTE IA

### agente_insights (Insights gerados)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| tipo | TEXT | Tipo do insight |
| categoria | TEXT | Categoria |
| titulo | TEXT | Título do insight |
| descricao | TEXT | Descrição completa |
| impacto | TEXT | Impacto estimado |
| acao_sugerida | TEXT | Ação recomendada |
| prioridade | INTEGER | Prioridade (1-5) |
| visualizado | BOOLEAN | Se foi visto |

### agente_conversas (Histórico de conversas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| usuario_id | UUID FK | Usuário |
| mensagem | TEXT | Pergunta do usuário |
| resposta | TEXT | Resposta do agente |
| modelo | VARCHAR | Modelo usado |
| tokens_usados | INTEGER | Tokens consumidos |

### agente_regras_dinamicas (Regras aprendidas)
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | ID único |
| bar_id | INTEGER FK | Referência ao bar |
| nome | VARCHAR | Nome da regra |
| condicao | JSONB | Condição para ativar |
| acao | JSONB | Ação a executar |
| ativa | BOOLEAN | Se está ativa |
| execucoes | INTEGER | Vezes executada |
| taxa_sucesso | FLOAT | Taxa de sucesso |

---

## REGRAS DE NEGÓCIO IMPORTANTES

### 1. Cálculos de CMV
\`\`\`
CMV % = (custo_produtos / faturamento_bruto) × 100
Meta: CMV < 34%
\`\`\`

### 2. Taxas de Cartão
\`\`\`
Crédito: 3.5%
Débito: 1.5%
PIX: 1.5%
Dinheiro: 0%
\`\`\`

### 3. Tickets
\`\`\`
Ticket Médio = faturamento_total / clientes
Ticket Entrada = faturamento_couvert / clientes
Ticket Bar = faturamento_bar / clientes
\`\`\`

### 4. Filtros Obrigatórios
- SEMPRE filtrar por bar_id = ${bar_id}
- Para dados do dia atual, usar data >= 'hoje'
- Para semana: usar data_inicio e data_fim

### 5. ⚠️ FONTES DE FATURAMENTO (MUITO IMPORTANTE!)
O faturamento vem de MÚLTIPLAS FONTES:
- **ContaHub** = PDV do bar (consumo no local)
- **Yuzer** = Sistema de eventos e ingressos (quando usa Yuzer)
- **Sympla** = Venda de ingressos online

Para faturamento total de um dia, use \`eventos_base\` que já tem:
- \`real_r\` = faturamento ContaHub
- \`yuzer_liquido\` = faturamento Yuzer
- \`sympla_liquido\` = faturamento Sympla

Para detalhes por categoria (bilheteria, cerveja, drinks, comida):
- Use a VIEW \`yuzer_resumo_por_categoria\`

### 6. Tabelas por Tipo de Consulta
| Tipo | Tabela |
|------|--------|
| Faturamento diário consolidado | \`eventos_base\` |
| Faturamento por categoria | \`yuzer_resumo_por_categoria\` |
| Produtos ContaHub | \`contahub_analitico\` |
| Produtos Yuzer | \`yuzer_produtos_categorizado\` |
| Métricas semanais | \`desempenho_semanal\` |
| Clientes/comandas | \`contahub_periodo\` |
| Ingressos Sympla | \`sympla_resumo\` |
| Faturamento por hora | \`yuzer_fatporhora\` ou \`contahub_fatporhora\` |
| **FEEDBACKS (TODOS CONSOLIDADOS)** | \`feedback_consolidado\` |
| Feedbacks de artistas | \`feedback_artistas\` |
| NPS de clientes (voz do cliente) | \`nps_reservas\` |
| NPS coletado por funcionários | \`nps\` |
| Pesquisa de felicidade | \`pesquisa_felicidade\` |
| Resumo mensal de feedbacks | \`feedback_resumo_mensal\` |
| Resumo semanal de feedbacks | \`feedback_resumo_semanal\` |
| CMV semanal | \`cmv_semanal\` |
| Rupturas de estoque | \`contahub_stockout\` |
| Seguidores Instagram | \`windsor_instagram_followers\` |
| Stories Instagram | \`windsor_instagram_stories\` |
| Google Reviews | \`google_reviews\` |
| Calendário planejado | \`calendario_operacional\` |
| OKRs e metas | \`organizador_okrs\` |
| Visão do negócio | \`organizador_visao\` |
| Campanhas CRM | \`crm_campanhas\` |
| Eventos concorrentes | \`eventos_concorrencia\` |
| **ANALYTICS AVANÇADOS** |
| Score preditivo | \`analytics_score_preditivo\` |
| Análise de artistas | \`analytics_artistas\` |
| Comparação YoY | \`analytics_comparacao_yoy\` |
| Faturamento por hora | \`analytics_faturamento_hora\` |
| Picos de horário | \`analytics_pico_horario\` |
| Alertas | \`analytics_alertas\` |
| Metas 2026 | \`analytics_metas_2026\` |
| Cruzamento completo | \`analytics_cruzamento_completo\` |
`

    // 2. USAR IA PARA GERAR SQL COM CONTEXTO ZYKOR
    const prompt = `
Você é o SQL Expert do sistema Zykor (SGB - Sistema de Gestão de Bares).
Você é especialista em PostgreSQL e conhece profundamente o banco de dados do Ordinário Bar.

# CONTEXTO DO NEGÓCIO
- Sistema de gestão para bares e casas noturnas
- Cada dia de operação é um "evento" (registrado em eventos_base)
- MÚLTIPLAS FONTES DE DADOS:
  * **ContaHub** = PDV do bar (consumo no local, bebidas, comidas)
  * **Yuzer** = Sistema de eventos/ingressos (bilheteria, vendas no evento)
  * **Sympla** = Venda de ingressos online
  * **NIBO** = Financeiro (contas a pagar/receber)
  * **GetIn** = Reservas de mesas
- bar_id = 3 é o Ordinário Bar (principal cliente)
- bar_id = 4 é o Deboche Bar

# VOCABULÁRIO DO NEGÓCIO
- **real_r**: Faturamento real do dia
- **m1_r**: Meta de faturamento
- **cl_real**: Clientes/Público real (PAX)
- **te_real**: Ticket de entrada (couvert médio)
- **tb_real**: Ticket de bebida (consumo médio)
- **CMV**: Custo de Mercadoria Vendida (meta < 34%)
- **CMO**: Custo de Mão de Obra (meta < 20%)

# ESQUEMA DO BANCO
${esquemaBanco}

# PERGUNTA DO USUÁRIO
"${pergunta}"

# BAR ID
${bar_id}

# SUA MISSÃO
1. Interprete a pergunta no contexto de gestão de bar
2. Identifique as tabelas corretas para responder
3. Crie uma query SQL otimizada e segura
4. Explique o resultado esperado em linguagem de negócio

# MELHORES PRÁTICAS
- SEMPRE filtrar por bar_id = ${bar_id}
- Para faturamento diário TOTAL: use eventos_base (tem real_r + yuzer_liquido + sympla_liquido)
- Para faturamento por CATEGORIA (bilheteria, cerveja, drinks, comida): use yuzer_resumo_por_categoria
- Para produtos vendidos no bar: use contahub_analitico (agrupar por prd_desc)
- Para produtos vendidos em eventos Yuzer: use yuzer_produtos_categorizado
- Para métricas semanais: use desempenho_semanal
- Para clientes/comandas: use contahub_periodo ou getin_reservas
- Para financeiro: use nibo_agendamentos
- Para ingressos online: use sympla_resumo
- Use LIMIT para evitar respostas muito grandes
- Ordene os resultados de forma relevante

# IMPORTANTE PARA FATURAMENTO
Quando perguntar "quanto foi o faturamento de [data]", SEMPRE considere:
1. Se o bar usa Yuzer (eventos especiais, festivais): inclua yuzer_liquido
2. Se vende ingresso pelo Sympla: inclua sympla_liquido
3. O campo real_r em eventos_base geralmente já tem o valor consolidado

# ATALHOS COMUNS
- "ontem": WHERE data_evento = CURRENT_DATE - 1
- "última semana": WHERE data_evento >= CURRENT_DATE - 7
- "mês atual": WHERE EXTRACT(MONTH FROM data_evento) = EXTRACT(MONTH FROM CURRENT_DATE)
- "top produtos": ORDER BY valorfinal DESC LIMIT 10

# IMPORTANTE PARA FEEDBACKS
Existem 4 tipos de feedbacks consolidados na view \`feedback_consolidado\`:
1. **'artista'**: Feedbacks de artistas/bandas sobre camarim, estrutura, segurança
2. **'cliente'**: Voz do Cliente - NPS das reservas (tabela nps_reservas)
3. **'funcionario_nps'**: NPS coletado por funcionários sobre clientes
4. **'funcionario_felicidade'**: Pesquisa de felicidade/satisfação dos funcionários

Para perguntas sobre feedbacks, use:
- \`feedback_consolidado\`: todos os feedbacks unificados
- \`feedback_resumo_mensal\`: visão consolidada por mês
- \`feedback_resumo_semanal\`: visão consolidada por semana
- Filtrar por \`tipo_feedback\` para categoria específica
- Filtrar por \`prioridade = 1\` para feedbacks urgentes
- Comentários negativos: \`avaliacao_resumo IN ('detrator', 'insatisfeito')\`
- Comentários positivos: \`avaliacao_resumo IN ('promotor', 'satisfeito', 'muito_satisfeito')\`

# IMPORTANTE PARA REDES SOCIAIS
Para perguntas sobre Instagram, seguidores, stories, alcance:
- \`windsor_instagram_followers\`: total de seguidores ao longo do tempo
- \`windsor_instagram_followers_daily\`: variação diária de seguidores
- \`windsor_instagram_stories\`: métricas de stories (impressões, alcance, respostas)
- \`google_reviews\`: avaliações do Google Maps coletadas via Apify

# IMPORTANTE PARA ESTOQUE E CMV
- \`contahub_stockout\`: produtos que ficaram em falta durante o dia
- \`cmv_semanal\`: CMV calculado por semana (meta é menor que 34%)
- Para verificar rupturas: WHERE data_stockout = [data]
- Para ver produtos que faltaram muito: GROUP BY nome_produto ORDER BY SUM(tempo_ruptura_min) DESC

# IMPORTANTE PARA CALENDÁRIO E PLANEJAMENTO
- \`calendario_operacional\`: eventos futuros planejados (artistas confirmados, metas)
- \`eventos_concorrencia\`: eventos externos na cidade que podem impactar o bar
- Use para perguntas como "quem toca amanhã?", "tem show na cidade hoje?"

# IMPORTANTE PARA OKRs E METAS ESTRATÉGICAS
- \`organizador_okrs\`: objetivos e key results definidos
- \`organizador_visao\`: missão, visão, valores e big bets do negócio
- Use para perguntas sobre metas do trimestre, objetivos estratégicos

# IMPORTANTE - VIEWS DE ANALYTICS AVANÇADOS (USE SEMPRE QUE POSSÍVEL!)

### Score Preditivo
- \`analytics_score_preditivo\`: Score de 0-100 prevendo potencial de sucesso
- Campos: score_total, classificacao (EXCELENTE, BOM, REGULAR, BAIXO, RISCO)
- Use para: "qual o potencial do evento?", "esse dia vai ser bom?"

### Análise de Artistas
- \`analytics_artistas\`: Análise histórica completa de cada artista
- Campos: faturamento_medio, roi_artista, tendencia, classificacao, recomendacao
- Use para: "melhor artista?", "artistas em queda?", "quem escalar mais?"

### Comparação YoY
- \`analytics_comparacao_yoy\`: Comparação ano a ano
- Campos: variacao_faturamento_yoy, status_yoy
- Use para: "crescimento vs ano passado?", "janeiro 2026 vs 2025?"

### Faturamento por Hora
- \`analytics_faturamento_hora\`: Performance por hora
- Campos: periodo (ABERTURA, PICO, POS_PICO, FECHAMENTO), performance_hora
- Use para: "melhor horário?", "quando fatura mais?"

### Alertas
- \`analytics_alertas\`: Sistema de alertas automáticos
- Campos: tipo_alerta, prioridade, descricao, acao_sugerida
- Use para: "tem algum problema?", "alertas?", "o que preciso resolver?"

### Metas 2026
- \`analytics_metas_2026\`: Metas vs realizado
- Campos: valor_meta, valor_realizado, percentual_atingimento, status
- Use para: "como estão as metas?", "vamos bater a meta?"

### Cruzamento Completo
- \`analytics_cruzamento_completo\`: Visão 360° com todos os dados cruzados
- Tem: faturamento + público + NPS + artista + categorias + hora + concorrência
- Use para análises complexas que cruzam múltiplos dados

# RESPONDA EM JSON
{
  "query_gerada": "SELECT ...",
  "explicacao": "O que a query faz e por que (em português)",
  "colunas_retornadas": ["coluna1", "coluna2"],
  "metricas_relacionadas": ["CMV", "Ticket Médio", etc],
  "complexidade": "baixa|media|alta",
  "tempo_estimado": "< 1s | 1-5s | > 5s",
  "sugestoes_adicionais": "Outras análises que poderiam complementar"
}
`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 10,
            topP: 0.8,
            maxOutputTokens: 4096,
          }
        })
      }
    )

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${await geminiResponse.text()}`)
    }

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates[0].content.parts[0].text

    let queryInfo
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      queryInfo = JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
    } catch (e) {
      console.error('Erro ao parsear resposta:', responseText)
      throw new Error('Erro ao gerar query SQL')
    }

    console.log('🔍 Query gerada:', queryInfo.query_gerada)

    // 3. EXECUTAR QUERY (com segurança)
    let resultado = null
    let erro = null

    try {
      // Validar que a query é SELECT (apenas leitura)
      const queryLower = queryInfo.query_gerada.toLowerCase().trim()
      if (!queryLower.startsWith('select') && !queryLower.startsWith('with')) {
        throw new Error('Apenas queries SELECT são permitidas')
      }

      // Validar que filtra por bar_id
      if (!queryInfo.query_gerada.includes(`bar_id = ${bar_id}`) && 
          !queryInfo.query_gerada.includes(`bar_id=${bar_id}`)) {
        console.warn('Query não filtra por bar_id, pode retornar dados de outros bares')
      }

      // Executar query
      const { data, error: queryError } = await supabaseClient
        .rpc('execute_sql_readonly', { 
          query_text: queryInfo.query_gerada 
        })
        .single()

      if (queryError) {
        // Se RPC não existir, executar direto (menos seguro)
        const { data: directData, error: directError } = await supabaseClient
          .from('_temp_query_result')
          .select('*')
        
        if (directError) {
          throw directError
        }
        resultado = directData
      } else {
        resultado = data
      }

    } catch (error: any) {
      erro = error.message
      console.error('Erro ao executar query:', erro)
    }

    // 4. SALVAR NO HISTÓRICO
    await supabaseClient
      .from('agente_conversas')
      .insert({
        bar_id,
        usuario_id: null,
        mensagem: pergunta,
        resposta: JSON.stringify({
          query: queryInfo.query_gerada,
          explicacao: queryInfo.explicacao,
          resultado: resultado ? 'Executada com sucesso' : 'Erro na execução'
        }),
        modelo: GEMINI_MODEL,
        tokens_usados: Math.ceil((prompt.length + responseText.length) / 4)
      })

    const tempoTotal = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: true,
        pergunta,
        sql: {
          query: queryInfo.query_gerada,
          explicacao: queryInfo.explicacao,
          colunas: queryInfo.colunas_retornadas,
          complexidade: queryInfo.complexidade,
          tempo_estimado: queryInfo.tempo_estimado,
          observacoes: queryInfo.observacoes
        },
        execucao: {
          executada: erro === null,
          resultado: resultado || null,
          erro: erro,
          linhas_retornadas: resultado ? (Array.isArray(resultado) ? resultado.length : 1) : 0
        },
        tempo_total_ms: tempoTotal
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Erro no agente-sql-expert:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
