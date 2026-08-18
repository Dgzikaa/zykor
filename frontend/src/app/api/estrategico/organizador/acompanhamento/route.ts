import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { getOrcamentacaoCompleta } from '@/app/estrategico/orcamentacao/services/orcamentacao-service';

export const dynamic = 'force-dynamic';

/**
 * Realizado dos indicadores do OVT — "meta sem realizado ao lado é só intenção" (Gonza, 18/08/2026).
 *
 * NÃO calcula nada por fora. Puxa de `gold.desempenho` (a mesma base da tela Desempenho) e, para o
 * lucro, do `getOrcamentacaoCompleta` (o mesmo serviço da tela Orçamentação). Recalcular aqui seria
 * criar uma terceira fonte para os mesmos números — e duas fontes para o mesmo indicador é como se
 * cria divergência que ninguém consegue explicar depois.
 *
 * COMO CADA UM É AGREGADO (a regra muda com a natureza do indicador):
 *  · Faturamento e Lucro   → SOMA dos meses. São fluxo.
 *  · Clientes Ativos       → MÉDIA. É estoque (quem tem 2+ visitas nos últimos 90 dias); somar mês
 *                            a mês contaria a mesma pessoa 6 vezes.
 *  · CMV Limpo %           → Σ cmv_limpo ÷ Σ faturamento_cmvivel. Média de percentual ignora o peso
 *                            de cada mês e dá um número que não existe.
 *  · (Atrações+Prod)/Fat % → média PONDERADA por faturamento, pelo mesmo motivo.
 *  · CMO Fixo R$           → MÉDIA por mês, porque a meta é um teto mensal (R$ 160k contra ~R$ 135k
 *                            realizado). Vai rotulado como "média/mês" na tela para não haver dúvida.
 *  · Reputação Google      → média das médias mensais.
 *
 * Meses futuros ficam de fora: contar mês que ainda não aconteceu como zero afundaria a média e
 * faria o acumulado parecer atrasado quando não está.
 *
 * GET ?bar_id=&ano=&semestre=
 */

type Linha = {
  faturamento_total: number | null;
  faturamento_cmvivel: number | null;
  clientes_ativos: number | null;
  cmv_limpo: number | null;
  cmo: number | null;
  custo_atracao_faturamento: number | null;
  media_avaliacoes_google: number | null;
  periodo: string;
};

const num = (v: any) => (v == null || v === '' ? null : Number(v));
const soma = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
};
const media = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
/** média ponderada por peso; ignora mês sem peso, que senão entraria como se valesse zero */
const ponderada = (pares: Array<[number | null, number | null]>) => {
  const v = pares.filter(([x, p]) => x != null && p != null && p !== 0) as Array<[number, number]>;
  if (!v.length) return null;
  const pesoTotal = v.reduce((a, [, p]) => a + p, 0);
  return pesoTotal ? v.reduce((a, [x, p]) => a + x * p, 0) / pesoTotal : null;
};

/**
 * `linhas` = todos os meses do recorte (para o ACUMULADO, que é honesto mesmo com o mês em curso
 * pela metade). `completas` = só os meses fechados, usado nas MÉDIAS.
 *
 * Sem essa separação o mês corrente afunda a média e mente: no dia 18/08 o CMO de agosto estava em
 * R$ 17k contra ~R$ 130k de um mês inteiro, e a média de jul+ago dava R$ 72k — o painel mostraria
 * "45% da meta" em verde, sugerindo uma folga de CMO que não existe.
 */
