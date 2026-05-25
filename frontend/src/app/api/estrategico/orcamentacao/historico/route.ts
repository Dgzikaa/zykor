import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = sp.get('ano') ? Number(sp.get('ano')) : undefined;
    const mes = sp.get('mes') ? Number(sp.get('mes')) : undefined;
    const categoria = sp.get('categoria') || undefined;
    const limit = Number(sp.get('limit') || 200);

    if (!barId) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let query = (supabase.schema('meta' as never) as never as ReturnType<typeof supabase.schema>)
      .from('orcamento_planilha_log')
      .select('*')
      .eq('bar_id', barId)
      .order('alterado_em', { ascending: false })
      .limit(limit);

    if (ano) query = query.eq('ano', ano);
    if (mes) query = query.eq('mes', mes);
    if (categoria) query = query.eq('categoria_nome', categoria);

    const { data, error } = await query;

    if (error) {
      console.error('[orcamentacao/historico]', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [], total: (data || []).length });
  } catch (err) {
    console.error('[orcamentacao/historico] exceção', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
