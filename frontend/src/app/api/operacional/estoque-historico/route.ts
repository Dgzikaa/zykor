import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * GET /api/operacional/estoque-historico?tipo=semanal&data=YYYY-MM-DD
 * Relatório (somente leitura) das contagens de estoque já gravadas:
 *  - histórico de datas por tipo (Diária/Curva A · Semanal/Completa · Mensal/Inventário)
 *  - itens da contagem com o preço do insumo NO MOMENTO da contagem (custo_unitario)
 *  - total em estoque (valor) por área (cozinha/bar)
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const spar = new URL(request.url).searchParams;
  const tipo = spar.get('tipo') || 'diaria';
  if (!['diaria', 'semanal', 'mensal'].includes(tipo)) {
    return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 });
  }
  const ops = (sb() as any).schema('operations');

  // histórico de datas desse tipo
  const { data: datasRaw, error: e1 } = await ops.rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo });
  if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
  const datas = (datasRaw || []).map((d: any) => ({ data: d.data_contagem, itens: Number(d.itens || 0) }));
  const dataSel = spar.get('data') || datas[0]?.data || null;
  if (!dataSel) return NextResponse.json({ success: true, tipo, datas, data: null, itens: [], totais_area: [], total_geral: 0 });

  // itens da contagem selecionada
  const { data: rows, error: e2 } = await ops
    .from('contagem_estoque_insumos')
    .select('insumo_codigo, insumo_nome, tipo_local, categoria, unidade_medida, estoque_inicial, estoque_final, custo_unitario')
    .eq('bar_id', user.bar_id).eq('tipo_contagem', tipo).eq('data_contagem', dataSel)
    .order('tipo_local', { ascending: true }).order('insumo_nome', { ascending: true });
  if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });

  const itens = (rows || []).map((r: any) => {
    const qtd = Number(r.estoque_final ?? 0);
    const custo = Number(r.custo_unitario ?? 0);
    return { ...r, estoque_final: qtd, custo_unitario: custo, valor: qtd * custo };
  });

  // total em estoque por área
  const areaMap: Record<string, { area: string; itens: number; valor: number }> = {};
  let total_geral = 0;
  for (const it of itens) {
    const area = it.tipo_local || '(sem área)';
    (areaMap[area] ??= { area, itens: 0, valor: 0 });
    areaMap[area].itens += 1;
    areaMap[area].valor += it.valor;
    total_geral += it.valor;
  }
  const totais_area = Object.values(areaMap).sort((a, b) => b.valor - a.valor);

  return NextResponse.json({ success: true, tipo, datas, data: dataSel, itens, totais_area, total_geral });
}
