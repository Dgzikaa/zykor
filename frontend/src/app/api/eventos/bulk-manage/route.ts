import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

interface DiaInput {
  data_evento: string;
  nome: string;
  m1_r: number;
}

const DIAS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaSemanaDeData = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return DIAS_PT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] || '';
};

/**
 * Gerência em massa dos dias de um mês no planejamento comercial (uma linha por dia,
 * respeitando o unique (data_evento, bar_id) do eventos_base):
 *   - `dias`    → upsert (cria dia novo ou atualiza label/M1 de dia existente)
 *   - `excluir` → DELETE definitivo do dia (o usuário escolheu excluir de vez)
 *
 * Depois materializa a projeção de custos e RODA o ETL gold.planejamento do mês na hora,
 * senão a mudança só apareceria no próximo cron diário (gold é lido pela tela).
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const supabase = createServiceRoleClient();

    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = (barIdHeader ? parseInt(barIdHeader, 10) : 0) || user.bar_id;
    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });

    // apiCall re-stringifica o body → aqui request.json() pode devolver STRING (double-encode).
    // Re-parseia nesse caso, senão body.campo vira undefined. Ver memória apicall_double_encode_body.
    let body: any;
    const rawBody = await request.json();
    body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const mes = parseInt(String(body.mes));
    const ano = parseInt(String(body.ano));
    const diasRaw: DiaInput[] = Array.isArray(body.dias) ? body.dias : [];
    const excluirRaw: string[] = Array.isArray(body.excluir) ? body.excluir : [];

    if (!mes || mes < 1 || mes > 12 || !ano) {
      return NextResponse.json({ error: 'mes/ano inválidos' }, { status: 400 });
    }

    const monthStart = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const monthEnd = mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

    // Só aceita datas dentro do mês (defensivo — a tela sempre manda do mês certo).
    const dentroDoMes = (iso: string) => !!iso && iso >= monthStart && iso < monthEnd;
    const dias = diasRaw
      .filter(d => dentroDoMes(d.data_evento))
      .map(d => ({ data_evento: d.data_evento, nome: (d.nome || '').trim() || 'A definir', m1_r: Number(d.m1_r) || 0 }));
    const excluir = excluirRaw.filter(dentroDoMes);

    // Estado atual do mês (chave = data_evento) para decidir insert vs update.
    const { data: existentesData, error: exErr } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, m1_r, versao_calculo')
      .eq('bar_id', barId)
      .gte('data_evento', monthStart)
      .lt('data_evento', monthEnd);
    if (exErr) {
      return NextResponse.json({ error: 'Erro ao ler eventos do mês', details: exErr.message }, { status: 500 });
    }
    const existentes = new Map<string, { id: number; nome: string; m1_r: number | null; versao_calculo: number | null }>(
      (existentesData || []).map((e: any) => [e.data_evento, e])
    );

    let inseridos = 0;
    let atualizados = 0;
    let excluidos = 0;

    // 1) EXCLUIR de vez (opção escolhida pelo usuário). Um item em `excluir` que também
    // apareça em `dias` prevalece o upsert (o usuário editou, não removeu).
    const datasUpsert = new Set(dias.map(d => d.data_evento));
    const excluirEfetivo = excluir.filter(d => !datasUpsert.has(d) && existentes.has(d));
    if (excluirEfetivo.length > 0) {
      const { error: delErr, count } = await supabase
        .from('eventos_base')
        .delete({ count: 'exact' })
        .eq('bar_id', barId)
        .in('data_evento', excluirEfetivo);
      if (delErr) {
        return NextResponse.json({ error: 'Erro ao excluir dias', details: delErr.message }, { status: 500 });
      }
      excluidos = count ?? excluirEfetivo.length;
    }

    // 2) INSERIR dias novos.
    const novos = dias.filter(d => !existentes.has(d.data_evento));
    if (novos.length > 0) {
      const rows = novos.map(d => ({
        bar_id: barId,
        data_evento: d.data_evento,
        nome: d.nome,
        dia_semana: diaSemanaDeData(d.data_evento),
        m1_r: d.m1_r,
        m1_manual: d.m1_r > 0,
        ativo: true,
        precisa_recalculo: true,
        versao_calculo: 1,
      }));
      const { error: insErr } = await supabase.from('eventos_base').insert(rows);
      if (insErr) {
        return NextResponse.json({ error: 'Erro ao inserir dias', details: insErr.message }, { status: 500 });
      }
      inseridos = novos.length;
    }

    // 3) ATUALIZAR dias existentes (label + M1). Só mexe no que mudou; preserva
    // versao_calculo=999 (edição manual) e o m1_manual quando o M1 muda de fato.
    for (const d of dias) {
      const atual = existentes.get(d.data_evento);
      if (!atual) continue;
      const m1Mudou = Number(atual.m1_r ?? NaN) !== d.m1_r;
      const nomeMudou = (atual.nome || '') !== d.nome;
      if (!m1Mudou && !nomeMudou) continue;

      const update: any = { nome: d.nome, m1_r: d.m1_r, ativo: true, atualizado_em: new Date().toISOString() };
      if (m1Mudou && d.m1_r > 0) update.m1_manual = true;
      if (atual.versao_calculo !== 999) {
        update.precisa_recalculo = true;
        update.versao_calculo = 1;
      }
      const { error: upErr } = await supabase
        .from('eventos_base')
        .update(update)
        .eq('id', atual.id)
        .eq('bar_id', barId);
      if (upErr) {
        return NextResponse.json({ error: 'Erro ao atualizar dia', details: upErr.message }, { status: 500 });
      }
      atualizados++;
    }

    // 4) Projeta custo artístico/produção dos dias novos (nascem em amarelo/⚠️ sem esperar o cron).
    if (novos.length > 0) {
      try {
        const datas = novos.map(d => d.data_evento).sort();
        await supabase.rpc('projetar_custos_pre_lancado', {
          p_bar_id: barId,
          p_data_inicio: datas[0],
          p_data_fim: datas[datas.length - 1],
        });
      } catch (projErr) {
        console.error('⚠️ Projeção de custos falhou (cron cobre):', projErr);
      }
    }

    // 5) Reflete no gold JÁ (a tela lê gold.planejamento; o cron só roda 1x/dia).
    try {
      const ultimoDia = mes === 12 ? `${ano}-12-31` : new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
      await supabase.rpc('etl_gold_planejamento_full', {
        p_bar_id: barId,
        p_data_inicio: monthStart,
        p_data_fim: ultimoDia,
      });
    } catch (etlErr) {
      console.error('⚠️ ETL gold.planejamento falhou (cron cobre):', etlErr);
    }

    return NextResponse.json({
      success: true,
      inseridos,
      atualizados,
      excluidos,
      message: `${inseridos} adicionados, ${atualizados} atualizados, ${excluidos} excluídos`,
    });
  } catch (error) {
    console.error('❌ Erro na API bulk-manage:', error);
    return NextResponse.json({
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
    }, { status: 500 });
  }
}
