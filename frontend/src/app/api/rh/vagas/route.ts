import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Recrutamento amarrado à cadeira (ata de RH de 13/08/2026).
 *
 * "SE TODAS AS CADEIRAS DAQUELE CARGO ESTÃO OCUPADAS, O ZYKOR EXIGE APROVAÇÃO PRA ABRIR CADEIRA
 * NOVA (HEADCOUNT)."
 *
 * Quem decide não é o líder que pediu: o servidor olha o quadro. Existe cadeira vaga do cargo?
 * A vaga nasce colada nela e ninguém aprova nada. Não existe? A vaga nasce SEM cadeira, pendente
 * de headcount — e a cadeira só passa a existir quando alguém aprova.
 */

const STATUS = ['aberta', 'pausada', 'fechada'];

const diasDesde = (iso: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;

/** GET -> vagas + quadro vago (cadeiras sem ocupante) + cargos, para montar o pedido. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const [vagasRes, quadroRes, cargosRes, areasRes] = await Promise.all([
    hr('vagas').select('*').eq('bar_id', user.bar_id).order('criado_em', { ascending: false }),
    hr('v_cadeiras_vagas').select('*').eq('bar_id', user.bar_id),
    hr('cargos').select('id, nome, area_id').eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
    hr('areas').select('id, nome').eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
  ]);
  if (vagasRes.error) return NextResponse.json({ success: false, error: vagasRes.error.message }, { status: 500 });

  const vagas = vagasRes.data || [];
  const quadro = quadroRes.data || [];
  const cadeiraPorId = new Map<string, any>(quadro.map((q: any) => [q.cadeira_id, q]));

  const ids = vagas.map((v: any) => v.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: cands } = await hr('candidatos').select('vaga_id, etapa').in('vaga_id', ids);
    for (const c of cands || []) if (c.etapa !== 'reprovado') counts[c.vaga_id] = (counts[c.vaga_id] || 0) + 1;
  }

  return NextResponse.json({
    success: true,
    vagas: vagas.map((v: any) => ({
      ...v,
      candidatos: counts[v.id] || 0,
      cadeira_codigo: v.cadeira_id ? cadeiraPorId.get(v.cadeira_id)?.codigo || null : null,
      dias_aberta: v.status === 'aberta' ? diasDesde(v.criado_em) : null,
    })),
    // cadeiras vagas que ainda não viraram processo seletivo
    quadro: quadro.map((q: any) => ({ ...q, vaga_desde_dias: diasDesde(q.vaga_desde) })),
    cargos: cargosRes.data || [],
    areas: areasRes.data || [],
  });
}

/** POST -> cria pedido, aprova/recusa headcount, atualiza ou fecha. */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);
  const quem = user.nome || user.email || null;

  // --- aprovar / recusar aumento de quadro -------------------------------------------------
  if (body.action === 'aprovar_headcount' || body.action === 'recusar_headcount') {
    const { data: vaga } = await hr('vagas').select('*').eq('id', body.id).eq('bar_id', user.bar_id).maybeSingle();
    if (!vaga) return NextResponse.json({ success: false, error: 'Vaga não encontrada' }, { status: 404 });
    if (vaga.headcount_status !== 'pendente') {
      return NextResponse.json({ success: false, error: 'Esta vaga não está pendente de aprovação de quadro' }, { status: 400 });
    }

    if (body.action === 'recusar_headcount') {
      const { data, error } = await hr('vagas').update({
        headcount_status: 'recusado', headcount_por: quem, headcount_em: new Date().toISOString(),
        headcount_motivo: body.motivo || null, status: 'fechada', fechado_em: new Date().toISOString(),
      }).eq('id', vaga.id).select().single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, vaga: data });
    }

    // aprovado: a cadeira nova nasce agora — é isso que "aumentar o quadro" significa
    const { data: cargo } = await hr('cargos').select('id, nome, area_id').eq('id', vaga.cargo_id).maybeSingle();
    const base = String(cargo?.nome || vaga.titulo).toUpperCase();
    const { data: irmas } = await hr('cadeiras').select('codigo').eq('bar_id', user.bar_id).eq('cargo_id', vaga.cargo_id);
    const n = (irmas || []).length + 1;
    const codigo = n > 1 ? `${base} ${n}` : base;

    const { data: cadeira, error: e1 } = await hr('cadeiras').insert({
      bar_id: user.bar_id, codigo, cargo_id: vaga.cargo_id,
      area_id: vaga.area_id ?? cargo?.area_id ?? null, ativa: true,
      observacao: `Quadro aumentado por ${quem || 'RH'} em ${new Date().toISOString().slice(0, 10)}`,
    }).select().single();
    if (e1) return NextResponse.json({ success: false, error: e1.message }, { status: 500 });

    const { data, error } = await hr('vagas').update({
      cadeira_id: cadeira.id, headcount_status: 'aprovado', headcount_por: quem,
      headcount_em: new Date().toISOString(), headcount_motivo: body.motivo || null,
    }).eq('id', vaga.id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, vaga: data, cadeira });
  }

  // --- editar / fechar ----------------------------------------------------------------------
  if (body.id) {
    const patch: any = {};
    if (body.status && STATUS.includes(body.status)) {
      patch.status = body.status;
      if (body.status === 'fechada') patch.fechado_em = new Date().toISOString();
    }
    if (body.titulo) patch.titulo = body.titulo;
    if (body.descricao !== undefined) patch.descricao = body.descricao || null;
    const { data, error } = await hr('vagas').update(patch).eq('id', body.id).eq('bar_id', user.bar_id).select().single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, vaga: data });
  }

  // --- abrir processo seletivo --------------------------------------------------------------
  const cargoId = body.cargo_id ? Number(body.cargo_id) : null;
  if (!cargoId) return NextResponse.json({ success: false, error: 'Escolha o cargo — é ele que define a cadeira' }, { status: 400 });

  const { data: cargo } = await hr('cargos').select('id, nome, area_id').eq('id', cargoId).eq('bar_id', user.bar_id).maybeSingle();
  if (!cargo) return NextResponse.json({ success: false, error: 'Cargo não encontrado neste bar' }, { status: 404 });

  // cadeira do cargo que está vaga E ainda sem processo seletivo aberto
  const { data: livres } = await hr('v_cadeiras_vagas').select('cadeira_id, codigo, vaga_id')
    .eq('bar_id', user.bar_id).eq('cargo_id', cargoId);
  const cadeiraLivre = (livres || []).find((c: any) => !c.vaga_id) || null;
  const cadeiraPedida = body.cadeira_id ? (livres || []).find((c: any) => c.cadeira_id === body.cadeira_id && !c.vaga_id) : null;
  const alvo = cadeiraPedida || cadeiraLivre;

  const { data, error } = await hr('vagas').insert({
    bar_id: user.bar_id,
    titulo: (body.titulo || cargo.nome).trim(),
    cargo_id: cargoId,
    area_id: body.area_id ? Number(body.area_id) : cargo.area_id ?? null,
    cadeira_id: alvo?.cadeira_id ?? null,
    tipo_contratacao: body.tipo_contratacao || null,
    descricao: body.descricao || null,
    status: 'aberta',
    solicitado_por: quem,
    headcount_status: alvo ? 'nao_precisa' : 'pendente',
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    vaga: { ...data, cadeira_codigo: alvo?.codigo ?? null },
    // a UI usa isto pra explicar o que aconteceu em vez de o líder descobrir depois
    aviso: alvo
      ? `Vaga aberta na cadeira ${alvo.codigo}.`
      : 'Todas as cadeiras deste cargo estão ocupadas — o pedido ficou pendente de aprovação de quadro.',
  }, { status: 201 });
}

/** DELETE ?id= */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('vagas').delete().eq('id', id).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
