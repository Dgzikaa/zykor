import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Organograma por CADEIRA (headcount), não por nome de pessoa.
 *
 * Ata de 13/08/2026: o chefe direto do CUMIN 1 é a cadeira CHEFE DE SALÃO 1 — não a pessoa que
 * hoje senta nela. Assim a hierarquia sobrevive à troca de gente, e cadeira sem ninguém é uma
 * VAGA de verdade, que é o que o recrutamento precisa enxergar.
 *
 * O modelo antigo (hr.funcionarios.gestor_id, pessoa -> pessoa) está deprecado; a coluna segue no
 * banco mas não é mais lida aqui.
 */

type Corpo = Record<string, any>;

async function ctx(request: NextRequest, escrita: boolean) {
  const user = await authenticateUser(request);
  if (!user) return { erro: authErrorResponse('Usuário não autenticado') };
  if (escrita) {
    const nega = negarPorRota(user, request);
    if (nega) return { erro: nega };
  }
  if (!user.bar_id) {
    return { erro: NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 }) };
  }
  const supabase = await getAdminClient();
  return { user, supabase, hr: (t: string) => (supabase as any).schema('hr').from(t) };
}

/** GET -> cadeiras do bar (com quem ocupa), quem está sem cadeira, cargos e áreas. */
export async function GET(request: NextRequest) {
  const c = await ctx(request, false);
  if (c.erro) return c.erro;
  const { user, hr } = c as any;

  const [cadRes, ocupRes, funcRes, cargosRes, areasRes] = await Promise.all([
    hr('cadeiras')
      .select('id, codigo, cargo_id, area_id, cadeira_chefe_id, ordem, observacao')
      .eq('bar_id', user.bar_id).eq('ativa', true).order('ordem'),
    hr('cadeira_ocupacao').select('cadeira_id, funcionario_id, inicio').is('fim', null),
    hr('funcionarios')
      .select('id, nome, cargo_id, area_id, foto_url, data_admissao, data_nascimento, tipo_contratacao')
      .eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
    hr('cargos').select('id, nome').eq('bar_id', user.bar_id),
    hr('areas').select('id, nome, cor').eq('bar_id', user.bar_id),
  ]);

  if (cadRes.error) return NextResponse.json({ error: cadRes.error.message }, { status: 500 });

  const cargoMap = new Map<number, string>((cargosRes.data || []).map((x: any) => [x.id, x.nome]));
  const areaMap = new Map<number, any>((areasRes.data || []).map((x: any) => [x.id, x]));
  const funcMap = new Map<number, any>((funcRes.data || []).map((f: any) => [f.id, f]));

  // ocupação só vale para gente ativa DESTE bar — a query de ocupação não filtra bar
  // (a cadeira é que pertence ao bar), então o cruzamento acontece aqui.
  const ocupPorCadeira = new Map<string, any>();
  for (const o of ocupRes.data || []) {
    if (funcMap.has(o.funcionario_id)) ocupPorCadeira.set(o.cadeira_id, o);
  }

  const cadeiras = (cadRes.data || []).map((cad: any) => {
    const ocup = ocupPorCadeira.get(cad.id);
    const pessoa = ocup ? funcMap.get(ocup.funcionario_id) : null;
    const area = cad.area_id ? areaMap.get(cad.area_id) : null;
    return {
      id: cad.id,
      codigo: cad.codigo,
      cadeira_chefe_id: cad.cadeira_chefe_id,
      ordem: cad.ordem,
      observacao: cad.observacao,
      cargo_id: cad.cargo_id,
      cargo_nome: cad.cargo_id ? cargoMap.get(cad.cargo_id) || null : null,
      area_id: cad.area_id,
      area_nome: (area as any)?.nome || null,
      area_cor: (area as any)?.cor || null,
      vaga: !pessoa,
      ocupante: pessoa ? {
        id: pessoa.id, nome: pessoa.nome, foto_url: pessoa.foto_url,
        data_admissao: pessoa.data_admissao, data_nascimento: pessoa.data_nascimento,
        tipo_contratacao: pessoa.tipo_contratacao, desde: ocup?.inicio || null,
      } : null,
    };
  });

  // Ativo que não está sentado em nenhuma cadeira — precisa aparecer, senão some da tela
  // (é o caso de quem foi cadastrado sem cargo).
  const alocados = new Set(Array.from(ocupPorCadeira.values()).map((o: any) => o.funcionario_id));
  const semCadeira = (funcRes.data || [])
    .filter((f: any) => !alocados.has(f.id))
    .map((f: any) => ({
      id: f.id, nome: f.nome, foto_url: f.foto_url,
      cargo_nome: f.cargo_id ? cargoMap.get(f.cargo_id) || null : null,
    }));

  return NextResponse.json({
    cadeiras,
    sem_cadeira: semCadeira,
    cargos: cargosRes.data || [],
    areas: areasRes.data || [],
  });
}

