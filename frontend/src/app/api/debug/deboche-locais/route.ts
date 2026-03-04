import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar locais únicos do Deboche
    const { data: locaisData, error: errorLocais } = await supabase
      .from('contahub_analitico')
      .select('loc_desc, valorfinal')
      .eq('bar_id', 4)
      .gte('trn_dtgerencial', '2026-02-01')
      .not('loc_desc', 'is', null);

    if (errorLocais) {
      return NextResponse.json({ error: errorLocais.message }, { status: 500 });
    }

    // Agrupar por local
    const locaisAgrupados: Record<string, { count: number; total: number }> = {};
    (locaisData || []).forEach((item: any) => {
      const loc = item.loc_desc;
      if (!locaisAgrupados[loc]) {
        locaisAgrupados[loc] = { count: 0, total: 0 };
      }
      locaisAgrupados[loc].count++;
      locaisAgrupados[loc].total += item.valorfinal || 0;
    });

    // Ordenar por faturamento
    const locaisOrdenados = Object.entries(locaisAgrupados)
      .map(([loc, data]) => ({ loc, ...data }))
      .sort((a, b) => b.total - a.total);

    // 2. Buscar eventos recentes
    const { data: eventos, error: errorEventos } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome, percent_b, percent_d, percent_c, percent_stockout, real_r, c_art, c_prod')
      .eq('bar_id', 4)
      .gte('data_evento', '2026-02-20')
      .order('data_evento', { ascending: false })
      .limit(5);

    if (errorEventos) {
      return NextResponse.json({ error: errorEventos.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      locais: locaisOrdenados,
      eventos: eventos || [],
      mapeamentoAtual: {
        bebidas: ['Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar'],
        comidas: ['Cozinha', 'Cozinha 1', 'Cozinha 2'],
        drinks: ['Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos']
      },
      mapeamentoDebocheSugerido: {
        bebidas: ['Salão'],
        comidas: ['Cozinha 1', 'Cozinha 2'],
        drinks: ['Bar']
      }
    });

  } catch (error: any) {
    console.error('Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
