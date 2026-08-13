import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { parametrosVigentes } from '@/lib/operacao/parametros';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

// =====================================================
// Plano Operacional — leitura de um período (semana ou mês).
//
// A cadeia é a da planilha, com os dois erros dela corrigidos:
//   publico = faturamento / ticket DO DIA DA SEMANA  (a planilha travava no de segunda)
//   pico    = publico / giro
//   total   = teto(pico / nivel_servico)
//   freelas = max(0, total - fixos)   |   custo = freelas * diaria
// O sábado é partido em turno dia/noite; os demais dias são turno único.
//
// GET /api/operacao/plano?de=2026-08-03&ate=2026-08-09
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const url = new URL(request.url);
  const de = url.searchParams.get('de');
  const ate = url.searchParams.get('ate');
  if (!de || !ate) return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });

  const c = sb();

  const [{ data: dias }, { data: linhas }, { data: funcoes }, params, { data: reservas }] = await Promise.all([
    ops(c).from('operacao_dia').select('*').eq('bar_id', user.bar_id)
      .gte('data', de).lte('data', ate).order('data').order('turno'),
    ops(c).from('v_operacao_dia_funcao').select('*').eq('bar_id', user.bar_id)
      .gte('data', de).lte('data', ate).order('data').order('funcao_ordem'),
    ops(c).from('operacao_funcao').select('*').eq('bar_id', user.bar_id).eq('ativo', true).order('ordem'),
    parametrosVigentes(c, user.bar_id, ate),
    // Reservas do GetIn — noção de quanto do público esperado já tem mesa marcada.
    // É FOTO DE AGORA e sobe até o dia: reserva de terça para sábado ainda vai crescer,
    // então a tela precisa dizer isso em vez de deixar parecer meta furada.
    (c as any).schema('silver').from('getin_reservas_diarias')
      .select('data_referencia, total_reservas, total_pessoas')
      .eq('bar_id', user.bar_id).gte('data_referencia', de).lte('data_referencia', ate),
  ]);

  // agrupa as funções dentro do seu dia — a tela lê uma coluna por dia/turno
  const porDia = new Map<string, any[]>();
  (linhas || []).forEach((l: any) => {
    const k = l.operacao_dia_id;
    if (!porDia.has(k)) porDia.set(k, []);
    porDia.get(k)!.push(l);
  });

  // a reserva é do DIA, não do turno — o sábado partido mostra o mesmo número nos dois,
  // porque o GetIn não separa quem reservou pro almoço e quem reservou pra noite
  const porDataReserva = new Map<string, any>();
  (reservas || []).forEach((r: any) => porDataReserva.set(r.data_referencia, r));

  const resultado = (dias || []).map((d: any) => {
    const r = porDataReserva.get(d.data);
    return {
      ...d,
      publico: d.publico_manual ?? d.publico_calculado,
      pico: d.pico_manual ?? d.pico_calculado,
      reservas: r ? Number(r.total_reservas || 0) : null,
      reservas_pessoas: r ? Number(r.total_pessoas || 0) : null,
      funcoes: porDia.get(d.id) || [],
      custo_dia: (porDia.get(d.id) || []).reduce((s: number, f: any) => s + Number(f.custo || 0), 0),
    };
  });

  const totais = {
    faturamento: resultado.reduce((s, d) => s + Number(d.faturamento_previsto || 0), 0),
    custo: resultado.reduce((s, d) => s + d.custo_dia, 0),
  };

  return NextResponse.json({ dias: resultado, funcoes: funcoes || [], parametros: params, totais });
}
