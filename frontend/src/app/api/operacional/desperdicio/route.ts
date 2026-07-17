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

type Item = { insumo_codigo: string; qtd: number; motivo?: string; observacao?: string };
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

function validarItens(itens: unknown): Item[] {
  if (!Array.isArray(itens) || itens.length === 0) return [];
  const out: Item[] = [];
  for (const raw of itens as any[]) {
    const insumo_codigo = String(raw?.insumo_codigo || '').trim();
    const qtd = Number(raw?.qtd);
    if (!insumo_codigo || !Number.isFinite(qtd) || qtd <= 0) continue;
    out.push({
      insumo_codigo,
      qtd: Math.round(qtd * 1000) / 1000,
      motivo: raw?.motivo ? String(raw.motivo).trim() : undefined,
      observacao: raw?.observacao ? String(raw.observacao).trim() : undefined,
    });
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

  // Cabeçalho + itens + fotos em 3 queries paralelas (mais simples que 1 join grande).
  const { data: registros, error: errReg } = await ops(supabase)
    .from('desperdicio_registro')
    .select('id, bar_id, data, observacao, criado_por, criado_em, atualizado_em')
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
      .select('id, registro_id, insumo_codigo, qtd, motivo, observacao').in('registro_id', ids),
    ops(supabase).from('desperdicio_registro_foto')
      .select('id, registro_id, storage_path, url, size_bytes, mime').in('registro_id', ids),
  ]);

  // Junta nome do insumo (operations.insumos) pra facilitar a UI (evita 1 lookup por item).
  const codigos = Array.from(new Set((itens || []).map((i: any) => i.insumo_codigo)));
  const nomeByCod = new Map<string, { nome: string; unidade_medida: string | null; categoria: string | null }>();
  if (codigos.length) {
    const { data: cad } = await ops(supabase).from('insumos')
      .select('codigo, nome, unidade_medida, categoria').eq('bar_id', bar_id).in('codigo', codigos);
    for (const r of (cad || []) as any[]) nomeByCod.set(r.codigo, { nome: r.nome, unidade_medida: r.unidade_medida, categoria: r.categoria });
  }

  const itensPorReg = new Map<number, any[]>();
  for (const it of (itens || []) as any[]) {
    const cad = nomeByCod.get(it.insumo_codigo);
    const enriched = { ...it, insumo_nome: cad?.nome || it.insumo_codigo, unidade: cad?.unidade_medida || 'un', categoria: cad?.categoria || null };
    const arr = itensPorReg.get(it.registro_id) || []; arr.push(enriched); itensPorReg.set(it.registro_id, arr);
  }
  const fotosPorReg = new Map<number, any[]>();
  for (const f of (fotos || []) as any[]) {
    const arr = fotosPorReg.get(f.registro_id) || []; arr.push(f); fotosPorReg.set(f.registro_id, arr);
  }

  const enriched = (registros || []).map((r: any) => ({
    ...r,
    itens: itensPorReg.get(r.id) || [],
    fotos: fotosPorReg.get(r.id) || [],
  }));

  return NextResponse.json({ success: true, registros: enriched });
}

export async function POST(request: NextRequest) {
  const c = await ctx(request); if (c.erro) return c.erro;
  const { user, supabase, bar_id } = c;
  const body = await request.json().catch(() => ({}));

  const data = String(body?.data || '');
  if (!isISO(data)) return NextResponse.json({ success: false, error: 'data (AAAA-MM-DD) obrigatória' }, { status: 400 });

  const itens = validarItens(body?.itens);
  if (itens.length === 0) return NextResponse.json({ success: false, error: 'Informe pelo menos 1 item (insumo + qtd)' }, { status: 400 });

  const fotos = validarFotos(body?.fotos);
  if (fotos.length === 0) return NextResponse.json({ success: false, error: 'Anexe pelo menos 1 foto' }, { status: 400 });

  // 1) Cabeçalho
  const { data: reg, error: errReg } = await ops(supabase).from('desperdicio_registro').insert({
    bar_id, data,
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
  if (Object.keys(patch).length > 0) {
    const { error } = await ops(supabase).from('desperdicio_registro').update(patch).eq('id', id);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Se veio itens[] no body, SUBSTITUI o conjunto de itens (delete + insert) — trigger sincroniza.
  if (body?.itens !== undefined) {
    const itens = validarItens(body.itens);
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
