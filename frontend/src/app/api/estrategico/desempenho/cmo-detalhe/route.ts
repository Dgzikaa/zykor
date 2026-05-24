import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/estrategico/desempenho/cmo-detalhe?bar_id=3&ano=2026
 *
 * Retorna o detalhamento do CMO (Custo de Mao-de-Obra) por semana e mes,
 * decomposto em 4 linhas:
 *
 *   1) freelas        — SUM(bronze_contaazul_lancamentos) categoria ILIKE '%FREELA%'
 *                       (FREELA ATENDIMENTO, COZINHA, BAR, LIMPEZA, SEGURANCA, BRIGADISTA)
 *   2) alimentacao    — CMA Total da semana/mes (est_ini_func + compras_alim - est_fim_func)
 *                       Semanal: financial.cmv_semanal; Mensal: financial.cmv_mensal.cma_total
 *   3) equipe_fixa    — meta.cmo_manual.equipe_fixa_mensal (manual)
 *                       Visao semanal: rateio dia a dia (cada dia da semana puxa do mes
 *                       correspondente, divide por dias_no_mes)
 *   4) pro_labore     — meta.cmo_manual.pro_labore_mensal (manual, default 64000)
 *                       Mesmo rateio dia a dia
 *
 * CMO % = (freelas + alimentacao + equipe_fixa + pro_labore) / faturamento_total × 100
 */