/** PUT -> move a cadeira na árvore. Body: { cadeira_id, cadeira_chefe_id | null } */
export async function PUT(request: NextRequest) {
  const c = await ctx(request, true);
  if (c.erro) return c.erro;
  const { user, hr } = c as any;

  const body: Corpo = await request.json().catch(() => ({}));
  const cadeiraId = String(body.cadeira_id || '');
  const chefeId = body.cadeira_chefe_id == null || body.cadeira_chefe_id === '' ? null : String(body.cadeira_chefe_id);
  if (!cadeiraId) return NextResponse.json({ error: 'cadeira_id obrigatório' }, { status: 400 });

  // as duas cadeiras têm que ser do bar da sessão — sem isso dava pra pendurar uma cadeira do
  // Ordinário sob uma do Deboche mandando o id na mão (mesmo cuidado do modelo anterior)
  const ids = chefeId ? [cadeiraId, chefeId] : [cadeiraId];
  const { data: validas } = await hr('cadeiras').select('id').eq('bar_id', user.bar_id).in('id', ids);
  if ((validas?.length || 0) !== ids.length) {
    return NextResponse.json({ error: 'Cadeira não encontrada neste bar' }, { status: 404 });
  }

  const { error } = await hr('cadeiras')
    .update({ cadeira_chefe_id: chefeId, atualizado_em: new Date().toISOString() })
    .eq('id', cadeiraId).eq('bar_id', user.bar_id);
  if (error) {
    // trg_cadeira_chefe_sem_ciclo devolve mensagem legível — repassa em vez de virar erro interno
    const ciclo = /ciclo|si mesma/i.test(error.message);
    return NextResponse.json({ error: error.message }, { status: ciclo ? 400 : 500 });
  }
  return NextResponse.json({ success: true });
}

/**
 * POST -> ações sobre cadeira. Body: { acao, ... }
 *  criar     { codigo, cargo_id?, area_id?, cadeira_chefe_id? }
 *  editar    { cadeira_id, codigo?, cargo_id?, area_id?, observacao? }
 *  alocar    { cadeira_id, funcionario_id }   -> tira a pessoa da cadeira antiga
 *  desalocar { cadeira_id, motivo? }          -> deixa a cadeira VAGA (não apaga o histórico)
 *  remover   { cadeira_id }                   -> inativa (só se estiver vaga e sem filhas)
 */
