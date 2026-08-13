import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

const hoje = () => new Date().toISOString().slice(0, 10);

// =====================================================
// Parâmetros do plano operacional (o bloco "Parâmetros - não mexer" da planilha).
//
// GET  — devolve o vigente hoje + as funções, pra tela montar o formulário.
// PUT  — grava. NÃO edita a vigência atual: FECHA ela ontem e ABRE uma nova a partir de hoje.
//
// Por que fechar em vez de editar: o custo projetado de junho foi calculado com a diária de
// junho. Editar a linha vigente reescreveria o passado e um mês já fechado mudaria de valor
// sozinho — a mesma armadilha que já pegou o CMV teórico e custou uma investigação inteira.
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const c = sb();
  const [{ data: p }, { data: funcoes }] = await Promise.all([
    ops(c).from('operacao_parametro').select('*')
      .eq('bar_id', user.bar_id).is('vigencia_fim', null)
      .order('vigencia_inicio', { ascending: false }).limit(1).maybeSingle(),
    ops(c).from('operacao_funcao').select('*').eq('bar_id', user.bar_id).eq('ativo', true).order('ordem'),
  ]);

  if (!p) return NextResponse.json({ parametro: null, funcoes: funcoes || [], tickets: [], por_funcao: [] });

  const [{ data: tickets }, { data: porFuncao }] = await Promise.all([
    ops(c).from('operacao_parametro_ticket').select('*').eq('parametro_id', p.id).order('dia_semana'),
    ops(c).from('operacao_parametro_funcao').select('*').eq('parametro_id', p.id),
  ]);

  // histórico, pra tela deixar claro que mudar cria uma vigência nova
  const { data: historico } = await ops(c).from('operacao_parametro')
    .select('id, vigencia_inicio, vigencia_fim, giro, observacao')
    .eq('bar_id', user.bar_id).order('vigencia_inicio', { ascending: false }).limit(12);

  return NextResponse.json({
    parametro: p,
    funcoes: funcoes || [],
    tickets: tickets || [],
    por_funcao: porFuncao || [],
    historico: historico || [],
  });
}

export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const giro = Number(body.giro);
  const tickets: Array<{ dia_semana: number; ticket_medio: number }> = body.tickets || [];
  const porFuncao: Array<{
    funcao_id: string; nivel_servico: number | null; diaria: number | null;
    custo_fechado_dia?: number | null;
  }> = body.por_funcao || [];
  if (!Number.isFinite(giro) || giro <= 0) return NextResponse.json({ error: 'Giro inválido' }, { status: 400 });

  const c = sb();
  const inicio = String(body.vigencia_inicio || hoje());
  const ontem = new Date(Date.parse(inicio + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);

  // fecha a vigência atual no dia anterior — o passado fica com os números do passado
  const { data: atual } = await ops(c).from('operacao_parametro')
    .select('id, vigencia_inicio, cmo_fixo_mensal, limite_cmo_pct')
    .eq('bar_id', user.bar_id).is('vigencia_fim', null)
    .order('vigencia_inicio', { ascending: false }).limit(1).maybeSingle();

  // O CMO fixo e o teto HERDAM da vigência anterior quando não vierem no body. Sem isso a
  // vigência nova nascia com folha nula e o CMO% despencava pra ~4% sem ninguém entender —
  // a tela não mandava esses campos e o insert abaixo os deixava de fora.
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const cmoFixoMensal = 'cmo_fixo_mensal' in body ? num(body.cmo_fixo_mensal) : (atual?.cmo_fixo_mensal ?? null);
  const limiteCmo = 'limite_cmo_pct' in body ? num(body.limite_cmo_pct) : (atual?.limite_cmo_pct ?? 20);

  if (atual) {
    if (atual.vigencia_inicio >= inicio) {
      // mesma data de início: é correção do que acabou de ser criado, não vigência nova
      await ops(c).from('operacao_parametro_ticket').delete().eq('parametro_id', atual.id);
      await ops(c).from('operacao_parametro_funcao').delete().eq('parametro_id', atual.id);
      await ops(c).from('operacao_parametro').delete().eq('id', atual.id);
    } else {
      await ops(c).from('operacao_parametro').update({ vigencia_fim: ontem }).eq('id', atual.id);
    }
  }

  const { data: novo, error } = await ops(c).from('operacao_parametro').insert({
    bar_id: user.bar_id, vigencia_inicio: inicio, giro,
    cmo_fixo_mensal: cmoFixoMensal, limite_cmo_pct: limiteCmo,
    observacao: body.observacao || null, criado_por: user.auth_id,
  }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (tickets.length) {
    const { error: e } = await ops(c).from('operacao_parametro_ticket').insert(
      tickets.map(t => ({ parametro_id: novo.id, dia_semana: t.dia_semana, ticket_medio: t.ticket_medio })),
    );
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }
  if (porFuncao.length) {
    const { error: e } = await ops(c).from('operacao_parametro_funcao').insert(
      porFuncao.map(f => ({
        parametro_id: novo.id, funcao_id: f.funcao_id,
        nivel_servico: f.nivel_servico, diaria: f.diaria,
        custo_fechado_dia: f.custo_fechado_dia ?? null,
      })),
    );
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ parametro_id: novo.id, vigencia_inicio: inicio, fechou_anterior: !!atual });
}
