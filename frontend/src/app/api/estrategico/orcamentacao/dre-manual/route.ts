import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createServerClient } from '@/lib/supabase-server';

/**
 * CRUD em financial.dre_manual.
 *
 * Lancamentos manuais que o socio adiciona fora do ContaAzul.
 * Sao somados ao gold.orcamento_realizado_mensal na pagina /orcamentacao.
 *
 * GET    ?bar_id=3&ano=2026&mes=5  -> lista entries do periodo
 * POST   body { bar_id, data_competencia, descricao, valor, categoria, categoria_macro, observacoes? }
 * PATCH  body { id, ...campos editaveis }
 * DELETE ?id=N
 */

const ALLOWED_MACROS = [
  'Receita',
  'Custos Variáveis',
  'Custo insumos (CMV)',
  'Mão-de-Obra',
  'Despesas Comerciais',
  'Despesas Administrativas',
  'Despesas Operacionais',
  'Despesas de Ocupação (Contas)',
  'Não Operacionais',
  'Investimentos',
  'Sócios',
];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = sp.get('ano') ? Number(sp.get('ano')) : undefined;
    const mes = sp.get('mes') ? Number(sp.get('mes')) : undefined;
    const categoria = sp.get('categoria') || undefined;

    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });
    }

    const supabase = createServerClient();

    let query = supabase
      .schema('financial' as never)
      .from('dre_manual')
      .select('id, bar_id, data_competencia, descricao, valor, categoria, categoria_macro, observacoes, usuario_criacao, criado_em, atualizado_em')
      .eq('bar_id', barId)
      .order('data_competencia', { ascending: false })
      .order('id', { ascending: false });

    if (ano) {
      const dataIni = `${ano}-01-01`;
      const dataFim = `${ano}-12-31`;
      query = query.gte('data_competencia', dataIni).lte('data_competencia', dataFim);
    }
    if (mes && ano) {
      const dataIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
      query = query.gte('data_competencia', dataIni).lte('data_competencia', dataFim);
    }
    if (categoria) query = query.eq('categoria', categoria);

    const { data, error } = await query;

    if (error) {
      console.error('[dre-manual GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [], total: (data || []).length });
  } catch (err) {
    console.error('[dre-manual GET] excecao:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const dataCompetencia = body?.data_competencia;
    const descricao = body?.descricao;
    const valor = Number(body?.valor);
    const categoria = body?.categoria;
    const categoriaMacro = body?.categoria_macro;
    const observacoes = body?.observacoes || null;
    const usuario = body?.usuario_criacao || 'ui_dre_manual';

    if (!barId || !dataCompetencia || !descricao || !categoria || !categoriaMacro) {
      return NextResponse.json(
        { error: 'bar_id, data_competencia, descricao, categoria, categoria_macro obrigatorios' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(valor)) {
      return NextResponse.json({ error: 'valor invalido' }, { status: 400 });
    }
    if (!ALLOWED_MACROS.includes(categoriaMacro)) {
      return NextResponse.json(
        { error: `categoria_macro deve ser uma de: ${ALLOWED_MACROS.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .schema('financial' as never)
      .from('dre_manual')
      .insert({
        bar_id: barId,
        data_competencia: dataCompetencia,
        descricao,
        valor,
        categoria,
        categoria_macro: categoriaMacro,
        observacoes,
        usuario_criacao: usuario,
      })
      .select()
      .single();

    if (error) {
      console.error('[dre-manual POST]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[dre-manual POST] excecao:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body?.id);

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (body?.data_competencia !== undefined) updates.data_competencia = body.data_competencia;
    if (body?.descricao !== undefined) updates.descricao = body.descricao;
    if (body?.valor !== undefined) {
      const v = Number(body.valor);
      if (!Number.isFinite(v)) return NextResponse.json({ error: 'valor invalido' }, { status: 400 });
      updates.valor = v;
    }
    if (body?.categoria !== undefined) updates.categoria = body.categoria;
    if (body?.categoria_macro !== undefined) {
      if (!ALLOWED_MACROS.includes(body.categoria_macro)) {
        return NextResponse.json(
          { error: `categoria_macro deve ser uma de: ${ALLOWED_MACROS.join(', ')}` },
          { status: 400 },
        );
      }
      updates.categoria_macro = body.categoria_macro;
    }
    if (body?.observacoes !== undefined) updates.observacoes = body.observacoes;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .schema('financial' as never)
      .from('dre_manual')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[dre-manual PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[dre-manual PATCH] excecao:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const sp = request.nextUrl.searchParams;
    const id = Number(sp.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .schema('financial' as never)
      .from('dre_manual')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[dre-manual DELETE]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[dre-manual DELETE] excecao:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 });
  }
}
