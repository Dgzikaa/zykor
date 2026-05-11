import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/reservas?bar_id=N&data_inicio=...&data_fim=...
 *
 * Status reais do Getin: seated, confirmed, canceled-agent, canceled-user,
 * no-show, pending. Origem da reserva é extraída do raw_data.info (campo
 * livre que pode conter "Instagram", "Google", nome de empresa, etc) ou
 * do custom_fields (ex: Ocasião).
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
      .select('reservation_date, reservation_time, people, status, no_show, synced_at, info, custom_fields, raw_data')
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
      info: string | null;
      custom_fields: Array<{ title?: string; answer?: string }> | null;
      raw_data: any;
    };
    const rows = (data ?? []) as R[];

    let total = 0;
    let totalPessoas = 0;
    const porStatus = new Map<string, { qtd: number; pessoas: number }>();
    const porDow = new Map<number, { qtd: number; presentes: number }>();
    const porHora = new Map<number, number>();
    const porOrigem = new Map<string, number>();
    const porOcasiao = new Map<string, number>();

    let leadTimeSomaDias = 0;
    let leadTimeQtd = 0;
    const leadTimeBuckets: Record<string, number> = {
      'Mesmo dia': 0, '1 dia': 0, '2-3 dias': 0, '4-7 dias': 0, '8-14 dias': 0, '15+ dias': 0,
    };

    // Status do Getin → categoria simplificada
    const ehPresente = (s: string) => s === 'seated' || s === 'confirmed';
    const ehCancelada = (s: string) => s.startsWith('canceled');
    const ehNoShow = (s: string) => s === 'no-show';
    const ehPendente = (s: string) => s === 'pending';

    let presentes = 0, canceladas = 0, noShow = 0, pendentes = 0;

    for (const r of rows) {
      total += 1;
      totalPessoas += Number(r.people) || 0;

      const status = (r.status || '').toLowerCase();
      const curStatus = porStatus.get(status) ?? { qtd: 0, pessoas: 0 };
      curStatus.qtd += 1;
      curStatus.pessoas += Number(r.people) || 0;
      porStatus.set(status, curStatus);

      if (ehPresente(status)) presentes += 1;
      else if (ehCancelada(status)) canceladas += 1;
      else if (ehNoShow(status) || r.no_show === true) noShow += 1;
      else if (ehPendente(status)) pendentes += 1;

      const dow = new Date(r.reservation_date + 'T12:00:00').getDay();
      const curDow = porDow.get(dow) ?? { qtd: 0, presentes: 0 };
      curDow.qtd += 1;
      if (ehPresente(status)) curDow.presentes += 1;
      porDow.set(dow, curDow);

      if (r.reservation_time) {
        const h = Number(r.reservation_time.split(':')[0]);
        if (!Number.isNaN(h)) porHora.set(h, (porHora.get(h) ?? 0) + 1);
      }

      // Origem: campo `info` em raw_data (livre) — agrupar por palavras-chave
      const info = String(r.info || '').toLowerCase().trim();
      let origem = 'Direto (sem info)';
      if (info) {
        if (info.includes('instagram') || info.includes('insta')) origem = 'Instagram';
        else if (info.includes('google')) origem = 'Google';
        else if (info.includes('site')) origem = 'Site';
        else if (info.includes('whatsapp') || info.includes('whats')) origem = 'WhatsApp';
        else if (info.includes('indica')) origem = 'Indicação';
        else origem = info.length > 30 ? info.slice(0, 30) + '…' : info;
      }
      porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1);

      // Ocasião (custom_fields)
      const cfs = Array.isArray(r.custom_fields) ? r.custom_fields : [];
      const ocasiao = cfs.find(c => (c?.title || '').toLowerCase().includes('ocasi'))?.answer;
      if (ocasiao) {
        porOcasiao.set(ocasiao, (porOcasiao.get(ocasiao) ?? 0) + 1);
      }

      // Lead time
      if (r.synced_at) {
        const created = new Date(r.synced_at);
        const reserved = new Date(r.reservation_date + 'T12:00:00');
        const diffDias = Math.max(0, Math.floor((reserved.getTime() - created.getTime()) / 86400000));
        leadTimeSomaDias += diffDias;
        leadTimeQtd += 1;
        if (diffDias === 0) leadTimeBuckets['Mesmo dia'] += 1;
        else if (diffDias === 1) leadTimeBuckets['1 dia'] += 1;
        else if (diffDias <= 3) leadTimeBuckets['2-3 dias'] += 1;
        else if (diffDias <= 7) leadTimeBuckets['4-7 dias'] += 1;
        else if (diffDias <= 14) leadTimeBuckets['8-14 dias'] += 1;
        else leadTimeBuckets['15+ dias'] += 1;
      }
    }

    const nomesDias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    return NextResponse.json({
      success: true,
      periodo: { data_inicio: dataInicio, data_fim: dataFim },
      resumo: {
        total_reservas: total,
        presentes,
        canceladas,
        no_show: noShow,
        pendentes,
        total_pessoas: totalPessoas,
        pessoas_presentes: rows
          .filter(r => ehPresente((r.status || '').toLowerCase()))
          .reduce((s, r) => s + (Number(r.people) || 0), 0),
        taxa_comparecimento_pct: total > 0 ? (presentes / total) * 100 : 0,
        taxa_no_show_pct: total > 0 ? (noShow / total) * 100 : 0,
        taxa_cancelamento_pct: total > 0 ? (canceladas / total) * 100 : 0,
        lead_time_medio_dias: leadTimeQtd > 0 ? leadTimeSomaDias / leadTimeQtd : 0,
      },
      por_status: Array.from(porStatus.entries())
        .map(([status, v]) => ({ status, qtd: v.qtd, pessoas: v.pessoas }))
        .sort((a, b) => b.qtd - a.qtd),
      lead_time_distribuicao: Object.entries(leadTimeBuckets).map(([bucket, count]) => ({
        bucket, count, pct: leadTimeQtd > 0 ? (count / leadTimeQtd) * 100 : 0,
      })),
      por_dia_semana: Array.from(porDow.entries())
        .map(([dow, v]) => ({
          dia_semana: nomesDias[dow], dow,
          qtd: v.qtd, presentes: v.presentes,
          taxa_comparecimento: v.qtd > 0 ? (v.presentes / v.qtd) * 100 : 0,
        }))
        .sort((a, b) => a.dow - b.dow),
      por_hora: Array.from(porHora.entries())
        .map(([hora, qtd]) => ({ hora, qtd }))
        .sort((a, b) => a.hora - b.hora),
      por_origem: Array.from(porOrigem.entries())
        .map(([origem, qtd]) => ({ origem, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 15),
      por_ocasiao: Array.from(porOcasiao.entries())
        .map(([ocasiao, qtd]) => ({ ocasiao, qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 10),
    });
  } catch (err: any) {
    console.error('[insights/reservas] exceção', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
