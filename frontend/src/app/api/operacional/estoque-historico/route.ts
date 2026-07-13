import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { areaDe } from '@/lib/estoque/area-contagem';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;
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
  // Classe = tipo de item: insumo (padrão) | limpeza | utensilio | producao.
  const classe = spar.get('classe') || 'insumo';
  if (!['insumo', 'limpeza', 'utensilio', 'producao'].includes(classe)) {
    return NextResponse.json({ success: false, error: 'classe inválida' }, { status: 400 });
  }
  const isLimpeza = classe === 'limpeza';
  const isProducao = classe === 'producao';
  const ops = (sb() as any).schema('operations');
  const silver = (sb() as any).schema('silver');

  // histórico de datas desse tipo+classe (datas vêm do operations; a silver espelha)
  const { data: datasRaw, error: e1 } = await ops.rpc('contagem_datas', { p_bar_id: user.bar_id, p_tipo: tipo, p_classe: classe });
  if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });
  const datas = (datasRaw || []).map((d: any) => ({ data: d.data_contagem, itens: Number(d.itens || 0) }));
  const dataSel = spar.get('data') || datas[0]?.data || null;
  if (!dataSel) return NextResponse.json({ success: true, tipo, classe, datas, data: null, itens: [], totais_area: [], total_geral: 0 });

  // UTENSÍLIO = modelo de quebra (gold.estoque_utensilio_quebra): por item, estoque +
  // compra → quebra; "valor" da aba é o VALOR DE QUEBRA. Agrupa por seção.
  if (classe === 'utensilio') {
    const gold = (sb() as any).schema('gold');
    const { data: rows, error: eq } = await gold
      .from('estoque_utensilio_quebra')
      .select('insumo_codigo, insumo_nome, secao, estoque_min, estoque_max, estoque, compra, estoque_ant, quebra, preco, valor_quebra')
      .eq('bar_id', user.bar_id).eq('data_contagem', dataSel)
      .order('secao', { ascending: true }).order('insumo_nome', { ascending: true });
    if (eq) return NextResponse.json({ success: false, error: eq.message }, { status: 500 });
    const itens = (rows || []).map((r: any) => ({
      insumo_codigo: r.insumo_codigo,
      insumo_nome: r.insumo_nome,
      area: r.secao || '—',
      categoria: r.secao || '—',
      estoque_final: Number(r.estoque ?? 0),
      compra: r.compra == null ? null : Number(r.compra),
      quebra: r.quebra == null ? null : Number(r.quebra),
      estoque_min: r.estoque_min == null ? null : Number(r.estoque_min),
      estoque_max: r.estoque_max == null ? null : Number(r.estoque_max),
      custo_unitario: Number(r.preco ?? 0),
      valor_quebra: r.valor_quebra == null ? null : Number(r.valor_quebra),
      valor: Number(r.valor_quebra ?? 0), // "valor" da aba utensílio = valor de quebra
    }));
    const areaMap: Record<string, { area: string; itens: number; valor: number }> = {};
    let total = 0;
    for (const it of itens) {
      (areaMap[it.area] ??= { area: it.area, itens: 0, valor: 0 });
      areaMap[it.area].itens += 1;
      areaMap[it.area].valor += it.valor;
      total += it.valor;
    }
    const totais_area = Object.values(areaMap).sort((a, b) => a.area.localeCompare(b.area));
    return NextResponse.json({ success: true, tipo, classe, datas, data: dataSel, itens, totais_area, total_geral: total });
  }

  // itens da contagem selecionada — da SILVER (valorizada pelo preço do VMarket NA DATA da contagem)
  // Diária = Curva A: só os itens (insumo OU produção) marcados com o checkbox curva_a entram.
  // O tipo_contagem é derivado pela data (segunda→'semanal', dia 1→'mensal'), mas os curva A são
  // contados TODO dia — inclusive dentro da contagem de segunda. Por isso a aba Diária é definida
  // pelo flag curva_a e NÃO pelo tipo_contagem (senão a contagem de segunda some). Semanal/mensal
  // continuam casando o tipo_contagem exato.
  let qItens = silver
    .from('estoque_contagem')
    .select('insumo_codigo, insumo_nome, tipo_local, categoria, unidade_medida, estoque_final, estoque_ideal, preco_vmarket, preco_fonte, valor, curva_a')
    .eq('bar_id', user.bar_id).eq('data_contagem', dataSel).eq('classe', classe);
  if (tipo === 'diaria') qItens = qItens.eq('curva_a', true);
  else qItens = qItens.eq('tipo_contagem', tipo);
  const { data: rows, error: e2 } = await qItens
    .order('categoria', { ascending: true }).order('insumo_nome', { ascending: true });
  if (e2) return NextResponse.json({ success: false, error: e2.message }, { status: 500 });

  // Unidade de CONTAGEM (do cadastro) por código — pra exibir a unidade como o bar conta,
  // não a unidade-base (ml/g) que confunde. insumo→operations.insumos, produção→producao_base.
  const unidContagem: Record<string, string> = {};
  if (classe === 'insumo' || isProducao) {
    const { data: cad } = await ops.from(isProducao ? 'producao_base' : 'insumos')
      .select('codigo, unidade_contagem').eq('bar_id', user.bar_id);
    for (const c of (cad || [])) if (c.codigo) unidContagem[String(c.codigo)] = c.unidade_contagem || '';
  }

  const itens = (rows || []).map((r: any) => {
    const estoque_final = Number(r.estoque_final ?? 0);
    const estoque_ideal = r.estoque_ideal == null ? null : Number(r.estoque_ideal);
    const valor = Number(r.valor ?? 0);
    return {
      ...r,
      estoque_final,
      estoque_ideal,
      // unidade como o bar conta (cadastro); vazio → a tela mostra só o número.
      unidade_contagem: unidContagem[String(r.insumo_codigo)] || null,
      // Limpeza: Sug. Pedido = repor até o ideal (nunca negativo).
      sug_pedido: isLimpeza && estoque_ideal != null ? Math.max(0, estoque_ideal - estoque_final) : null,
      // Custo/un: VMarket quando confiável; senão o EFETIVO (valor ÷ qtd) — reflete o custo do
      // cadastro/contagem quando o VMarket foi descartado (0 ou preço de embalagem trocada).
      // Produção idem (não tem VMarket; custo da ficha já está no `valor`).
      custo_unitario: (isProducao || !(Number(r.preco_vmarket) > 0))
        ? (estoque_final !== 0 ? valor / estoque_final : null)
        : Number(r.preco_vmarket),
      valor,
      // Insumo agrupa por área derivada; limpeza pela própria categoria;
      // produção (pc/pd) por seção da ficha (Cozinha × Drinks) pelo prefixo do código.
      area: isLimpeza ? (r.categoria || 'Outros')
          : isProducao ? (String(r.insumo_codigo || '').toLowerCase().startsWith('pd') ? 'Produção Drinks' : 'Produção Cozinha')
          : areaDe(r.categoria, r.insumo_codigo),
    };
  });

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
  const ordem = ['Comidas', 'Salão', 'Drinks', 'Alimentação', 'Produção Cozinha', 'Produção Drinks'];
  const totais_area = Object.values(areaMap).sort((a, b) => (ordem.indexOf(a.area) - ordem.indexOf(b.area)));

  return NextResponse.json({ success: true, tipo, classe, datas, data: dataSel, itens, totais_area, total_geral });
}

/**
 * POST { action:'sync', dias_atras? } — roda o sync da planilha de contagem (aba INSUMOS)
 * pro bar do usuário, invocando a edge function sync-contagem-sheets. Mesmo fluxo do cron.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
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
