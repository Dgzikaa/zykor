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
