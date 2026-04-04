import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * UMBLER SYNC INCREMENTAL
 * Sincroniza conversas recentes usando /v1/chats/basic-info/
 * Ideal para sincronizacao periodica (cron job)
 * Vantagem: Ja retorna latestMessages embutidas
 */

const UMBLER_API = 'https://app-utalk.umbler.com/api/v1'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  let heartbeatId: number | null = null
  let startTime: number = Date.now()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { 
      bar_id = 3, 
      dias_atras = 7,      // Quantos dias pra tras sincronizar
      limit = 250,
      chat_state = 'All',
      channel_id_filter  // Opcional: filtrar por channel
    } = await req.json().catch(() => ({}))

    const hbResult = await heartbeatStart(supabase, 'umbler-sync-incremental', bar_id, null, 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime

    // Buscar config da Umbler
    const { data: config, error: configError } = await supabase
      .from('umbler_config')
      .select('*')
      .eq('bar_id', bar_id)
      .eq('ativo', true)
      .single()

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: 'Config Umbler nao encontrada' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const token = config.api_token
    const orgId = config.organization_id
    const channelId = channel_id_filter || config.channel_id

    // Calcular datas
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - dias_atras)
    
    const startDateStr = startDate.toISOString()
    const endDateStr = endDate.toISOString()

    console.log(`[UMBLER-SYNC] Sincronizando bar_id=${bar_id}, periodo=${startDateStr} ate ${endDateStr}`)

    let totalConversasSalvas = 0
    let totalMensagensSalvas = 0
    let currentSkip = 0
    let hasMore = true
    let batchCount = 0
    const maxBatches = 50
    const allErros: string[] = []
    let totalItems = 0

    while (hasMore && batchCount < maxBatches) {
      batchCount++
      
      // Usar /v1/chats/basic-info/ com filtro de data
      let chatsUrl = `${UMBLER_API}/chats/basic-info/?organizationId=${orgId}&StartDate=${encodeURIComponent(startDateStr)}&EndDate=${encodeURIComponent(endDateStr)}&ChatState=${chat_state}&Take=${limit}&Skip=${currentSkip}&Behavior=CountAllAndGetSlice`
      
      if (channelId) {
        chatsUrl += `&ChannelId=${channelId}`
      }
      
      console.log(`[UMBLER-SYNC] Batch ${batchCount}: skip=${currentSkip}`)

      const chatsResponse = await fetch(chatsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })

      if (!chatsResponse.ok) {
        const errorText = await chatsResponse.text()
        console.error('Erro ao buscar chats:', chatsResponse.status, errorText)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro API Umbler: ${chatsResponse.status}`, 
            details: errorText,
            url: chatsUrl,
            batch: batchCount
          }),
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      const chatsData = await chatsResponse.json()
      const chats = chatsData.items || []
      const pageInfo = chatsData.page || {}
      
      totalItems = pageInfo.totalItems || totalItems
      
      console.log(`[UMBLER-SYNC] Batch ${batchCount}: ${chats.length} conversas (total=${totalItems})`)

      if (chats.length === 0) {
        hasMore = false
        break
      }

      // Processar conversas
      for (const chat of chats) {
        try {
          const telefone = normalizePhone(chat.contact?.phoneNumber)
          
          let status = 'aberta'
          if (chat.closedAtUTC) {
            status = 'finalizada'
          } else if (chat.organizationMember) {
            status = 'em_atendimento'
          } else if (chat.waiting) {
            status = 'aberta'
          }

          const { error: conversaError } = await supabase
            .from('umbler_conversas')
            .upsert({
              id: chat.id,
              bar_id: bar_id,
              channel_id: chat.channel?.id || channelId,
              contato_telefone: telefone,
              contato_nome: chat.contact?.name,
              contato_id: chat.contact?.id,
              status: status,
              setor: chat.sector?.name,
              atendente_nome: chat.organizationMember?.displayName,
              atendente_id: chat.organizationMember?.id,
              tags: (chat.tags || []).map((t: any) => t.name),
              iniciada_em: chat.createdAtUTC,
              finalizada_em: chat.closedAtUTC,
              ultima_mensagem_em: chat.lastMessage?.eventAtUTC || chat.lastMessage?.createdAtUTC,
              metadata: { 
                synced: true,
                sync_date: new Date().toISOString(),
                open: chat.open,
                waiting: chat.waiting,
                totalUnread: chat.totalUnread,
                bots: chat.bots,
                visibility: chat.visibility
              }
            }, { onConflict: 'id' })

          if (conversaError) {
            allErros.push(`Conversa ${chat.id}: ${conversaError.message}`)
          } else {
            totalConversasSalvas++
          }

          // Salvar lastMessage
          if (chat.lastMessage && !chat.lastMessage.isPrivate) {
            const saved = await saveMessage(supabase, chat.lastMessage, chat, bar_id, channelId, telefone)
            if (saved) totalMensagensSalvas++
          }

          // Salvar latestMessages (vantagem do basic-info)
          const latestMessages = chat.latestMessages || []
          for (const msg of latestMessages) {
            if (msg.isPrivate) continue
            const saved = await saveMessage(supabase, msg, chat, bar_id, channelId, telefone)
            if (saved) totalMensagensSalvas++
          }

        } catch (chatError) {
          allErros.push(`Chat ${chat.id}: ${String(chatError)}`)
        }
      }

      currentSkip += chats.length
      hasMore = currentSkip < totalItems
      
      if (hasMore) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    // Registrar log de sync
    await supabase
      .from('umbler_webhook_logs')
      .insert({
        bar_id: bar_id,
        event_type: 'sync_incremental',
        channel_id: channelId,
        payload: {
          periodo: { start: startDateStr, end: endDateStr },
          conversas_sincronizadas: totalConversasSalvas,
          mensagens_sincronizadas: totalMensagensSalvas,
          total_items_api: totalItems,
          batches: batchCount
        },
        processed: true,
        received_at: new Date().toISOString()
      })

    console.log(`[UMBLER-SYNC] Concluido: ${totalConversasSalvas} conversas, ${totalMensagensSalvas} mensagens`)

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, totalConversasSalvas + totalMensagensSalvas, { conversas: totalConversasSalvas, mensagens: totalMensagensSalvas })

    return new Response(
      JSON.stringify({
        success: true,
        periodo: {
          inicio: startDateStr,
          fim: endDateStr,
          dias: dias_atras
        },
        conversas_sincronizadas: totalConversasSalvas,
        mensagens_sincronizadas: totalMensagensSalvas,
        total_items_api: totalItems,
        batches_processados: batchCount,
        sincronizacao_completa: !hasMore,
        erros: allErros.length > 0 ? allErros.slice(0, 20) : undefined
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro no sync:', error)
    await heartbeatError(supabase, heartbeatId, startTime, error instanceof Error ? error : String(error))
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function saveMessage(
  supabase: any,
  msg: any,
  chat: any,
  bar_id: number,
  channelId: string,
  telefone: string
): Promise<boolean> {
  const source = msg.source || ''
  const direcao = source === 'Contact' ? 'entrada' : 'saida'
  const tipoRemetente = source === 'Contact' ? 'cliente' : 
    (source === 'Bot' ? 'bot' : 'atendente')

  const { error } = await supabase
    .from('umbler_mensagens')
    .upsert({
      id: msg.id,
      bar_id: bar_id,
      conversa_id: chat.id,
      channel_id: chat.channel?.id || channelId,
      direcao: direcao,
      tipo_remetente: tipoRemetente,
      contato_telefone: telefone,
      contato_nome: chat.contact?.name,
      tipo_mensagem: (msg.messageType || 'text').toLowerCase(),
      conteudo: msg.content,
      status: 'sincronizada',
      enviada_em: msg.eventAtUTC || msg.createdAtUTC,
      metadata: { 
        synced: true, 
        source: source,
        botName: msg.botInstance?.botName,
        messageState: msg.messageState
      }
    }, { onConflict: 'id' })

  return !error
}

function normalizePhone(phone: string | undefined): string {
  if (!phone) return ''
  let normalized = phone.replace(/\D/g, '')
  if (normalized.length === 11) {
    normalized = '55' + normalized
  } else if (normalized.length === 10) {
    normalized = '55' + normalized
  }
  return normalized
}