import { NextRequest, NextResponse } from 'next/server';
import { fetchMetaAdsInsights, fetchMetaAdsBreakdown, fetchMetaAdsBreakdowns, hasMetaAdsCredentials, getAdAccountId } from '@/lib/meta-ads/insights';

/**
 * Detalhamento de mídia PAGA por CAMPANHA e por ANÚNCIO (aba "Anúncios").
 * Fonte: Marketing API real (act_<id>/insights, level=campaign|ad) via System User token.
 * Retorna resumo (totais da conta) + campanhas + anúncios (com thumbnail do criativo).
 *
 * GET ?bar_id=&inicio=&fim=
 */
export const dynamic = 'force-dynamic';

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const inicio = sp.get('inicio') || sp.get('de');
  const fim = sp.get('fim') || sp.get('ate');
  if (!inicio || !fim) return NextResponse.json({ success: false, error: 'inicio/fim obrigatórios' }, { status: 400 });

  if (!hasMetaAdsCredentials(barId)) {
    return NextResponse.json({
      success: true,
      tem_dados: false,
      configurado: false,
      msg: 'Conta de anúncio não conectada para este bar (env META_ADS_ACCOUNTS).',
    });
  }

  try {
    const [resumo, detalhe, quebras] = await Promise.all([
      fetchMetaAdsInsights(barId, inicio, fim),
      fetchMetaAdsBreakdown(barId, inicio, fim),
      fetchMetaAdsBreakdowns(barId, inicio, fim),
    ]);

    return NextResponse.json({
      success: true,
      configurado: true,
      tem_dados: Boolean(detalhe && detalhe.anuncios.length > 0),
      conta: getAdAccountId(barId),
      resumo: resumo
        ? {
            investimento: Math.round(resumo.investimento),
            impressoes: resumo.impressoes,
            alcance: resumo.alcance,
            cliques: resumo.cliques,
            conversas: resumo.conversas,
            cpm: resumo.cpm,
            ctr: resumo.ctr,
            cpc: resumo.cpc,
            frequencia: resumo.frequencia,
            roas_compra: resumo.roas_compra,
            custo_conversa: resumo.custo_conversa,
            custo_venda: resumo.custo_venda,
            leads: resumo.leads,
            compras: resumo.compras,
            thruplays: resumo.thruplays,
          }
        : null,
      campanhas: detalhe?.campanhas ?? [],
      anuncios: detalhe?.anuncios ?? [],
      posicionamento: quebras?.posicionamento ?? [],
      demografia: quebras?.demografia ?? [],
    });
  } catch (e: any) {
    console.error('[receitas/anuncios] Marketing API falhou:', e?.message);
    return NextResponse.json({ success: false, error: e?.message || 'Falha na Marketing API' }, { status: 502 });
  }
}
