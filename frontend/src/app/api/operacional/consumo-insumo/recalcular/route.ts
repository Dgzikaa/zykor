import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Botão "Recalcular" da tela de Saídas (pedido do Isaías, 18/08/2026).
 *
 * A embalagem em si JÁ é lida ao vivo: `silver.fn_consumo_insumo_periodo` resolve
 * `coalesce(insumo_unidade.embalagem, derive_embalagem(...))` na hora da consulta, pela chave
 * manual `-i.id`, e faz `qtd_contagem = qtd_base / embalagem` na saída. Trocar a embalagem na tela
 * de Insumos muda o número no mesmo instante — o que segurava era o cache do navegador (o SWR
 * dedupa 30s e não revalida ao focar a aba), então quem voltava para as Saídas via o valor velho e
 * concluía que "não recalculou".
 *
 * O que NÃO é ao vivo é a base: `qtd_base` vem da matview `silver.consumo_teorico_insumo_dia`, que
 * embute ficha técnica e multiplicador. Mexer na ficha exigia esperar o cron. Por isso o botão
 * refaz essa matview antes de devolver — aí ele resolve os dois casos de uma vez.
 *
 * Usa `silver.fn_refresh_saidas()` (~3s) e NÃO a `fn_refresh_consumo_teorico()` (~18s), que
 * refaz também as duas matviews de vendas e estouraria o teto de 8s do PostgREST — foi o que
 * fazia o botão "vincular" do de-para parecer morto (ver 20260811_vincular_depara_refresh_confiavel).
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request);
  if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('silver').rpc('fn_refresh_saidas');

  if (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      aviso: 'O recálculo não completou. Os números seguem os da última atualização automática.',
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    segundos: (data as any)?.segundos ?? null,
    mensagem: 'Saídas recalculadas com a ficha técnica e a embalagem atuais.',
  });
}
