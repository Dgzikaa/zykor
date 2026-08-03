import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const supabase = createServiceRoleClient();

function barDe(request: NextRequest, user: any): number | null {
  const h = request.headers.get('x-selected-bar-id');
  return parseInt(String(h || ''), 10) || Number(user?.bar_id) || null;
}

// normalização da mesa — DEVE bater com a do frontend/API GET
const normMesa = (m: string | null) => (m || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—';

/**
 * Vínculo de mesa (pessoa) da Consumação: liga uma mesa normalizada a um artista/sócio cadastrado
 * e/ou força a categoria (corrige classificação errada na origem). Também cria sócio no cadastro.
 *
 * POST { acao:'criar_socio', nome }                          -> cria sócio, retorna { id, nome }
 * POST { mesa, tipo, artista_id?, socio_id?, entidade_nome?, categoria_override? } -> upsert vínculo
 * DELETE { mesa }                                            -> remove o vínculo (volta pro motivo)
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  const barId = barDe(request, user);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const fin = (supabase as any).schema('financial');

  // criar sócio no cadastro
  if (body.acao === 'criar_socio') {
    const nome = String(body.nome || '').trim();
    if (!nome) return NextResponse.json({ success: false, error: 'nome obrigatório' }, { status: 400 });
    // já existe? (case-insensitive) retorna sem duplicar
    const { data: ex } = await fin.from('consumo_socio').select('id, nome').eq('bar_id', barId).ilike('nome', nome).maybeSingle();
    if (ex) return NextResponse.json({ success: true, socio: ex });
    const { data, error } = await fin.from('consumo_socio').insert({ bar_id: barId, nome, ativo: true }).select('id, nome').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, socio: data });
  }

  // upsert do vínculo de mesa
  const mesa = body.mesa == null ? null : String(body.mesa);
  const mesaNorm = normMesa(mesa);
  if (mesaNorm === '—') return NextResponse.json({ success: false, error: 'mesa obrigatória' }, { status: 400 });
  const tipo = body.tipo ? String(body.tipo) : null;

  // Reclassificar a CATEGORIA é restrito ao time financeiro (28/07/2026: é rotina dele, e a
  // trava só-admin o impedia de trabalhar). Só bloqueia quem está MUDANDO o categoria_override —
  // quem edita a tag da mesa (mesma categoria) segue liberado, como antes.
  //
  // O critério é a FERRAMENTA (módulo), não a coluna legada `role`. A versão anterior usava
  // `['admin','financeiro'].includes(user.role)` e barrava o David (financeiro@grupobizu), que
  // tem o PERFIL "Financeiro" completo mas ficou com `role='funcionario'` — o sistema migrou pra
  // RBAC por perfil e o role virou resquício.
  //
  // O comentário antigo evitava `podeFerramentaFinanceira` com medo de liberar as agências via
  // módulo genérico. Isso não vale mais: `authenticateUser` sobrescreve `modulos_permitidos` com
  // `usuarios_perfil.modulos`, e NENHUM perfil tem os genéricos `financeiro`/`financeiro_ferramentas`
  // (só existiam na coluna legada do usuário, hoje ignorada). Conferido em 03/08/2026:
  // `financeiro_conciliacao` está apenas nos perfis Financeiro e Liderança — Sócio (agências),
  // Operação, Marketing, Investidor e Administrativo NÃO têm.
  const podeReclassificar = podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.conciliacao, 'editar');
  const novaCat = body.categoria_override ? String(body.categoria_override) : null;
  if (!podeReclassificar) {
    const { data: prev } = await fin.from('consumo_mesa_vinculo')
      .select('categoria_override').eq('bar_id', barId).eq('mesa_norm', mesaNorm).maybeSingle();
    if (novaCat !== ((prev?.categoria_override as string | null) ?? null)) {
      return NextResponse.json({ success: false, error: 'Reclassificar a categoria da consumação exige a ferramenta financeira de Conciliação (perfis Financeiro ou Liderança).' }, { status: 403 });
    }
  }

  const row = {
    bar_id: barId,
    mesa_norm: mesaNorm,
    mesa_label: mesa,
    tipo,
    artista_id: body.artista_id == null || body.artista_id === '' ? null : Number(body.artista_id),
    socio_id: body.socio_id == null || body.socio_id === '' ? null : Number(body.socio_id),
    entidade_nome: body.entidade_nome ? String(body.entidade_nome) : null,
    categoria_override: body.categoria_override ? String(body.categoria_override) : null,
    updated_at: new Date().toISOString(),
    updated_by: user.email || user.nome || 'app',
  };
  const { error } = await fin.from('consumo_mesa_vinculo').upsert(row, { onConflict: 'bar_id,mesa_norm' });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, vinculo: row });
}

export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  const barId = barDe(request, user);
  const body = await request.json().catch(() => ({}));
  const mesaNorm = normMesa(body.mesa == null ? null : String(body.mesa));
  if (!barId || mesaNorm === '—') return NextResponse.json({ success: false, error: 'bar_id e mesa obrigatórios' }, { status: 400 });
  const { error } = await (supabase as any).schema('financial').from('consumo_mesa_vinculo').delete().eq('bar_id', barId).eq('mesa_norm', mesaNorm);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
