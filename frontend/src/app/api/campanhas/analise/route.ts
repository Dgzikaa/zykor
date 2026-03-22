import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CampanhaUnificada {
  id: string;
  nome: string;
  tipo: string;
  origem: 'umbler' | 'crm';
  template_mensagem: string;
  status: string;
  total_destinatarios: number;
  enviados: number;
  erros: number;
  created_at: string;
  bar_id: number;
  segmento_alvo?: string;
}

interface DestinatarioComCruzamento {
  telefone: string;
  nome: string | null;
  status_envio: string;
  leu_mensagem: boolean;
  fez_reserva: boolean;
  reserva_status: string | null;
  reserva_data: string | null;
  compareceu: boolean;
  foi_ao_bar: boolean;
  data_visita: string | null;
  valor_gasto: number | null;
}

interface AnaliseCampanha {
  campanha: CampanhaUnificada;
  metricas: {
    total_destinatarios: number;
    enviados: number;
    erros: number;
    taxa_envio: number;
    lidos: number;
    taxa_leitura: number;
    fizeram_reserva: number;
    taxa_conversao_reserva: number;
    reservas_seated: number;
    reservas_no_show: number;
    reservas_confirmadas: number;
    reservas_canceladas: number;
    foram_ao_bar: number;
    taxa_comparecimento: number;
    valor_total_gasto: number;
    ticket_medio: number;
  };
  destinatarios: DestinatarioComCruzamento[];
}

