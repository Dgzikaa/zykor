import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { equipeDoUsuario } from '@/lib/rh/equipe';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Ações de bar inteiro da Escala.
 *
 *  - `puxar`         : traz as pessoas do ORGANOGRAMA pra escala do período, criando as funções
 *                      que faltam a partir dos cargos. É o que faz um bar sem escala nenhuma
 *                      (o Deboche em 19/08/2026: 0 funções, 0 linhas, 9 cadeiras ocupadas)
 *                      funcionar sem importar planilha.
 *  - `salvar_padrao` : grava o período como a escala PADRÃO de cada pessoa. Depois, `puxar`
 *                      usa esse molde em vez de nascer tudo FOLGA.
 *
 * As duas mexem na casa TODA, não só na equipe de quem clicou — então são de quem enxerga a
 * casa toda (gerência, RH, admin). Líder de área é barrado aqui de propósito: ele monta a
 * escala da equipe dele na grade, não puxa o organograma inteiro.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const acao = String(body.acao || '');
  const de = String(body.de || '');
  const ate = String(body.ate || '');

  const c = sb();
  const equipe = await equipeDoUsuario(c, user);

  /**
   * Padrão de UMA pessoa — o líder edita a da própria equipe. É o caso do "canetinha ao lado
   * do nome", e não é ação de bar inteiro, então não exige enxergar a casa toda.
   */
  if (acao === 'salvar_pessoa') {
    const fid = Number(body.funcionario_id);
    if (!fid) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });
    if (equipe.ids && !equipe.ids.has(fid)) {
      return NextResponse.json({ error: 'Essa pessoa não está na sua equipe.' }, { status: 403 });
    }
    const dias = Array.isArray(body.dias) ? body.dias : [];
    const ops = (c as any).schema('operations');

    // dia sem nada = sem padrão: apaga a linha em vez de gravar tudo nulo, senão "sem padrão"
    // e "padrão vazio" viram estados diferentes com o mesmo significado.
    const paraApagar = dias.filter((d: any) => !d?.entra && !d?.marcador).map((d: any) => Number(d.dia_semana));
    const paraGravar = dias
      .filter((d: any) => d?.entra || d?.marcador)
      .map((d: any) => ({
        bar_id: user.bar_id, funcionario_id: fid, dia_semana: Number(d.dia_semana),
        entra: d.entra || null, sai: d.sai || null, marcador: d.marcador || null,
        atualizado_em: new Date().toISOString(),
      }));

    if (paraApagar.length) {
      const { error } = await ops.from('escala_padrao').delete()
        .eq('funcionario_id', fid).in('dia_semana', paraApagar);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (paraGravar.length) {
      const { error } = await ops.from('escala_padrao')
        .upsert(paraGravar, { onConflict: 'funcionario_id,dia_semana' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, gravados: paraGravar.length, apagados: paraApagar.length });
  }

  // Daqui pra baixo são as ações de BAR INTEIRO: exigem período e visão da casa toda.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });
  }
  if (equipe.ids) {
    return NextResponse.json(
      { error: 'Essa ação é da gerência: ela monta a escala do bar inteiro, não só da sua equipe.' },
      { status: 403 },
    );
  }

  if (acao === 'puxar') {
    const { data, error } = await (c as any).schema('operations')
      .rpc('fn_escala_puxar_do_organograma', { p_bar: user.bar_id, p_de: de, p_ate: ate });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ...(data || {}) });
  }

  if (acao === 'salvar_padrao') {
    const { data, error } = await (c as any).schema('operations')
      .rpc('fn_escala_salvar_padrao', { p_bar: user.bar_id, p_de: de, p_ate: ate });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ...(data || {}) });
  }

  return NextResponse.json({ error: 'ação inválida (use puxar, salvar_padrao ou salvar_pessoa)' }, { status: 400 });
}

/**
 * GET ?funcionario_id= — a escala padrão de UMA pessoa (os 7 dias da semana).
 * Líder lê a da própria equipe; quem vê a casa toda lê de qualquer um.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const fid = Number(new URL(request.url).searchParams.get('funcionario_id'));
  if (!fid) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });

  const c = sb();
  const equipe = await equipeDoUsuario(c, user);
  if (equipe.ids && !equipe.ids.has(fid)) {
    return NextResponse.json({ error: 'Essa pessoa não está na sua equipe.' }, { status: 403 });
  }

  const { data, error } = await (c as any).schema('operations')
    .from('escala_padrao').select('dia_semana, entra, sai, marcador')
    .eq('funcionario_id', fid).order('dia_semana');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dias: data || [] });
}