export async function POST(request: NextRequest) {
  const c = await ctx(request, true);
  if (c.erro) return c.erro;
  const { user, hr } = c as any;

  const body: Corpo = await request.json().catch(() => ({}));
  const acao = String(body.acao || '');
  const hoje = new Date().toISOString().slice(0, 10);

  const daCasa = async (cadeiraId: string) => {
    const { data } = await hr('cadeiras').select('id').eq('id', cadeiraId).eq('bar_id', user.bar_id).maybeSingle();
    return !!data;
  };

  if (acao === 'criar') {
    const codigo = String(body.codigo || '').trim().toUpperCase();
    if (!codigo) return NextResponse.json({ error: 'Nome da cadeira obrigatório' }, { status: 400 });
    const { data, error } = await hr('cadeiras').insert({
      bar_id: user.bar_id, codigo,
      cargo_id: body.cargo_id || null, area_id: body.area_id || null,
      cadeira_chefe_id: body.cadeira_chefe_id || null,
      ordem: Number(body.ordem) || 0,
    }).select().single();
    if (error) {
      const dup = /unique|duplicad/i.test(error.message);
      return NextResponse.json({ error: dup ? `Já existe uma cadeira "${codigo}" neste bar` : error.message }, { status: dup ? 409 : 500 });
    }
    return NextResponse.json({ success: true, cadeira: data });
  }

  if (acao === 'editar') {
    const cadeiraId = String(body.cadeira_id || '');
    if (!cadeiraId || !(await daCasa(cadeiraId))) return NextResponse.json({ error: 'Cadeira não encontrada neste bar' }, { status: 404 });
    const patch: Corpo = { atualizado_em: new Date().toISOString() };
    if (body.codigo !== undefined) patch.codigo = String(body.codigo).trim().toUpperCase();
    if (body.cargo_id !== undefined) patch.cargo_id = body.cargo_id || null;
    if (body.area_id !== undefined) patch.area_id = body.area_id || null;
    if (body.observacao !== undefined) patch.observacao = body.observacao || null;
    const { error } = await hr('cadeiras').update(patch).eq('id', cadeiraId).eq('bar_id', user.bar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (acao === 'alocar') {
    const cadeiraId = String(body.cadeira_id || '');
    const funcionarioId = Number(body.funcionario_id);
    if (!cadeiraId || !funcionarioId) return NextResponse.json({ error: 'cadeira_id e funcionario_id obrigatórios' }, { status: 400 });
    if (!(await daCasa(cadeiraId))) return NextResponse.json({ error: 'Cadeira não encontrada neste bar' }, { status: 404 });

    const { data: pessoa } = await hr('funcionarios').select('id').eq('id', funcionarioId).eq('bar_id', user.bar_id).eq('ativo', true).maybeSingle();
    if (!pessoa) return NextResponse.json({ error: 'Funcionário não encontrado neste bar' }, { status: 404 });

    // fecha o que estiver aberto dos dois lados antes de abrir o vínculo novo — os índices
    // parciais (uma ocupação aberta por cadeira, uma por pessoa) rejeitariam o insert senão
    await hr('cadeira_ocupacao').update({ fim: hoje, motivo_saida: 'realocação' }).eq('cadeira_id', cadeiraId).is('fim', null);
    await hr('cadeira_ocupacao').update({ fim: hoje, motivo_saida: 'realocação' }).eq('funcionario_id', funcionarioId).is('fim', null);

    const { error } = await hr('cadeira_ocupacao').insert({ cadeira_id: cadeiraId, funcionario_id: funcionarioId, inicio: hoje });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (acao === 'desalocar') {
    const cadeiraId = String(body.cadeira_id || '');
    if (!cadeiraId || !(await daCasa(cadeiraId))) return NextResponse.json({ error: 'Cadeira não encontrada neste bar' }, { status: 404 });
    const { error } = await hr('cadeira_ocupacao')
      .update({ fim: hoje, motivo_saida: body.motivo || null })
      .eq('cadeira_id', cadeiraId).is('fim', null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (acao === 'remover') {
    const cadeiraId = String(body.cadeira_id || '');
    if (!cadeiraId || !(await daCasa(cadeiraId))) return NextResponse.json({ error: 'Cadeira não encontrada neste bar' }, { status: 404 });

    // cadeira ocupada ou com subordinadas não some: sumir levaria junto a informação de quem
    // responde a quem, sem ninguém perceber
    const [{ data: ocupada }, { data: filhas }] = await Promise.all([
      hr('cadeira_ocupacao').select('id').eq('cadeira_id', cadeiraId).is('fim', null).maybeSingle(),
      hr('cadeiras').select('id').eq('cadeira_chefe_id', cadeiraId).eq('ativa', true).limit(1),
    ]);
    if (ocupada) return NextResponse.json({ error: 'Cadeira ocupada — tire a pessoa antes de remover' }, { status: 409 });
    if ((filhas?.length || 0) > 0) return NextResponse.json({ error: 'Cadeira tem subordinadas — mova-as antes de remover' }, { status: 409 });

    const { error } = await hr('cadeiras').update({ ativa: false, atualizado_em: new Date().toISOString() })
      .eq('id', cadeiraId).eq('bar_id', user.bar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: `Ação desconhecida: ${acao}` }, { status: 400 });
}
