import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * Preparo que VENDEU muito mais do que foi lançado como PRODUZIDO.
 *
 * Nasceu do caso do pastel de queijo no Deboche (18/08/2026): entre 01/07 e 17/08 saíram 1.052
 * pastéis pela venda e só 50 foram lançados como feitos. Como o insumo só é debitado quando alguém
 * registra a produção, a mussarela, o cream cheese e a massa apareceram como desvio — R$ 5,5 mil
 * de "perda" que não era perda, era lançamento faltando. E, pior, um desvio de verdade some no meio
 * de um número inflado assim.
 *
 * Reaproveita `gold.fn_desvios`, que já calcula os dois lados na linha do preparo: `saida_teorica`
 * (o que a venda consumiu) contra `produzido` (o que a equipe registrou). Não recalcula nada por
 * fora — se o desvio mudar de regra, este alerta acompanha sozinho.
 *
 * GET ?bar_id=&ini=&fim=
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');

  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const ini = sp.get('ini');
  const fim = sp.get('fim');
  if (!barId || !ini || !fim) {
    return NextResponse.json({ success: false, error: 'bar_id, ini e fim são obrigatórios' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('gold').rpc('fn_desvios', {
    p_bar: barId, p_ini: ini, p_fim: fim,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = ((data || []) as any[])
    .filter((r) => r.is_producao)
    .map((r) => {
      const vendido = Number(r.saida_teorica || 0);
      const produzido = Number(r.produzido || 0);
      return { r, vendido, produzido, faltando: vendido - produzido };
    })
    // Só o que é gritante: sobrou mais da metade do que saiu por registrar. Preparo com folga
    // pequena é ritmo normal de estoque (produz num dia, vende no outro) e viraria ruído.
    .filter((x) => x.vendido > 0 && x.faltando > 0 && x.faltando / x.vendido >= 0.5)
    .map((x) => ({
      codigo: String(x.r.insumo_codigo || '').toLowerCase(),
      nome: x.r.insumo_nome,
      unidade: x.r.unidade,
      vendido: Number(x.vendido.toFixed(3)),
      produzido: Number(x.produzido.toFixed(3)),
      faltando: Number(x.faltando.toFixed(3)),
      pct_sem_registro: Math.round((x.faltando / x.vendido) * 100),
      // o desvio em R$ dos INSUMOS é o que dói, mas aqui dá pra mostrar o do próprio preparo
      desvio_rs: x.r.desvio_rs == null ? null : Number(x.r.desvio_rs),
    }))
    .sort((a, b) => b.faltando - a.faltando);

  return NextResponse.json({ success: true, periodo: { ini, fim }, linhas });
}
