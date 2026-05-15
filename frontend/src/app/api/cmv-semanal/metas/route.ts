import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Metas da Gestão CMV — visão tipo Desempenho.
 *
 * Reusa meta.metas_desempenho com periodo='cmv'. Métricas suportadas:
 *   - cmv_real                 (CMV R$ — derivado em runtime de cmv_percentual × fat_bruto)
 *   - cmv_percentual           (CMV Real %)
 *   - cmv_limpo_percentual     (CMV Limpo %)
 *   - cmv_teorico_percentual   (CMV Teórico %)
 *
 * Defaults aplicados quando meta ausente:
 *   teorico=29, limpo=33 (teorico+4), real_pct=26
 *
 * Operador padrão: '<=' (CMV menor é melhor).
 */

const DEFAULTS: Record<string, { valor: number; operador: '<=' | '>=' }> = {
  cmv_teorico_percentual: { valor: 29, operador: '<=' },
  cmv_limpo_percentual: { valor: 33, operador: '<=' },
  cmv_percentual: { valor: 26, operador: '<=' },
};

export async function GET(request: NextRequest) {
  try {
    const barId = Number(request.nextUrl.searchParams.get('bar_id'));
    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .select('metrica, valor_meta, operador')
      .eq('bar_id', barId)
      .eq('periodo', 'cmv')
      .is('semana', null)
      .is('ano', null);

    if (error) {
      console.error('[cmv-metas] erro:', error);
      return NextResponse.json({ error: 'Erro ao buscar metas' }, { status: 500 });
    }

    const metas: Record<string, { valor: number; operador: string }> = {};
    for (const m of (data as any[]) || []) {
      metas[m.metrica] = { valor: parseFloat(m.valor_meta), operador: m.operador || '<=' };
    }

    // Aplicar defaults pra métricas não definidas
    for (const [metrica, def] of Object.entries(DEFAULTS)) {
      if (!metas[metrica]) metas[metrica] = { ...def };
    }

    return NextResponse.json({ metas, defaults: DEFAULTS });
  } catch (err) {
    console.error('[cmv-metas] exceção:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const metrica = String(body?.metrica || '').trim();
    const valor = Number(body?.valor);
    const operador = body?.operador ? String(body.operador) : '<=';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    if (!metrica) {
      return NextResponse.json({ error: 'metrica é obrigatória' }, { status: 400 });
    }
    if (!Number.isFinite(valor)) {
      return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
    }
    if (!(metrica in DEFAULTS)) {
      return NextResponse.json({ error: `metrica '${metrica}' não suportada` }, { status: 400 });
    }

    const supabase = createServerClient();

    // delete + insert (mesmo padrão do desempenho — evita conflito com unique COALESCE)
    await supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .delete()
      .eq('bar_id', barId)
      .eq('periodo', 'cmv')
      .eq('metrica', metrica)
      .is('semana', null)
      .is('ano', null);

    const { error } = await supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .insert({
        bar_id: barId,
        periodo: 'cmv',
        metrica,
        valor_meta: valor,
        operador,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[cmv-metas] erro ao salvar:', error);
      return NextResponse.json({ error: 'Erro ao salvar meta' }, { status: 500 });
    }

    return NextResponse.json({ success: true, metrica, valor, operador });
  } catch (err) {
    console.error('[cmv-metas] exceção PATCH:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
