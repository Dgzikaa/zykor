import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UMBLER_API_BASE = 'https://app-utalk.umbler.com/api';

interface BulkSendSession {
  id: string;
  title: string;
  createdAtUTC: string;
  messagesSent: number;
  totalScheduled: number;
  totalFailed?: number;
  totalRead?: number;
  totalProcessing?: number;
  totalSent?: number;
  initiatedBy?: {
    id: string;
  };
  channel?: {
    id: string;
  };
  template?: {
    label: string;
    content: string;
  };
}

interface BulkSendRecipient {
  id: string;
  phoneNumber: string;
  contactName?: string;
  status: string; // 'Sent', 'Read', 'Failed', 'Processing', etc.
  sentAtUTC?: string;
  readAtUTC?: string;
}

/**
 * Normaliza telefone para formato consistente para comparação
 * Trata: +55, 55, sem código, com/sem 9 dígito, etc.
 * Retorna últimos 11 dígitos (DDD + 9 dígitos) ou 10 se for fixo
 */
function normalizeTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '';
  
  // Remove tudo que não é dígito
  let digits = telefone.replace(/\D/g, '');
  
  // Se começa com 55 (código do Brasil), remove
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2);
  }
  
  // Se tem 11 dígitos (DDD + 9 + número), retorna como está
  if (digits.length === 11) {
    return digits;
  }
  
  // Se tem 10 dígitos (DDD + número sem 9), adiciona 9 após DDD
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const numero = digits.slice(2);
    // Celulares começam com 9, fixos não
    if (numero.startsWith('9') || parseInt(numero[0]) >= 6) {
      return ddd + '9' + numero.slice(1);
    }
    return digits; // Mantém 10 dígitos para fixos
  }
  
  // Se tem 9 dígitos (só número com 9), não temos DDD - retorna como está
  if (digits.length === 9) {
    return digits;
  }
  
  // Para outros casos, retorna os últimos 11 dígitos
  if (digits.length > 11) {
    return digits.slice(-11);
  }
  
  return digits;
}

/**
 * Gera variações do telefone para busca mais flexível
 * Retorna array com diferentes formatos possíveis
 */
function gerarVariacoesTelefone(telefone: string): string[] {
  const normalized = normalizeTelefone(telefone);
  if (!normalized) return [];
  
  const variacoes: string[] = [normalized];
  
  // Com código do país
  if (!normalized.startsWith('55')) {
    variacoes.push('55' + normalized);
  }
  
  // Se tem 11 dígitos, também tenta com 10 (sem o 9 extra)
  if (normalized.length === 11) {
    const ddd = normalized.slice(0, 2);
    const nono = normalized[2];
    const resto = normalized.slice(3);
    if (nono === '9') {
      variacoes.push(ddd + resto); // versão com 10 dígitos
    }
  }
  
  // Se tem 10 dígitos, também tenta com 11 (com 9)
  if (normalized.length === 10) {
    const ddd = normalized.slice(0, 2);
    const numero = normalized.slice(2);
    variacoes.push(ddd + '9' + numero); // versão com 11 dígitos
  }
  
  return [...new Set(variacoes)]; // Remove duplicados
}

