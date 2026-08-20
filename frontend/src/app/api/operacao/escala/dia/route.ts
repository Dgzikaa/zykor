import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { equipeDoUsuario } from '@/lib/rh/equipe';
import { salvarCheckin } from '@/lib/rh/checkin';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * VISÃO DIA da Escala da Operação — quem está escalado hoje e o check do líder.
 *
 * Substitui a aba Check-ins que morava no RH. Duas diferenças que importam:
 *  - lê a escala da OPERAÇÃO (operations.v_escala_checkin_dia), não a hr.escalas do Tangerino,
 *    que marcava ~50 escalados por dia num bar de 56 ativos;
 *  - salva em LOTE, quando o líder aperta Salvar, em vez de um POST por clique.
 *
 * O escopo é o mesmo da visão Semana: a árvore de cadeiras abaixo de quem está logado.
 */

// GET ?data=AAAA-MM-DD
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const data = new URL(request.url).searchParams.get('data') || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data inválida (AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();
  const [{ data: linhas, error }, equipe] = await Promise.all([
    (c as any).schema('operations').from('v_escala_checkin_dia')
      .select('*').eq('bar_id', user.bar_id).eq('data', data).order('nome'),
    equipeDoUsuario(c, user),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todas = (linhas || []) as any[];
  const lista = equipe.ids ? todas.filter((l) => equipe.ids!.has(l.funcionario_id)) : todas;

  /**
   * QUEM É O LÍDER DIRETO de cada pessoa — pra tela agrupar o dia por líder (pedido do Rodrigo,
   * 20/08/2026: no Ordinário são 56 pessoas e a lista corrida não se lê).
   *
   * Sai do organograma, do mesmo jeito que o escopo de visão: a cadeira da pessoa aponta a
   * cadeira do chefe, e o líder é quem ocupa essa cadeira. Cadeira de chefia VAGA não inventa
   * líder — a pessoa cai em "Sem líder direto", que é a verdade e ainda serve de alerta.
   */
  const { data: ocupacoes } = await (c as any).schema('hr').from('cadeira_ocupacao')
    .select('funcionario_id, cadeira_id, cadeiras!inner(id, bar_id, ativa, cadeira_chefe_id)')
    .is('fim', null).eq('cadeiras.bar_id', user.bar_id).eq('cadeiras.ativa', true);

  const ocupanteDaCadeira = new Map<string, number>();
  const chefeDaPessoa = new Map<number, string | null>();
  for (const o of ((ocupacoes || []) as any[])) {
    ocupanteDaCadeira.set(String(o.cadeira_id), o.funcionario_id);
    chefeDaPessoa.set(o.funcionario_id, o.cadeiras?.cadeira_chefe_id ?? null);
  }

  const idsLideres = new Set<number>();
  for (const [, cadeiraChefe] of chefeDaPessoa) {
    const id = cadeiraChefe ? ocupanteDaCadeira.get(String(cadeiraChefe)) : undefined;
    if (id) idsLideres.add(id);
  }
  const nomeDoLider = new Map<number, string>();
  if (idsLideres.size) {
    const { data: nomes } = await (c as any).schema('hr').from('funcionarios')
      .select('id, nome').in('id', [...idsLideres]);
    for (const n of ((nomes || []) as any[])) nomeDoLider.set(n.id, n.nome);
  }
  const liderDe = (fid: number) => {
    const cadeiraChefe = chefeDaPessoa.get(fid);
    const idChefe = cadeiraChefe ? ocupanteDaCadeira.get(String(cadeiraChefe)) : undefined;
    // o topo do organograma não tem chefe: fica no próprio grupo, não em "sem líder"
    if (!idChefe) return { lider_id: null as number | null, lider_nome: null as string | null };
    return { lider_id: idChefe, lider_nome: nomeDoLider.get(idChefe) ?? null };
  };

  // sugestão: o que o ponto diz, traduzido para as opções que o líder tem. Quem não bate ponto
  // (PJ, liderança) não gera sugestão — some do ponto seria falta, e não é.
  const comSugestao = lista.map((l) => ({
    ...liderDe(l.funcionario_id),
    ...l,
    sugestao: l.ponto_situacao === 'ok' ? 'ok'
      : l.ponto_situacao === 'atraso' ? 'ok_atraso'
      : l.ponto_situacao === 'falta' ? 'falta'
      : null,
  }));

  /**
   * Quem o líder pode ADICIONAR no dia: a equipe dele (ou a casa toda) menos quem já está na
   * lista. Serve pro caso que o Rodrigo levantou — "se tiver sem escala feita o líder pode
   * adicionar e marcar que a pessoa foi". A grade semanal não aceita mais nome digitado, então
   * este é o caminho pra registrar quem apareceu sem estar planejado.
   */
  const jaNoDia = new Set(comSugestao.map((l) => l.funcionario_id));
  const { data: ocupantes } = await (c as any).schema('hr')
    .from('cadeira_ocupacao')
    .select('funcionario_id, fim, cadeiras!inner(bar_id, ativa), funcionarios!inner(id, nome, ativo)')
    .is('fim', null)
    .eq('cadeiras.bar_id', user.bar_id).eq('cadeiras.ativa', true)
    .eq('funcionarios.ativo', true);

  const elegiveis = ((ocupantes || []) as any[])
    .filter((o) => !jaNoDia.has(o.funcionario_id))
    .filter((o) => !equipe.ids || equipe.ids.has(o.funcionario_id))
    .map((o) => ({ id: o.funcionario_id, nome: o.funcionarios?.nome as string }))
    .filter((e) => !!e.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return NextResponse.json({
    data,
    linhas: comSugestao,
    elegiveis,
    equipe_de: equipe.lider,
    resumo: {
      escalados: comSugestao.length,
      marcados: comSugestao.filter((l) => l.checkin_status).length,
      pendentes: comSugestao.filter((l) => !l.checkin_status).length,
      faltas: comSugestao.filter((l) => l.checkin_status === 'falta').length,
    },
  });
}

/**
 * POST — salva o lote do dia. body: { data, marcacoes: [{ funcionario_id, status, observacao? }] }
 *
 * Em lote porque o líder revisa a lista inteira e só aperta Salvar no fim; e porque a maioria
 * das linhas já vem certa pela sugestão do ponto, então salvar a cada toque seria pedir dezenas
 * de requisições pra registrar duas correções.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const data = String(body.data || '').slice(0, 10);
  const marcacoes = Array.isArray(body.marcacoes) ? body.marcacoes : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'data inválida (AAAA-MM-DD)' }, { status: 400 });
  }
  const c = sb();
  const equipe = await equipeDoUsuario(c, user);

  /**
   * Adiciona alguém NO DIA que não estava escalado. A linha nasce com origem 'fora_escala',
   * pra depois dar pra separar quem foi planejado de quem apareceu.
   *
   * A função da linha sai do CARGO da cadeira (hr.cargos.funcao_escala_id) — a mesma regra do
   * "Puxar do organograma". Quem não tem cadeira nem aparece na lista de elegíveis.
   */
  if (body.acao === 'adicionar') {
    const fid = Number(body.funcionario_id);
    if (!fid) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });
    if (equipe.ids && !equipe.ids.has(fid)) {
      return NextResponse.json({ error: 'Essa pessoa não está na sua equipe.' }, { status: 403 });
    }
    const ops = (c as any).schema('operations');
    const { data: pessoa } = await (c as any).schema('hr').from('funcionarios')
      .select('id, nome').eq('id', fid).eq('bar_id', user.bar_id).maybeSingle();
    if (!pessoa) return NextResponse.json({ error: 'Funcionário não encontrado neste bar' }, { status: 404 });

    const { data: cad } = await (c as any).schema('hr').from('cadeira_ocupacao')
      .select('funcionario_id, cadeiras!inner(bar_id, ativa, cargos:cargo_id(funcao_escala_id))')
      .is('fim', null).eq('funcionario_id', fid)
      .eq('cadeiras.bar_id', user.bar_id).eq('cadeiras.ativa', true).maybeSingle();
    const funcaoId = (cad as any)?.cadeiras?.cargos?.funcao_escala_id;
    if (!funcaoId) {
      return NextResponse.json(
        { error: `${pessoa.nome} não tem cargo ligado a uma função da escala — ajuste no Organograma.` },
        { status: 400 },
      );
    }

    const { data: usados } = await ops.from('escala_dia').select('slot')
      .eq('bar_id', user.bar_id).eq('funcao_id', funcaoId)
      .order('slot', { ascending: false }).limit(1);
    const slot = ((usados?.[0]?.slot as number) ?? 0) + 1;

    const { error: errIns } = await ops.from('escala_dia').insert({
      bar_id: user.bar_id, data, funcao_id: funcaoId, slot,
      pessoa_nome: String(pessoa.nome).toUpperCase(), funcionario_id: fid,
      turno: 'unico', origem: 'fora_escala',
    });
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 });
    return NextResponse.json({ success: true, adicionado: pessoa.nome });
  }

  if (!marcacoes.length) return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 });

  const erros: string[] = [];
  let gravados = 0;
  for (const m of marcacoes) {
    const fid = Number(m?.funcionario_id);
    // trava no SERVIDOR: sem isto bastaria mandar outro funcionario_id na requisição pra
    // marcar falta em gente de outra equipe.
    if (equipe.ids && !equipe.ids.has(fid)) {
      erros.push(`funcionário ${fid} não é da sua equipe`);
      continue;
    }
    const r = await salvarCheckin(c, user, {
      funcionario_id: fid, data, status: String(m?.status || ''), observacao: m?.observacao ?? null,
    });
    if (r.ok) gravados++; else erros.push(r.erro);
  }

  // Parcial NÃO é sucesso silencioso: o líder precisa saber que 2 das 12 não entraram.
  return NextResponse.json({
    success: erros.length === 0,
    gravados,
    erros,
  }, { status: erros.length && !gravados ? 400 : 200 });
}
