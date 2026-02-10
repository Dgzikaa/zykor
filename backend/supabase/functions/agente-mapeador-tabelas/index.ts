import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = 'gemini-1.5-pro-latest'

interface TabelaInfo {
  nome: string
  total_registros: number
  registros_ultimo_mes: number
  ultima_atualizacao: string | null
  tamanho_estimado_mb: number
  colunas_principais: string[]
  tem_bar_id: boolean
  em_uso: boolean
  motivo_desuso?: string
  categoria: string
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

    const startTime = Date.now()

    console.log('🗺️ Iniciando mapeamento de tabelas...')

    // LISTA COMPLETA DE TABELAS DO SISTEMA (conhecidas)
    const tabelasConhecidas = [
      // Operacionais
      'bars', 'usuarios_bar', 'user_bars', 'usuarios_bares', 'profiles', 'user_settings',
      
      // Faturamento e Vendas
      'contahub_analitico', 'contahub_fatporhora', 'contahub_pagamentos', 'contahub_tempo',
      'contahub_periodo', 'contahub_vendas', 'contahub_prodporhora', 'contahub_stockout',
      'contahub_raw_data', 'contahub_corrections', 'contahub_validation_logs', 'contahub_alertas',
      'contahub_retry_control', 'contahub_processing_queue', 'contahub_correction_logs',
      'sync_logs_contahub',
      
      // Desempenho
      'desempenho_semanal', 'sistema_kpis',
      
      // Estoque e Insumos
      'estoque_insumos', 'insumos', 'insumos_historico', 'receitas', 'receitas_insumos',
      'receitas_historico', 'producoes', 'producoes_insumos', 'producao_insumos_calculados',
      'contagem_estoque_insumos', 'contagem_estoque_produtos', 'contagem_estoque_historico',
      'areas_contagem',
      
      // CMV
      'cmv_semanal', 'cmv_manual', 'simulacoes_cmo', 'custos_mensais_diluidos',
      
      // Checklists
      'checklists', 'checklist_secoes', 'checklist_itens', 'checklist_executions',
      'checklist_funcionario', 'checklist_agendamentos', 'checklist_schedules',
      'checklist_auto_executions', 'checklist_automation_logs', 'auditoria_checklists',
      
      // Eventos
      'eventos_base', 'eventos_base_auditoria', 'sympla_eventos', 'sympla_participantes',
      'sympla_pedidos', 'sympla_sync_logs', 'yuzer_eventos', 'yuzer_fatporhora',
      'yuzer_pagamento', 'yuzer_produtos', 'yuzer_sync_logs',
      
      // Nibo
      'nibo_agendamentos', 'nibo_logs_sincronizacao', 'nibo_raw_data', 'nibo_background_jobs',
      'nibo_categorias', 'nibo_stakeholders',
      
      // Financeiro
      'dre_manual', 'orcamentacao', 'fp_contas', 'fp_categorias', 'fp_transacoes',
      'fp_regras_categoria', 'fp_categorias_template', 'fp_pluggy_items', 'fp_pluggy_sync_log',
      'pix_enviados',
      
      // GetIn
      'getin_units', 'getin_reservations', 'getin_sync_logs',
      
      // Windsor específico
      'windsor_datav2', 'google_reviews', 'windsor_instagram_stories',
      'windsor_instagram_followers', 'windsor_instagram_followers_daily',
      
      // NPS e Pesquisas
      'nps', 'nps_reservas', 'pesquisa_felicidade',
      
      // Cliente
      'cliente_estatisticas', 'cliente_perfil_consumo',
      
      // CRM
      'crm_campanhas', 'crm_cupons', 'crm_segmentacao', 'crm_envios', 'crm_templates',
      
      // WhatsApp
      'whatsapp_messages', 'whatsapp_configuracoes', 'whatsapp_mensagens',
      'whatsapp_contatos', 'whatsapp_templates',
      
      // Segurança e Logs
      'security_events', 'security_metrics', 'security_config_pending',
      'security_audit_results', 'security_monitoring', 'audit_trail',
      'logs_sistema', 'automation_logs',
      
      // Notificações
      'notificacoes', 'notifications', 'discord_webhooks', 'alertas_enviados',
      
      // Agente IA
      'agente_configuracoes', 'agente_scans', 'agente_insights', 'agente_alertas',
      'agente_metricas', 'agente_aprendizado', 'agente_memoria_vetorial',
      'agente_conversas', 'agente_feedbacks', 'agente_regras_dinamicas',
      'agente_padroes_detectados', 'agente_ia_metricas',
      
      // Configurações
      'bar_api_configs', 'bar_notification_configs', 'bar_stats',
      'user_lgpd_settings', 'user_sessions', 'lgpd_audit_log',
      
      // Validações
      'validacoes_cruzadas', 'dados_bloqueados', 'validacao_dados', 'validacao_dados_diaria',
      'sistema_alertas',
      
      // Diversos
      'uploads', 'pessoas_responsaveis', 'calendario_operacional', 'calendario_historico',
      'semanas_referencia', 'recalculo_eventos_log', 'execucoes_automaticas',
      'permanent_tokens', 'organizador_visao', 'organizador_okrs', 'sync_eventos',
      'sync_eventos_automatico'
    ]

