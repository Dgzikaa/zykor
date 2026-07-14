import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Execução de produção (cronômetro). Grava uma instância de execução de uma ficha
 * (public.producao_base) em operations.producao_execucao + N operations.producao_execucao_insumo.
 *
 * O custo é snapshotado no momento do save a partir do `preco_un` que a tela já recebeu de
 * GET /api/operacional/producoes/ficha (cascata VMarket → planilha). Não recalcula o motor de custo.
 */

const round = (n: number, casas = 4) => {
  const f = Math.pow(10, casas);
  return Math.round((Number(n) || 0) * f) / f;
};

// NOTA: auditoria de exclusão/edição de execução agora é automática via trigger genérico
// (system.fn_audit) nas tabelas operations.producao_execucao/_insumo — não há mais gancho
// app-level aqui (evita duplo log). Ver project_audit_trail_acoes_usuario.

// Snapshot de custo/desvio por insumo (usado no POST e no PUT/editar). O custo já vem
// precificado da tela (preco_un da cascata VMarket→planilha); aqui só multiplica e agrega.
function computarExecucao(insumos: any[]) {
  let custoPlanejado = 0;
  let custoReal = 0;
  const desvios: number[] = [];
  const linhas = (Array.isArray(insumos) ? insumos : []).map((i) => {
    const precoUn = Number(i.preco_un) || 0;
    const qtdPlan = i.qtd_planejada != null ? Number(i.qtd_planejada) : null;
    const qtdCalc = i.qtd_calculada != null ? Number(i.qtd_calculada) : qtdPlan;
    const qtdReal = i.qtd_real != null ? Number(i.qtd_real) : null;
    const base = qtdCalc; // referência da execução = quantidade calculada (proporção do mestre)
    const cPlan = base != null ? base * precoUn : 0;
    const cReal = qtdReal != null ? qtdReal * precoUn : 0;
    custoPlanejado += cPlan;
    custoReal += cReal;
    let desvioPct: number | null = null;
    if (base != null && base > 0 && qtdReal != null) {
      desvioPct = round((qtdReal - base) / base, 4);
      desvios.push(Math.abs(desvioPct));
    }
    return {
      insumo_codigo: i.insumo_codigo ?? null,
      insumo_id_vmarket: i.insumo_id_vmarket != null ? Number(i.insumo_id_vmarket) : null,
      nome: i.nome ?? null,
      is_mestre: !!i.is_mestre,
      qtd_planejada: qtdPlan,
      qtd_calculada: qtdCalc,
      qtd_real: qtdReal,
      unidade: i.unidade ?? null,
      preco_un: precoUn,
      custo_planejado: round(cPlan, 4),
      custo_real: round(cReal, 4),
      desvio_pct: desvioPct,
    };
  });
  // aderência = 100 - desvio médio absoluto (clamp 0..100)
  const aderenciaPct = desvios.length
    ? Math.max(0, round(100 - (desvios.reduce((s, d) => s + d, 0) / desvios.length) * 100, 2))
    : null;
  return { linhas, custoPlanejado, custoReal, aderenciaPct };
}

