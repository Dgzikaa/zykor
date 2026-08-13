import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { cmoFixoDoPeriodo, interseccao, montarFolhaDoMes } from '@/lib/operacao/cmo';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

/**
 * Rótulos do resumo, na ordem e com os nomes da planilha. `seg/bri` junta segurança e
 * brigadista numa linha só — é como o time lê o custo de segurança.
 */
const LINHAS_RESUMO: Array<{ label: string; codigos: string[] }> = [
  { label: 'garçom', codigos: ['garcom'] },
  { label: 'cumim', codigos: ['cumim'] },
  { label: 'host', codigos: ['host'] },
  { label: 'asg', codigos: ['asg'] },
  { label: 'bar', codigos: ['bartender'] },
  { label: 'back', codigos: ['barback'] },
  { label: 'cozinha', codigos: ['cozinha'] },
  { label: 'seg/bri', codigos: ['seguranca', 'brigadista'] },
];

/** Primeiro dia do mês N meses antes — janela de histórico da folha. */
const mesesAtras = (dataISO: string, n: number) => {
  const [a, m] = dataISO.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
};

const segundaDe = (dataISO: string) => {
  const [a, m, d] = dataISO.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  x.setUTCDate(x.getUTCDate() - (x.getUTCDay() === 0 ? 6 : x.getUTCDay() - 1));
  return x.toISOString().slice(0, 10);
};

