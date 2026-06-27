import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Área = seção da planilha de contagem (COZINHA/SALÃO/DRINKS/FUNCIONÁRIOS), refletida no sufixo da categoria:
// (C)→Comidas · (S)→Salão · (B)/destilados→Drinks · (F)→Alimentação. "Não-alcóolicos" aparece nas 2 seções → resolve por código.
const DRINK_NAOALC = new Set(['i0298', 'i0085', 'i0328', 'i0191', 'i0563']); // não-alcóolicos que ficam na seção DRINKS
function areaDe(categoria: string | null, cod: string | null): string {
  const c = (categoria || '').toUpperCase();
  if (cod && DRINK_NAOALC.has(cod)) return 'Drinks';
  if (/\(F\)/.test(c)) return 'Alimentação';
  if (/\(C\)/.test(c) || c.includes('PÃES') || c.includes('PAES') || c.includes('FEIJOADA')) return 'Comidas';
  if (/\(S\)/.test(c) || c.includes('MERCADO (S)')) return 'Salão';
  if (/\(B\)/.test(c) || ['DESTILADOS', 'IMPÉRIO', 'IMPERIO', 'POLPAS', 'PRÉ-BATCH', 'PRE-BATCH', 'OUTROS'].some((k) => c.includes(k))) return 'Drinks';
  if (['ARTESANAL', 'LATA', 'LONG NECK', 'RETORNÁVEIS', 'RETORNAVEIS', 'VINHOS'].some((k) => c.includes(k))) return 'Salão';
  if (c.includes('ALCÓOLICOS') || c.includes('ALCOOLICOS')) return 'Salão';
  return 'Comidas';
}

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
  const silver = (sb() as any).schema('silver');

  // histórico de datas desse tipo (datas vêm do operations; a silver espelha)
  const { data: datasRaw, error: e1 } = await ops.rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo });
  if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
  const datas = (datasRaw || []).map((d: any) => ({ data: d.data_contagem, itens: Number(d.itens || 0) }));
  const dataSel = spar.get('data') || datas[0]?.data || null;
  if (!dataSel) return NextResponse.json({ success: true, tipo, datas, data: null, itens: [], totais_area: [], total_geral: 0 });

  // itens da contagem selecionada — da SILVER (valorizada pelo preço do VMarket NA DATA da contagem)
  // Diária = Curva A: só os itens (insumo OU produção) marcados com o checkbox curva_a entram.
  let qItens = silver
    .from('estoque_contagem')
    .select('insumo_codigo, insumo_nome, tipo_local, categoria, unidade_medida, estoque_final, preco_vmarket, preco_fonte, valor, curva_a')
    .eq('bar_id', user.bar_id).eq('tipo_contagem', tipo).eq('data_contagem', dataSel);
  if (tipo === 'diaria') qItens = qItens.eq('curva_a', true);
  const { data: rows, error: e2 } = await qItens
    .order('tipo_local', { ascending: true }).order('insumo_nome', { ascending: true });
  if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });

  const itens = (rows || []).map((r: any) => ({
    ...r,
    estoque_final: Number(r.estoque_final ?? 0),
    custo_unitario: Number(r.preco_vmarket ?? 0), // coluna "Preço (na data)" = preço VMarket na data da contagem
    valor: Number(r.valor ?? 0),
    area: areaDe(r.categoria, r.insumo_codigo),
  }));

  // total em estoque por área (Comidas / Salão / Drinks / Alimentação)
  const areaMap: Record<string, { area: string; itens: number; valor: number }> = {};
  let total_geral = 0;
  for (const it of itens) {
    const area = it.area;
    (areaMap[area] ??= { area, itens: 0, valor: 0 });
    areaMap[area].itens += 1;
    areaMap[area].valor += it.valor;
    total_geral += it.valor;
  }
  const ordem = ['Comidas', 'Salão', 'Drinks', 'Alimentação'];
  const totais_area = Object.values(areaMap).sort((a, b) => (ordem.indexOf(a.area) - ordem.indexOf(b.area)));

  return NextResponse.json({ success: true, tipo, datas, data: dataSel, itens, totais_area, total_geral });
}

/**
 * POST { action:'sync', dias_atras? } — roda o sync da planilha de contagem (aba INSUMOS)
 * pro bar do usuário, invocando a edge function sync-contagem-sheets. Mesmo fluxo do cron.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });

  const dias = Math.max(1, Math.min(400, Number(body.dias_atras) || 14));
  const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-contagem-sheets?bar_id=${user.bar_id}&dias_atras=${dias}`;
  try {
    const r = await fetch(fnUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    });
    const txt = await r.text();
    let res: any = null; try { res = JSON.parse(txt); } catch { res = { raw: txt }; }
    if (!r.ok || res?.success === false) {
      return NextResponse.json({ success: false, error: res?.error || `Falha no sync (HTTP ${r.status})` }, { status: 502 });
    }
    const meu = (res?.results || []).find((x: any) => Number(x?.bar) === Number(user.bar_id)) || res?.results?.[0] || null;
    return NextResponse.json({ success: true, upserted: meu?.upserted ?? null, linhas: meu?.linhas ?? null, sem_cadastro: meu?.sem_cadastro ?? [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
