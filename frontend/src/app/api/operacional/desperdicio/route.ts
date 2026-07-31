import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * DESPERDÍCIO (Beta) — registro visual do que foi descartado (caixa de desperdício).
 *
 * Cada registro tem 1 dia + N fotos + N itens (insumo/qtd/motivo/obs) + observação geral.
 * Trigger em operations.desperdicio_registro_item recalcula operations.desvio_desperdicio_manual
 * (soma por bar+data+insumo) → a coluna "Desperdício" em /operacional/desvios reflete a soma.
 *
 * GET    ?ini&fim               → registros do período (com itens e fotos)
 * POST   { data, observacao, itens[], fotos[] } → cria registro completo
 * PUT    { id, ...campos, itens[]?, fotos[]? }  → atualiza cabeçalho e/ou substitui itens/fotos
 * DELETE ?id=...                → apaga registro (cascade)
 */

const isISO = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

type Area = 'CozinhaFin' | 'CozinhaProd' | 'BarFin' | 'BarProd' | 'Salao';
const AREAS: Area[] = ['CozinhaFin', 'CozinhaProd', 'BarFin', 'BarProd', 'Salao'];
type OrigemTipo = 'insumo' | 'preparo' | 'produto';
type Item = {
  insumo_codigo: string; qtd: number; motivo?: string; observacao?: string; area?: Area | null;
  origem_tipo?: OrigemTipo; origem_codigo?: string; origem_nome?: string; origem_qtd?: number;
  /**
   * Só do REQUEST (não é coluna): marca linha que já é resultado da explosão e veio do banco,
   * na edição de um registro. Sem isso, reexplodir trataria o código do COMPONENTE como id de
   * produto e a linha sumiria. Ver expandirItens.
   */
  ja_expandido?: boolean;
};
type Foto = { storage_path: string; url: string; size_bytes?: number; mime?: string };

async function ctx(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return { erro: authErrorResponse('Usuário não autenticado') };
  const nega = negarPorRota(user, request); if (nega) return { erro: nega };
  if (!user.ativo) return { erro: authErrorResponse('Usuário inativo', 403) };
  const bar_id = user.bar_id;
  if (!bar_id) return { erro: NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 }) };
  return { user, supabase: await getAdminClient(), bar_id };
}

const ops = (supabase: any) => supabase.schema('operations');

/**
 * A explosão de PRODUTO do cardápio está desligada porque a ficha e o desperdício falam unidades
 * diferentes em PARTE dos componentes — e ninguém percebeu porque a explosão NUNCA rodou de
 * verdade: até 30/07/2026 a tela não mandava `origem_tipo`, então todo "prato pronto" era gravado
 * como um insumo de código inexistente e morria ali, sem chegar no /desvios.
 *
 * O que o /desvios espera, medido nos lançamentos reais do time (operations.desvio_desperdicio_manual):
 *   - PRODUÇÃO unitizada (pc0040 Quibe, pc0011 Isca, pc0024 Croquete) → UNIDADE. qtd = 1, 3, 10.
 *   - EMBALADO (i0199 Stella, i0186 Original)                        → UNIDADE (garrafas). qtd = 3, 9.
 *   - GRANEL (i0043 Limão, i0089 Laranja, i0125 Morango)             → KG. qtd = 0,27 / 0,088 / 0,072.
 * `insumos.unidade_medida` NÃO distingue: diz "ml" pra Stella (contada em garrafa) e "g" pro
 * morango (contado em kg).
 *
 * O que a ficha (public.producao_ficha_item) guarda:
 *   - pc0040 Quibe → 1        ✅ bate: 1 quibe é 1 quibe
 *   - pc0024 Croquete → 8     ✅ bate: 8 croquetes na porção
 *   - i0199 Stella → 330      ❌ 330 (ml) onde o desvio espera 1 (garrafa)      → 330x
 *   - i0188 Pepsi → 350       ❌ 350 (ml) onde o desvio espera 1 (lata)         → 350x
 *   - i0043 Limão → 80        ❌ 80 (g) onde o desvio espera 0,08 (kg)          → 1000x
 *
 * Ou seja: a parte de produção já está certa — jogar fora 1 Quibe do Calaf debita mesmo 1 quibe.
 * O que quebra são os insumos crus da MESMA ficha. Como a explosão grava tudo de uma vez, basta um
 * componente errado pra contaminar desvio e CMV. Enquanto a conversão por embalagem não existir,
 * é melhor recusar na cara do que gravar 80 kg de limão.
 */
