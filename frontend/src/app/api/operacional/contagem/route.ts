import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * GET /api/operacional/contagem            → lista as áreas (tipo_local) do bar com nº de itens
 * GET /api/operacional/contagem?area=bar&data=2026-06-20 → itens da área pra contar
 * POST { area, data, itens:[{insumo_id, estoque_final, observacoes?}] } → salva a contagem
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const sp = new URL(request.url).searchParams;
  const area = sp.get('area');
  const data = sp.get('data') || hoje();
  const modo = sp.get('modo');
  const supabase = sb();

  // modo=resultado → análise da contagem (consumo, esperado, perda/anomalia) do dia
  if (modo === 'resultado') {
    const { data: rows, error } = await (supabase as any).schema('operations').rpc('contagem_resultado', { p_bar_id: user.bar_id, p_data: data });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const itens = (rows || []).filter((r: any) => Number(r.consumo) !== 0);
    const total_consumo = itens.reduce((s: number, r: any) => s + (Number(r.valor_consumo) || 0), 0);
    const anomalos = itens.filter((r: any) => r.anomalo);
    return NextResponse.json({
      success: true, data, itens,
      resumo: {
        total_consumo: Math.round(total_consumo * 100) / 100,
        qtd_itens: itens.length,
        qtd_anomalos: anomalos.length,
      },
    });
  }

  if (!area) {
    const { data: rows, error } = await (supabase.schema('operations' as any) as any)
      .from('insumos').select('tipo_local').eq('bar_id', user.bar_id).eq('ativo', true).not('tipo_local', 'is', null);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    const cont: Record<string, number> = {};
    for (const r of (rows || [])) cont[r.tipo_local] = (cont[r.tipo_local] || 0) + 1;
    const areas = Object.entries(cont).map(([nome, n]) => ({ nome, itens: n })).sort((a, b) => b.itens - a.itens);
    return NextResponse.json({ success: true, areas });
  }

  const { data: itens, error } = await (supabase as any).schema('operations').rpc('contagem_lista', { p_bar_id: user.bar_id, p_tipo_local: area, p_data: data });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, area, data, itens: itens || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }
  const data = body.data || hoje();
  const itens = (Array.isArray(body.itens) ? body.itens : [])
    .filter((i: any) => i.insumo_id != null && i.estoque_final != null && i.estoque_final !== '')
    .map((i: any) => ({ insumo_id: Number(i.insumo_id), estoque_final: Number(i.estoque_final), observacoes: i.observacoes || null }));
  if (!itens.length) return NextResponse.json({ success: false, error: 'nada pra salvar' }, { status: 400 });

  const supabase = sb();
  const { data: n, error } = await (supabase as any).schema('operations').rpc('contagem_salvar', {
    p_bar_id: user.bar_id, p_data: data, p_usuario: user.nome || user.email || 'app', p_itens: itens,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, salvos: n });
}
