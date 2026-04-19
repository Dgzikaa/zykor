import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface DestinatarioComCruzamento {
  telefone: string;
  nome: string | null;
  status_envio: string;
  enviado_em: string | null;
  // Cruzamento
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
  campanha: {
    id: string;
    nome: string;
    template_mensagem: string;
    status: string;
    created_at: string;
    iniciado_em: string | null;
    finalizado_em: string | null;
  };
  metricas: {
    total_destinatarios: number;
    enviados: number;
    erros: number;
    taxa_envio: number;
    // Leitura (se disponível)
    lidos: number;
    taxa_leitura: number;
    // Reservas
    fizeram_reserva: number;
    taxa_conversao_reserva: number;
    // Status das reservas
    reservas_seated: number;
    reservas_no_show: number;
    reservas_confirmadas: number;
    reservas_canceladas: number;
    // Comparecimento (contahub)
    foram_ao_bar: number;
    taxa_comparecimento: number;
    valor_total_gasto: number;
    ticket_medio: number;
  };
  destinatarios: DestinatarioComCruzamento[];
}

/**
 * GET /api/umbler/campanhas/[id]/analise
 * Retorna análise completa de uma campanha cruzando:
 * - Destinatários e status de envio
 * - Reservas no Getin
 * - Comparecimento no ContaHub
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campanhaId } = await params;
    const { searchParams } = new URL(request.url);
    const dataInicio = searchParams.get('data_inicio'); // Para filtrar reservas/visitas
    const dataFim = searchParams.get('data_fim');

    // 1. Buscar dados da campanha
    const { data: campanha, error: campanhaError } = await supabase
      .from('umbler_campanhas')
      .select('*')
      .eq('id', campanhaId)
      .single();

    if (campanhaError || !campanha) {
      return NextResponse.json(
        { error: 'Campanha não encontrada' },
        { status: 404 }
      );
    }

    const barId = campanha.bar_id;

    // 2. Buscar destinatários da campanha
    const { data: destinatarios, error: destError } = await supabase
      .from('umbler_campanha_destinatarios')
      .select('*')
      .eq('campanha_id', campanhaId);

    if (destError) {
      console.error('Erro ao buscar destinatários:', destError);
      return NextResponse.json({ error: destError.message }, { status: 500 });
    }

    // 3. Normalizar telefones dos destinatários para cruzamento (últimos 11 dígitos)
    const telefonesNormalizados = new Map<string, string>();
    (destinatarios || []).forEach(d => {
      const digits = d.telefone.replace(/\D/g, '');
      const normalized = digits.slice(-11);
      telefonesNormalizados.set(d.telefone, normalized);
    });

    const telefonesParaBusca = Array.from(telefonesNormalizados.values());

    // 4. Buscar mensagens enviadas para verificar status de leitura
    const { data: mensagens } = await supabase
      .from('umbler_mensagens')
      .select('contato_telefone, status, campanha_id')
      .eq('campanha_id', campanhaId)
      .eq('bar_id', barId);

    // Mapear status de leitura por telefone
    const statusLeitura = new Map<string, boolean>();
    (mensagens || []).forEach(m => {
      const normalized = m.contato_telefone.replace(/\D/g, '').slice(-11);
      // Consideramos "lido" se o status for 'lida', 'read', 'delivered', 'entregue'
      const lido = ['lida', 'read', 'delivered', 'entregue'].includes(m.status?.toLowerCase() || '');
      if (lido) {
        statusLeitura.set(normalized, true);
      }
    });

    // 5. Buscar reservas do Getin para esses telefones
    // IMPORTANTE: Usar horário exato do disparo para verificar conversões reais
    // Uma reserva só conta como conversão se foi CRIADA após o disparo da campanha
    const timestampDisparo = campanha.iniciado_em || campanha.created_at;
    const dataInicioReserva = dataInicio || campanha.created_at?.split('T')[0];
    const dataFimReserva = dataFim || new Date().toISOString().split('T')[0];

    const { data: reservas } = await supabase
      .from('getin_reservas')
      .select('customer_phone, status, reservation_date, no_show, created_at')
      .eq('bar_id', barId)
      .gte('reservation_date', dataInicioReserva)
      .lte('reservation_date', dataFimReserva)
      .gte('created_at', timestampDisparo) // ← NOVA LÓGICA: só reservas criadas APÓS o disparo
      .not('customer_phone', 'is', null);

    // Mapear reservas por telefone normalizado
    const reservasPorTelefone = new Map<string, {
      status: string;
      data: string;
      compareceu: boolean;
    }>();
    
    (reservas || []).forEach(r => {
      if (!r.customer_phone) return;
      const normalized = r.customer_phone.replace(/\D/g, '').slice(-11);
      if (telefonesParaBusca.includes(normalized)) {
        // Guardar a reserva mais recente
        const existing = reservasPorTelefone.get(normalized);
        if (!existing || (r.reservation_date && r.reservation_date > (existing.data || ''))) {
          reservasPorTelefone.set(normalized, {
            status: r.status || 'unknown',
            data: r.reservation_date || '',
            compareceu: r.status === 'seated'
          });
        }
      }
    });

    // 6. Buscar visitas (pessoas que foram ao bar)
    const { data: visitas } = await supabase
      .schema('silver')
      .from('cliente_visitas')
      .select('cliente_fone, data_visita, valor_pagamentos, pessoas')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicioReserva)
      .lte('data_visita', dataFimReserva)
      .eq('tem_telefone', true)
      .gt('pessoas', 0);

    // Mapear visitas por telefone normalizado
    const visitasPorTelefone = new Map<string, {
      data: string;
      valor: number;
    }>();

    (visitas || []).forEach(v => {
      if (!v.cliente_fone) return;
      const normalized = v.cliente_fone.replace(/\D/g, '').slice(-11);
      if (telefonesParaBusca.includes(normalized)) {
        const existing = visitasPorTelefone.get(normalized);
        const valorAtual = v.valor_pagamentos || 0;
        if (!existing) {
          visitasPorTelefone.set(normalized, {
            data: v.data_visita || '',
            valor: valorAtual
          });
        } else {
          // Somar valores se já existe
          existing.valor += valorAtual;
          if (v.data_visita && v.data_visita > (existing.data || '')) {
            existing.data = v.data_visita;
          }
        }
      }
    });

    // 7. Montar lista de destinatários com cruzamento
    const destinatariosComCruzamento: DestinatarioComCruzamento[] = (destinatarios || []).map(d => {
      const normalized = telefonesNormalizados.get(d.telefone) || '';
      const reserva = reservasPorTelefone.get(normalized);
      const visita = visitasPorTelefone.get(normalized);

      return {
        telefone: d.telefone,
        nome: d.nome,
        status_envio: d.status || 'pendente',
        enviado_em: d.enviado_em,
        leu_mensagem: statusLeitura.get(normalized) || false,
        fez_reserva: !!reserva,
        reserva_status: reserva?.status || null,
        reserva_data: reserva?.data || null,
        compareceu: reserva?.compareceu || false,
        foi_ao_bar: !!visita,
        data_visita: visita?.data || null,
        valor_gasto: visita?.valor || null
      };
    });

    // 8. Calcular métricas
    const total = destinatariosComCruzamento.length;
    const enviados = destinatariosComCruzamento.filter(d => d.status_envio === 'enviado').length;
    const erros = destinatariosComCruzamento.filter(d => d.status_envio === 'erro').length;
    const lidos = destinatariosComCruzamento.filter(d => d.leu_mensagem).length;
    const fizeramReserva = destinatariosComCruzamento.filter(d => d.fez_reserva).length;
    const foramAoBar = destinatariosComCruzamento.filter(d => d.foi_ao_bar).length;
    const valorTotalGasto = destinatariosComCruzamento.reduce((sum, d) => sum + (d.valor_gasto || 0), 0);

    // Status das reservas
    const reservasSeated = destinatariosComCruzamento.filter(d => d.reserva_status === 'seated').length;
    const reservasNoShow = destinatariosComCruzamento.filter(d => d.reserva_status === 'no-show').length;
    const reservasConfirmadas = destinatariosComCruzamento.filter(d => d.reserva_status === 'confirmed').length;
    const reservasCanceladas = destinatariosComCruzamento.filter(d => 
      d.reserva_status === 'canceled-user' || d.reserva_status === 'canceled-agent'
    ).length;

    const analise: AnaliseCampanha = {
      campanha: {
        id: campanha.id,
        nome: campanha.nome,
        template_mensagem: campanha.template_mensagem,
        status: campanha.status,
        created_at: campanha.created_at,
        iniciado_em: campanha.iniciado_em,
        finalizado_em: campanha.finalizado_em
      },
      metricas: {
        total_destinatarios: total,
        enviados,
        erros,
        taxa_envio: total > 0 ? (enviados / total) * 100 : 0,
        lidos,
        taxa_leitura: enviados > 0 ? (lidos / enviados) * 100 : 0,
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
      destinatarios: destinatariosComCruzamento
    };

    return NextResponse.json({
      success: true,
      ...analise
    });

  } catch (error) {
    console.error('Erro na análise de campanha:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
