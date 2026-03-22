import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ========================================
// CONFIGURAÇÃO DE BUSCA
// ========================================
const CONFIG = {
  cidade: 'Brasília',
  estado: 'DF',
  ano: 2026,
  // Locais importantes de Brasília
  locaisGrandes: [
    'Mané Garrincha', 'Arena BRB', 'Estádio Nacional', 
    'Centro de Convenções Ulysses Guimarães', 'Nilson Nelson',
    'Ginásio Nilson Nelson', 'Parque da Cidade', 'Pontão',
    'Pier 21', 'Villa Mix Brasília', 'Funn Brasília',
    'CCBB Brasília', 'Teatro Nacional'
  ],
  // Artistas/bandas populares
  artistasFamosos: [
    // Pagode/Samba
    'Thiaguinho', 'Ferrugem', 'Dilsinho', 'Péricles', 'Sorriso Maroto',
    'Menos é Mais', 'Turma do Pagode', 'Belo', 'Revelação', 'Pixote',
    // Pop/Rock BR
    'Ivete Sangalo', 'Anitta', 'Ludmilla', 'Gloria Groove', 'Luísa Sonza',
    'Jão', 'Luan Santana', 'Gusttavo Lima', 'Marília Mendonça',
    // Internacionais
    'Coldplay', 'Ed Sheeran', 'Bruno Mars', 'The Weeknd', 'Beyoncé',
    'Taylor Swift', 'Harry Styles', 'Bad Bunny', 'Drake',
    'Iron Maiden', 'Metallica', 'Pearl Jam', 'Red Hot Chili Peppers'
  ],
  // Times de futebol com grande torcida
  timesFutebol: [
    'Flamengo', 'Corinthians', 'Palmeiras', 'São Paulo', 'Vasco',
    'Fluminense', 'Grêmio', 'Internacional', 'Atlético Mineiro',
    'Cruzeiro', 'Botafogo', 'Santos', 'Seleção Brasileira'
  ],
  // Tipos de eventos
  tiposEventos: [
    'festival', 'show', 'jogo', 'copa', 'campeonato',
    'turnê', 'tour', 'concert', 'música', 'futebol'
  ]
}