    const resultado: TabelaInfo[] = []
    const umMesAtras = new Date()
    umMesAtras.setMonth(umMesAtras.getMonth() - 1)

    console.log(`📊 Analisando ${tabelasConhecidas.length} tabelas...`)

    for (const nomeTabela of tabelasConhecidas) {
      try {
        // Verificar se tabela existe e pegar contagem total
        const { count: totalRegistros, error: countError } = await supabaseClient
          .from(nomeTabela)
          .select('*', { count: 'exact', head: true })

        if (countError) {
          console.log(`⚠️ Tabela ${nomeTabela} não acessível:`, countError.message)
          continue
        }

        // Verificar se tem coluna bar_id
        const { data: sample } = await supabaseClient
          .from(nomeTabela)
          .select('*')
          .limit(1)
          .single()

        const temBarId = sample && 'bar_id' in sample
        const colunas = sample ? Object.keys(sample) : []

        // Tentar pegar última atualização
        let ultimaAtualizacao = null
        let registrosUltimoMes = 0

        if (colunas.includes('created_at')) {
          const { data: ultima } = await supabaseClient
            .from(nomeTabela)
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (ultima) {
            ultimaAtualizacao = ultima.created_at
          }

          // Contar registros do último mês
          const { count } = await supabaseClient
            .from(nomeTabela)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', umMesAtras.toISOString())

          registrosUltimoMes = count || 0
        } else if (colunas.includes('updated_at')) {
          const { data: ultima } = await supabaseClient
            .from(nomeTabela)
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1)
            .single()

          if (ultima) {
            ultimaAtualizacao = ultima.updated_at
          }
        }

        // Determinar categoria
        let categoria = 'outros'
        if (nomeTabela.startsWith('contahub_')) categoria = 'faturamento'
        else if (nomeTabela.startsWith('agente_')) categoria = 'agente_ia'
        else if (nomeTabela.includes('checklist')) categoria = 'checklists'
        else if (nomeTabela.includes('estoque') || nomeTabela.includes('insumo') || nomeTabela.includes('receita')) categoria = 'estoque'
        else if (nomeTabela.includes('evento') || nomeTabela.includes('sympla') || nomeTabela.includes('yuzer')) categoria = 'eventos'
        else if (nomeTabela.includes('nps') || nomeTabela.includes('pesquisa')) categoria = 'feedback_cliente'
        else if (nomeTabela.includes('fp_') || nomeTabela.includes('dre') || nomeTabela.includes('orcamento')) categoria = 'financeiro'
        else if (nomeTabela.includes('user') || nomeTabela.includes('profile') || nomeTabela === 'bars') categoria = 'usuarios'
        else if (nomeTabela.includes('log') || nomeTabela.includes('audit') || nomeTabela.includes('security')) categoria = 'logs_auditoria'

        // Determinar se está em uso
        const emUso = (totalRegistros || 0) > 0 && registrosUltimoMes > 0

        // Motivo de desuso
        let motivoDesuso = undefined
        if (!emUso) {
          if ((totalRegistros || 0) === 0) {
            motivoDesuso = 'Tabela vazia - nunca foi usada'
          } else if (registrosUltimoMes === 0) {
            motivoDesuso = 'Sem dados novos há mais de 30 dias - possível feature descontinuada'
          }
        }

        // Tamanho estimado (aproximado: 1KB por registro)
        const tamanhoEstimado = ((totalRegistros || 0) * 1) / 1024 // MB

        resultado.push({
          nome: nomeTabela,
          total_registros: totalRegistros || 0,
          registros_ultimo_mes: registrosUltimoMes,
          ultima_atualizacao: ultimaAtualizacao,
          tamanho_estimado_mb: parseFloat(tamanhoEstimado.toFixed(2)),
          colunas_principais: colunas.slice(0, 10),
          tem_bar_id: temBarId,
          em_uso: emUso,
          motivo_desuso: motivoDesuso,
          categoria
        })

      } catch (error) {
        console.error(`Erro ao analisar ${nomeTabela}:`, error.message)
      }
    }

    console.log(`✅ Análise concluída: ${resultado.length} tabelas mapeadas`)

    // Estatísticas gerais
    const totalEmUso = resultado.filter(t => t.em_uso).length
    const totalDesuso = resultado.filter(t => !t.em_uso && t.total_registros === 0).length
    const totalAbandonadas = resultado.filter(t => !t.em_uso && t.total_registros > 0).length

    const porCategoria = resultado.reduce((acc, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Usar IA para análise avançada
    const analiseIA = await analisarComIA(resultado)

    const tempoTotal = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: true,
        resumo: {
          total_tabelas: resultado.length,
          em_uso: totalEmUso,
          vazias: totalDesuso,
          abandonadas: totalAbandonadas,
          por_categoria: porCategoria
        },
        tabelas: resultado,
        analise_ia: analiseIA,
        tempo_execucao_ms: tempoTotal
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Erro no mapeador de tabelas:', error)
    
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

async function analisarComIA(tabelas: TabelaInfo[]) {
  if (!GEMINI_API_KEY) return null

  const prompt = `
Você é um DBA especialista analisando o uso de tabelas em um sistema de gestão de bares.

# DADOS DAS TABELAS
${JSON.stringify(tabelas, null, 2)}

# SUA MISSÃO
1. Identificar tabelas claramente em desuso e sugerir ação (manter por histórico, arquivar, deletar)
2. Identificar possíveis problemas (tabelas críticas sem dados recentes)
3. Sugerir otimizações (tabelas grandes que poderiam ser arquivadas)
4. Identificar redundâncias (tabelas duplicadas ou similares)

Responda em JSON:
{
  "tabelas_para_remover": [
    {"nome": "string", "motivo": "string"}
  ],
  "tabelas_criticas_sem_dados": [
    {"nome": "string", "impacto": "string"}
  ],
  "oportunidades_otimizacao": [
    {"nome": "string", "acao": "string"}
  ],
  "redundancias_detectadas": [
    {"tabelas": ["string"], "descricao": "string"}
  ],
  "recomendacoes_gerais": ["string"]
}
`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          }
        })
      }
    )

    if (response.ok) {
      const data = await response.json()
      const responseText = data.candidates[0].content.parts[0].text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      return JSON.parse(jsonMatch ? jsonMatch[0] : responseText)
    }
  } catch (error) {
    console.error('Erro na análise com IA:', error)
  }

  return null
}