function agregar(linhas: Linha[], completas: Linha[]) {
  const m = completas.length ? completas : linhas; // semestre recém-começado: melhor a média parcial que nada
  return {
    meses: linhas.length,
    meses_fechados: completas.length,
    faturamento: soma(linhas.map((l) => num(l.faturamento_total))),
    clientes_ativos: media(m.map((l) => num(l.clientes_ativos))),
    cmv_limpo_pct: (() => {
      const c = soma(linhas.map((l) => num(l.cmv_limpo)));
      const f = soma(linhas.map((l) => num(l.faturamento_cmvivel)));
      return c != null && f ? (c / f) * 100 : null;
    })(),
    artistico_pct: ponderada(linhas.map((l) => [num(l.custo_atracao_faturamento), num(l.faturamento_total)])),
    cmo_medio_mes: media(m.map((l) => num(l.cmo))),
    reputacao: media(m.map((l) => num(l.media_avaliacoes_google))),
  };
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ano = Number(sp.get('ano')) || new Date().getFullYear();
  const semestre = Number(sp.get('semestre')) === 1 ? 1 : 2;
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const hoje = new Date();
  // só até o mês corrente (no ano corrente); ano passado fecha em dezembro
  const ultimoMes = ano < hoje.getFullYear() ? 12 : ano > hoje.getFullYear() ? 0 : hoje.getMonth() + 1;
  const mesesSemestre = (semestre === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]).filter((m) => m <= ultimoMes);
  const mesesAno = Array.from({ length: 12 }, (_, i) => i + 1).filter((m) => m <= ultimoMes);

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').from('desempenho')
    .select('periodo, faturamento_total, faturamento_cmvivel, clientes_ativos, cmv_limpo, cmo, custo_atracao_faturamento, media_avaliacoes_google')
    .eq('bar_id', barId).eq('ano', ano).eq('granularidade', 'mensal');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // `periodo` vem como 'YYYY-MM'
  const porMes = new Map<number, Linha>();
  for (const l of (data || []) as Linha[]) {
    const m = Number(String(l.periodo || '').slice(5, 7));
    if (m) porMes.set(m, l);
  }
  const linhasDo = (meses: number[]) => meses.map((m) => porMes.get(m)).filter(Boolean) as Linha[];

  // Lucro líquido: só o serviço da Orçamentação sabe montar (blocos curados, de-para, DRE manual).
  let lucroSemestre: number | null = null;
  let lucroAno: number | null = null;
  try {
    const orc = await getOrcamentacaoCompleta(supabase as any, barId, ano, 1, 12);
    const lucroDe = (meses: number[]) => {
      const vs = (orc || [])
        .filter((m: any) => meses.includes(Number(m.mes)))
        .map((m: any) => num(m.lucro_realizado))
        .filter((x): x is number => x != null);
      return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
    };
    lucroSemestre = lucroDe(mesesSemestre);
    lucroAno = lucroDe(mesesAno);
  } catch {
    // Orçamentação indisponível não pode derrubar o resto do acompanhamento — o lucro fica em branco
    // e os outros indicadores continuam aparecendo.
  }

  // o mês corrente do ano corrente ainda está aberto; qualquer outro já fechou
  const mesAberto = ano === hoje.getFullYear() ? hoje.getMonth() + 1 : null;
  const fechados = (meses: number[]) => meses.filter((mm) => mm !== mesAberto);

  const sem = agregar(linhasDo(mesesSemestre), linhasDo(fechados(mesesSemestre)));
  const anoAgg = agregar(linhasDo(mesesAno), linhasDo(fechados(mesesAno)));

  return NextResponse.json({
    success: true,
    ate_mes: ultimoMes,
    // chaves com o MESMO nome do campo de meta, pra tela só fazer lookup
    semestre: {
      meses: sem.meses,
      meses_fechados: sem.meses_fechados,
      meta_faturamento: sem.faturamento,
      meta_clientes_ativos: sem.clientes_ativos,
      meta_cmv_limpo: sem.cmv_limpo_pct,
      meta_artistica: sem.artistico_pct,
      meta_cmo_fixo: sem.cmo_medio_mes,
    },
    ano: {
      meses: anoAgg.meses,
      meses_fechados: anoAgg.meses_fechados,
      faturamento_meta: anoAgg.faturamento,
      lucro_liquido_meta: lucroAno,
      pessoas_meta: anoAgg.clientes_ativos,
      artistico_meta: anoAgg.artistico_pct,
      reputacao_meta: anoAgg.reputacao,
    },
    lucro_semestre: lucroSemestre,
  });
}