// =====================================================
// Resumo do período — mesmos campos do bloco RESUMO da planilha.
//
//   Custo de Freelas · CMO Fixo · Público Proj · Fat Proj · CMO% Proj
//   + FUNÇÃO / QTDE / CUSTO
//
// O CMO% É (FREELA + FIXO) / FATURAMENTO, não só o freela. Sem a folha CLT o percentual
// dava ~4% e o teto nunca disparava.
//
// O CMO Fixo é UM valor só — a folha do mês — rateada por dia (ver lib/operacao/cmo.ts).
// Até 13/08/2026 havia também um `cmo_fixo_semanal` digitado (59.000) que media outra
// régua: a semana estourava (25–28%) enquanto o mês passava (19%), com o mesmo teto.
// O Cadu fechou "é pra ser igual, sempre 20%" e o semanal saiu.
//
// GET /api/operacao/resumo?de=2026-08-01&ate=2026-08-31&escopo=mes|semana
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const url = new URL(request.url);
  const de = url.searchParams.get('de') || '';
  const ate = url.searchParams.get('ate') || '';
  const escopo = url.searchParams.get('escopo') === 'semana' ? 'semana' : 'mes';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();
  const [{ data: dias }, { data: linhas }, { data: param }, { data: folhaMeses }] = await Promise.all([
    ops(c).from('operacao_dia').select('id, data, turno, faturamento_previsto, publico_calculado, publico_manual')
      .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate),
    ops(c).from('v_operacao_dia_funcao').select('operacao_dia_id, data, funcao_codigo, freelas, custo, entra_no_custo')
      .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate),
    ops(c).from('operacao_parametro').select('cmo_fixo_mensal, limite_cmo_pct')
      .eq('bar_id', user.bar_id).lte('vigencia_inicio', ate)
      .or(`vigencia_fim.is.null,vigencia_fim.gte.${ate}`)
      .order('vigencia_inicio', { ascending: false }).limit(1).maybeSingle(),
    // A folha vem do FINANCEIRO, não digitada: o Cadu pediu ("o ideal era conseguir puxar de
    // algum relatório financeiro") e o motivo é que ela muda — no bar 3 saiu de 170.721 em
    // janeiro para 198.990 em julho, enquanto o parâmetro guardava 172.000 de janeiro.
    (c as any).schema('gold').from('cmo_produtividade_mensal')
      .select('mes, cmo_fixo_operacao')
      .eq('bar_id', user.bar_id).gte('mes', mesesAtras(de, 14)).lte('mes', ate)
      .order('mes'),
  ]);

  const custoFreelas = (linhas || []).reduce((s: number, l: any) => s + Number(l.custo || 0), 0);
  const fatProj = (dias || []).reduce((s: number, d: any) => s + Number(d.faturamento_previsto || 0), 0);
  const publicoProj = (dias || []).reduce(
    (s: number, d: any) => s + Number(d.publico_manual ?? d.publico_calculado ?? 0), 0);

  // mesma conta para semana e mês: a folha do mês rateada pelos dias do período
  const { folha, origem, projecao } = montarFolhaDoMes({
    meses: folhaMeses || [],
    override: param?.cmo_fixo_mensal == null ? null : Number(param.cmo_fixo_mensal),
    hojeISO: new Date().toISOString().slice(0, 10),
  });
  const cmoFixo = cmoFixoDoPeriodo(de, ate, folha);
  const cmoPct = fatProj > 0 ? ((custoFreelas + cmoFixo) / fatProj) * 100 : null;
  // origem do período: se os meses divergem, vale a mais fraca (projeção sobre realizado)
  const origensNoPeriodo = [...new Set([de.slice(0, 7), ate.slice(0, 7)])].map(origem);
  const origemFolha = origensNoPeriodo.includes('sem_dado') ? 'sem_dado'
    : origensNoPeriodo.includes('projecao') ? 'projecao'
    : origensNoPeriodo.includes('manual') ? 'manual' : 'realizado';

  // por função, com seg/bri agrupado
  const porCodigo = new Map<string, { qtde: number; custo: number }>();
  (linhas || []).forEach((l: any) => {
    if (!l.entra_no_custo) return;
    const at = porCodigo.get(l.funcao_codigo) || { qtde: 0, custo: 0 };
    at.qtde += Number(l.freelas || 0);
    at.custo += Number(l.custo || 0);
    porCodigo.set(l.funcao_codigo, at);
  });
  const porFuncao = LINHAS_RESUMO.map(lr => {
    const acc = lr.codigos.reduce((a, cod) => {
      const v = porCodigo.get(cod);
      return { qtde: a.qtde + (v?.qtde || 0), custo: a.custo + (v?.custo || 0) };
    }, { qtde: 0, custo: 0 });
    return { label: lr.label, ...acc };
  });

  // quebra por semana (só faz sentido no escopo mensal)
  const custoPorDiaId = new Map<string, number>();
  (linhas || []).forEach((l: any) =>
    custoPorDiaId.set(l.operacao_dia_id, (custoPorDiaId.get(l.operacao_dia_id) || 0) + Number(l.custo || 0)));

  const semanas = new Map<string, { inicio: string; fim: string; dias_no_periodo: number; faturamento: number; custo: number }>();
  (dias || []).forEach((d: any) => {
    const ini = segundaDe(d.data);
    if (!semanas.has(ini)) {
      const [a, m, dd] = ini.split('-').map(Number);
      semanas.set(ini, {
        inicio: ini,
        fim: new Date(Date.UTC(a, m - 1, dd + 6)).toISOString().slice(0, 10),
        dias_no_periodo: 0, faturamento: 0, custo: 0,
      });
    }
    const s = semanas.get(ini)!;
    // sábado dia/noite são 2 registros do MESMO dia — não contar o dia duas vezes
    if (d.turno !== 'noite') s.dias_no_periodo += 1;
    s.faturamento += Number(d.faturamento_previsto || 0);
    s.custo += custoPorDiaId.get(d.id) || 0;
  });

  return NextResponse.json({
    escopo,
    periodo: { de, ate },
    custo_freelas: custoFreelas,
    cmo_fixo: cmoFixo,
    cmo_fixo_origem: origemFolha,
    cmo_fixo_projecao_mensal: projecao,
    publico_proj: Math.round(publicoProj),
    fat_proj: fatProj,
    cmo_pct: cmoPct,
    por_funcao: porFuncao,
    // O fixo da semana sai do mesmo rateio por dia, recortado pelo período pedido. A
    // semana que entra parcial (27/07–02/08 entra em agosto com 2 dias) leva só a folha
    // desses 2 dias; antes levava a folha inteira sobre o faturamento de 2 dias e
    // aparecia com 60% — número que não quer dizer nada.
    semanas: [...semanas.values()].sort((a, b) => a.inicio.localeCompare(b.inicio)).map(s => {
      const corte = interseccao(s.inicio, s.fim, de, ate);
      const fixoRateado = corte ? cmoFixoDoPeriodo(corte.de, corte.ate, folha) : 0;
      return {
        ...s,
        cmo_fixo_rateado: fixoRateado,
        parcial: !!corte && corte.dias < 7,
        cmo_pct: s.faturamento > 0 ? ((s.custo + fixoRateado) / s.faturamento) * 100 : null,
      };
    }),
    limite_cmo_pct: Number(param?.limite_cmo_pct ?? 20),
  });
}
