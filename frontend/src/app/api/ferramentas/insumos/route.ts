import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { tbl } from '@/lib/supabase/table-schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ferramentas/insumos?bar_id=3[&search=alho][&apenas_ativos=true]
 *
 * Lista insumos do bar. Para uso na tela /ferramentas/insumos.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const barId = parseInt(barIdParam);
    const search = searchParams.get('search')?.trim() || '';
    const apenasAtivos = searchParams.get('apenas_ativos') !== 'false';

    const supabase = createServiceRoleClient();

    let query = tbl(supabase, 'insumos')
      .select('id, bar_id, codigo, nome, categoria, tipo_local, unidade_medida, custo_unitario, ativo, master_codigo, updated_at')
      .eq('bar_id', barId)
      .order('nome', { ascending: true });

    if (apenasAtivos) {
      query = query.eq('ativo', true);
    }

    if (search) {
      query = query.ilike('nome', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[insumos GET] erro:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: data?.length ?? 0,
      insumos: data ?? [],
    });
  } catch (e) {
    console.error('[insumos GET] exception:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/ferramentas/insumos
 * body: { id: number, custo_unitario?: number | null, categoria?: string }
 *
 * Atualiza um insumo. Apenas custo_unitario e categoria são editáveis aqui
 * (escopo mínimo). Outras edições exigem SQL direto até a UI evoluir.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, custo_unitario, categoria } = body ?? {};

    if (!id || typeof id !== 'number') {
      return NextResponse.json({ success: false, error: 'id (number) é obrigatório' }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (custo_unitario !== undefined) {
      if (custo_unitario !== null && (typeof custo_unitario !== 'number' || custo_unitario < 0 || !Number.isFinite(custo_unitario))) {
        return NextResponse.json({ success: false, error: 'custo_unitario inválido' }, { status: 400 });
      }
      update.custo_unitario = custo_unitario;
    }

    if (categoria !== undefined) {
      if (typeof categoria !== 'string' || categoria.trim().length === 0) {
        return NextResponse.json({ success: false, error: 'categoria não pode ser vazia' }, { status: 400 });
      }
      update.categoria = categoria.trim();
    }

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ success: false, error: 'nenhum campo para atualizar' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await tbl(supabase, 'insumos')
      .update(update)
      .eq('id', id)
      .select('id, codigo, nome, categoria, custo_unitario, updated_at')
      .single();

    if (error) {
      console.error('[insumos PATCH] erro:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, insumo: data });
  } catch (e) {
    console.error('[insumos PATCH] exception:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
