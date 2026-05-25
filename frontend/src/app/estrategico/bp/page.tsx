import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { BpClient } from './BpClient';
import type { BpLinha, BpIndicador, AnaliseSemanal, DiaSemana, AnaliseSemanalDow } from './types';

export const revalidate = 600;

const DIA_DOW: Record<number, DiaSemana> = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab',
};

interface EventoRow {
  data_evento: string;
  m1_r: number | string | null;
  real_r: number | string | null;
  cl_plan: number | null;
  cl_real: number | null;
  te_plan: number | string | null;
  te_real: number | string | null;
  tb_plan: number | string | null;
  tb_real: number | string | null;
  c_art: number | string | null;
  c_prod: number | string | null;
}

function dowDaData(dataISO: string): DiaSemana {
  // 'YYYY-MM-DD' interpretado como UTC pode girar de dia em alguns timezones —
  // criar Date com UTC explicito pra estabilidade
  const [y, m, d] = dataISO.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return DIA_DOW[dow];
}

function calcAnaliseSemanal(
  eventos: EventoRow[],
  bpPorDia: Record<string, Record<DiaSemana, number>>,
  ano: number,
  mes: number
): AnaliseSemanal {
  const DIAS: DiaSemana[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  // Agrupar eventos por DOW
  const grupos = new Map<DiaSemana, EventoRow[]>();
  for (const dia of DIAS) grupos.set(dia, []);
  for (const ev of eventos) {
    const dia = dowDaData(ev.data_evento);
    grupos.get(dia)?.push(ev);
  }

  // Contar ocorrencias de cada dia da semana no mes pra plan dia x mes
  const ocorrenciasPorDia: Record<DiaSemana, number> = { seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0, dom: 0 };
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();
  for (let d = 1; d <= ultimoDiaMes; d++) {
    const dia = DIA_DOW[new Date(Date.UTC(ano, mes - 1, d)).getUTCDay()];
    ocorrenciasPorDia[dia]++;
  }

  const num = (v: unknown): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };

  const pessoasPlanDia = bpPorDia['PESSOAS'] || ({} as Record<DiaSemana, number>);
  const tbPlanDia = bpPorDia['TKT M BAR'] || ({} as Record<DiaSemana, number>);
  const tePlanDia = bpPorDia['TKT M ENTRADA'] || ({} as Record<DiaSemana, number>);
  const fatBarPlanDia = bpPorDia['Faturamento Bar'] || ({} as Record<DiaSemana, number>);
  const fatEntradaPlanDia = bpPorDia['Faturamento Couvert'] || ({} as Record<DiaSemana, number>);
  const cachePlanDia = bpPorDia['Programacao Artistica'] || ({} as Record<DiaSemana, number>);

  const por_dia: AnaliseSemanalDow[] = DIAS.map(dia => {
    const evs = grupos.get(dia) || [];
    const ocorr = ocorrenciasPorDia[dia] || 0;

    const pessoas_real = evs.reduce((s, e) => s + num(e.cl_real), 0);
    const fat_total_real = evs.reduce((s, e) => s + num(e.real_r), 0);
    // Faturamento por componente: usar tb_real * cl_real e te_real * cl_real
    const fat_bar_real = evs.reduce((s, e) => s + num(e.tb_real) * num(e.cl_real), 0);
    const fat_entrada_real = evs.reduce((s, e) => s + num(e.te_real) * num(e.cl_real), 0);
    // Ticket medio = total / pessoas (so se tem pessoas)
    const tb_real = pessoas_real > 0 ? fat_bar_real / pessoas_real : 0;
    const te_real = pessoas_real > 0 ? fat_entrada_real / pessoas_real : 0;
    const cache_real = evs.reduce((s, e) => s + num(e.c_art) + num(e.c_prod), 0);

    // Plan: valor do BP * ocorrencias do dia no mes
    const pessoas_plan = (pessoasPlanDia[dia] || 0) * ocorr;
    const tb_plan = tbPlanDia[dia] || 0;
    const te_plan = tePlanDia[dia] || 0;
    const fat_bar_plan = (fatBarPlanDia[dia] || 0) * ocorr;
    const fat_entrada_plan = (fatEntradaPlanDia[dia] || 0) * ocorr;
    const fat_total_plan = fat_bar_plan + fat_entrada_plan;
    const cache_plan = (cachePlanDia[dia] || 0) * ocorr;

    const pct_cache_real = fat_total_real > 0 ? (cache_real / fat_total_real) * 100 : 0;
    const pct_cache_plan = fat_total_plan > 0 ? (cache_plan / fat_total_plan) * 100 : 0;

    return {
      dia,
      eventos_count: evs.length,
      pessoas_real,
      pessoas_plan,
      tb_real,
      tb_plan,
      te_real,
      te_plan,
      fat_bar_real,
      fat_bar_plan,
      fat_entrada_real,
      fat_entrada_plan,
      fat_total_real,
      fat_total_plan,
      cache_real,
      cache_plan,
      pct_cache_real,
      pct_cache_plan,
    };
  });

  const totais = por_dia.reduce(
    (acc, d) => ({
      eventos_count: acc.eventos_count + d.eventos_count,
      pessoas_real: acc.pessoas_real + d.pessoas_real,
      pessoas_plan: acc.pessoas_plan + d.pessoas_plan,
      fat_bar_real: acc.fat_bar_real + d.fat_bar_real,
      fat_bar_plan: acc.fat_bar_plan + d.fat_bar_plan,
      fat_entrada_real: acc.fat_entrada_real + d.fat_entrada_real,
      fat_entrada_plan: acc.fat_entrada_plan + d.fat_entrada_plan,
      fat_total_real: acc.fat_total_real + d.fat_total_real,
      fat_total_plan: acc.fat_total_plan + d.fat_total_plan,
      cache_real: acc.cache_real + d.cache_real,
      cache_plan: acc.cache_plan + d.cache_plan,
    }),
    {
      eventos_count: 0, pessoas_real: 0, pessoas_plan: 0,
      fat_bar_real: 0, fat_bar_plan: 0,
      fat_entrada_real: 0, fat_entrada_plan: 0,
      fat_total_real: 0, fat_total_plan: 0,
      cache_real: 0, cache_plan: 0,
    }
  );

  const label = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return { ano, mes, label, por_dia, totais };
}

