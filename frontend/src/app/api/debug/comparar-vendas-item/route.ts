import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Compara dados de vendas_item entre semanas para identificar anomalias
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    const barId = 3;

    const semanas = [
      { num: 10, inicio: '2026-03-02', fim: '2026-03-08' },
      { num: 11, inicio: '2026-03-09', fim: '2026-03-15' },
      { num: 12, inicio: '2026-03-16', fim: '2026-03-22' },
      { num: 13, inicio: '2026-03-23', fim: '2026-03-29' },
    ];

    const resultados = [];

    for (const semana of semanas) {
      // Buscar vendas_item
      const { data: vendasItem } = await supabase
        .from('vendas_item')
        .select('data_venda, valor, local_desc')
        .eq('bar_id', barId)
        .gte('data_venda', semana.inicio)
        .lte('data_venda', semana.fim)
        .gt('valor', 0);

      // Buscar eventos
      const { data: eventos } = await supabase
        .from('eventos_base')
        .select('data_evento, real_r')
        .eq('bar_id', barId)
        .gte('data_evento', semana.inicio)
        .lte('data_evento', semana.fim)
        .eq('ativo', true);

      // Buscar mapeamento
      const { data: mapeamento } = await supabase
        .from('bar_local_mapeamento')
        .select('*')
        .eq('bar_id', barId)
        .single();

      const locaisBebidas = mapeamento?.bebidas || [];
      const locaisDrinks = mapeamento?.drinks || [];
      const locaisComidas = mapeamento?.comidas || [];

      // Calcular totais
      const totalVendasItem = (vendasItem || []).reduce((acc: number, v: any) => acc + (v.valor || 0), 0);
      const totalEventos = (eventos || []).reduce((acc: number, e: any) => acc + (e.real_r || 0), 0);

      // Calcular mix do vendas_item
      let bebidasVI = 0;
      let drinksVI = 0;
      let comidasVI = 0;
      let outrosVI = 0;

      (vendasItem || []).forEach((item: any) => {
        const valor = item.valor || 0;
        const local = item.local_desc || '';

        if (locaisBebidas.includes(local)) {
          bebidasVI += valor;
        } else if (locaisDrinks.includes(local)) {
          drinksVI += valor;
        } else if (locaisComidas.includes(local)) {
          comidasVI += valor;
        } else {
          outrosVI += valor;
        }
      });

      // Contar locais distintos
      const locaisDistintos = new Set((vendasItem || []).map((v: any) => v.local_desc)).size;
      const locaisNaoMapeados = new Set(
        (vendasItem || [])
          .map((v: any) => v.local_desc)
          .filter((l: string) => 
            !locaisBebidas.includes(l) && 
            !locaisDrinks.includes(l) && 
            !locaisComidas.includes(l)
          )
      );

      resultados.push({
        semana: semana.num,
        periodo: `${semana.inicio} até ${semana.fim}`,
        vendas_item: {
          total: totalVendasItem,
          registros: (vendasItem || []).length,
          locais_distintos: locaisDistintos,
          locais_nao_mapeados: Array.from(locaisNaoMapeados),
          mix: {
            bebidas: totalVendasItem > 0 ? ((bebidasVI + outrosVI) / totalVendasItem) * 100 : 0,
            drinks: totalVendasItem > 0 ? (drinksVI / totalVendasItem) * 100 : 0,
            comida: totalVendasItem > 0 ? (comidasVI / totalVendasItem) * 100 : 0,
          },
          valores: {
            bebidas: bebidasVI,
            drinks: drinksVI,
            comidas: comidasVI,
            outros: outrosVI,
          }
        },
        eventos: {
          total: totalEventos,
          count: (eventos || []).length,
        },
        cobertura: {
          percentual: totalEventos > 0 ? (totalVendasItem / totalEventos) * 100 : 0,
          faltando: totalEventos - totalVendasItem,
        }
      });
    }

    return NextResponse.json({
      success: true,
      semanas: resultados,
      analise: {
        semana_com_problema: resultados.find(r => r.cobertura.percentual < 50)?.semana || null,
        todas_coberturas: resultados.map(r => ({
          semana: r.semana,
          cobertura: r.cobertura.percentual.toFixed(2) + '%',
        })),
      }
    });

  } catch (error) {
    console.error('Erro na comparação:', error);
    return NextResponse.json(
      { error: 'Erro interno', details: String(error) },
      { status: 500 }
    );
  }
}
