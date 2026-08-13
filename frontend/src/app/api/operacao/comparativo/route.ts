import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');
const fin = (c: ReturnType<typeof sb>) => (c as any).schema('financial');

/** Segunda-feira da semana de uma data (a semana da operação é seg→dom). */
function segundaDe(dataISO: string) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  x.setUTCDate(x.getUTCDate() - (x.getUTCDay() === 0 ? 6 : x.getUTCDay() - 1));
  return x.toISOString().slice(0, 10);
}

// =====================================================
// Planejado × Realizado, por semana.
//
// POR QUE SEMANA E NÃO DIA: o plano projeta por função e por dia, mas o freela é PAGO por
// semana (competência = segunda) e em 5 categorias grossas (Atendimento, Bar, Cozinha,
// Segurança, Limpeza). Comparar por dia ou por função daria um número inventado — a
// granularidade do realizado é essa e ponto. A ponte função→grupo mora em
// operations.operacao_funcao.grupo_freela.
//
// GET /api/operacao/comparativo?de=2026-08-01&ate=2026-08-31
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

  const [{ data: dias }, { data: linhas }, { data: funcoes }, { data: eventos }, { data: freelas }] =
    await Promise.all([
      ops(c).from('operacao_dia').select('id, data, turno, faturamento_previsto')
        .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate),
      ops(c).from('v_operacao_dia_funcao').select('operacao_dia_id, data, funcao_id, freelas, custo, entra_no_custo')
        .eq('bar_id', user.bar_id).gte('data', de).lte('data', ate),
      ops(c).from('operacao_funcao').select('id, codigo, nome, grupo_freela').eq('bar_id', user.bar_id),
      // receita realizada do dia
      ops(c).from('eventos').select('data_evento, real_r')
        .eq('bar_id', user.bar_id).gte('data_evento', de).lte('data_evento', ate),
      // freela efetivamente pago (competência = segunda da semana trabalhada)
      fin(c).from('pedidos_pagamento')
        .select('data_competencia, categoria_nome, descricao, valor')
        .eq('bar_id', user.bar_id).eq('tipo', 'freela')
        .gte('data_competencia', segundaDe(de)).lte('data_competencia', ate),
    ]);

  const grupoDe = new Map<string, string | null>((funcoes || []).map((f: any) => [f.id, f.grupo_freela]));

  type Semana = {
    inicio: string;
    faturamento_previsto: number; faturamento_real: number;
    custo_projetado: number; custo_pago: number;
    grupos: Record<string, { diarias_planejadas: number; diarias_pagas: number; custo_projetado: number; custo_pago: number }>;
    tem_pagamento: boolean;
  };
  const semanas = new Map<string, Semana>();
  const nova = (ini: string): Semana => ({
    inicio: ini, faturamento_previsto: 0, faturamento_real: 0,
    custo_projetado: 0, custo_pago: 0, grupos: {}, tem_pagamento: false,
  });
  const pega = (ini: string) => {
    if (!semanas.has(ini)) semanas.set(ini, nova(ini));
    return semanas.get(ini)!;
  };
  const pegaGrupo = (s: Semana, g: string) => {
    if (!s.grupos[g]) s.grupos[g] = { diarias_planejadas: 0, diarias_pagas: 0, custo_projetado: 0, custo_pago: 0 };
    return s.grupos[g];
  };

  const diaPorId = new Map((dias || []).map((d: any) => [d.id, d]));
  (dias || []).forEach((d: any) => {
    const s = pega(segundaDe(d.data));
    s.faturamento_previsto += Number(d.faturamento_previsto || 0);
  });

  (linhas || []).forEach((l: any) => {
    if (!l.entra_no_custo) return;
    const d: any = diaPorId.get(l.operacao_dia_id);
    if (!d) return;
    const s = pega(segundaDe(d.data));
    s.custo_projetado += Number(l.custo || 0);
    const g = grupoDe.get(l.funcao_id);
    if (!g) return;
    const gr = pegaGrupo(s, g);
    gr.diarias_planejadas += Number(l.freelas || 0);
    gr.custo_projetado += Number(l.custo || 0);
  });

  (eventos || []).forEach((e: any) => {
    const s = pega(segundaDe(e.data_evento));
    s.faturamento_real += Number(e.real_r || 0);
  });

  (freelas || []).forEach((p: any) => {
    const s = pega(segundaDe(p.data_competencia));
    const valor = Number(p.valor || 0);
    s.custo_pago += valor;
    s.tem_pagamento = true;
    const g = String(p.categoria_nome || '').replace(/^FREELA\s+/i, '').toUpperCase();
    if (!g) return;
    const gr = pegaGrupo(s, g);
    gr.custo_pago += valor;
    // a quantidade de diárias só existe escrita na descrição ("… (3 diária(s))")
    const m = /(\d+)\s+di[áa]ria/i.exec(String(p.descricao || ''));
    if (m) gr.diarias_pagas += Number(m[1]);
  });

  const lista = [...semanas.values()]
    .filter(s => s.inicio >= segundaDe(de))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map(s => {
      const fim = new Date(Date.parse(s.inicio + 'T00:00:00Z') + 6 * 86400000).toISOString().slice(0, 10);
      return {
        ...s,
        fim,
        // Sem pagamento lançado a semana NÃO tem diferença de zero — tem diferença
        // desconhecida. Mostrar 0 faria parecer que fechou no alvo.
        diferenca_custo: s.tem_pagamento ? s.custo_pago - s.custo_projetado : null,
        diferenca_faturamento: s.faturamento_real > 0 ? s.faturamento_real - s.faturamento_previsto : null,
        grupos: Object.entries(s.grupos)
          .map(([nome, v]) => ({ nome, ...v, diferenca: s.tem_pagamento ? v.custo_pago - v.custo_projetado : null }))
          .sort((a, b) => Math.abs(b.diferenca ?? 0) - Math.abs(a.diferenca ?? 0)),
      };
    });

  return NextResponse.json({
    semanas: lista,
    aviso_granularidade:
      'O freela é pago por semana e em 5 grupos (Atendimento, Bar, Cozinha, Segurança, Limpeza). ' +
      'A comparação por função ou por dia não existe no realizado.',
  });
}
