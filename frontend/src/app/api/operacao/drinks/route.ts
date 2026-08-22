import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Painel de Drinks — o aprofundamento da área Bar.
 *
 * Pedido da Mafê (22/08/2026), item a item: faturamento de drinks, quantidade, % do faturamento
 * total, ticket médio, CMV médio, ranking (qtd / faturamento / margem), mix de vendas, vendas por
 * dia da semana e faixa de horário, tempo médio de saída, evolução semanal, classificação
 * automática em Destaques / Alto giro / Oportunidades / Baixa performance, e filtro por casa e
 * período.
 *
 * Todo o cálculo mora em `gold.fn_drinks_painel` — uma chamada, ~550 ms. A rota só resolve
 * período e bar. Cálculo no banco porque o recorte de "o que é um drink" precisa valer igual em
 * qualquer tela que venha depois; se ficasse aqui, a próxima tela reimplementaria e divergiria.
 */

const hojeBRT = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

/** Aritmética de data em ISO puro: `new Date('2026-08-21')` é UTC e volta um dia no BRT. */
const addDias = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const de = sp.get('de');
  const ate = sp.get('ate');

  let ini: string;
  let fim: string;
  if (de && ate && ISO.test(de) && ISO.test(ate) && de <= ate) {
    ini = de; fim = ate;
  } else {
    // `dias` inclui hoje, então -(dias-1): "28 dias" = 4 semanas fechadas, não 29 dias.
    const dias = Math.min(365, Math.max(7, Number(sp.get('dias')) || 28));
    fim = hojeBRT();
    ini = addDias(fim, -(dias - 1));
  }

  const supabase = await getAdminClient();
  // `.schema('gold')` é obrigatório — sem ele o PostgREST procura em `public` e falha.
  const { data, error } = await (supabase as any).schema('gold').rpc('fn_drinks_painel', {
    p_bar: user.bar_id, p_ini: ini, p_fim: fim,
  });

  if (error) {
    console.error('[operacao/drinks] fn_drinks_painel falhou:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, painel: data });
}
