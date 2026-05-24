import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET/PATCH em meta.cmo_manual.
 *
 * Armazena os 2 inputs manuais que compoem o CMO no Desempenho:
 *   - equipe_fixa_mensal: folha mensal da equipe fixa (R$)
 *   - pro_labore_mensal: pro labore dos socios (R$). Visao semanal rateia
 *     por (dias_do_mes × 7).
 *
 * Os outros 2 itens do CMO (Freelas, Alimentacao) sao automaticos e nao passam
 * por essa API.
 *
 * GET ?bar_id=3&ano=2026&mes=5  -> retorna { equipe_fixa_mensal, pro_labore_mensal }
 * GET ?bar_id=3&ano=2026        -> retorna array com os 12 meses
 * PATCH body { bar_id, ano, mes, equipe_fixa_mensal?, pro_labore_mensal? }
 */

const PRO_LABORE_DEFAULT = 64000;

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano'));
    const mesStr = sp.get('mes');

    if (!barId || !ano) {
      return NextResponse.json(
        { error: 'bar_id e ano sao obrigatorios' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (mesStr) {
      const mes = Number(mesStr);
      const { data, error } = await supabase
        .schema('meta' as never)
        .from('cmo_manual')
        .select('equipe_fixa_mensal, pro_labore_mensal, updated_at')
        .eq('bar_id', barId)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();

      if (error) {
        console.error('[cmo-manual GET] erro:', error);
        return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
      }

      return NextResponse.json({
        equipe_fixa_mensal: parseFloat(String(data?.equipe_fixa_mensal ?? 0)),
        pro_labore_mensal: parseFloat(String(data?.pro_labore_mensal ?? PRO_LABORE_DEFAULT)),
        updated_at: data?.updated_at ?? null,
        existe: !!data,
      });
    }

    // ano inteiro
    const { data, error } = await supabase
      .schema('meta' as never)
      .from('cmo_manual')
      .select('mes, equipe_fixa_mensal, pro_labore_mensal')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .order('mes');

    if (error) {
      console.error('[cmo-manual GET ano] erro:', error);
      return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
    }

    const porMes: Record<number, { equipe_fixa_mensal: number; pro_labore_mensal: number }> = {};
    for (const row of (data as any[]) || []) {
      porMes[row.mes] = {
        equipe_fixa_mensal: parseFloat(String(row.equipe_fixa_mensal || 0)),
        pro_labore_mensal: parseFloat(String(row.pro_labore_mensal || 0)),
      };
    }

    return NextResponse.json({ ano, bar_id: barId, meses: porMes });
  } catch (err) {
    console.error('[cmo-manual GET] excecao:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const ano = Number(body?.ano);
    const mes = Number(body?.mes);
    const equipeFixa = body?.equipe_fixa_mensal != null ? Number(body.equipe_fixa_mensal) : undefined;
    const proLabore = body?.pro_labore_mensal != null ? Number(body.pro_labore_mensal) : undefined;

    if (!barId || !ano || !mes) {
      return NextResponse.json(
        { error: 'bar_id, ano e mes sao obrigatorios' },
        { status: 400 }
      );
    }
    if (equipeFixa === undefined && proLabore === undefined) {
      return NextResponse.json(
        { error: 'informe equipe_fixa_mensal ou pro_labore_mensal' },
        { status: 400 }
      );
    }
    if (equipeFixa !== undefined && !Number.isFinite(equipeFixa)) {
      return NextResponse.json({ error: 'equipe_fixa_mensal invalido' }, { status: 400 });
    }
    if (proLabore !== undefined && !Number.isFinite(proLabore)) {
      return NextResponse.json({ error: 'pro_labore_mensal invalido' }, { status: 400 });
    }

    const supabase = createServerClient();

    // upsert: cria a row se nao existe, atualiza so o campo enviado
    const payload: Record<string, unknown> = {
      bar_id: barId,
      ano,
      mes,
      updated_at: new Date().toISOString(),
    };
    if (equipeFixa !== undefined) payload.equipe_fixa_mensal = equipeFixa;
    if (proLabore !== undefined) payload.pro_labore_mensal = proLabore;

    const { data, error } = await supabase
      .schema('meta' as never)
      .from('cmo_manual')
      .upsert(payload, { onConflict: 'bar_id,ano,mes' })
      .select()
      .single();

    if (error) {
      console.error('[cmo-manual PATCH] erro:', error);
      return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[cmo-manual PATCH] excecao:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
