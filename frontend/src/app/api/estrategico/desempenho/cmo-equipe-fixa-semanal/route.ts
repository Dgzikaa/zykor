import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET/PATCH em meta.cmo_equipe_fixa_semanal.
 *
 * Valor SEMANAL de Equipe Fixa CMO. Substituiu o rateio dia-a-dia do
 * cmo_manual.equipe_fixa_mensal — agora o socio insere semana a semana.
 *
 * GET ?bar_id=3&ano=2026  -> retorna { por_semana: { 1: 8000, 2: 7500, ... } }
 * PATCH body { bar_id, ano, numero_semana, valor, atualizado_por? }
 */

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano'));

    if (!barId || !ano) {
      return NextResponse.json({ error: 'bar_id e ano obrigatorios' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .schema('meta' as never)
      .from('cmo_equipe_fixa_semanal')
      .select('numero_semana, valor, atualizado_por, updated_at')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .order('numero_semana');

    if (error) {
      console.error('[cmo-equipe-fixa-semanal GET]', error);
      return NextResponse.json({ error: 'Erro ao buscar' }, { status: 500 });
    }

    const porSemana: Record<number, number> = {};
    for (const r of (data as any[]) || []) {
      porSemana[r.numero_semana] = parseFloat(String(r.valor || 0));
    }

    return NextResponse.json({ bar_id: barId, ano, por_semana: porSemana, rows: data || [] });
  } catch (err) {
    console.error('[cmo-equipe-fixa-semanal GET] excecao:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const ano = Number(body?.ano);
    const numeroSemana = Number(body?.numero_semana);
    const valor = Number(body?.valor);
    const atualizadoPor = body?.atualizado_por ? String(body.atualizado_por).slice(0, 120) : null;

    if (!barId || !ano || !numeroSemana) {
      return NextResponse.json(
        { error: 'bar_id, ano e numero_semana obrigatorios' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(valor)) {
      return NextResponse.json({ error: 'valor invalido' }, { status: 400 });
    }
    if (numeroSemana < 1 || numeroSemana > 53) {
      return NextResponse.json({ error: 'numero_semana fora do range 1..53' }, { status: 400 });
    }

    const supabase = createServerClient();

    const payload: Record<string, unknown> = {
      bar_id: barId,
      ano,
      numero_semana: numeroSemana,
      valor,
      updated_at: new Date().toISOString(),
    };
    if (atualizadoPor) payload.atualizado_por = atualizadoPor;

    const { data, error } = await supabase
      .schema('meta' as never)
      .from('cmo_equipe_fixa_semanal')
      .upsert(payload, { onConflict: 'bar_id,ano,numero_semana' })
      .select()
      .single();

    if (error) {
      console.error('[cmo-equipe-fixa-semanal PATCH]', error);
      return NextResponse.json({ error: 'Erro ao salvar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[cmo-equipe-fixa-semanal PATCH] excecao:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