/**
 * GET /api/campanhas/analise
 * Lista campanhas de todas as fontes (Umbler e CRM) com análise de cruzamento
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const campanhaId = searchParams.get('campanha_id');
    const origem = searchParams.get('origem'); // 'umbler' ou 'crm'
    const limit = parseInt(searchParams.get('limit') || '20');

    // Se foi passado um ID específico, retornar análise detalhada
    if (campanhaId && origem) {
      return await getAnaliseDetalhada(campanhaId, origem as 'umbler' | 'crm', barId);
    }

    // Listar campanhas de ambas as fontes
    const campanhas: CampanhaUnificada[] = [];

    // 1. Buscar campanhas Umbler
    const { data: umblerCampanhas } = await supabase
      .from('umbler_campanhas')
      .select('*')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(limit);

    (umblerCampanhas || []).forEach(c => {
      campanhas.push({
        id: c.id,
        nome: c.nome,
        tipo: 'whatsapp',
        origem: 'umbler',
        template_mensagem: c.template_mensagem,
        status: c.status,
        total_destinatarios: c.total_destinatarios || 0,
        enviados: c.enviados || 0,
        erros: c.erros || 0,
        created_at: c.created_at,
        bar_id: c.bar_id
      });
    });

    // 2. Buscar campanhas CRM
    const { data: crmCampanhas } = await supabase
      .from('crm_campanhas')
      .select('*')
      .eq('bar_id', barId)
      .order('criado_em', { ascending: false })
      .limit(limit);

    (crmCampanhas || []).forEach(c => {
      campanhas.push({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo || 'whatsapp',
        origem: 'crm',
        template_mensagem: c.template_mensagem,
        status: c.status,
        total_destinatarios: c.enviados || 0, // CRM não tem total_destinatarios separado
        enviados: c.enviados || 0,
        erros: 0,
        created_at: c.criado_em,
        bar_id: c.bar_id,
        segmento_alvo: c.segmento_alvo
      });
    });

    // Ordenar por data decrescente
    campanhas.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Buscar análise resumida para cada campanha
    const campanhasComAnalise = await Promise.all(
      campanhas.slice(0, limit).map(async (campanha) => {
        const analise = await calcularAnaliseResumida(campanha, barId);
        return { ...campanha, analise };
      })
    );

    return NextResponse.json({
      success: true,
      campanhas: campanhasComAnalise,
      total: campanhas.length
    });

  } catch (error) {
    console.error('Erro ao listar campanhas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

async function calcularAnaliseResumida(campanha: CampanhaUnificada, barId: number) {
  try {
    // Definir período de busca (data da campanha até hoje)
    // IMPORTANTE: Usar timestamp completo para verificar conversões reais
    const timestampDisparo = campanha.created_at; // Timestamp completo do disparo
    const dataInicio = campanha.created_at.split('T')[0];
    const dataFim = new Date().toISOString().split('T')[0];

    // Buscar telefones dos destinatários
    let telefones: string[] = [];

    if (campanha.origem === 'umbler') {
      const { data: destinatarios } = await supabase
        .from('umbler_campanha_destinatarios')
        .select('telefone')
        .eq('campanha_id', campanha.id);
      
      telefones = (destinatarios || []).map(d => d.telefone.replace(/\D/g, '').slice(-11));
    } else {
      // Para CRM, buscar do segmento
      const { data: clientes } = await supabase
        .from('crm_segmentacao')
        .select('cliente_telefone_normalizado')
        .eq('segmento', campanha.segmento_alvo)
        .eq('bar_id', barId);
      
      telefones = (clientes || []).map(c => c.cliente_telefone_normalizado?.replace(/\D/g, '').slice(-11)).filter(Boolean);
    }

    if (telefones.length === 0) {
      return {
        total_destinatarios: campanha.enviados || 0,
        enviados: campanha.enviados || 0,
        erros: campanha.erros || 0,
        taxa_envio: 100,
        lidos: 0,
        taxa_leitura: 0,
        fizeram_reserva: 0,
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

    // Buscar reservas do Getin
    // IMPORTANTE: Só conta reservas criadas APÓS o disparo da campanha
    const { data: reservas } = await supabase
      .from('getin_reservas')
      .select('customer_phone, status, reservation_date, created_at')
      .eq('bar_id', barId)
      .gte('reservation_date', dataInicio)
      .lte('reservation_date', dataFim)
      .gte('created_at', timestampDisparo) // ← Só reservas criadas após disparo
      .not('customer_phone', 'is', null);

    // Cruzar telefones com reservas
    const reservasPorTelefone = new Map<string, { status: string }>();
    (reservas || []).forEach(r => {
      if (!r.customer_phone) return;
      const normalized = r.customer_phone.replace(/\D/g, '').slice(-11);
      if (telefones.includes(normalized)) {
        reservasPorTelefone.set(normalized, { status: r.status || 'unknown' });
      }
    });

    // Buscar visitas na tabela visitas
    const { data: visitas } = await supabase
      .from('visitas')
      .select('cliente_fone, valor_pagamentos')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicio)
      .lte('data_visita', dataFim)
      .not('cliente_fone', 'is', null)
      .gt('pessoas', 0);

    // Cruzar telefones com visitas
    const visitasPorTelefone = new Map<string, number>();
    (visitas || []).forEach(v => {
      if (!v.cliente_fone) return;
      const normalized = v.cliente_fone.replace(/\D/g, '').slice(-11);
      if (telefones.includes(normalized)) {
        const valorAtual = visitasPorTelefone.get(normalized) || 0;
        visitasPorTelefone.set(normalized, valorAtual + (v.valor_pagamentos || 0));
      }
    });

    // Calcular métricas
    const fizeramReserva = reservasPorTelefone.size;
    const foramAoBar = visitasPorTelefone.size;
    const valorTotalGasto = Array.from(visitasPorTelefone.values()).reduce((sum, v) => sum + v, 0);
    
    // Status das reservas
    let reservasSeated = 0;
    let reservasNoShow = 0;
    let reservasConfirmadas = 0;
    let reservasCanceladas = 0;

    reservasPorTelefone.forEach((reserva) => {
      switch (reserva.status) {
        case 'seated': reservasSeated++; break;
        case 'no-show': reservasNoShow++; break;
        case 'confirmed': reservasConfirmadas++; break;
        case 'canceled-user':
        case 'canceled-agent': reservasCanceladas++; break;
      }
    });

    const enviados = campanha.enviados || telefones.length;

    return {
      total_destinatarios: telefones.length,
      enviados,
      erros: campanha.erros || 0,
      taxa_envio: telefones.length > 0 ? (enviados / telefones.length) * 100 : 0,
      lidos: 0, // Não temos essa info ainda
      taxa_leitura: 0,
      fizeram_reserva: fizeramReserva,
      taxa_conversao_reserva: enviados > 0 ? (fizeramReserva / enviados) * 100 : 0,
      reservas_seated: reservasSeated,
      reservas_no_show: reservasNoShow,
      reservas_confirmadas: reservasConfirmadas,
      reservas_canceladas: reservasCanceladas,
      foram_ao_bar: foramAoBar,
      taxa_comparecimento: enviados > 0 ? (foramAoBar / enviados) * 100 : 0,
      valor_total_gasto: valorTotalGasto,
      ticket_medio: foramAoBar > 0 ? valorTotalGasto / foramAoBar : 0
    };
  } catch (error) {
    console.error('Erro ao calcular análise resumida:', error);
    return null;
  }
}

async function getAnaliseDetalhada(
  campanhaId: string, 
  origem: 'umbler' | 'crm', 
  barId: number
): Promise<NextResponse> {
  try {
    let campanha: CampanhaUnificada | null = null;
    let telefones: { telefone: string; nome: string | null; status: string }[] = [];

    if (origem === 'umbler') {
      const { data } = await supabase
        .from('umbler_campanhas')
        .select('*')
        .eq('id', campanhaId)
        .single();

      if (data) {
        campanha = {
          id: data.id,
          nome: data.nome,
          tipo: 'whatsapp',
          origem: 'umbler',
          template_mensagem: data.template_mensagem,
          status: data.status,
          total_destinatarios: data.total_destinatarios || 0,
          enviados: data.enviados || 0,
          erros: data.erros || 0,
          created_at: data.created_at,
          bar_id: data.bar_id
        };

        const { data: dest } = await supabase
          .from('umbler_campanha_destinatarios')
          .select('telefone, nome, status')
          .eq('campanha_id', campanhaId);

        telefones = (dest || []).map(d => ({
          telefone: d.telefone,
          nome: d.nome,
          status: d.status || 'enviado'
        }));
      }
    } else {
      const { data } = await supabase
        .from('crm_campanhas')
        .select('*')
        .eq('id', campanhaId)
        .single();

      if (data) {
        campanha = {
          id: data.id,
          nome: data.nome,
          tipo: data.tipo || 'whatsapp',
          origem: 'crm',
          template_mensagem: data.template_mensagem,
          status: data.status,
          total_destinatarios: data.enviados || 0,
          enviados: data.enviados || 0,
          erros: 0,
          created_at: data.criado_em,
          bar_id: data.bar_id,
          segmento_alvo: data.segmento_alvo
        };

        // Buscar clientes do segmento
        const { data: clientes } = await supabase
          .from('crm_segmentacao')
          .select('cliente_telefone_normalizado, cliente_nome')
          .eq('segmento', data.segmento_alvo)
          .eq('bar_id', barId);

        telefones = (clientes || []).map(c => ({
          telefone: c.cliente_telefone_normalizado || '',
          nome: c.cliente_nome,
          status: 'enviado'
        })).filter(t => t.telefone);
      }
    }

    if (!campanha) {
      return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 });
    }

    // Definir período
    // IMPORTANTE: Usar timestamp completo para verificar conversões reais
    const timestampDisparo = campanha.created_at; // Timestamp completo do disparo
    const dataInicio = campanha.created_at.split('T')[0];
    const dataFim = new Date().toISOString().split('T')[0];

    // Normalizar telefones
    const telefonesNormalizados = new Map<string, string>();
    telefones.forEach(t => {
      const normalized = t.telefone.replace(/\D/g, '').slice(-11);
      telefonesNormalizados.set(t.telefone, normalized);
    });

    const telefonesParaBusca = Array.from(telefonesNormalizados.values());

    // Buscar reservas
    // IMPORTANTE: Só conta reservas criadas APÓS o disparo da campanha
    const { data: reservas } = await supabase
      .from('getin_reservas')
      .select('customer_phone, status, reservation_date, created_at')
      .eq('bar_id', barId)
      .gte('reservation_date', dataInicio)
      .lte('reservation_date', dataFim)
      .gte('created_at', timestampDisparo) // ← Só reservas criadas após disparo
      .not('customer_phone', 'is', null);

    const reservasPorTelefone = new Map<string, { status: string; data: string }>();
    (reservas || []).forEach(r => {
      if (!r.customer_phone) return;
      const normalized = r.customer_phone.replace(/\D/g, '').slice(-11);
      if (telefonesParaBusca.includes(normalized)) {
        const existing = reservasPorTelefone.get(normalized);
        if (!existing || (r.reservation_date && r.reservation_date > existing.data)) {
          reservasPorTelefone.set(normalized, {
            status: r.status || 'unknown',
            data: r.reservation_date || ''
          });
        }
      }
    });

    // Buscar visitas
    const { data: visitas } = await supabase
      .from('visitas')
      .select('cliente_fone, data_visita, valor_pagamentos')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicio)
      .lte('data_visita', dataFim)
      .not('cliente_fone', 'is', null)
      .gt('pessoas', 0);

    const visitasPorTelefone = new Map<string, { data: string; valor: number }>();
    (visitas || []).forEach(v => {
      if (!v.cliente_fone) return;
      const normalized = v.cliente_fone.replace(/\D/g, '').slice(-11);
      if (telefonesParaBusca.includes(normalized)) {
        const existing = visitasPorTelefone.get(normalized);
        if (!existing) {
          visitasPorTelefone.set(normalized, {
            data: v.data_visita || '',
            valor: v.valor_pagamentos || 0
          });
        } else {
          existing.valor += v.valor_pagamentos || 0;
        }
      }
    });

    // Montar lista de destinatários
    const destinatarios: DestinatarioComCruzamento[] = telefones.map(t => {
      const normalized = telefonesNormalizados.get(t.telefone) || '';
      const reserva = reservasPorTelefone.get(normalized);
      const visita = visitasPorTelefone.get(normalized);

      return {
        telefone: t.telefone,
        nome: t.nome,
        status_envio: t.status,
        leu_mensagem: false,
        fez_reserva: !!reserva,
        reserva_status: reserva?.status || null,
        reserva_data: reserva?.data || null,
        compareceu: reserva?.status === 'seated',
        foi_ao_bar: !!visita,
        data_visita: visita?.data || null,
        valor_gasto: visita?.valor || null
      };
    });

    // Calcular métricas
    const total = destinatarios.length;
    const enviados = destinatarios.filter(d => d.status_envio === 'enviado').length || total;
    const erros = destinatarios.filter(d => d.status_envio === 'erro').length;
    const fizeramReserva = destinatarios.filter(d => d.fez_reserva).length;
    const foramAoBar = destinatarios.filter(d => d.foi_ao_bar).length;
    const valorTotalGasto = destinatarios.reduce((sum, d) => sum + (d.valor_gasto || 0), 0);

    const reservasSeated = destinatarios.filter(d => d.reserva_status === 'seated').length;
    const reservasNoShow = destinatarios.filter(d => d.reserva_status === 'no-show').length;
    const reservasConfirmadas = destinatarios.filter(d => d.reserva_status === 'confirmed').length;
    const reservasCanceladas = destinatarios.filter(d => 
      d.reserva_status === 'canceled-user' || d.reserva_status === 'canceled-agent'
    ).length;

    const analise: AnaliseCampanha = {
      campanha,
      metricas: {
        total_destinatarios: total,
        enviados,
        erros,
        taxa_envio: total > 0 ? (enviados / total) * 100 : 0,
        lidos: 0,
        taxa_leitura: 0,
        fizeram_reserva: fizeramReserva,
        taxa_conversao_reserva: enviados > 0 ? (fizeramReserva / enviados) * 100 : 0,
        reservas_seated: reservasSeated,
        reservas_no_show: reservasNoShow,
        reservas_confirmadas: reservasConfirmadas,
        reservas_canceladas: reservasCanceladas,
        foram_ao_bar: foramAoBar,
        taxa_comparecimento: enviados > 0 ? (foramAoBar / enviados) * 100 : 0,
        valor_total_gasto: valorTotalGasto,
        ticket_medio: foramAoBar > 0 ? valorTotalGasto / foramAoBar : 0
      },
      destinatarios
    };

    return NextResponse.json({ success: true, ...analise });
  } catch (error) {
    console.error('Erro ao buscar análise detalhada:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
