import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

// =====================================================
// Resumo do mês: total mensal + quebra por semana + por função.
//
// A DOR QUE ISSO RESOLVE: na planilha, mês que começa numa quarta obrigava a recortar
// dias da última semana do mês anterior à mão ("tem mês que a semana começa dia 03, aí
// tem que tirar 2 dias da última semana do outro mês"). Aqui não existe esse trabalho:
// a chave é DATA, então
//   - o MENSAL é todo dia cuja data cai no mês, não importa em que semana ele esteja;
//   - a SEMANA é sempre segunda→domingo, atravessando a virada de mês sem cerimônia.
// Cada semana da lista informa `dias_no_mes`, pra deixar explícito quando ela é parcial.
//
// GET /api/operacao/resumo?mes=2026-08
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const mes = new URL(request.url).searchParams.get('mes') || '';
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: 'Informe mes (AAAA-MM)' }, { status: 400 });

  const [ano, m] = mes.split('-').map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const ultimo = new Date(Date.UTC(ano, m, 0));
  const de = primeiro.toISOString().slice(0, 10);
  const ate = ultimo.toISOString().slice(0, 10);

  const c = sb();
  const [{ data: dias }, { data: linhas }] = await Promise.all([
    ops(c).from('operacao_dia').select('id, data, turno, faturamento_previsto')
      .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate).order('data'),
    ops(c).from('v_operacao_dia_funcao').select('*')
      .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate),
  ]);

  const custoPorDiaId = new Map<string, number>();
  (linhas || []).forEach((l: any) => {
    custoPorDiaId.set(l.operacao_dia_id, (custoPorDiaId.get(l.operacao_dia_id) || 0) + Number(l.custo || 0));
  });

  // ---- por função (mensal) — espelha o bloco "RESUMO MENSAL: FUNÇÃO / CUSTO" da planilha
  const porFuncao = new Map<string, { funcao_nome: string; ordem: number; freelas: number; custo: number }>();
  (linhas || []).forEach((l: any) => {
    if (!l.entra_no_custo) return;
    const k = l.funcao_id;
    if (!porFuncao.has(k)) porFuncao.set(k, { funcao_nome: l.funcao_nome, ordem: l.funcao_ordem, freelas: 0, custo: 0 });
    const f = porFuncao.get(k)!;
    f.freelas += Number(l.freelas || 0);
    f.custo += Number(l.custo || 0);
  });

  // ---- por semana (segunda→domingo), atravessando a virada de mês
  const segundaDe = (dataISO: string) => {
    const [a, mm, dd] = dataISO.split('-').map(Number);
    const d = new Date(Date.UTC(a, mm - 1, dd));
    const dow = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    return d.toISOString().slice(0, 10);
  };

  const semanas = new Map<string, { inicio: string; fim: string; dias_no_mes: number; faturamento: number; custo: number }>();
  (dias || []).forEach((d: any) => {
    const ini = segundaDe(d.data);
    if (!semanas.has(ini)) {
      const [a, mm, dd] = ini.split('-').map(Number);
      const fim = new Date(Date.UTC(a, mm - 1, dd + 6)).toISOString().slice(0, 10);
      semanas.set(ini, { inicio: ini, fim, dias_no_mes: 0, faturamento: 0, custo: 0 });
    }
    const s = semanas.get(ini)!;
    // turno dia/noite do sábado são 2 registros do MESMO dia — não contar o dia duas vezes
    if (d.turno !== 'noite') s.dias_no_mes += 1;
    s.faturamento += Number(d.faturamento_previsto || 0);
    s.custo += custoPorDiaId.get(d.id) || 0;
  });

  const listaSemanas = [...semanas.values()]
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map(s => ({ ...s, pct_cmo: s.faturamento > 0 ? (s.custo / s.faturamento) * 100 : null }));

  const faturamento = (dias || []).reduce((t: number, d: any) => t + Number(d.faturamento_previsto || 0), 0);
  const custo = [...custoPorDiaId.values()].reduce((t, v) => t + v, 0);

  return NextResponse.json({
    mes,
    periodo: { de, ate },
    total: { faturamento, custo, pct_cmo: faturamento > 0 ? (custo / faturamento) * 100 : null },
    semanas: listaSemanas,
    por_funcao: [...porFuncao.values()].sort((a, b) => a.ordem - b.ordem),
    // teto combinado com o time; acima disso a tela alerta
    limite_cmo_pct: 21,
  });
}