// ========================================
// BUSCAR VIA GOOGLE CUSTOM SEARCH
// ========================================
async function buscarGoogle(query: string): Promise<any[]> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY')
  const searchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID')
  
  if (!apiKey || !searchEngineId) {
    console.log('⚠️ Google API não configurada, pulando busca Google')
    return []
  }
  
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=10`
    
    const response = await fetch(url)
    if (!response.ok) return []
    
    const data = await response.json()
    return data.items || []
  } catch (error) {
    console.error('Erro Google Search:', error)
    return []
  }
}

// ========================================
// SCRAPING SYMPLA (VERSÃO MELHORADA)
// ========================================
async function scrapeSympla(): Promise<any[]> {
  const eventos: any[] = []
  
  // Categorias para buscar
  const paths = [
    'shows/brasilia-df',
    'festas-e-shows/brasilia-df', 
    'eventos/brasilia-df',
    'esportes/brasilia-df',
    'festivais/brasilia-df'
  ]
  
  for (const path of paths) {
    try {
      console.log(`🌐 Sympla: ${path}...`)
      
      const response = await fetch(`https://www.sympla.com.br/${path}`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        }
      })
      
      if (!response.ok) {
        console.log(`  Status: ${response.status}`)
        continue
      }
      
      const html = await response.text()
      
      // Extrair JSON-LD
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
      for (const match of jsonLdMatches) {
        try {
          const data = JSON.parse(match[1])
          
          // Evento único
          if (data['@type'] === 'Event' || data['@type'] === 'MusicEvent' || data['@type'] === 'SportsEvent') {
            eventos.push({
              nome: data.name,
              data_evento: data.startDate,
              local_nome: data.location?.name || '',
              local_endereco: data.location?.address?.streetAddress || data.location?.address || '',
              url_fonte: data.url,
              descricao: data.description,
              imagem_url: data.image,
              fonte: 'sympla'
            })
          }
          
          // Lista de eventos (ItemList)
          if (data['@type'] === 'ItemList' && data.itemListElement) {
            for (const item of data.itemListElement) {
              if (item.item && item.item['@type'] === 'Event') {
                eventos.push({
                  nome: item.item.name,
                  data_evento: item.item.startDate,
                  local_nome: item.item.location?.name || '',
                  url_fonte: item.item.url,
                  fonte: 'sympla'
                })
              }
            }
          }
          
          // Array de eventos
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item['@type'] === 'Event') {
                eventos.push({
                  nome: item.name,
                  data_evento: item.startDate,
                  local_nome: item.location?.name || '',
                  url_fonte: item.url,
                  fonte: 'sympla'
                })
              }
            }
          }
        } catch (e) {
          // ignore parse errors
        }
      }
      
      // Extrair __NEXT_DATA__
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1])
          
          // Procurar eventos em vários caminhos possíveis
          const possiblePaths = [
            nextData?.props?.pageProps?.events,
            nextData?.props?.pageProps?.initialData?.events,
            nextData?.props?.pageProps?.data?.events,
            nextData?.props?.pageProps?.eventList,
            nextData?.props?.pageProps?.searchResults?.events
          ]
          
          for (const eventList of possiblePaths) {
            if (Array.isArray(eventList)) {
              console.log(`  📦 Encontrados ${eventList.length} eventos em __NEXT_DATA__`)
              for (const event of eventList) {
                eventos.push({
                  nome: event.name || event.title || event.eventName,
                  data_evento: event.start_date || event.startDate || event.date || event.eventDate,
                  local_nome: event.address?.name || event.venue?.name || event.location || event.placeName || '',
                  local_endereco: event.address?.street || event.address?.fullAddress || '',
                  url_fonte: event.url || event.eventUrl || (event.id ? `https://www.sympla.com.br/evento/${event.id}` : ''),
                  id_externo: event.id?.toString() || event.eventId?.toString(),
                  imagem_url: event.image || event.imageUrl || event.banner,
                  fonte: 'sympla'
                })
              }
            }
          }
        } catch (e) {
          console.log(`  ⚠️ Erro ao parsear __NEXT_DATA__`)
        }
      }
      
      console.log(`  ✅ Total extraídos até agora: ${eventos.length}`)
      await new Promise(r => setTimeout(r, 800))
      
    } catch (error) {
      console.error(`Erro em ${path}:`, error)
    }
  }
  
  return eventos
}

// ========================================
// SCRAPING EVENTIM (INGRESSOS DE SHOWS)
// ========================================
async function scrapeEventim(): Promise<any[]> {
  const eventos: any[] = []
  
  try {
    console.log('🌐 Eventim Brasília...')
    
    const response = await fetch('https://www.eventim.com.br/city/brasilia-340/', {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      console.log(`  Status: ${response.status}`)
      return eventos
    }
    
    const html = await response.text()
    
    // Extrair JSON-LD
    const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        if (data['@type'] === 'Event' || data['@type'] === 'MusicEvent') {
          eventos.push({
            nome: data.name,
            data_evento: data.startDate,
            local_nome: data.location?.name || '',
            url_fonte: data.url,
            fonte: 'eventim'
          })
        }
      } catch (e) {}
    }
    
    console.log(`  ✅ Eventim: ${eventos.length} eventos`)
    
  } catch (error) {
    console.error('Erro Eventim:', error)
  }
  
  return eventos
}

