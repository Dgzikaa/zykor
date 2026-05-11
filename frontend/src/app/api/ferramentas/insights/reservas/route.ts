import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/reservas?bar_id=N&data_inicio=...&data_fim=...
 *
 * Análise de reservas Getin: lead time, taxa comparecimento, dia da semana,
 * horários, segmento (vip vs casual via reservantes_perfil).
 * Fonte: bronze.bronze_getin_reservations + silver.reservantes_perfil.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const dataInicio = sp.get('data_inicio');
    const dataFim = sp.get('data_fim');

    if (!barId || !dataInicio || !dataFim) {
      return NextResponse.json({ error: 'bar_id, data_inicio e data_fim obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabase
      .schema('bronze' as never)
      .from('bronze_getin_reservations')
      .select('reservation_date, reservation_time, people, status, no_show, synced_at, sector_name')
      .eq('bar_id', barId)
      .gte('reservation_date', dataInicio)
      .lte('reservation_date', dataFim);

    if (error) {
      console.error('[insights/reservas]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type R = {
      reservation_date: string;
      reservation_time: string | null;
      people: number;
      status: string | null;
      no_show: boolean | null;
      synced_at: string | null;
      sector_name: string | null;
    };
    const rows = (data ?? []) as R[];

    let total = 0;
    let presentes = 0;
    let noShow = 0;
    let canceladas = 0;
    let totalPessoas = 0;
    let leadTimeSomaDias = 0;
    let leadTimeQtd = 0;

    const leadTimeBuckets: Record<string, number> = {
      'Mesmo dia': 0,
      '1 dia': 0,
      '2-3 dias': 0,
      '4-7 dias': 0,
      '8-14 dias': 0,
      '15+ dias': 0,
    };
    const porDow = new Map<number, number>();
    const porHora = new Map<number, number>();
    const porStatus = new Map<string, number>();
    const porSetor = new Map<string, number>();

    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    for (const r of rows) {
      total += 1;
      totalPessoas += Number(r.people) || 0;

      const status = (r.status || '').toLowerCase();
      if (r.no_show) noShow += 1;
      if (status === 'present' || status === 'confirmed_present') presentes += 1;
      if (status === 'canceled' || status === 'cancelled') canceladas += 1;

      porStatus.set(status || 'desconhecido', (porStatus.get(status || 'desconhecido') ?? 0) + 1);

      // Lead time = reservation_date - synced_at (data em que foi criada)
      if (r.synced_at) {
        const created = new Date(r.synced_at);
        const reserved = new Date(r.reservation_date + 'T12:00:00');
        const diffMs = reserved.getTime() - created.getTime();
        const diffDias = Math.max(0, Math.floor(diffMs / 86400000));
        leadTimeSomaDias += diffDias;
        leadTimeQtd += 1;
        if (diffDias === 0) leadTimeBuckets['Mesmo dia'] += 1;
        else if (diffDias === 1) leadTimeBuckets['1 dia'] += 1;
        else if (diffDias <= 3) leadTimeBuckets['2-3 dias'] += 1;
        else if (diffDias <= 7) leadTimeBuckets['4-7 dias'] += 1;
        else if (diffDias <= 14) leadTimeBuckets['8-14 dias'] += 1;
        else leadTimeBuckets['15+ dias'] += 1;
      }

      const dow = new Date(r.reservation_date + 'T12:00:00').getDay();
      porDow.set(dow, (porDow.get(dow) ?? 0) + 1);

      if (r.reservation_time) {
        const h = Number(r.reservation_time.split(':')[0]);
        if (!Number.isNaN(h)) porHora.set(h, (porHora.get(h) ?? 0) + 1);
      }

      const setor = (r.sector_name || 'Sem setor').trim();
      porSetor.set(setor, (porSetor.get(setor) ?? 0) + 1);
    }

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      resumo: {
        total_reservas: total,
        presentes,
        no_show: noShow,
        canceladas,
        total_pessoas: totalPessoas,
        taxa_no_show_pct: total > 0 ? (noShow / total) * 100 : 0,
        taxa_cancelamento_pct: total > 0 ? (canceladas / total) * 100 : 0,
        lead_time_medio_dias: leadTimeQtd > 0 ? leadTimeSomaDias / leadTimeQtd : 0,
      },
      lead_time_distribuicao: Object.entries(leadTimeBuckets).map(([bucket, count]) => ({
        bucket,
        count,
        pct: leadTimeQtd > 0 ? (count / leadTimeQtd) * 100 : 0,
      })),
      por_dia_semana: Array.from(porDow.entries())
        .map(([dow, qtd]) => ({ dia_semana: nomesDias[dow], dow, qtd }))
        .sort((a, b) => a.dow - b.dow),
      por_hora: Array.from(porHora.entries())
        .map(([hora, qtd]) => ({ hora, qtd }))
        .sort((a, b) => a.hora - b.hora),
      por_status: Array.from(porStatus.entries()).map(([status, qtd]) => ({ status, qtd })),
      por_setor: Array.from(porSetor.entries())
        .map(([setor, qtd]) => ({ setor, qtd }))
        .sort((a, b) => b.qtd - a.qtd),
    });
  } catch (err) {
    console.error('[insights/reservas] exceção', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