const PRO_LABORE_DEFAULT = 64000;
const EQUIPE_FIXA_DEFAULT = 0;

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function rateioPorDia(
  dataInicio: string,
  dataFim: string,
  valorMensalDoMes: (mes: number, ano: number) => number,
): number {
  const dIni = new Date(dataInicio + 'T00:00:00Z');
  const dFim = new Date(dataFim + 'T00:00:00Z');
  let total = 0;
  for (let d = new Date(dIni); d <= dFim; d.setUTCDate(d.getUTCDate() + 1)) {
    const mes = d.getUTCMonth() + 1;
    const ano = d.getUTCFullYear();
    total += valorMensalDoMes(mes, ano) / diasNoMes(ano, mes);
  }
  return total;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano') ?? new Date().getFullYear());

    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    }

    const supabase = createServerClient();

    // 1. cmo_manual do ano (12 meses) — manual de Equipe Fixa e Pro Labore
    const { data: cmoManualRows, error: errCmo } = await supabase
      .schema('meta' as never)
      .from('cmo_manual')
      .select('mes, equipe_fixa_mensal, pro_labore_mensal')
      .eq('bar_id', barId)
      .eq('ano', ano);

    if (errCmo) {
      console.error('[cmo-detalhe] erro cmo_manual:', errCmo);
    }

    const cmoManualPorMes: Record<number, { equipe_fixa: number; pro_labore: number }> = {};
    for (let m = 1; m <= 12; m++) {
      cmoManualPorMes[m] = { equipe_fixa: EQUIPE_FIXA_DEFAULT, pro_labore: PRO_LABORE_DEFAULT };
    }
    for (const r of ((cmoManualRows as any[]) || [])) {
      cmoManualPorMes[r.mes] = {
        equipe_fixa: parseFloat(String(r.equipe_fixa_mensal || 0)),
        pro_labore: parseFloat(String(r.pro_labore_mensal || 0)),
      };
    }

    // 2. Freelas do ano inteiro (Conta Azul, todas categorias FREELA *)
    const dataInicioAno = `${ano}-01-01`;
    const dataFimAno = `${ano}-12-31`;
    const { data: freelasRows } = await (supabase as any)
      .schema('bronze')
      .from('bronze_contaazul_lancamentos')
      .select('valor_bruto, data_competencia')
      .eq('bar_id', barId)
      .eq('tipo', 'DESPESA')
      .is('excluido_em', null)
      .ilike('categoria_nome', '%freela%')
      .gte('data_competencia', dataInicioAno)
      .lte('data_competencia', dataFimAno);

    const freelasLista = (freelasRows || []) as { valor_bruto: any; data_competencia: string }[];

    const freelasNoIntervalo = (ini: string, fim: string): number =>
      freelasLista
        .filter((r) => r.data_competencia >= ini && r.data_competencia <= fim)
        .reduce((sum, r) => sum + (parseFloat(String(r.valor_bruto)) || 0), 0);

    // 3. gold.desempenho semanal (data_inicio, data_fim, faturamento)
    const { data: semanasGold } = await (supabase as any)
      .schema('gold')
      .from('desempenho')
      .select('numero_semana, ano, data_inicio, data_fim, faturamento_total')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('granularidade', 'semanal')
      .order('numero_semana');

    // 4. cmv_semanal para CMA semanal
    const { data: cmvSem } = await (supabase as any)
      .schema('financial')
      .from('cmv_semanal')
      .select('ano, semana, estoque_inicial_funcionarios, compras_alimentacao, estoque_final_funcionarios')
      .eq('bar_id', barId)
      .eq('ano', ano);

    const cmaSemanalMap = new Map<string, number>();
    for (const r of ((cmvSem as any[]) || [])) {
      const cma =
        (parseFloat(String(r.estoque_inicial_funcionarios || 0)) || 0)
        + (parseFloat(String(r.compras_alimentacao || 0)) || 0)
        - (parseFloat(String(r.estoque_final_funcionarios || 0)) || 0);
      cmaSemanalMap.set(`${r.ano}-${r.semana}`, cma);
    }

    // 5. cmv_mensal (mensal: faturamento total, cma total)
    const { data: cmvMen } = await (supabase as any)
      .schema('financial')
      .from('cmv_mensal')
      .select('mes, faturamento_total, cma_total')
      .eq('bar_id', barId)
      .eq('ano', ano);

    const cmvMensalMap = new Map<number, { faturamento_total: number; cma_total: number }>();
    for (const r of ((cmvMen as any[]) || [])) {
      cmvMensalMap.set(r.mes, {
        faturamento_total: parseFloat(String(r.faturamento_total || 0)),
        cma_total: parseFloat(String(r.cma_total || 0)),
      });
    }

    // 6. Montar semanas
    const semanas = ((semanasGold as any[]) || []).map((s) => {
      const dIni = s.data_inicio as string;
      const dFim = s.data_fim as string;
      const freelas = freelasNoIntervalo(dIni, dFim);
      const alimentacao = cmaSemanalMap.get(`${s.ano}-${s.numero_semana}`) || 0;
      const equipe_fixa = rateioPorDia(dIni, dFim, (m) => cmoManualPorMes[m]?.equipe_fixa || 0);
      const pro_labore = rateioPorDia(dIni, dFim, (m) => cmoManualPorMes[m]?.pro_labore || 0);
      const total = freelas + alimentacao + equipe_fixa + pro_labore;
      const faturamento = parseFloat(String(s.faturamento_total || 0));
      const cmo_percentual = faturamento > 0 ? (total / faturamento) * 100 : 0;
      return {
        numero_semana: s.numero_semana,
        ano: s.ano,
        data_inicio: dIni,
        data_fim: dFim,
        freelas,
        alimentacao,
        equipe_fixa,
        pro_labore,
        total,
        faturamento_total: faturamento,
        cmo_percentual,
      };
    });

    // 7. Montar meses
    const meses: Array<{
      mes: number;
      ano: number;
      data_inicio: string;
      data_fim: string;
      freelas: number;
      alimentacao: number;
      equipe_fixa: number;
      pro_labore: number;
      total: number;
      faturamento_total: number;
      cmo_percentual: number;
    }> = [];
    for (let mes = 1; mes <= 12; mes++) {
      const dias = diasNoMes(ano, mes);
      const dIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const dFim = `${ano}-${String(mes).padStart(2, '0')}-${String(dias).padStart(2, '0')}`;
      const freelas = freelasNoIntervalo(dIni, dFim);
      const cmv = cmvMensalMap.get(mes) || { faturamento_total: 0, cma_total: 0 };
      const alimentacao = cmv.cma_total;
      const equipe_fixa = cmoManualPorMes[mes]?.equipe_fixa || 0;
      const pro_labore = cmoManualPorMes[mes]?.pro_labore || 0;
      const total = freelas + alimentacao + equipe_fixa + pro_labore;
      const cmo_percentual = cmv.faturamento_total > 0 ? (total / cmv.faturamento_total) * 100 : 0;
      meses.push({
        mes, ano,
        data_inicio: dIni, data_fim: dFim,
        freelas, alimentacao, equipe_fixa, pro_labore, total,
        faturamento_total: cmv.faturamento_total,
        cmo_percentual,
      });
    }

    return NextResponse.json({
      bar_id: barId,
      ano,
      semanas,
      meses,
      cmo_manual_por_mes: cmoManualPorMes,
      defaults: { pro_labore_mensal: PRO_LABORE_DEFAULT, equipe_fixa_mensal: EQUIPE_FIXA_DEFAULT },
    });
  } catch (err) {
    console.error('[cmo-detalhe] excecao:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
