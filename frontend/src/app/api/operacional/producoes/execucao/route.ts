import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

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

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const body = await request.json().catch(() => ({}));

  const barId = Number(body.bar_id) || user.bar_id;
  const producaoId = Number(body.producao_id);
  if (!barId || !producaoId) {
    return NextResponse.json({ success: false, error: 'bar_id e producao_id obrigatórios' }, { status: 400 });
  }

  const insumos: any[] = Array.isArray(body.insumos) ? body.insumos : [];

  // snapshots de custo/desvio por insumo
  let custoPlanejado = 0;
  let custoReal = 0;
  const desvios: number[] = [];
  const linhas = insumos.map((i) => {
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

  const supabase = await getAdminClient();

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
      criado_por: user.email ?? user.nome ?? null,
    })
    .select('id')
    .single();
  if (errExec) return NextResponse.json({ success: false, error: errExec.message }, { status: 500 });

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

  return NextResponse.json({
    success: true,
    execucao_id: exec.id,
    custo_planejado: round(custoPlanejado, 2),
    custo_real: round(custoReal, 2),
    aderencia_pct: aderenciaPct,
  });
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
      if (m.producao_id && fc > 0 && fc !== 1) fcEspMap.set(m.producao_id, fc);
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
      tempo_meta_seg: f?.tempo_meta_seg ?? null,
      fc_esperado: fcEspMap.get(e.producao_id) ?? null,
    };
  });

  return NextResponse.json({ success: true, execucoes: lista, baselines });
}