/**
 * GET /api/umbler/bulksend
 * Lista campanhas de bulksend da Umbler e opcionalmente faz cruzamento
 * 
 * Params:
 * - bar_id: ID do bar (para buscar config)
 * - session_id: ID específico de uma sessão para detalhes
 * - cruzamento: 'true' para incluir cruzamento com reservas/comparecimento
 * - data_evento: Data específica do evento para cruzar reservas (formato: YYYY-MM-DD)
 * - modo: 'pre_evento' (só GetIn) ou 'pos_evento' (GetIn + ContaHub). Default: auto-detecta
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const sessionId = searchParams.get('session_id');
    const incluirCruzamento = searchParams.get('cruzamento') === 'true';
    const dataEvento = searchParams.get('data_evento'); // Data específica do evento
    const modo = searchParams.get('modo') as 'pre_evento' | 'pos_evento' | null; // Modo de análise
    const limit = parseInt(searchParams.get('limit') || '20');

    // 1. Buscar config da Umbler para o bar
    const { data: config, error: configError } = await supabase
      .from('umbler_config')
      .select('*')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Umbler não configurado para este bar' },
        { status: 400 }
      );
    }

    const { api_token, organization_id } = config;

    // 2. Se foi passado session_id, buscar detalhes dessa sessão
    if (sessionId) {
      return await getBulkSendDetails(
        api_token, 
        organization_id, 
        sessionId, 
        barId,
        incluirCruzamento,
        dataEvento,
        modo
      );
    }

    // 3. Listar todas as sessões de bulksend
    const sessionsResponse = await fetch(
      `${UMBLER_API_BASE}/v1/bulk-send-session/?organizationId=${organization_id}&Take=${limit}&OrderBy=CreatedAtUTC&Order=Desc`,
      {
        headers: {
          'Authorization': `Bearer ${api_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!sessionsResponse.ok) {
      const errorText = await sessionsResponse.text();
      console.error('Erro ao buscar bulksend sessions:', errorText);
      return NextResponse.json(
        { 
          error: 'Erro ao buscar campanhas da Umbler', 
          details: errorText,
          debug: {
            organization_id,
            status: sessionsResponse.status,
            url: `${UMBLER_API_BASE}/v1/bulk-send-session/?organizationId=${organization_id}`
          }
        },
        { status: sessionsResponse.status }
      );
    }

    const sessionsData = await sessionsResponse.json();
    const allSessions: BulkSendSession[] = sessionsData.items || [];

    // Filtrar apenas campanhas com mais de 90 envios (campanhas em massa reais)
    // A API Umbler usa totalScheduled para quantidade de mensagens programadas
    const minEnvios = parseInt(searchParams.get('min_envios') || '90');
    const sessions = allSessions.filter(s => 
      (s.totalScheduled || 0) >= minEnvios || 
      (s.messagesSent || 0) >= minEnvios || 
      (s.totalSent || 0) >= minEnvios
    );

    // 4. Buscar detalhes completos de cada sessão (para ter totalSent, totalRead, etc)
    const sessionsComDetalhes = await Promise.all(
      sessions.map(async (session) => {
        try {
          const detailResponse = await fetch(
            `${UMBLER_API_BASE}/v1/bulk-send-session/${session.id}/?organizationId=${organization_id}`,
            {
              headers: {
                'Authorization': `Bearer ${api_token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (detailResponse.ok) {
            const details = await detailResponse.json();
            return { ...session, ...details };
          }
          return session;
        } catch {
          return session;
        }
      })
    );

    // 5. Se incluir cruzamento, calcular para cada sessão
    let campanhasComAnalise = sessionsComDetalhes;
    
    if (incluirCruzamento && sessionsComDetalhes.length > 0) {
      campanhasComAnalise = await Promise.all(
        sessionsComDetalhes.map(async (session) => {
          const analise = await calcularAnaliseCampanha(
            api_token,
            organization_id,
            session.id,
            barId,
            session.createdAtUTC,
            session // Passar dados da sessão para evitar chamadas extras
          );
          return { ...session, analise };
        })
      );
    }

    return NextResponse.json({
      success: true,
      campanhas: campanhasComAnalise,
      total: sessionsData.page?.totalItems || sessions.length,
      debug: {
        organization_id,
        total_da_api: allSessions.length,
        apos_filtro: sessions.length,
        min_envios: minEnvios
      }
    });

  } catch (error) {
    console.error('Erro na API bulksend:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function getBulkSendDetails(
  apiToken: string,
  organizationId: string,
  sessionId: string,
  barId: number,
  incluirCruzamento: boolean,
  dataEvento?: string | null,
  modo?: 'pre_evento' | 'pos_evento' | null
): Promise<NextResponse> {
  try {
    // 1. Buscar detalhes da sessão
    const sessionResponse = await fetch(
      `${UMBLER_API_BASE}/v1/bulk-send-session/${sessionId}/?organizationId=${organizationId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!sessionResponse.ok) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404 }
      );
    }

    const session: BulkSendSession = await sessionResponse.json();

    // 2. Buscar mensagens enviadas da sessão (endpoint que retorna os contatos)
    // Função para extrair telefone do chatId (formato: 5561999999999@s.whatsapp.net)
    const extrairTelefoneDoChatId = (chatId: string): string | null => {
      if (!chatId) return null;
      // Remove o sufixo @s.whatsapp.net ou @c.us
      const match = chatId.match(/^(\d+)@/);
      if (match) {
        return match[1]; // Retorna só os dígitos
      }
      return null;
    };
    
    // Buscar em lotes de 500 até pegar todos
    let allMessagesSent: Array<{
      chatId: string;
      messageId: string;
      state: string;
      eventAtUTC: string;
      contactId: string;
      contactName: string;
    }> = [];
    
    let skip = 0;
    const take = 250; // API Umbler limita a 250 por página
    let hasMore = true;
    
    while (hasMore && skip < 10000) { // Limite de segurança de 10000
      const messagesUrl = `${UMBLER_API_BASE}/v1/bulk-send-session/${sessionId}/messages-sent/?organizationId=${organizationId}&Skip=${skip}&Take=${take}&Behavior=GetSliceOnly`;

      const messagesResponse = await fetch(messagesUrl, {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text();
        console.error('[BULKSEND DETAILS] Messages error:', messagesResponse.status, errorText);
        break;
      }

      const messagesData = await messagesResponse.json();
      const items = messagesData.items || [];

      if (items.length > 0) {
        allMessagesSent = [...allMessagesSent, ...items];
        skip += items.length; // Usar o tamanho real retornado
        hasMore = items.length >= take; // Continuar se retornou o máximo ou mais
      } else {
        hasMore = false;
      }
    }

    // 3. Primeiro tentar extrair telefones do chatId
    // Se não conseguir, buscar da tabela umbler_conversas como fallback
    
    // Tentar extrair do chatId primeiro
    let destinatarios = allMessagesSent.map(msg => {
      const telefoneExtraido = extrairTelefoneDoChatId(msg.chatId);
      return {
        contactId: msg.contactId,
        contactName: msg.contactName,
        telefone: telefoneExtraido,
        state: msg.state, // Processing, Sent, Read, Failed
        eventAtUTC: msg.eventAtUTC
      };
    });
    
    let telefonesExtraidos = destinatarios.filter(d => d.telefone).length;

    // Se poucos telefones foram extraídos do chatId, buscar da tabela umbler_conversas
    if (telefonesExtraidos < destinatarios.length * 0.5) {
      const contactIds = allMessagesSent.map(m => m.contactId).filter(Boolean);
      const uniqueContactIds = [...new Set(contactIds)];

      if (uniqueContactIds.length > 0) {
        // Buscar em lotes de 500 para evitar limite do Supabase
        const contactIdToPhone = new Map<string, string>();
        const batchSize = 500;
        
        for (let i = 0; i < uniqueContactIds.length; i += batchSize) {
          const batch = uniqueContactIds.slice(i, i + batchSize);

          const { data: conversas, error } = await supabase
            .from('umbler_conversas')
            .select('contato_id, contato_telefone, contato_nome')
            .eq('bar_id', barId)
            .in('contato_id', batch);
          
          if (error) {
            console.error('[BULKSEND DETAILS] Erro ao buscar conversas:', error);
          } else if (conversas && conversas.length > 0) {
            conversas.forEach(c => {
              if (c.contato_id && c.contato_telefone) {
                contactIdToPhone.set(c.contato_id, c.contato_telefone);
              }
            });
          }
        }

        if (contactIdToPhone.size > 0) {
          // Atualizar destinatários que não tem telefone
          destinatarios = destinatarios.map(d => {
            if (!d.telefone && d.contactId) {
              const telefoneTabela = contactIdToPhone.get(d.contactId);
              if (telefoneTabela) {
                return { ...d, telefone: telefoneTabela };
              }
            }
            return d;
          });
          
          telefonesExtraidos = destinatarios.filter(d => d.telefone).length;
        }
      }
    }
    
    // Telefones para busca de cruzamento - usando normalização robusta
    const telefonesParaBusca = destinatarios
      .map(d => normalizeTelefone(d.telefone))
      .filter(Boolean) as string[];
    
    // Criar mapa de variações para busca mais flexível
    const telefoneVariacoesMap = new Map<string, string[]>();
    destinatarios.forEach(d => {
      if (d.telefone) {
        const normalized = normalizeTelefone(d.telefone);
        if (normalized) {
          telefoneVariacoesMap.set(normalized, gerarVariacoesTelefone(d.telefone));
        }
      }
    });

    // 4. Se não incluir cruzamento, retornar apenas os dados da Umbler
    if (!incluirCruzamento) {
      return NextResponse.json({
        success: true,
        campanha: session,
        destinatarios: destinatarios
      });
    }

    // 5. Fazer cruzamento com reservas e comparecimento
    // Se data_evento foi especificada, buscar apenas reservas desse dia
    // Caso contrário, buscar do dia da campanha até hoje
    const dataInicio = dataEvento || session.createdAtUTC.split('T')[0];
    const dataFim = dataEvento || new Date().toISOString().split('T')[0];
    
    // Determinar modo automaticamente se não especificado
    // Pre-evento: data do evento é hoje ou futura
    // Pos-evento: data do evento é passada
    const hoje = new Date().toISOString().split('T')[0];
    const modoEfetivo = modo || (dataEvento && dataEvento <= hoje ? 'pos_evento' : 'pre_evento');
    const incluirContaHub = modoEfetivo === 'pos_evento';

    // Buscar reservas do Getin no período
    let reservasQuery = supabase
      .from('bronze_getin_reservations')
      .select('reservation_id, customer_phone, customer_name, customer_email, status, reservation_date, reservation_time, people, synced_at')
      .eq('bar_id', barId)
      .not('customer_phone', 'is', null);
    
    // Se data_evento especificada, buscar só esse dia
    if (dataEvento) {
      reservasQuery = reservasQuery.eq('reservation_date', dataEvento);
    } else {
      reservasQuery = reservasQuery
        .gte('reservation_date', dataInicio)
        .lte('reservation_date', dataFim);
    }
    
    const { data: reservas } = await reservasQuery;

    // Mapear reservas por telefone normalizado (com todas as variações)
    interface ReservaInfo {
      reservation_id: string;
      status: string;
      data: string;
      horario: string;
      pessoas: number;
      nome: string;
      email: string;
      telefone: string;
      created_at: string; // Quando a reserva foi feita
    }
    const reservasPorTelefone = new Map<string, ReservaInfo>();
    const todasReservas: ReservaInfo[] = []; // Para timeline
    
    (reservas || []).forEach(r => {
      if (!r.customer_phone) return;
      
      const reservaInfo: ReservaInfo = {
        reservation_id: r.reservation_id || '',
        status: r.status || 'unknown',
        data: r.reservation_date || '',
        horario: r.reservation_time || '',
        pessoas: r.people || 0,
        nome: r.customer_name || '',
        email: r.customer_email || '',
        telefone: r.customer_phone || '',
        created_at: r.created_at || r.updated_at || ''
      };
      
      todasReservas.push(reservaInfo);
      
      const variacoes = gerarVariacoesTelefone(r.customer_phone);
      variacoes.forEach(normalized => {
        const existing = reservasPorTelefone.get(normalized);
        if (!existing || (r.reservation_date && r.reservation_date > existing.data)) {
          reservasPorTelefone.set(normalized, reservaInfo);
        }
      });
    });

    // Buscar visitas no ContaHub - APENAS se for modo pós-evento
    const visitasPorTelefone = new Map<string, { data: string; valor: number }>();
    
    if (incluirContaHub) {
      const { data: visitas } = await supabase
        .schema('silver')
        .from('cliente_visitas')
        .select('cliente_fone, data_visita, valor_pagamentos')
        .eq('bar_id', barId)
        .gte('data_visita', dataInicio)
        .lte('data_visita', dataFim)
        .eq('tem_telefone', true)
        .gt('pessoas', 0);

      // Mapear visitas por telefone normalizado (com todas as variações)
      (visitas || []).forEach(v => {
        if (!v.cliente_fone) return;
        const variacoes = gerarVariacoesTelefone(v.cliente_fone);
        variacoes.forEach(normalized => {
          const existing = visitasPorTelefone.get(normalized);
          if (!existing) {
            visitasPorTelefone.set(normalized, {
              data: v.data_visita || '',
              valor: v.valor_pagamentos || 0
            });
          } else {
            existing.valor += v.valor_pagamentos || 0;
          }
        });
      });
    }

    // ========== TIMELINE ==========
    // Criar timeline de eventos para visualizar impacto do bulk
    const bulkEnviadoEm = new Date(session.createdAtUTC);

    // Separar reservas em ANTES e DEPOIS do bulk
    const reservasAntesBulk: typeof todasReservas = [];
    const reservasDeposBulk: typeof todasReservas = [];
    const reservasSemDataCriacao: typeof todasReservas = [];
    
    todasReservas.forEach(r => {
      if (!r.created_at) {
        reservasSemDataCriacao.push(r);
        return;
      }
      
      const reservaCriadaEm = new Date(r.created_at);
      if (reservaCriadaEm < bulkEnviadoEm) {
        reservasAntesBulk.push(r);
      } else {
        reservasDeposBulk.push(r);
      }
    });
    
    // Ordenar por created_at
    reservasAntesBulk.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    reservasDeposBulk.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Montar timeline estruturada
    interface TimelineEvent {
      tipo: 'reserva' | 'bulk_enviado';
      timestamp: string;
      dados: any;
    }
    
    const timeline: TimelineEvent[] = [];
    
    // Adicionar reservas anteriores ao bulk
    reservasAntesBulk.forEach(r => {
      timeline.push({
        tipo: 'reserva',
        timestamp: r.created_at,
        dados: {
          nome: r.nome,
          telefone: r.telefone,
          pessoas: r.pessoas,
          horario_reserva: r.horario,
          status: r.status,
          origem: 'antes_bulk'
        }
      });
    });
    
    // Adicionar evento do bulk
    timeline.push({
      tipo: 'bulk_enviado',
      timestamp: session.createdAtUTC,
      dados: {
        titulo: session.title,
        total_enviados: session.totalSent || session.totalScheduled || 0,
        total_lidos: session.totalRead || 0
      }
    });
    
    // Adicionar reservas posteriores ao bulk
    reservasDeposBulk.forEach(r => {
      timeline.push({
        tipo: 'reserva',
        timestamp: r.created_at,
        dados: {
          nome: r.nome,
          telefone: r.telefone,
          pessoas: r.pessoas,
          horario_reserva: r.horario,
          status: r.status,
          origem: 'depois_bulk'
        }
      });
    });
    
    // Ordenar timeline por timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Resumo da timeline
    const timelineResumo = {
      reservas_antes_bulk: reservasAntesBulk.length,
      pessoas_antes_bulk: reservasAntesBulk.reduce((sum, r) => sum + r.pessoas, 0),
      bulk_enviado_em: session.createdAtUTC,
      reservas_depois_bulk: reservasDeposBulk.length,
      pessoas_depois_bulk: reservasDeposBulk.reduce((sum, r) => sum + r.pessoas, 0),
      reservas_sem_data: reservasSemDataCriacao.length,
      impacto_estimado: {
        novas_reservas: reservasDeposBulk.length,
        novas_pessoas: reservasDeposBulk.reduce((sum, r) => sum + r.pessoas, 0),
        crescimento_percentual: reservasAntesBulk.length > 0 
          ? ((reservasDeposBulk.length / reservasAntesBulk.length) * 100).toFixed(1) + '%'
          : 'N/A (sem reservas antes)'
      }
    };

    // Montar destinatários com cruzamento (usando busca por variações)
    const destinatariosComCruzamento = destinatarios.map(d => {
      const variacoes = gerarVariacoesTelefone(d.telefone || '');
      
      // Buscar reserva em qualquer variação do telefone
      let reserva: ReservaInfo | undefined;
      for (const v of variacoes) {
        reserva = reservasPorTelefone.get(v);
        if (reserva) break;
      }
      
      // Buscar visita em qualquer variação do telefone (só no modo pós-evento)
      let visita: { data: string; valor: number } | undefined;
      if (incluirContaHub) {
        for (const v of variacoes) {
          visita = visitasPorTelefone.get(v);
          if (visita) break;
        }
      }

      // Dados base (sempre retornados)
      const dadosBase = {
        telefone: d.telefone,
        nome: d.contactName || null,
        status_envio: d.state,
        enviado_em: d.eventAtUTC,
        leu_mensagem: d.state === 'Read',
        lido_em: d.state === 'Read' ? d.eventAtUTC : null,
        fez_reserva: !!reserva,
        reserva_status: reserva?.status || null,
        reserva_data: reserva?.data || null,
        reserva_horario: reserva?.horario || null,
        reserva_pessoas: reserva?.pessoas || null,
        reserva_nome: reserva?.nome || null
      };

      // Adicionar dados de comparecimento apenas no modo pós-evento
      if (incluirContaHub) {
        return {
          ...dadosBase,
          compareceu: reserva?.status === 'seated',
          foi_ao_bar: !!visita,
          data_visita: visita?.data || null,
          valor_gasto: visita?.valor || null
        };
      }

      return dadosBase;
    });

    // Calcular métricas - usar dados da sessão quando disponíveis
    const fizeramReserva = destinatariosComCruzamento.filter(d => d.fez_reserva).length;
    
    // Métricas de ContaHub apenas no modo pós-evento
    const foramAoBar = incluirContaHub 
      ? destinatariosComCruzamento.filter(d => 'foi_ao_bar' in d && d.foi_ao_bar).length 
      : 0;
    const valorTotalGasto = incluirContaHub 
      ? destinatariosComCruzamento.reduce((sum, d) => sum + (('valor_gasto' in d ? d.valor_gasto : 0) || 0), 0) 
      : 0;

    const reservasSeated = destinatariosComCruzamento.filter(d => d.reserva_status === 'seated').length;
    const reservasNoShow = destinatariosComCruzamento.filter(d => d.reserva_status === 'no-show').length;
    const reservasConfirmadas = destinatariosComCruzamento.filter(d => d.reserva_status === 'confirmed').length;
    const reservasCanceladas = destinatariosComCruzamento.filter(d => 
      d.reserva_status === 'canceled-user' || d.reserva_status === 'canceled-agent'
    ).length;

    // Usar dados agregados da sessão Umbler (que são confiáveis)
    const totalEnviados = session.totalSent || session.totalScheduled || 0;
    const totalLidos = session.totalRead || 0;
    const totalErros = session.totalFailed || 0;

    // Métrica principal: quem LEU e FEZ RESERVA (conversão real)
    const leramEFizeramReserva = destinatariosComCruzamento.filter(d => d.leu_mensagem && d.fez_reserva);
    const totalLeramEFizeramReserva = leramEFizeramReserva.length;
    const pessoasLeramEFizeramReserva = leramEFizeramReserva.reduce((sum, d) => sum + (d.reserva_pessoas || 0), 0);
    
    // Também: quem RECEBEU e FEZ RESERVA (mesmo sem ler)
    const receberamEFizeramReserva = destinatariosComCruzamento.filter(d => d.fez_reserva);
    const totalReceberamEFizeramReserva = receberamEFizeramReserva.length;
    const pessoasReceberamEFizeramReserva = receberamEFizeramReserva.reduce((sum, d) => sum + (d.reserva_pessoas || 0), 0);

    // Identificar reservas que NÃO vieram do bulk (fizeram reserva mas não estavam na lista)
    const telefonesNaBulk = new Set(
      destinatarios
        .map(d => normalizeTelefone(d.telefone))
        .filter(Boolean)
    );
    
    // Adicionar variações dos telefones do bulk
    destinatarios.forEach(d => {
      if (d.telefone) {
        gerarVariacoesTelefone(d.telefone).forEach(v => telefonesNaBulk.add(v));
      }
    });
    
    const reservasForaDoBulk = (reservas || []).filter(r => {
      if (!r.customer_phone) return false;
      const variacoes = gerarVariacoesTelefone(r.customer_phone);
      return !variacoes.some(v => telefonesNaBulk.has(v));
    }).map(r => ({
      telefone: r.customer_phone,
      nome: r.customer_name,
      email: r.customer_email,
      status: r.status,
      data: r.reservation_date,
      horario: r.reservation_time,
      pessoas: r.people
    }));

    return NextResponse.json({
      success: true,
      campanha: {
        id: session.id,
        nome: session.title,
        template_mensagem: session.template?.content || '',
        status: 'concluida',
        created_at: session.createdAtUTC,
        total_destinatarios: totalEnviados,
        enviados: totalEnviados,
        lidos: totalLidos,
        erros: totalErros
      },
      metricas: {
        // Métricas de envio (sempre disponíveis)
        total_destinatarios: totalEnviados,
        enviados: totalEnviados,
        erros: totalErros,
        taxa_envio: 100, // Se chegou aqui, foi 100% enviado
        lidos: totalLidos,
        taxa_leitura: totalEnviados > 0 ? (totalLidos / totalEnviados) * 100 : 0,
        // Métricas de reserva (sempre disponíveis)
        fizeram_reserva: fizeramReserva,
        taxa_conversao_reserva: totalEnviados > 0 ? (fizeramReserva / totalEnviados) * 100 : 0,
        reservas_pending: destinatariosComCruzamento.filter(d => d.reserva_status === 'pending').length,
        reservas_confirmadas: reservasConfirmadas,
        reservas_canceladas: reservasCanceladas,
        // Métricas de comparecimento (apenas pós-evento)
        ...(incluirContaHub ? {
          reservas_seated: reservasSeated,
          reservas_no_show: reservasNoShow,
          foram_ao_bar: foramAoBar,
          taxa_comparecimento: totalEnviados > 0 ? (foramAoBar / totalEnviados) * 100 : 0,
          valor_total_gasto: valorTotalGasto,
          ticket_medio: foramAoBar > 0 ? valorTotalGasto / foramAoBar : 0
        } : {})
      },
      // Timeline de impacto
      timeline: timeline,
      timeline_resumo: timelineResumo,
      // Dados detalhados
      destinatarios: destinatariosComCruzamento,
      reservas_fora_do_bulk: reservasForaDoBulk,
      resumo: {
        modo: modoEfetivo,
        data_evento: dataEvento || null,
        data_analise: hoje,
        // Dados do Bulk
        total_bulk: totalEnviados,
        bulk_lidos: totalLidos,
        taxa_leitura: totalEnviados > 0 ? ((totalLidos / totalEnviados) * 100).toFixed(2) + '%' : '0%',
        // Cruzamento Bulk x GetIn (Reservas)
        total_reservas_dia: reservas?.length || 0,
        reservas_do_bulk: fizeramReserva,
        reservas_fora_bulk: reservasForaDoBulk.length,
        taxa_conversao_bulk: totalEnviados > 0 ? ((fizeramReserva / totalEnviados) * 100).toFixed(2) + '%' : '0%',
        pessoas_total_bulk: destinatariosComCruzamento.filter(d => d.fez_reserva).reduce((sum, d) => sum + (d.reserva_pessoas || 0), 0),
        pessoas_total_fora_bulk: reservasForaDoBulk.reduce((sum, r) => sum + (r.pessoas || 0), 0),
        // CONVERSÃO REAL: Leu a mensagem E fez reserva
        leram_e_fizeram_reserva: totalLeramEFizeramReserva,
        pessoas_leram_e_fizeram_reserva: pessoasLeramEFizeramReserva,
        taxa_conversao_leitura: totalLidos > 0 ? ((totalLeramEFizeramReserva / totalLidos) * 100).toFixed(2) + '%' : '0%',
        // Lista de quem leu e fez reserva
        quem_leu_e_reservou: leramEFizeramReserva.map(d => ({
          nome: d.reserva_nome || d.nome,
          telefone: d.telefone,
          pessoas: d.reserva_pessoas,
          horario: d.reserva_horario
        })),
        // Lista de quem RECEBEU e fez reserva (mesmo sem ler)
        receberam_e_fizeram_reserva: totalReceberamEFizeramReserva,
        pessoas_receberam_e_fizeram_reserva: pessoasReceberamEFizeramReserva,
        quem_recebeu_e_reservou: receberamEFizeramReserva.map(d => ({
          nome: d.reserva_nome || d.nome,
          telefone: d.telefone,
          pessoas: d.reserva_pessoas,
          horario: d.reserva_horario,
          leu: d.leu_mensagem
        })),
        // Dados de visitas (apenas pós-evento)
        dados_visitas_disponiveis: incluirContaHub,
        foram_ao_bar: incluirContaHub ? foramAoBar : null,
        valor_total_gasto: incluirContaHub ? valorTotalGasto : null,
        ticket_medio: incluirContaHub && foramAoBar > 0 ? valorTotalGasto / foramAoBar : null
      },
      debug: {
        messages_sent_da_api: allMessagesSent.length,
        telefones_extraidos: destinatarios.filter(d => d.telefone).length,
        telefones_buscados: telefonesParaBusca.length,
        telefones_campanha_amostra: telefonesParaBusca.slice(0, 10),
        reservas_no_periodo_total: reservas?.length || 0,
        reservas_mapeadas: reservasPorTelefone.size,
        reservas_telefones_amostra: Array.from(reservasPorTelefone.keys()).slice(0, 10),
        visitas_encontradas: visitasPorTelefone.size,
        periodo_busca: { dataInicio, dataFim },
        bar_id: barId
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar detalhes bulksend:', error);
    console.error('Stack:', error?.stack);
    return NextResponse.json(
      { error: 'Erro interno', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

async function calcularAnaliseCampanha(
  apiToken: string,
  organizationId: string,
  sessionId: string,
  barId: number,
  createdAt: string,
  sessionData?: BulkSendSession // Dados da sessão já carregados
) {
  try {
    // Se já temos os dados da sessão, usar diretamente
    // Evita chamada extra à API e usa dados agregados confiáveis
    if (sessionData) {
      const totalEnviados = sessionData.totalSent || sessionData.totalScheduled || sessionData.messagesSent || 0;
      const totalLidos = sessionData.totalRead || 0;
      const totalErros = sessionData.totalFailed || 0;
      
      // Retornar métricas básicas da sessão (sem cruzamento detalhado na listagem)
      // O cruzamento completo será feito quando abrir os detalhes
      return {
        total_destinatarios: totalEnviados,
        enviados: totalEnviados,
        erros: totalErros,
        taxa_envio: 100,
        lidos: totalLidos,
        taxa_leitura: totalEnviados > 0 ? (totalLidos / totalEnviados) * 100 : 0,
        fizeram_reserva: 0, // Será calculado ao abrir detalhes
        taxa_conversao_reserva: 0,
        reservas_seated: 0,
        reservas_no_show: 0,
        reservas_confirmadas: 0,
        reservas_canceladas: 0,
        foram_ao_bar: 0,
        taxa_comparecimento: 0,
        valor_total_gasto: 0,
        ticket_medio: 0
      };
    }
    
    // Sem dados da sessão, retornar null
    // O cruzamento detalhado será feito ao abrir os detalhes da campanha
    return null;
  } catch (error) {
    console.error('Erro ao calcular análise:', error);
    return null;
  }
}
