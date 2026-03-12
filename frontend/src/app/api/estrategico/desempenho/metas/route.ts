import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const barId = searchParams.get('bar_id');
    const periodo = searchParams.get('periodo'); // 'semanal' ou 'mensal'

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    let query = supabase
      .from('metas_desempenho')
      .select('*')
      .eq('bar_id', barId);

    if (periodo) {
      query = query.eq('periodo', periodo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar metas:', error);
      return NextResponse.json(
        { error: 'Erro ao buscar metas de desempenho' },
        { status: 500 }
      );
    }

    // Transformar array em objeto para facilitar acesso
    const metasMap: Record<string, { valor: number; operador: string }> = {};
    (data || []).forEach((meta: any) => {
      metasMap[meta.metrica] = {
        valor: parseFloat(meta.valor_meta),
        operador: meta.operador
      };
    });

    return NextResponse.json({ metas: metasMap, raw: data });
  } catch (error) {
    console.error('Erro na API de metas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

type MetaPayload = {
  metrica: string;
  valor: number;
  operador?: string;
};

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const periodo = String(body?.periodo || '');
    const metas = (body?.metas || []) as MetaPayload[];

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    if (periodo !== 'semanal' && periodo !== 'mensal') {
      return NextResponse.json(
        { error: 'periodo inválido (use semanal ou mensal)' },
        { status: 400 }
      );
    }

    if (!Array.isArray(metas) || metas.length === 0) {
      return NextResponse.json(
        { error: 'metas é obrigatório e deve ser um array não vazio' },
        { status: 400 }
      );
    }

    const metasValidas = metas
      .filter((m) => m && typeof m.metrica === 'string' && m.metrica.trim() !== '')
      .map((m) => ({
        bar_id: barId,
        periodo,
        metrica: m.metrica.trim(),
        valor_meta: Number(m.valor),
        operador: m.operador && m.operador.trim() ? m.operador.trim() : '>=',
        atualizado_em: new Date().toISOString(),
      }))
      .filter((m) => Number.isFinite(m.valor_meta));

    if (!metasValidas.length) {
      return NextResponse.json(
        { error: 'Nenhuma meta válida para salvar' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error: upsertError } = await supabase
      .from('metas_desempenho')
      .upsert(metasValidas, { onConflict: 'bar_id,periodo,metrica' });

    if (upsertError) {
      console.error('Erro ao salvar metas:', upsertError);
      return NextResponse.json(
        { error: 'Erro ao salvar metas de desempenho' },
        { status: 500 }
      );
    }

    const { data, error: fetchError } = await supabase
      .from('metas_desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('periodo', periodo);

    if (fetchError) {
      console.error('Erro ao recarregar metas após salvar:', fetchError);
      return NextResponse.json(
        { error: 'Metas salvas, mas falha ao recarregar' },
        { status: 500 }
      );
    }

    const metasMap: Record<string, { valor: number; operador: string }> = {};
    (data || []).forEach((meta: any) => {
      metasMap[meta.metrica] = {
        valor: parseFloat(meta.valor_meta),
        operador: meta.operador,
      };
    });

    return NextResponse.json({
      success: true,
      salvas: metasValidas.length,
      metas: metasMap,
    });
  } catch (error) {
    console.error('Erro ao salvar metas (PUT):', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Edição individual de meta com histórico
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const periodo = String(body?.periodo || 'semanal');
    const metrica = String(body?.metrica || '');
    const valorNovo = Number(body?.valor);
    const operador = body?.operador ? String(body.operador) : undefined;
    const alteradoPor = body?.alterado_por ? String(body.alterado_por) : 'Sistema';

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (!metrica.trim()) {
      return NextResponse.json({ error: 'metrica é obrigatória' }, { status: 400 });
    }

    if (!Number.isFinite(valorNovo)) {
      return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Buscar meta atual para registrar valor anterior
    const { data: metaAtual } = await supabase
      .from('metas_desempenho')
      .select('id, valor_meta')
      .eq('bar_id', barId)
      .eq('periodo', periodo)
      .eq('metrica', metrica)
      .maybeSingle();

    const valorAnterior = metaAtual?.valor_meta ?? null;
    const metaId = metaAtual?.id ?? null;

    // Upsert da meta
    const dadosMeta: Record<string, unknown> = {
      bar_id: barId,
      periodo,
      metrica: metrica.trim(),
      valor_meta: valorNovo,
      updated_at: new Date().toISOString(),
    };
    if (operador) {
      dadosMeta.operador = operador;
    }

    const { data: metaSalva, error: upsertError } = await supabase
      .from('metas_desempenho')
      .upsert(dadosMeta, { onConflict: 'bar_id,periodo,metrica' })
      .select('id')
      .single();

    if (upsertError) {
      console.error('Erro ao salvar meta:', upsertError);
      return NextResponse.json({ error: 'Erro ao salvar meta' }, { status: 500 });
    }

    // Registrar histórico
    const { error: historicoError } = await supabase
      .from('metas_desempenho_historico')
      .insert({
        meta_id: metaSalva?.id || metaId,
        bar_id: barId,
        metrica: metrica.trim(),
        periodo,
        valor_anterior: valorAnterior,
        valor_novo: valorNovo,
        alterado_por: alteradoPor,
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico (não crítico):', historicoError);
    }

    return NextResponse.json({
      success: true,
      metrica,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
    });
  } catch (error) {
    console.error('Erro ao editar meta (PATCH):', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