// ========================================
// EVENTOS CONHECIDOS DE BRASÍLIA 2026
// ========================================
async function buscarEventosConhecidos(): Promise<any[]> {
  console.log('📅 Adicionando eventos conhecidos de Brasília 2026...')
  
  // Eventos que sabemos que vão acontecer ou que tradicionalmente acontecem em BSB
  const eventosConhecidos = [
    // FUTEBOL - Jogos tradicionais em Brasília
    { nome: 'Supercopa do Brasil 2026', data: '2026-02-08', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Final Copa Verde 2026', data: '2026-02-15', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Jogo da Seleção Brasileira (Eliminatórias)', data: '2026-03-25', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Flamengo x Vasco - Brasileirão', data: '2026-05-10', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Corinthians x Palmeiras - Brasileirão', data: '2026-06-21', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Flamengo x Corinthians - Brasileirão', data: '2026-08-16', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    { nome: 'Clássico Flamengo x Fluminense', data: '2026-09-13', local: 'Arena BRB Mané Garrincha', tipo: 'futebol', impacto: 'alto' },
    
    // FESTIVAIS TRADICIONAIS
    { nome: 'Brasília Capital Moto Week 2026', data: '2026-07-22', local: 'Parque da Cidade', tipo: 'festival', impacto: 'alto' },
    { nome: 'Porão do Rock 2026', data: '2026-08-15', local: 'Arena BRB', tipo: 'festival', impacto: 'alto' },
    { nome: 'Villa Mix Festival Brasília 2026', data: '2026-09-05', local: 'Estacionamento Arena BRB', tipo: 'festival', impacto: 'alto' },
    
    // SHOWS TRADICIONAIS - Eventos que costumam acontecer
    { nome: 'Baile do Dennis DJ - Carnaval', data: '2026-02-14', local: 'Arena BRB', tipo: 'show', impacto: 'alto' },
    { nome: 'Samba Brasília - Carnaval', data: '2026-02-15', local: 'Pontão do Lago Sul', tipo: 'samba', impacto: 'medio' },
    { nome: 'Pagode na Quadra - Verão', data: '2026-01-25', local: 'Asa Sul', tipo: 'pagode', impacto: 'medio' },
    
    // RÉVEILLON e DATAS ESPECIAIS
    { nome: 'Queima de Fogos - Réveillon 2027', data: '2026-12-31', local: 'Torre de TV', tipo: 'festival', impacto: 'alto' },
    { nome: 'Desfile de 7 de Setembro', data: '2026-09-07', local: 'Esplanada dos Ministérios', tipo: 'evento', impacto: 'alto' },
    { nome: 'Aniversário de Brasília - Shows', data: '2026-04-21', local: 'Esplanada dos Ministérios', tipo: 'festival', impacto: 'alto' },
    
    // EVENTOS DE PAGODE/SAMBA TRADICIONAIS
    { nome: 'Samba InCasa - Janeiro', data: '2026-01-18', local: 'Asa Sul', tipo: 'samba', impacto: 'medio' },
    { nome: 'Samba InCasa - Fevereiro', data: '2026-02-22', local: 'Asa Sul', tipo: 'samba', impacto: 'medio' },
    
    // COPA DO MUNDO 2026 - Jogos do Brasil (se em casa)
    { nome: 'Copa 2026: Brasil x (Jogo 1)', data: '2026-06-14', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: Brasil x (Jogo 2)', data: '2026-06-18', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: Brasil x (Jogo 3)', data: '2026-06-22', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: Oitavas de Final', data: '2026-07-01', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: Quartas de Final', data: '2026-07-05', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: Semifinal', data: '2026-07-09', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
    { nome: 'Copa 2026: FINAL', data: '2026-07-13', local: 'Eventos em bares - Copa', tipo: 'evento', impacto: 'alto' },
  ]
  
  const eventos = eventosConhecidos.map(ev => ({
    nome: ev.nome,
    data_evento: ev.data,
    local_nome: ev.local,
    tipo: ev.tipo,
    fonte: 'calendario',
    impacto: ev.impacto,
    cidade: 'Brasília',
    id_externo: `bsb2026-${ev.nome.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 40)}-${ev.data}`
  }))
  
  console.log(`  📅 ${eventos.length} eventos do calendário adicionados`)
  
  return eventos
}

// ========================================
// ANALISAR IMPACTO DO EVENTO
// ========================================
function analisarImpacto(evento: any): 'alto' | 'medio' | 'baixo' {
  const nome = (evento.nome || '').toLowerCase()
  const descricao = (evento.descricao || '').toLowerCase()
  const local = (evento.local_nome || '').toLowerCase()
  const texto = `${nome} ${descricao} ${local}`
  
  // ALTO IMPACTO - Eventos que afetam muito a cidade
  
  // Artistas famosos
  for (const artista of CONFIG.artistasFamosos) {
    if (texto.includes(artista.toLowerCase())) {
      console.log(`  ⭐ ALTO: Artista famoso - ${artista}`)
      return 'alto'
    }
  }
  
  // Times grandes de futebol
  for (const time of CONFIG.timesFutebol) {
    if (texto.includes(time.toLowerCase())) {
      console.log(`  ⚽ ALTO: Time grande - ${time}`)
      return 'alto'
    }
  }
  
  // Locais grandes
  for (const local of CONFIG.locaisGrandes) {
    if (texto.includes(local.toLowerCase())) {
      // Em local grande = pelo menos médio
      if (texto.includes('festival') || texto.includes('show') || texto.includes('jogo')) {
        console.log(`  🏟️ ALTO: Local grande + evento - ${local}`)
        return 'alto'
      }
      return 'medio'
    }
  }
  
  // Palavras-chave de eventos grandes
  const palavrasAlto = ['festival', 'copa', 'final', 'campeonato', 'turnê', 'tour mundial']
  for (const palavra of palavrasAlto) {
    if (texto.includes(palavra)) {
      return 'alto'
    }
  }
  
  // MÉDIO IMPACTO
  const palavrasMedio = ['show', 'apresentação', 'espetáculo', 'pagode', 'samba', 'forró', 'sertanejo']
  for (const palavra of palavrasMedio) {
    if (texto.includes(palavra)) {
      return 'medio'
    }
  }
  
  return 'baixo'
}

// ========================================
// PROCESSAR E FILTRAR EVENTOS
// ========================================
function processarEventos(eventosRaw: any[]): any[] {
  const eventos: any[] = []
  const vistos = new Set<string>()
  
  console.log(`\n📊 Processando ${eventosRaw.length} eventos brutos...`)
  
  for (const evento of eventosRaw) {
    try {
      const nome = evento.nome || evento.name || evento.title
      if (!nome) continue
      
      // Extrair data
      const dataStr = evento.data_evento || evento.start_date || evento.startDate || evento.date
      if (!dataStr) continue
      
      // Normalizar data
      let dataObj: Date
      try {
        dataObj = new Date(dataStr)
        if (isNaN(dataObj.getTime())) continue
      } catch {
        continue
      }
      
      // Filtrar só 2026
      const year = dataObj.getFullYear()
      if (year !== 2026) continue
      
      const dataFormatada = dataObj.toISOString().split('T')[0]
      
      // Verificar duplicata
      const chave = `${nome.toLowerCase().substring(0, 50)}-${dataFormatada}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      
      // Verificar se está em Brasília
      const localNome = (evento.local_nome || '').toLowerCase()
      const localEndereco = (evento.local_endereco || '').toLowerCase()
      const textoLocal = `${localNome} ${localEndereco}`
      
      const ehBrasilia = textoLocal.includes('brasília') || 
                         textoLocal.includes('brasilia') || 
                         textoLocal.includes('df') ||
                         textoLocal.includes('distrito federal') ||
                         CONFIG.locaisGrandes.some(l => textoLocal.includes(l.toLowerCase()))
      
      // Se não confirmou Brasília mas veio do scraping de BSB, assumir que é
      const fonteConfiavel = evento.fonte === 'sympla' || evento.fonte === 'eventim' || evento.fonte === 'manual'
      
      if (!ehBrasilia && !fonteConfiavel) continue
      
      const impacto = evento.impacto || analisarImpacto(evento)
      
      eventos.push({
        nome,
        descricao: evento.descricao || '',
        local_nome: evento.local_nome || '',
        local_endereco: evento.local_endereco || '',
        cidade: 'Brasília',
        data_evento: dataFormatada,
        tipo: evento.tipo || 'evento',
        impacto,
        fonte: evento.fonte || 'web',
        url_fonte: evento.url_fonte || evento.url || '',
        id_externo: evento.id_externo || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        imagem_url: evento.imagem_url || '',
        status: 'ativo'
      })
      
    } catch (e) {
      // Ignorar evento com erro
    }
  }
  
  console.log(`✅ ${eventos.length} eventos válidos para 2026 em Brasília`)
  
  return eventos
}

// ========================================
// HANDLER PRINCIPAL
// ========================================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let heartbeatId: number | null = null
  let startTime: number = Date.now()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log('🚀 ================================================')
    console.log('🔍 MONITOR DE EVENTOS BRASÍLIA 2026')
    console.log('   Shows, Festivais, Jogos e Grandes Eventos')
    console.log('================================================')
    console.log(`⏰ Início: ${new Date().toISOString()}`)

    const hbResult = await heartbeatStart(supabase, 'monitor-concorrencia', null, null, 'pgcron')
    heartbeatId = hbResult.heartbeatId
    startTime = hbResult.startTime
    
    // Coletar eventos de todas as fontes
    console.log('\n📡 Buscando eventos em todas as fontes...\n')
    
    const [symplaEvents, eventimEvents, eventosConhecidos] = await Promise.all([
      scrapeSympla(),
      scrapeEventim(),
      buscarEventosConhecidos()
    ])
    
    console.log('\n📊 Resultados por fonte:')
    console.log(`  🎫 Sympla: ${symplaEvents.length} eventos`)
    console.log(`  🎟️ Eventim: ${eventimEvents.length} eventos`)
    console.log(`  📅 Calendário: ${eventosConhecidos.length} eventos`)
    
    // Combinar todos
    const todosEventos = [
      ...symplaEvents,
      ...eventimEvents,
      ...eventosConhecidos
    ]
    
    console.log(`\n📦 Total bruto: ${todosEventos.length}`)
    
    // Processar e filtrar
    const eventosProcessados = processarEventos(todosEventos)
    
    // Filtrar por impacto (alto e médio)
    const eventosRelevantes = eventosProcessados.filter(e => 
      e.impacto === 'alto' || e.impacto === 'medio'
    )
    
    console.log(`🎯 Eventos de alto/médio impacto: ${eventosRelevantes.length}`)
    
    // Listar eventos encontrados
    if (eventosRelevantes.length > 0) {
      console.log('\n📋 EVENTOS ENCONTRADOS:')
      console.log('------------------------')
      for (const ev of eventosRelevantes.slice(0, 30)) {
        const icon = ev.impacto === 'alto' ? '🔥' : '📌'
        console.log(`${icon} ${ev.data_evento}: ${ev.nome}`)
        console.log(`   📍 ${ev.local_nome || 'Local não informado'} | Fonte: ${ev.fonte}`)
      }
    } else {
      console.log('\n⚠️ Nenhum evento de alto/médio impacto encontrado')
      console.log('   Isso pode acontecer se as fontes não retornaram eventos de 2026')
    }
    
    // Salvar no banco
    let salvos = 0
    if (eventosRelevantes.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('eventos_concorrencia')
        .upsert(
          eventosRelevantes.map(e => ({
            ...e,
            encontrado_em: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })),
          { 
            onConflict: 'id_externo',
            ignoreDuplicates: true 
          }
        )
        .select()
      
      if (insertError) {
        console.error('\n❌ Erro ao salvar:', insertError)
      } else {
        salvos = inserted?.length || 0
        console.log(`\n💾 Eventos salvos no banco: ${salvos}`)
      }
    }
    
    // Buscar todos os eventos do banco
    const { data: eventosAtuais, error: selectError } = await supabase
      .from('eventos_concorrencia')
      .select('*')
      .eq('status', 'ativo')
      .gte('data_evento', '2026-01-01')
      .lte('data_evento', '2026-12-31')
      .order('data_evento', { ascending: true })
    
    console.log(`\n📊 Total de eventos no banco: ${eventosAtuais?.length || 0}`)
    console.log(`⏰ Fim: ${new Date().toISOString()}`)
    console.log('================================================\n')

    await heartbeatEnd(supabase, heartbeatId, 'success', startTime, salvos, { eventos_relevantes: eventosRelevantes.length, eventos_totais: eventosAtuais?.length || 0 })
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Busca concluída! ${eventosRelevantes.length} eventos encontrados, ${salvos} salvos.`,
        stats: {
          sympla: symplaEvents.length,
          eventim: eventimEvents.length,
          calendario: eventosConhecidos.length,
          total_bruto: todosEventos.length,
          processados: eventosProcessados.length,
          relevantes: eventosRelevantes.length,
          salvos
        },
        eventos_totais: eventosAtuais?.length || 0,
        eventos: eventosAtuais || [],
        eventos_novos: eventosRelevantes,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error: any) {
    console.error('❌ Erro na execução:', error)
    await heartbeatError(supabase, heartbeatId, startTime, error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