// Trava DURA anti-erro-de-preenchimento. Bloqueia SÓ o fisicamente impossível, com ~zero falso-positivo:
// NÃO usa tamanho de lote como sinal (fazer 400 pastéis de uma ficha "por 1 un" é legítimo — dá 400×).
// Erro de verdade é QUEBRA DE PROPORÇÃO por unidade trocada (kg×g), não lote grande. As heurísticas
// fuzzy (peso em tonelada, FC estranho) ficam no watchdog diário — lá é revisão, não bloqueio.
function checarMagnitudesAbsurdas(body: any): string[] {
  const erros: string[] = [];
  const pm = body.peso_mestre_real != null ? Number(body.peso_mestre_real) : null;
  const pb = body.peso_bruto != null ? Number(body.peso_bruto) : null;
  const rReal = body.rendimento_real != null ? Number(body.rendimento_real) : null;
  const rEsp = body.rendimento_esperado != null ? Number(body.rendimento_esperado) : null;
  // 1) peso limpo (mestre) > peso bruto → impossível (não sai mais limpo do que entrou bruto)
  if (pm != null && pb != null && pm > 0 && pb > 0 && pm > pb * 1.02) {
    erros.push('O peso limpo (mestre) ficou maior que o peso bruto — confira os dois campos.');
  }
  // 2) rendimento real ≥ 50× a meta → só acontece por unidade trocada (ex.: digitar em g num campo "un").
  //    A meta já acompanha o tamanho do lote, então o rendimento nunca chega a 50× dela de verdade.
  if (rReal != null && rEsp != null && rReal > 0 && rEsp > 0 && rReal / rEsp >= 50) {
    erros.push(`O rendimento real está ${Math.round(rReal / rEsp)}× a meta — provável erro de unidade. Confira e tente de novo.`);
  }
  return erros;
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));

  const barId = Number(body.bar_id) || user.bar_id;
  const producaoId = Number(body.producao_id);
  if (!barId || !producaoId) {
    return NextResponse.json({ success: false, error: 'bar_id e producao_id obrigatórios' }, { status: 400 });
  }

  const insumos: any[] = Array.isArray(body.insumos) ? body.insumos : [];
  const absurdos = checarMagnitudesAbsurdas(body);
  if (absurdos.length) return NextResponse.json({ success: false, error: absurdos.join(' ') }, { status: 400 });
  const { linhas, custoPlanejado, custoReal, aderenciaPct } = computarExecucao(insumos);
  // chave de idempotência gerada no cliente (1 por instância de execução) — o unique index
  // (bar_id, idempotencia_key) faz duplo/triplo submit colidir no banco em vez de duplicar.
  const idemKey = typeof body.idempotencia_key === 'string' && body.idempotencia_key.trim()
    ? body.idempotencia_key.trim().slice(0, 80) : null;

  const supabase = await getAdminClient();

  // fallback idempotente pela chave (também cobre o retry que chega DEPOIS do 1º já ter inserido)
  if (idemKey) {
    const { data: jaTem } = await (supabase as any)
      .schema('operations').from('producao_execucao')
      .select('id, custo_planejado, custo_real, aderencia_pct')
      .eq('bar_id', barId).eq('idempotencia_key', idemKey).maybeSingle();
    if (jaTem) {
      return NextResponse.json({
        success: true, execucao_id: jaTem.id,
        custo_planejado: Number(jaTem.custo_planejado ?? round(custoPlanejado, 2)),
        custo_real: Number(jaTem.custo_real ?? round(custoReal, 2)),
        aderencia_pct: jaTem.aderencia_pct ?? aderenciaPct, duplicada: true,
      });
    }
  }

  // IDEMPOTÊNCIA (anti duplo/triplo submit): o "Finalizar" pode disparar 2-3x em rede lenta
  // (cozinha), cada chamada recalcula inicio/fim com new Date() — então só o timestamp muda.
  // Deduplica pela chave estável (bar+ficha+responsável+duração+rendimento) numa janela curta:
  // se já existe uma execução idêntica nos últimos 5 min, devolve ELA (sucesso idempotente) em
  // vez de inserir de novo. Guard em memória no cliente sempre vaza (ver incidente PIX 3x).
  const durSeg = body.duracao_seg != null ? Math.round(Number(body.duracao_seg)) : null;
  const rendReal = body.rendimento_real != null ? Number(body.rendimento_real) : null;
  const respId = body.responsavel_id != null ? Number(body.responsavel_id) : null;
  const janelaIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentes } = await (supabase as any)
    .schema('operations')
    .from('producao_execucao')
    .select('id, responsavel_id, duracao_seg, rendimento_real')
    .eq('bar_id', barId)
    .eq('producao_id', producaoId)
    .gte('criado_em', janelaIso)
    .order('criado_em', { ascending: false })
    .limit(20);
  const dup = (recentes || []).find((e: any) =>
    (e.duracao_seg ?? null) === durSeg &&
    (e.rendimento_real == null ? null : Number(e.rendimento_real)) === rendReal &&
    (e.responsavel_id ?? null) === respId
  );
  if (dup) {
    return NextResponse.json({
      success: true,
      execucao_id: dup.id,
      custo_planejado: round(custoPlanejado, 2),
      custo_real: round(custoReal, 2),
      aderencia_pct: aderenciaPct,
      duplicada: true,
    });
  }

  const { data: exec, error: errExec } = await (supabase as any)
    .schema('operations')
    .from('producao_execucao')
    .insert({
      bar_id: barId,
      producao_id: producaoId,
      responsavel_id: body.responsavel_id != null ? Number(body.responsavel_id) : null,
      responsavel_nome: body.responsavel_nome ?? null,
      inicio: body.inicio ?? null,
      fim: body.fim ?? null,
      duracao_seg: body.duracao_seg != null ? Math.round(Number(body.duracao_seg)) : null,
      rendimento_esperado: body.rendimento_esperado != null ? Number(body.rendimento_esperado) : null,
      rendimento_real: body.rendimento_real != null ? Number(body.rendimento_real) : null,
      custo_planejado: round(custoPlanejado, 4),
      custo_real: round(custoReal, 4),
      aderencia_pct: aderenciaPct,
      peso_mestre_real: body.peso_mestre_real != null ? Number(body.peso_mestre_real) : null,
      peso_bruto: body.peso_bruto != null ? Number(body.peso_bruto) : null,
      status: body.status ? String(body.status) : 'finalizada',
      observacao: body.observacao ? String(body.observacao) : null,
      idempotencia_key: idemKey,
      criado_por: user.email ?? user.nome ?? null,
    })
    .select('id')
    .single();
  if (errExec) {
    // colisão do unique index = duplo submit concorrente (a corrida que o pré-check não pega).
    // Devolve a execução que venceu, como sucesso idempotente, em vez de erro/duplicata.
    if ((errExec.code === '23505') && idemKey) {
      const { data: venceu } = await (supabase as any)
        .schema('operations').from('producao_execucao')
        .select('id, custo_planejado, custo_real, aderencia_pct')
        .eq('bar_id', barId).eq('idempotencia_key', idemKey).maybeSingle();
      if (venceu) {
        return NextResponse.json({
          success: true, execucao_id: venceu.id,
          custo_planejado: Number(venceu.custo_planejado ?? round(custoPlanejado, 2)),
          custo_real: Number(venceu.custo_real ?? round(custoReal, 2)),
          aderencia_pct: venceu.aderencia_pct ?? aderenciaPct, duplicada: true,
        });
      }
    }
    return NextResponse.json({ success: false, error: errExec.message }, { status: 500 });
  }

  if (linhas.length) {
    const payload = linhas.map((l) => ({ ...l, execucao_id: exec.id }));
    const { error: errIns } = await (supabase as any)
      .schema('operations')
      .from('producao_execucao_insumo')
      .insert(payload);
    if (errIns) {
      // rollback manual da execução órfã
      await (supabase as any).schema('operations').from('producao_execucao').delete().eq('id', exec.id);
      return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
    }
  }

  // Finalizou → o rascunho de autosave dessa instância não é mais necessário (backstop caso o
  // DELETE do cliente não chegue). Best-effort: falha aqui nunca quebra o registro da produção.
  if (idemKey) {
    try {
      await (supabase as any).schema('operations').from('producao_execucao_rascunho')
        .delete().eq('bar_id', barId).eq('idempotencia_key', idemKey);
    } catch (e) { console.error('[rascunho] limpeza pós-finalização falhou:', e); }
  }

  // Notifica os interessados conforme a regra do bar (Central de Notificações).
  // Best-effort: qualquer erro é engolido — NUNCA quebra o registro da produção.
  try {
    const { dispatchNotification } = await import('@/lib/notifications/dispatch');
    const nomeResp = body.responsavel_nome || user.nome || user.email || 'A equipe';

    // "Fora do planejamento": existe plano ENCERRADO cobrindo hoje, mas esta produção não
    // está entre as planejadas (decidido_receitas > 0). Sem plano cobrindo a data → não marca
    // (mesma regra da tela de Produções: só marca fora-do-plano dentro da janela do plano).
    let foraDoPlano = false;
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const seisAtras = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
      const { data: planos } = await (supabase as any)
        .schema('operations')
        .from('producao_plano')
        .select('id')
        .eq('bar_id', barId)
        .eq('status', 'encerrado')
        .lte('semana_ini', hoje)
        .gte('semana_ini', seisAtras)
        .order('semana_ini', { ascending: false })
        .limit(1);
      const planoId = planos?.[0]?.id;
      if (planoId) {
        const { data: itens } = await (supabase as any)
          .schema('operations')
          .from('producao_plano_item')
          .select('producao_id')
          .eq('plano_id', planoId)
          .gt('decidido_receitas', 0);
        const planejadas = new Set((itens || []).map((i: any) => Number(i.producao_id)));
        foraDoPlano = !planejadas.has(Number(producaoId));
      }
    } catch (e) {
      console.error('[notif] check fora-do-plano falhou (segue como producao_criada):', e);
    }

    await dispatchNotification({
      barId,
      eventKey: foraDoPlano ? 'producao_fora_planejamento' : 'producao_criada',
      titulo: foraDoPlano ? 'Produção fora do planejamento' : 'Novo controle de produção',
      mensagem: foraDoPlano
        ? `${nomeResp} iniciou uma produção que não estava no planejamento da semana.`
        : `${nomeResp} registrou uma produção` +
          (aderenciaPct != null ? ` (aderência ${aderenciaPct}%).` : '.'),
      url: '/operacional/producoes',
      dados: {
        execucao_id: exec.id,
        producao_id: producaoId,
        responsavel_nome: nomeResp,
        fora_do_plano: foraDoPlano,
      },
    });
  } catch (e) {
    console.error('[notif] dispatch producao falhou:', e);
  }

  return NextResponse.json({
    success: true,
    execucao_id: exec.id,
    custo_planejado: round(custoPlanejado, 2),
    custo_real: round(custoReal, 2),
    aderencia_pct: aderenciaPct,
  });
}