const EXPLOSAO_PRODUTO_BLOQUEADA = true;
const ERRO_EXPLOSAO_UNIDADE =
  'Prato pronto está temporariamente indisponível: a parte de produção da ficha está certa, mas os ' +
  'insumos crus dela estão em g/ml enquanto o desvio conta em unidade/kg — sairia 80 kg de limão ' +
  'no lugar de 80 g. Lance os itens direto por enquanto; a equipe do Zykor já está com isso.';

function validarItens(itens: unknown): Item[] {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const out: Item[] = [];
  for (const raw of itens as any[]) {
    const insumo_codigo = String(raw?.insumo_codigo || '').trim();
    const qtd = Number(raw?.qtd);
    if (!insumo_codigo || !Number.isFinite(qtd) || qtd <= 0) continue;
    const rawArea = raw?.area ? String(raw.area).trim() : null;
    const area = rawArea && (AREAS as string[]).includes(rawArea) ? (rawArea as Area) : null;
    const ot = String(raw?.origem_tipo || '').trim();
    out.push({
      insumo_codigo,
      qtd: Math.round(qtd * 1000) / 1000,
      motivo: raw?.motivo ? String(raw.motivo).trim() : undefined,
      observacao: raw?.observacao ? String(raw.observacao).trim() : undefined,
      area,
      origem_tipo: (['insumo', 'preparo', 'produto'] as string[]).includes(ot) ? (ot as OrigemTipo) : undefined,
      origem_codigo: raw?.origem_codigo ? String(raw.origem_codigo).trim() : undefined,
      origem_nome: raw?.origem_nome ? String(raw.origem_nome).trim() : undefined,
      origem_qtd: Number.isFinite(Number(raw?.origem_qtd)) ? Number(raw.origem_qtd) : undefined,
      ja_expandido: raw?.ja_expandido === true || undefined,
    });
  }
  return out;
}

/**
 * Produto do cardápio → linhas que realmente saem do estoque.
 *
 * "Hambúrguer, quando a gente fala, é ele completo" (dono, 27/07) — então jogar fora 1 Debochão
 * debita blend, pão, queijo, cebola... e o Molho Barbecoca. A explosão PARA no preparo de
 * propósito: preparo tem estoque próprio e é contado, e o insumo cru dele já saiu quando foi
 * produzido — descer além disso contaria o mesmo prejuízo duas vezes.
 *
 * Preparo e insumo escolhidos direto não explodem: viram 1 linha, no próprio código.
 *
 * `ja_expandido` desliga a explosão: na EDIÇÃO, as linhas vêm do banco já explodidas e carregam
 * `origem_tipo: 'produto'` como histórico ("esta linha nasceu de um Debochão"). Explodir de novo
 * leria o código do componente (ex.: "PAO001") como id de produto — NaN — e a linha sumiria.
 *
 * ⚠️ EXPLOSÃO DESLIGADA (30/07/2026) — CONFLITO DE UNIDADE, ver EXPLOSAO_PRODUTO_BLOQUEADA.
 */
