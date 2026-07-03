import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarSeNaoPode } from '@/lib/permissions/guard';
import { recalcCmvFromFichaParent } from '@/lib/cmv-recalc';

export const dynamic = 'force-dynamic';

/**
 * Fichas vinculadas (réplicas). Membros de um ficha_grupo_id compartilham a receita.
 *  GET    ?tipo&id           → membros do grupo do parent (nome/código).
 *  POST   { tipo, master_id, ids } → vincula os ids num grupo e SINCRONIZA todos com a ficha do master.
 *  DELETE ?tipo&id           → desvincula o parent do grupo.
 */
const CFG = (tipo: string) => tipo === 'producao'
  ? { table: 'producao_base', parentCol: 'producao_id' as const }
  : { table: 'produto_cardapio', parentCol: 'produto_id' as const };

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const tipo = sp.get('tipo') || 'produto';
  const id = Number(sp.get('id'));
  if (!barId || !id) return NextResponse.json({ success: false, error: 'bar_id e id obrigatórios' }, { status: 400 });
  const { table } = CFG(tipo);
  const supabase = await getAdminClient();
  const { data: self } = await supabase.from(table).select('id, ficha_grupo_id').eq('id', id).maybeSingle();
  if (!self?.ficha_grupo_id) return NextResponse.json({ success: true, grupo_id: null, membros: [] });
  const { data: membros } = await supabase.from(table)
    .select('id, codigo, nome').eq('bar_id', barId).eq('ficha_grupo_id', self.ficha_grupo_id).order('nome');
  return NextResponse.json({ success: true, grupo_id: self.ficha_grupo_id, membros: membros || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, ['/operacional/fichas-tecnicas'], 'editar'); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id) || user.bar_id;
  const tipo = String(body.tipo || 'produto');
  const masterId = Number(body.master_id);
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map((x: any) => Number(x)).filter(Boolean) : [];
  if (!barId || !masterId || ids.length < 2) return NextResponse.json({ success: false, error: 'master_id e ao menos 2 ids' }, { status: 400 });
  if (!ids.includes(masterId)) ids.push(masterId);
  const { table, parentCol } = CFG(tipo);
  const supabase = await getAdminClient();

  // grupo: reaproveita o do master se já existir, senão gera novo
  const { data: masterRow } = await supabase.from(table).select('id, ficha_grupo_id, bar_id').eq('id', masterId).maybeSingle();
  if (!masterRow || masterRow.bar_id !== barId) return NextResponse.json({ success: false, error: 'master inválido' }, { status: 400 });
  let grupoId = masterRow.ficha_grupo_id as number | null;
  if (!grupoId) {
    const { data: seq } = await supabase.rpc('nextval_ficha_grupo');
    grupoId = Number(seq);
  }

  // ficha do master
  const { data: masterItens } = await supabase.from('producao_ficha_item')
    .select('componente_tipo, insumo_codigo, insumo_id_vmarket, producao_ref, nome_componente, quantidade, unidade, is_mestre, fator_correcao')
    .eq(parentCol, masterId);

  // sincroniza cada membro (≠ master): apaga a ficha dele e recria a do master
  for (const mid of ids) {
    if (mid === masterId) continue;
    await supabase.from('producao_ficha_item').delete().eq(parentCol, mid);
    if ((masterItens || []).length) {
      const payload = (masterItens || []).map((it: any) => ({ ...it, [parentCol]: mid }));
      await supabase.from('producao_ficha_item').insert(payload);
    }
  }
  // marca o grupo em todos
  const { error } = await supabase.from(table).update({ ficha_grupo_id: grupoId }).in('id', ids);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  for (const mid of ids) { try { await recalcCmvFromFichaParent(supabase, { [parentCol]: mid } as any); } catch { /* segue */ } }

  return NextResponse.json({ success: true, grupo_id: grupoId, vinculadas: ids.length });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarSeNaoPode(user, ['/operacional/fichas-tecnicas'], 'editar'); if (nega) return nega;
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const tipo = sp.get('tipo') || 'produto';
  const id = Number(sp.get('id'));
  if (!barId || !id) return NextResponse.json({ success: false, error: 'bar_id e id obrigatórios' }, { status: 400 });
  const { table } = CFG(tipo);
  const supabase = await getAdminClient();
  const { data: self } = await supabase.from(table).select('ficha_grupo_id').eq('id', id).maybeSingle();
  const grupo = self?.ficha_grupo_id;
  await supabase.from(table).update({ ficha_grupo_id: null }).eq('id', id);
  // se sobrar só 1 no grupo, desfaz o grupo (grupo de 1 não faz sentido)
  if (grupo) {
    const { data: rest } = await supabase.from(table).select('id').eq('bar_id', barId).eq('ficha_grupo_id', grupo);
    if ((rest || []).length < 2) await supabase.from(table).update({ ficha_grupo_id: null }).eq('bar_id', barId).eq('ficha_grupo_id', grupo);
  }
  return NextResponse.json({ success: true });
}