/**
 * PUT — edita uma execução existente (permissão 'editar' no módulo Controle de Produção). Recomputa custo/aderência a partir das
 * linhas enviadas (mesma lógica do POST) e substitui os insumos. Usado pelo modal de edição
 * rápida do histórico pra corrigir lançamento errado (ex.: peso mestre em unidade trocada)
 * sem perder o registro. Não mexe em inicio/fim salvo se vierem no body.
 */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Escrita gateada pelo módulo da rota (negarPorRota → 'editar' em producao - cmv_controle_de_producao).
  // Antes exigia role admin; agora respeita a config do usuário (admin continua passando).
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));
  const execId = Number(body.execucao_id);
  const barId = Number(body.bar_id) || user.bar_id;
  if (!execId || !barId) return NextResponse.json({ success: false, error: 'execucao_id e bar_id obrigatórios' }, { status: 400 });

  const absurdos = checarMagnitudesAbsurdas(body);
  if (absurdos.length) return NextResponse.json({ success: false, error: absurdos.join(' ') }, { status: 400 });

  const supabase = await getAdminClient();
  // confirma que a execução é do bar (o antes/depois da edição fica no trigger de auditoria)
  const { data: alvo } = await (supabase as any)
    .schema('operations').from('producao_execucao')
    .select('id').eq('id', execId).eq('bar_id', barId).maybeSingle();
  if (!alvo) return NextResponse.json({ success: false, error: 'Execução não encontrada neste bar' }, { status: 404 });

  const { linhas, custoPlanejado, custoReal, aderenciaPct } = computarExecucao(Array.isArray(body.insumos) ? body.insumos : []);

  const patch: any = {}; // producao_execucao não tem coluna de updated_at (só criado_em)
  if ('responsavel_id' in body) patch.responsavel_id = body.responsavel_id != null ? Number(body.responsavel_id) : null;
  if ('responsavel_nome' in body) patch.responsavel_nome = body.responsavel_nome ?? null;
  if ('duracao_seg' in body) patch.duracao_seg = body.duracao_seg != null ? Math.round(Number(body.duracao_seg)) : null;
  if ('rendimento_esperado' in body) patch.rendimento_esperado = body.rendimento_esperado != null ? Number(body.rendimento_esperado) : null;
  if ('rendimento_real' in body) patch.rendimento_real = body.rendimento_real != null ? Number(body.rendimento_real) : null;
  if ('peso_mestre_real' in body) patch.peso_mestre_real = body.peso_mestre_real != null ? Number(body.peso_mestre_real) : null;
  if ('peso_bruto' in body) patch.peso_bruto = body.peso_bruto != null ? Number(body.peso_bruto) : null;
  if ('observacao' in body) patch.observacao = body.observacao ? String(body.observacao) : null;
  patch.custo_planejado = round(custoPlanejado, 4);
  patch.custo_real = round(custoReal, 4);
  patch.aderencia_pct = aderenciaPct;

  const { error: errUpd } = await (supabase as any)
    .schema('operations').from('producao_execucao').update(patch).eq('id', execId).eq('bar_id', barId);
  if (errUpd) return NextResponse.json({ success: false, error: errUpd.message }, { status: 500 });

  // substitui os insumos (apaga + reinsere)
  await (supabase as any).schema('operations').from('producao_execucao_insumo').delete().eq('execucao_id', execId);
  if (linhas.length) {
    const ins = linhas.map((l) => ({ ...l, execucao_id: execId }));
    const { error: errIns } = await (supabase as any).schema('operations').from('producao_execucao_insumo').insert(ins);
    if (errIns) return NextResponse.json({ success: false, error: errIns.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true, execucao_id: execId,
    custo_planejado: round(custoPlanejado, 2), custo_real: round(custoReal, 2), aderencia_pct: aderenciaPct,
  });
}