async function expandirItens(supabase: any, barId: number, itens: Item[]): Promise<Item[]> {
  const out: Item[] = [];
  for (const item of itens) {
    // `ja_expandido` é campo só de request: tirar aqui evita vazar pro insert (não existe coluna).
    const { ja_expandido, ...it } = item;
    if (ja_expandido || it.origem_tipo !== 'produto') {
      out.push({ ...it, origem_tipo: it.origem_tipo || 'insumo', origem_codigo: it.origem_codigo || it.insumo_codigo, origem_qtd: it.origem_qtd ?? it.qtd });
      continue;
    }
    if (EXPLOSAO_PRODUTO_BLOQUEADA) throw new Error(ERRO_EXPLOSAO_UNIDADE);
    const produtoId = Number(it.insumo_codigo); // no produto, o "código" que chega é o id do cardápio
    const { data: comps } = await supabase.rpc('fn_desperdicio_explodir_produto', {
      p_bar: barId, p_produto_id: produtoId,
    });
    if (!comps || comps.length === 0) continue; // produto sem ficha → nada a debitar
    for (const c of comps as any[]) {
      const qtdComponente = Number(c.qtd_por_unidade) * it.qtd;
      if (!Number.isFinite(qtdComponente) || qtdComponente <= 0) continue;
      out.push({
        insumo_codigo: String(c.codigo),
        qtd: Math.round(qtdComponente * 1000) / 1000,
        motivo: it.motivo, observacao: it.observacao, area: it.area,
        origem_tipo: 'produto',
        origem_codigo: String(produtoId),
        origem_nome: it.origem_nome,
        origem_qtd: it.qtd,
      });
    }
  }
  return out;
}

function validarFotos(fotos: unknown): Foto[] {
  if (!Array.isArray(fotos)) return [];
  const out: Foto[] = [];
  for (const raw of fotos as any[]) {
    const url = String(raw?.url || '').trim();
    const storage_path = String(raw?.storage_path || '').trim();
    if (!url || !storage_path) continue;
    out.push({
      url,
      storage_path,
      size_bytes: raw?.size_bytes != null ? Number(raw.size_bytes) : undefined,
      mime: raw?.mime ? String(raw.mime) : undefined,
    });
  }
  return out;
}

