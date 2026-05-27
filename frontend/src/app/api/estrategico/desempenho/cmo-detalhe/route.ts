import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { paginate } from '@/lib/supabase/paginate';

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
 *   3) equipe_fixa    — SUM(bronze_contaazul_lancamentos) categorias:
 *                       SALARIO FUNCIONARIOS + PROVISÃO TRABALHISTA + VALE TRANSPORTE + ADICIONAIS
 *                       Mesma logica do freelas (auto via CA, sem rateio).
 *                       Mudou em 2026-05-27: era manual via meta.cmo_equipe_fixa_semanal.
 *   4) pro_labore     — meta.cmo_manual.pro_labore_mensal (manual, sem default)
 *                       Rateio dia a dia para visao semanal
 *
 * CMO % = (freelas + alimentacao + equipe_fixa + pro_labore) / faturamento_total × 100
 */

// Sem default hardcoded: cada bar tem seu pro_labore manual em meta.cmo_manual.
// Bar 3 (Ordinario) = 64k, Bar 4 (Deboche) = 15k em 2026. Se row nao existe, fica 0.
const PRO_LABORE_DEFAULT = 0;
const EQUIPE_FIXA_DEFAULT = 0;

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function rateioPorDia(
  dataInicio: string,
  dataFim: string,
  valorMensalDoMes: (ano: number, mes: number) => number,
): number {
  const dIni = new Date(dataInicio + 'T00:00:00Z');
  const dFim = new Date(dataFim + 'T00:00:00Z');
  let total = 0;
  for (let d = new Date(dIni); d <= dFim; d.setUTCDate(d.getUTCDate() + 1)) {
    const mes = d.getUTCMonth() + 1;
    const ano = d.getUTCFullYear();
    total += valorMensalDoMes(ano, mes) / diasNoMes(ano, mes);
  }
  return total;
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    const anoParam = Number(sp.get('ano') ?? new Date().getFullYear());
    // ano_min/ano_max para visao mensal que cruza anos (ex: Mar/2025 -> hoje).
    // Sem isso, ano=2026 truncava todos os meses/semanas de 2025 da UI.
    const anoMin = Number(sp.get('ano_min') ?? anoParam);
    const anoMax = Number(sp.get('ano_max') ?? anoParam);
    // Mantemos `ano` interno como max pra cmo_manual (que ainda eh por ano unico).
    const ano = anoMax;

    if (!barId) {
      return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Array de anos no range (pra queries que filtram por ano)
    const anosNoRange: number[] = [];
    for (let a = anoMin; a <= anoMax; a++) anosNoRange.push(a);

    // 1. cmo_manual do range — manual de Equipe Fixa e Pro Labore (Pro Labore eh mensal)
    // Indexado por `${ano}-${mes}` agora pra suportar cross-year.
    const { data: cmoManualRows, error: errCmo } = await supabase
      .schema('meta' as never)
      .from('cmo_manual')
      .select('ano, mes, equipe_fixa_mensal, pro_labore_mensal')
      .eq('bar_id', barId)
      .in('ano', anosNoRange);

    if (errCmo) {
      console.error('[cmo-detalhe] erro cmo_manual:', errCmo);
    }

    const cmoManualPorMes: Record<string, { equipe_fixa: number; pro_labore: number }> = {};
    for (const a of anosNoRange) {
      for (let m = 1; m <= 12; m++) {
        cmoManualPorMes[`${a}-${m}`] = { equipe_fixa: EQUIPE_FIXA_DEFAULT, pro_labore: PRO_LABORE_DEFAULT };
      }
    }
    for (const r of ((cmoManualRows as any[]) || [])) {
      cmoManualPorMes[`${r.ano}-${r.mes}`] = {
        equipe_fixa: parseFloat(String(r.equipe_fixa_mensal || 0)),
        pro_labore: parseFloat(String(r.pro_labore_mensal || 0)),
      };
    }

    // 2. Freelas do range (Conta Azul, 6 categorias FREELA explicitas)
    // Substituiu ILIKE '%freela%' em 2026-05-27 — explicito eh mais robusto contra
    // possiveis novas categorias com "freela" no nome que nao deveriam entrar.
    // PAGINADO em 2026-05-27: Ord 2026 tem 1572 rows, limite default Supabase
    // (1000) causava UI mostrar ~63% do valor real.
    // Range estendido pra suportar visao mensal cross-year (Mar/2025 -> hoje).
    // VALOR PAGO em 2026-05-27: usa valor_pago quando > 0 (o que realmente saiu),
    // fallback valor_bruto. CA/planilha mostra valor_pago — diff de R$ 30 era 1
    // lancamento Ord/Abr/26 onde freela ganhou ajuste (bruto 130, pago 160).
    const dataInicioAno = `${anoMin}-01-01`;
    const dataFimAno = `${anoMax}-12-31`;
    const freelasLista = await paginate<{ valor_bruto: any; valor_pago: any; data_competencia: string }>(
      () => (supabase as any)
        .schema('bronze')
        .from('bronze_contaazul_lancamentos')
        .select('valor_bruto, valor_pago, data_competencia')
        .eq('bar_id', barId)
        .eq('tipo', 'DESPESA')
        .is('excluido_em', null)
        .in('categoria_nome', [
          'FREELA ATENDIMENTO',
          'FREELA COZINHA',
          'FREELA BAR',
          'FREELA LIMPEZA',
          'FREELA SEGURANÇA',
          'FREELA BRIGADISTA',
        ])
        .gte('data_competencia', dataInicioAno)
        .lte('data_competencia', dataFimAno)
        .order('data_competencia'),
    );

    const valorEfetivo = (r: { valor_bruto: any; valor_pago: any }) => {
      const pago = parseFloat(String(r.valor_pago)) || 0;
      const bruto = parseFloat(String(r.valor_bruto)) || 0;
      return pago > 0 ? pago : bruto;
    };

    const freelasNoIntervalo = (ini: string, fim: string): number =>
      freelasLista
        .filter((r) => r.data_competencia >= ini && r.data_competencia <= fim)
        .reduce((sum, r) => sum + valorEfetivo(r), 0);

    // 2b. Equipe Fixa AUTO via ContaAzul (categorias SALARIO + PROVISÃO + VT + ADICIONAIS)
    // Mudou em 2026-05-27: era manual via meta.cmo_equipe_fixa_semanal.
    // Mesma logica do freelas — soma valorEfetivo (pago se >0, senao bruto) por intervalo.
    // PAGINADO pra evitar truncamento silencioso (mesmo bug do freelas).
    const equipeFixaLista = await paginate<{ valor_bruto: any; valor_pago: any; data_competencia: string }>(
      () => (supabase as any)
        .schema('bronze')
        .from('bronze_contaazul_lancamentos')
        .select('valor_bruto, valor_pago, data_competencia, categoria_nome')
        .eq('bar_id', barId)
        .eq('tipo', 'DESPESA')
        .is('excluido_em', null)
        .in('categoria_nome', [
          'SALARIO FUNCIONARIOS',
          'PROVISÃO TRABALHISTA',
          'VALE TRANSPORTE',
          'ADICIONAIS',
        ])
        .gte('data_competencia', dataInicioAno)
        .lte('data_competencia', dataFimAno)
        .order('data_competencia'),
    );

    const equipeFixaNoIntervalo = (ini: string, fim: string): number =>
      equipeFixaLista
        .filter((r) => r.data_competencia >= ini && r.data_competencia <= fim)
        .reduce((sum, r) => sum + valorEfetivo(r), 0);

    // 3. gold.desempenho semanal (data_inicio, data_fim, faturamento)
    const semanasGold = await paginate<any>(
      () => (supabase as any)
        .schema('gold')
        .from('desempenho')
        .select('numero_semana, ano, data_inicio, data_fim, faturamento_total')
        .eq('bar_id', barId)
        .in('ano', anosNoRange)
        .eq('granularidade', 'semanal')
        .order('ano')
        .order('numero_semana'),
    );

    // 4. cmv_semanal para CMA semanal
    const cmvSem = await paginate<any>(
      () => (supabase as any)
        .schema('financial')
        .from('cmv_semanal')
        .select('ano, semana, estoque_inicial_funcionarios, compras_alimentacao, estoque_final_funcionarios')
        .eq('bar_id', barId)
        .in('ano', anosNoRange)
        .order('ano')
        .order('semana'),
    );

    const cmaSemanalMap = new Map<string, number>();
    for (const r of (cmvSem || [])) {
      const cma =
        (parseFloat(String(r.estoque_inicial_funcionarios || 0)) || 0)
        + (parseFloat(String(r.compras_alimentacao || 0)) || 0)
        - (parseFloat(String(r.estoque_final_funcionarios || 0)) || 0);
      cmaSemanalMap.set(`${r.ano}-${r.semana}`, cma);
    }

    // 5. cmv_mensal (mensal: faturamento total, cma total) — agora cross-year
    const cmvMen = await paginate<any>(
      () => (supabase as any)
        .schema('financial')
        .from('cmv_mensal')
        .select('ano, mes, faturamento_total, cma_total')
        .eq('bar_id', barId)
        .in('ano', anosNoRange)
        .order('ano')
        .order('mes'),
    );

    // Indexado por `${ano}-${mes}` (cross-year).
    const cmvMensalMap = new Map<string, { faturamento_total: number; cma_total: number }>();
    for (const r of (cmvMen || [])) {
      cmvMensalMap.set(`${r.ano}-${r.mes}`, {
        faturamento_total: parseFloat(String(r.faturamento_total || 0)),
        cma_total: parseFloat(String(r.cma_total || 0)),
      });
    }

    // 6. Montar semanas
    // Equipe Fixa: AUTO via ContaAzul (mesma logica do freelas, soma por intervalo).
    // Pro Labore: continua mensal, rateado dia a dia.
    const semanas = (semanasGold || []).map((s) => {
      const dIni = s.data_inicio as string;
      const dFim = s.data_fim as string;
      const freelas = freelasNoIntervalo(dIni, dFim);
      const alimentacao = cmaSemanalMap.get(`${s.ano}-${s.numero_semana}`) || 0;
      const equipe_fixa = equipeFixaNoIntervalo(dIni, dFim);
      const pro_labore = rateioPorDia(dIni, dFim, (a, m) => cmoManualPorMes[`${a}-${m}`]?.pro_labore || 0);
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

    // 7. Montar meses (cross-year: anoMin..anoMax)
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
    for (const a of anosNoRange) {
      for (let mes = 1; mes <= 12; mes++) {
        const dias = diasNoMes(a, mes);
        const dIni = `${a}-${String(mes).padStart(2, '0')}-01`;
        const dFim = `${a}-${String(mes).padStart(2, '0')}-${String(dias).padStart(2, '0')}`;
        const freelas = freelasNoIntervalo(dIni, dFim);
        const cmv = cmvMensalMap.get(`${a}-${mes}`) || { faturamento_total: 0, cma_total: 0 };
        const alimentacao = cmv.cma_total;
        const equipe_fixa = equipeFixaNoIntervalo(dIni, dFim);
        const pro_labore = cmoManualPorMes[`${a}-${mes}`]?.pro_labore || 0;
        const total = freelas + alimentacao + equipe_fixa + pro_labore;
        const cmo_percentual = cmv.faturamento_total > 0 ? (total / cmv.faturamento_total) * 100 : 0;
        meses.push({
          mes, ano: a,
          data_inicio: dIni, data_fim: dFim,
          freelas, alimentacao, equipe_fixa, pro_labore, total,
          faturamento_total: cmv.faturamento_total,
          cmo_percentual,
        });
      }
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