/**
 * DELETE ?id=&bar_id= — remove uma execução do histórico (permissão 'excluir' no módulo Controle de Produção). Usado pra corrigir
 * lançamentos errados/duplicados (ex.: duplo submit). Apaga os insumos e a execução.
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  // Escrita gateada pelo módulo da rota (negarPorRota → 'excluir' em producao - cmv_controle_de_producao).
  // Antes exigia role admin; agora respeita a config do usuário (admin continua passando).
  const nega = negarPorRota(user, request); if (nega) return nega;
  const sp = new URL(request.url).searchParams;
  const id = Number(sp.get('id'));
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!id || !barId) return NextResponse.json({ success: false, error: 'id e bar_id obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  // confirma que a execução é do bar antes de apagar (evita excluir de outro bar por id solto).
  // o que foi apagado fica registrado automaticamente pelo trigger de auditoria (old_values).
  const { data: alvo } = await (supabase as any)
    .schema('operations').from('producao_execucao')
    .select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  if (!alvo) return NextResponse.json({ success: false, error: 'Execução não encontrada neste bar' }, { status: 404 });

  await (supabase as any).schema('operations').from('producao_execucao_insumo').delete().eq('execucao_id', id);
  const { error } = await (supabase as any).schema('operations').from('producao_execucao').delete().eq('id', id).eq('bar_id', barId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, deleted_id: id });
}

/**
 * Histórico + análise. Filtros: bar_id (obrigatório), producao_id, responsavel_id, de, ate.
 * Retorna execuções (com nome/código da ficha) + baselines por ficha (tempo/custo médios, contagem).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();

  // detalhe de UMA execução: insumos consumidos
  const execId = sp.get('execucao_id');
  if (execId) {
    const { data: insumos, error: errDet } = await (supabase as any)
      .schema('operations')
      .from('producao_execucao_insumo')
      .select('*')
      .eq('execucao_id', Number(execId))
      .order('is_mestre', { ascending: false })
      .order('id', { ascending: true });
    if (errDet) return NextResponse.json({ success: false, error: errDet.message }, { status: 500 });
    return NextResponse.json({ success: true, insumos: insumos || [] });
  }

  let q = (supabase as any)
    .schema('operations')
    .from('producao_execucao')
    .select('*')
    .eq('bar_id', barId)
    .order('criado_em', { ascending: false })
    .limit(500);
  if (sp.get('producao_id')) q = q.eq('producao_id', Number(sp.get('producao_id')));
  if (sp.get('responsavel_id')) q = q.eq('responsavel_id', Number(sp.get('responsavel_id')));
  if (sp.get('de')) q = q.gte('criado_em', sp.get('de'));
  if (sp.get('ate')) q = q.lte('criado_em', sp.get('ate'));

  const { data: execs, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const execucoes = execs || [];

  // nome/código/unidade/tempo_meta da ficha por producao_id
  const prodIds = Array.from(new Set(execucoes.map((e: any) => e.producao_id)));
  const fichaMap = new Map<number, any>();
  const fcEspMap = new Map<number, number>(); // FC esperado da ficha (mestre) por produção
  if (prodIds.length) {
    const { data: bases } = await supabase
      .from('producao_base')
      .select('id, codigo, nome, unidade, secao, rendimento, tempo_meta_seg')
      .in('id', prodIds);
    (bases || []).forEach((b: any) => fichaMap.set(b.id, b));
    // FC esperado = fator_correcao do insumo mestre na ficha da produção
    const { data: mestres } = await supabase
      .from('producao_ficha_item')
      .select('producao_id, fator_correcao')
      .in('producao_id', prodIds).eq('is_mestre', true);
    for (const m of (mestres || []) as any[]) {
      const fc = Number(m.fator_correcao);
      // inclui FC esperado mesmo quando 1 (= ficha espera 0% de perda): se o realizado vier < 1 fica vermelho.
      if (m.producao_id && fc > 0) fcEspMap.set(m.producao_id, fc);
    }
  }

  // baselines por ficha: tempo médio (benchmark), custo médio, aderência média, contagem
  const agg = new Map<number, { n: number; somaTempo: number; nTempo: number; somaCusto: number; nCusto: number; somaAder: number; nAder: number }>();
  for (const e of execucoes) {
    const a = agg.get(e.producao_id) || { n: 0, somaTempo: 0, nTempo: 0, somaCusto: 0, nCusto: 0, somaAder: 0, nAder: 0 };
    a.n += 1;
    if (e.duracao_seg != null) { a.somaTempo += Number(e.duracao_seg); a.nTempo += 1; }
    if (e.custo_real != null) { a.somaCusto += Number(e.custo_real); a.nCusto += 1; }
    if (e.aderencia_pct != null) { a.somaAder += Number(e.aderencia_pct); a.nAder += 1; }
    agg.set(e.producao_id, a);
  }
  const baselines: Record<number, any> = {};
  agg.forEach((a, pid) => {
    baselines[pid] = {
      execucoes: a.n,
      tempo_medio_seg: a.nTempo ? Math.round(a.somaTempo / a.nTempo) : null,
      custo_medio: a.nCusto ? round(a.somaCusto / a.nCusto, 2) : null,
      aderencia_media: a.nAder ? round(a.somaAder / a.nAder, 1) : null,
      tempo_meta_seg: fichaMap.get(pid)?.tempo_meta_seg ?? null,
    };
  });

  const lista = execucoes.map((e: any) => {
    const f = fichaMap.get(e.producao_id);
    return {
      ...e,
      producao_codigo: f?.codigo ?? null,
      producao_nome: f?.nome ?? null,
      producao_unidade: f?.unidade ?? null,
      producao_secao: f?.secao ?? null,
      // rendimento base da ficha (por 1 receita) — divisor p/ converter rendimento_real em nº de
      // receitas no Planejado × Realizado (ex.: 13,6kg ÷ 3,72 = ~4 receitas), no lugar de contar execuções.
      producao_rendimento: f?.rendimento != null ? Number(f.rendimento) : null,
      tempo_meta_seg: f?.tempo_meta_seg ?? null,
      fc_esperado: fcEspMap.get(e.producao_id) ?? null,
    };
  });

  return NextResponse.json({ success: true, execucoes: lista, baselines });
}