export async function GET(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { supabase, bar_id } = c;
  const sp = new URL(request.url).searchParams;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  if (!isISO(ini) || !isISO(fim)) return NextResponse.json({ success: false, error: 'ini e fim (AAAA-MM-DD) obrigatórios' }, { status: 400 });
  // Filtro de seção (abas Bar/Cozinha). O filtro NÃO é aplicado aqui na query: registros antigos
  // não têm `secao`, e filtrar só por ela colocava registro 100% de Bar dentro da aba Cozinha
  // (reportado em 29/07). A seção efetiva é resolvida abaixo, depois de carregar os itens —
  // a ÁREA de cada item (BarFin/BarProd/CozinhaFin/CozinhaProd) é a informação precisa.
  const secao = sp.get('secao');

  // Cabeçalho + itens + fotos em 3 queries paralelas (mais simples que 1 join grande).
  const { data: registros, error: errReg } = await ops(supabase)
    .from('desperdicio_registro')
    .select('id, bar_id, data, observacao, criado_por, criado_em, atualizado_em, secao, responsavel_id')
    .eq('bar_id', bar_id)
    .gte('data', ini)
    .lte('data', fim)
    .order('data', { ascending: false })
    .order('id', { ascending: false });
  if (errReg) return NextResponse.json({ success: false, error: errReg.message }, { status: 500 });

  const ids = (registros || []).map((r: any) => r.id);
  if (ids.length === 0) return NextResponse.json({ success: true, registros: [] });

  const [{ data: itens }, { data: fotos }] = await Promise.all([
    ops(supabase).from('desperdicio_registro_item')
      .select('id, registro_id, insumo_codigo, qtd, motivo, observacao, area, origem_tipo, origem_codigo, origem_nome, origem_qtd').in('registro_id', ids),
    ops(supabase).from('desperdicio_registro_foto')
      .select('id, registro_id, storage_path, url, size_bytes, mime').in('registro_id', ids),
  ]);

  // Junta nome + preço unitário do insumo (evita 1 lookup por item). Preço vem da view
  // operations.v_insumo_preco_atual, que já é a fonte usada pelo desvio pra valorizar.
  const codigos = Array.from(new Set((itens || []).map((i: any) => i.insumo_codigo)));
  const nomeByCod = new Map<string, { nome: string; unidade_medida: string | null; categoria: string | null }>();
  const precoByCod = new Map<string, number>();
  if (codigos.length) {
    const [{ data: cad }, { data: prc }] = await Promise.all([
      ops(supabase).from('insumos')
        .select('codigo, nome, unidade_medida, categoria').eq('bar_id', bar_id).in('codigo', codigos),
      ops(supabase).from('v_insumo_preco_atual')
        .select('cod_u, preco_atual').eq('bar_id', bar_id).in('cod_u', codigos.map((c) => String(c).toUpperCase())),
    ]);
    for (const r of (cad || []) as any[]) nomeByCod.set(r.codigo, { nome: r.nome, unidade_medida: r.unidade_medida, categoria: r.categoria });
    for (const r of (prc || []) as any[]) precoByCod.set(String(r.cod_u).toUpperCase(), Number(r.preco_atual || 0));
  }

  const itensPorReg = new Map<number, any[]>();
  for (const it of (itens || []) as any[]) {
    const cad = nomeByCod.get(it.insumo_codigo);
    const preco = precoByCod.get(String(it.insumo_codigo).toUpperCase()) ?? null;
    const valor_rs = preco != null ? Math.round(Number(it.qtd) * preco * 100) / 100 : null;
    const enriched = {
      ...it,
      insumo_nome: cad?.nome || it.insumo_codigo,
      unidade: cad?.unidade_medida || 'un',
      categoria: cad?.categoria || null,
      preco, valor_rs,
    };
    const arr = itensPorReg.get(it.registro_id) || []; arr.push(enriched); itensPorReg.set(it.registro_id, arr);
  }
  const fotosPorReg = new Map<number, any[]>();
  for (const f of (fotos || []) as any[]) {
    const arr = fotosPorReg.get(f.registro_id) || []; arr.push(f); fotosPorReg.set(f.registro_id, arr);
  }

  // Seção EFETIVA: a marcada no registro manda; sem ela, deriva das ÁREAS dos itens
  // (BarFin/BarProd → Bar; CozinhaFin/CozinhaProd → Cozinha). Registro com itens dos dois lados
  // aparece nas duas abas — é misto de verdade. 'Salao' não é bar nem cozinha: cai nas duas, pra
  // não sumir de lugar nenhum.
  const secoesDoRegistro = (reg: any, itensDoReg: any[]): string[] => {
    if (reg.secao === 'Bar' || reg.secao === 'Cozinha') return [reg.secao];
    const areas = new Set(itensDoReg.map((i) => String(i.area || '')));
    const out: string[] = [];
    if ([...areas].some((a) => a.startsWith('Bar'))) out.push('Bar');
    if ([...areas].some((a) => a.startsWith('Cozinha'))) out.push('Cozinha');
    // Sem área nenhuma (ou só Salão): não dá pra afirmar de que lado é — mostra nas duas.
    return out.length ? out : ['Bar', 'Cozinha'];
  };

  const enriched = (registros || [])
    .map((r: any) => {
      const itensDoReg = itensPorReg.get(r.id) || [];
      return {
        ...r,
        itens: itensDoReg,
        fotos: fotosPorReg.get(r.id) || [],
        // Devolvido pra tela poder rotular o card mesmo quando a seção foi inferida.
        secao_efetiva: secoesDoRegistro(r, itensDoReg),
      };
    })
    .filter((r: any) => (secao === 'Bar' || secao === 'Cozinha') ? r.secao_efetiva.includes(secao) : true);

  return NextResponse.json({ success: true, registros: enriched });
}

