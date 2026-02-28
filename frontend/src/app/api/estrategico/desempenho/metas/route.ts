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
