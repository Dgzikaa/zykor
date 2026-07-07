import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const num = (v: any) => (v === null || v === undefined ? 0 : Number(v) || 0);

// Lista grupos (classificados + pendentes) de um bar — para a tela de classificação do mix.
export async function GET(request: NextRequest) {
  try {
    const barId = parseInt(new URL(request.url).searchParams.get('bar_id') || '0');
    if (!barId) {
      return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
    }
    const { data, error } = await (supabase as any).rpc('get_grupos_classificacao', {
      p_bar_id: barId,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    const grupos = ((data || []) as any[]).map((r) => ({
      grupo: r.grupo_desc,
      categoria: r.categoria as string | null,
      volume: num(r.volume),
      itens: num(r.itens),
      pendente: !!r.pendente,
    }));
    return NextResponse.json({ success: true, bar_id: barId, grupos });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 }
    );
  }
}

// Salva (upsert) a categoria de um grupo.
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();
    const barId = parseInt(String(body.bar_id || 0));
    const grupo = String(body.grupo || '').trim();
    const categoria = String(body.categoria || '').toUpperCase();
    const por = body.por ? String(body.por) : null;
    if (!barId || !grupo || !['BEBIDA', 'DRINK', 'COMIDA', 'OUTROS'].includes(categoria)) {
      return NextResponse.json(
        { success: false, error: 'bar_id, grupo e categoria (BEBIDA/DRINK/COMIDA/OUTROS) obrigatórios' },
        { status: 400 }
      );
    }
    const { error } = await (supabase as any).rpc('set_grupo_categoria', {
      p_bar_id: barId,
      p_grupo_desc: grupo,
      p_categoria: categoria,
      p_por: por,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'erro' },
      { status: 500 }
    );
  }
}