export async function POST(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  const body = await request.json().catch(() => ({}));

  const data = String(body?.data || '');
  if (!isISO(data)) return NextResponse.json({ success: false, error: 'data (AAAA-MM-DD) obrigatória' }, { status: 400 });

  const itensBrutos = validarItens(body?.itens);
  if (itensBrutos.length === 0) return NextResponse.json({ success: false, error: 'Informe pelo menos 1 item (insumo + qtd)' }, { status: 400 });
  // Produto do cardápio vira N linhas (blend, pão, queijo, molho...) ANTES de gravar.
  let itens: Item[];
  try {
    itens = await expandirItens(supabase, bar_id, itensBrutos);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Falha ao expandir a ficha' }, { status: 400 });
  }
  if (itens.length === 0) return NextResponse.json({ success: false, error: 'Nenhum item com ficha técnica pra debitar — confira a ficha do produto escolhido' }, { status: 400 });

  const fotos = validarFotos(body?.fotos);
  if (fotos.length === 0) return NextResponse.json({ success: false, error: 'Anexe pelo menos 1 foto' }, { status: 400 });

  // Seção + responsável (espelha o Controle de Produção). Seção inválida vira null em vez de
  // barrar: o registro do desperdício não pode ser perdido por causa de metadado de organização.
  const secao = body?.secao === 'Bar' || body?.secao === 'Cozinha' ? body.secao : null;
  const responsavelId = Number(body?.responsavel_id) || null;

  // ── ANTI-DUPLICAÇÃO ────────────────────────────────────────────────────────────────────
  // Em 29/07/2026 o mesmo registro entrou 13 VEZES (ids 37-49, 00:59→01:00): a pessoa clicou
  // várias vezes em Salvar, provavelmente achando que não tinha funcionado — o upload das fotos
  // demora e a tela não dava sinal claro. Cada clique virou um registro, e o desperdício foi
  // 13x pro desvio (78 un onde eram 6).
  //
  // O `disabled` do botão não basta: em tablet o toque repetido dispara antes do re-render, e
  // aqui os cliques tinham 2-7s de intervalo (pessoa insistindo). A trava tem que ser do lado
  // do servidor, comparando o CONTEÚDO — mesmo bar, mesma data, mesmos itens/qtds, na última
  // meia hora. Nesse caso devolve o registro que já existe em vez de criar outro (idempotente):
  // pro usuário parece que salvou, que é o que ele queria mesmo.
  const assinatura = (lista: any[]) => lista
    .map((i) => `${String(i.insumo_codigo).toUpperCase()}:${Number(i.qtd)}`)
    .sort()
    .join('|');
  const assinaturaNova = assinatura(itens);

  const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentes } = await ops(supabase).from('desperdicio_registro')
    .select('id, criado_em')
    .eq('bar_id', bar_id)
    .eq('data', data)
    .gte('criado_em', trintaMinAtras);

  if (recentes?.length) {
    const idsRecentes = recentes.map((r: any) => r.id);
    const { data: itensRecentes } = await ops(supabase).from('desperdicio_registro_item')
      .select('registro_id, insumo_codigo, qtd')
      .in('registro_id', idsRecentes);
    const porRegistro = new Map<number, any[]>();
    for (const it of (itensRecentes || []) as any[]) {
      const arr = porRegistro.get(it.registro_id) || []; arr.push(it); porRegistro.set(it.registro_id, arr);
    }
    for (const [regId, lista] of porRegistro) {
      if (assinatura(lista) === assinaturaNova) {
        return NextResponse.json({
          success: true,
          duplicado_evitado: true,
          registro_id: regId,
          aviso: 'Este mesmo registro já tinha sido salvo há pouco — reaproveitamos o existente em vez de duplicar.',
        });
      }
    }
  }

  // 1) Cabeçalho
  const { data: reg, error: errReg } = await ops(supabase).from('desperdicio_registro').insert({
    bar_id, data, secao, responsavel_id: responsavelId,
    observacao: body?.observacao ? String(body.observacao).trim() : null,
    criado_por: user.email || user.nome || 'desperdicio-beta',
  }).select('id').single();
  if (errReg) return NextResponse.json({ success: false, error: errReg.message }, { status: 500 });

  // 2) Itens (trigger sincroniza operations.desvio_desperdicio_manual)
  const { error: errIt } = await ops(supabase).from('desperdicio_registro_item').insert(
    itens.map((i) => ({ registro_id: reg.id, ...i })),
  );
  if (errIt) {
    await ops(supabase).from('desperdicio_registro').delete().eq('id', reg.id); // rollback manual
    return NextResponse.json({ success: false, error: errIt.message }, { status: 500 });
  }

  // 3) Fotos
  const { error: errFt } = await ops(supabase).from('desperdicio_registro_foto').insert(
    fotos.map((f) => ({ registro_id: reg.id, ...f })),
  );
  if (errFt) {
    await ops(supabase).from('desperdicio_registro').delete().eq('id', reg.id); // cascade limpa itens/fotos
    return NextResponse.json({ success: false, error: errFt.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: reg.id });
}