export default async function BpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const barId = await getBarIdServer();
  if (!barId) return <BarSyncCheck />;

  const params = await searchParams;
  const now = new Date();
  const ano = Number(params.ano) || now.getFullYear();
  const versao = (params.versao as string) || 'Mai26';
  const mesAnalise = Number(params.mes) || now.getMonth() + 1;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const inicio = `${ano}-${String(mesAnalise).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mesAnalise, 0).getDate();
  const fim = `${ano}-${String(mesAnalise).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const [linhasResult, indicadoresResult, versoesResult, eventosResult] = await Promise.all([
    supabase
      .from('bp_linha')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versao)
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    supabase
      .from('bp_indicador')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versao)
      .eq('ativo', true),
    supabase
      .from('bp_linha')
      .select('versao, ano')
      .eq('bar_id', barId)
      .eq('ativo', true),
    supabase
      .from('eventos_base')
      .select('data_evento, m1_r, real_r, cl_plan, cl_real, te_plan, te_real, tb_plan, tb_real, c_art, c_prod')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .gte('data_evento', inicio)
      .lte('data_evento', fim),
  ]);

  const linhas = (linhasResult.data || []) as BpLinha[];
  const indicadores = (indicadoresResult.data || []) as BpIndicador[];
  const eventos = (eventosResult.data || []) as EventoRow[];

  // Indexar bp por linha pra usar no cálculo de análise semanal
  const bpPorDia: Record<string, Record<DiaSemana, number>> = {};
  for (const l of linhas) {
    if (l.por_dia_semana) {
      bpPorDia[l.linha] = l.por_dia_semana;
    }
  }

  const analise = calcAnaliseSemanal(eventos, bpPorDia, ano, mesAnalise);

  const versoes = Array.from(
    new Set(((versoesResult.data || []) as { versao: string; ano: number }[]).map(v => `${v.ano}|${v.versao}`))
  ).map(s => {
    const [a, v] = s.split('|');
    return { ano: Number(a), versao: v };
  });

  return (
    <BpClient
      linhas={linhas}
      indicadores={indicadores}
      versoes={versoes}
      anoAtual={ano}
      versaoAtual={versao}
      mesAnalise={mesAnalise}
      analise={analise}
      barId={barId}
    />
  );
}
