import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORIAS_VALIDAS = [
  'socios','artistas','funcionarios_operacao','funcionarios_escritorio','clientes','_descartado'
];

const PRIORIDADE_DEFAULT: Record<string, number> = {
  '_descartado': 10,
  'socios': 20,
  'artistas': 30,
  'funcionarios_operacao': 40,
  'funcionarios_escritorio': 50,
  'clientes': 60,
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .schema('financial' as any)
      .from('consumos_keywords')
      .select('*')
      .order('prioridade', { ascending: true })
      .order('id', { ascending: true });

    if (!includeInactive) {
      query = query.eq('ativo', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ keywords: data || [] });
  } catch (err: any) {
    console.error('Erro GET keywords:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pattern, categoria, descricao, exemplo, bar_id } = body;

    if (!pattern || !categoria) {
      return NextResponse.json({ error: 'pattern e categoria sao obrigatorios' }, { status: 400 });
    }

    if (!CATEGORIAS_VALIDAS.includes(categoria)) {
      return NextResponse.json({ error: `categoria invalida. Use: ${CATEGORIAS_VALIDAS.join(', ')}` }, { status: 400 });
    }

    const prioridade = PRIORIDADE_DEFAULT[categoria] ?? 100;

    const { data, error } = await supabase
      .schema('financial' as any)
      .from('consumos_keywords')
      .insert({
        pattern: pattern.toLowerCase().trim(),
        categoria,
        prioridade,
        descricao: descricao || null,
        exemplo: exemplo || null,
        bar_id: bar_id || null,
        ativo: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ keyword: data });
  } catch (err: any) {
    console.error('Erro POST keyword:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