export async function PUT(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { supabase, bar_id } = c;
  const body = await request.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  // Confirma que o registro é do bar do usuário (defesa em profundidade — negarPorRota já filtra por permissão)
  const { data: existente } = await ops(supabase).from('desperdicio_registro')
    .select('id, bar_id').eq('id', id).single();
  if (!existente || existente.bar_id !== bar_id) return NextResponse.json({ success: false, error: 'registro não encontrado' }, { status: 404 });

  // Cabeçalho (data e/ou observação)
  const patch: any = {};
  if (body?.data !== undefined) {
    if (!isISO(body.data)) return NextResponse.json({ success: false, error: 'data (AAAA-MM-DD) inválida' }, { status: 400 });
    patch.data = body.data;
  }
  if (body?.observacao !== undefined) patch.observacao = body.observacao ? String(body.observacao).trim() : null;
  if (body?.secao !== undefined) {
    patch.secao = body.secao === 'Bar' || body.secao === 'Cozinha' ? body.secao : null;
  }
  if (body?.responsavel_id !== undefined) patch.responsavel_id = Number(body.responsavel_id) || null;
  if (Object.keys(patch).length > 0) {
    const { error } = await ops(supabase).from('desperdicio_registro').update(patch).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Se veio itens[] no body, SUBSTITUI o conjunto de itens (delete + insert) — trigger sincroniza.
  if (body?.itens !== undefined) {
    let itens: Item[];
    try {
      itens = await expandirItens(supabase, bar_id, validarItens(body.itens));
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e?.message || 'Falha ao expandir a ficha' }, { status: 400 });
    }
    if (itens.length === 0) return NextResponse.json({ success: false, error: 'Pelo menos 1 item obrigatório' }, { status: 400 });
    const { error: errDel } = await ops(supabase).from('desperdicio_registro_item').delete().eq('registro_id', id);
    if (errDel) return NextResponse.json({ success: false, error: errDel.message }, { status: 500 });
    const { error: errIns } = await ops(supabase).from('desperdicio_registro_item').insert(itens.map((i) => ({ registro_id: id, ...i })));
    if (errIns) return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
  }

  // Se veio fotos[] no body, SUBSTITUI o conjunto de fotos.
  if (body?.fotos !== undefined) {
    const fotos = validarFotos(body.fotos);
    if (fotos.length === 0) return NextResponse.json({ success: false, error: 'Pelo menos 1 foto obrigatória' }, { status: 400 });
    await ops(supabase).from('desperdicio_registro_foto').delete().eq('registro_id', id);
    const { error: errIns } = await ops(supabase).from('desperdicio_registro_foto').insert(fotos.map((f) => ({ registro_id: id, ...f })));
    if (errIns) return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { supabase, bar_id } = c;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const { data: existente } = await ops(supabase).from('desperdicio_registro')
    .select('id, bar_id').eq('id', id).single();
  if (!existente || existente.bar_id !== bar_id) return NextResponse.json({ success: false, error: 'registro não encontrado' }, { status: 404 });

  const { error } = await ops(supabase).from('desperdicio_registro').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
