import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET - Buscar feedbacks de voz do cliente
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const dataInicio = searchParams.get('data_inicio');
    const dataFim = searchParams.get('data_fim');
    const tom = searchParams.get('tom'); // Positivo, Negativo, Sugestão
    const categoria = searchParams.get('categoria');
    const semana = searchParams.get('semana');

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não informado' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Construir query
    let query = supabase
      .from('voz_cliente')
      .select('*')
      .eq('bar_id', parseInt(barId))
      .order('data_feedback', { ascending: false });

    // Filtros opcionais
    if (dataInicio) {
      query = query.gte('data_feedback', dataInicio);
    }
    if (dataFim) {
      query = query.lte('data_feedback', dataFim);
    }
    if (tom && tom !== 'todos') {
      query = query.eq('tom', tom);
    }
    if (categoria && categoria !== 'todas') {
      query = query.eq('categoria', categoria);
    }
    if (semana) {
      query = query.eq('semana', parseInt(semana));
    }

    const { data, error } = await query.limit(500);

    if (error) {
      console.error('Erro ao buscar voz_cliente:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Agregar estatísticas
    const estatisticas = {
      total: data?.length || 0,
      positivos: data?.filter(d => d.tom === 'Positivo').length || 0,
      negativos: data?.filter(d => d.tom === 'Negativo').length || 0,
      sugestoes: data?.filter(d => d.tom === 'Sugestão').length || 0,
      categorias: {} as Record<string, number>
    };

    // Contar por categoria
    data?.forEach(item => {
      if (item.categoria) {
        estatisticas.categorias[item.categoria] = (estatisticas.categorias[item.categoria] || 0) + 1;
      }
    });

    return NextResponse.json({
      success: true,
      data: data || [],
      estatisticas
    });

  } catch (error) {
    console.error('Erro na API voz_cliente:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// GET resumo por semana
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bar_id, ano } = body;

    if (!bar_id) {
      return NextResponse.json(
        { success: false, error: 'Bar não informado' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Buscar resumo agrupado por semana
    const { data, error } = await supabase
      .from('voz_cliente')
      .select('semana, tom, categoria')
      .eq('bar_id', bar_id)
      .gte('data_feedback', `${ano || 2026}-01-01`)
      .lte('data_feedback', `${ano || 2026}-12-31`);

    if (error) {
      console.error('Erro ao buscar resumo:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Agrupar por semana
    const porSemana: Record<number, { positivos: number; negativos: number; sugestoes: number; total: number }> = {};
    
    data?.forEach(item => {
      const semana = item.semana || 0;
      if (!porSemana[semana]) {
        porSemana[semana] = { positivos: 0, negativos: 0, sugestoes: 0, total: 0 };
      }
      porSemana[semana].total++;
      if (item.tom === 'Positivo') porSemana[semana].positivos++;
      if (item.tom === 'Negativo') porSemana[semana].negativos++;
      if (item.tom === 'Sugestão') porSemana[semana].sugestoes++;
    });

    // Converter para array ordenado
    const resumo = Object.entries(porSemana)
      .map(([semana, stats]) => ({
        semana: parseInt(semana),
        ...stats
      }))
      .sort((a, b) => b.semana - a.semana);

    return NextResponse.json({
      success: true,
      resumo
    });

  } catch (error) {
    console.error('Erro na API voz_cliente resumo:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
