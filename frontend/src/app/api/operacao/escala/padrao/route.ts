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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();
  const equipe = await equipeDoUsuario(c, user);
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

  return NextResponse.json({ error: 'ação inválida (use puxar ou salvar_padrao)' }, { status: 400 });
}
