import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 1. TOP 20 PRODUTOS MAIS VENDIDOS (por quantidade)
    const { data: produtosPorQtd } = await supabase
      .from('contahub_analitico')
      .select('prd_desc, qtd, valorfinal')
      .eq('bar_id', barId)
      .not('prd_desc', 'is', null)
      .neq('prd_desc', '');

    const produtosAgregados: any = {};
    (produtosPorQtd || []).forEach((venda: any) => {
      const produto = venda.prd_desc;
      if (!produtosAgregados[produto]) {
        produtosAgregados[produto] = {
          produto,
          quantidade_vendida: 0,
          faturamento_total: 0,
          quantidade_transacoes: 0
        };
      }
      produtosAgregados[produto].quantidade_vendida += venda.qtd || 0;
      produtosAgregados[produto].faturamento_total += venda.valorfinal || 0;
      produtosAgregados[produto].quantidade_transacoes += 1;
    });

    const topProdutos = Object.values(produtosAgregados)
      .map((p: any) => ({
        ...p,
        preco_medio: p.faturamento_total / p.quantidade_vendida,
        ticket_medio_transacao: p.faturamento_total / p.quantidade_transacoes
      }))
      .sort((a: any, b: any) => b.quantidade_vendida - a.quantidade_vendida)
      .slice(0, 20);

    // 2. PRODUTOS COM MAIOR MARGEM (assumindo margem = faturamento - custo estimado)
    // Vamos usar uma estimativa: bebidas ~30% custo, comida ~40% custo
    const produtosComMargem = Object.values(produtosAgregados)
      .map((p: any) => {
        const produto = p.produto.toLowerCase();
        let custoEstimado = 0.35; // Padrão 35%
        
        if (produto.includes('cerveja') || produto.includes('chopp') || produto.includes('drink')) {
          custoEstimado = 0.30;
        } else if (produto.includes('comida') || produto.includes('porção') || produto.includes('lanche')) {
          custoEstimado = 0.40;
        } else if (produto.includes('água') || produto.includes('refrigerante')) {
          custoEstimado = 0.25;
        }
        
        const margemEstimada = p.faturamento_total * (1 - custoEstimado);
        
        return {
          produto: p.produto,
          faturamento_total: p.faturamento_total,
          custo_estimado_pct: custoEstimado * 100,
          margem_estimada: margemEstimada,
          margem_pct: (1 - custoEstimado) * 100
        };
      })
      .sort((a: any, b: any) => b.margem_estimada - a.margem_estimada)
      .slice(0, 20);

    // 3. PRODUTOS MAIS CANCELADOS (valor negativo indica cancelamento)
    const { data: cancelamentos } = await supabase
      .from('contahub_analitico')
      .select('prd_desc, qtd, valorfinal')
      .eq('bar_id', barId)
      .lt('valorfinal', 0)
      .not('prd_desc', 'is', null);

    const produtosCancelados: any = {};
    (cancelamentos || []).forEach((cancel: any) => {
      const produto = cancel.prd_desc;
      if (!produtosCancelados[produto]) {
        produtosCancelados[produto] = {
          produto,
          quantidade_cancelada: 0,
          valor_cancelado: 0,
          quantidade_cancelamentos: 0
        };
      }
      produtosCancelados[produto].quantidade_cancelada += Math.abs(cancel.qtd || 0);
      produtosCancelados[produto].valor_cancelado += Math.abs(cancel.valorfinal || 0);
      produtosCancelados[produto].quantidade_cancelamentos += 1;
    });

    const topCancelados = Object.values(produtosCancelados)
      .sort((a: any, b: any) => b.quantidade_cancelamentos - a.quantidade_cancelamentos)
      .slice(0, 20);

    // 4. PRODUTOS QUE VENDEM JUNTOS (análise de combos)
    // Buscar transações do mesmo horário/mesa
    const { data: transacoesPorHora } = await supabase
      .from('contahub_analitico')
      .select('trn_dtgerencial, hora, prd_desc, qtd')
      .eq('bar_id', barId)
      .not('prd_desc', 'is', null)
      .gte('trn_dtgerencial', new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0])
      .order('trn_dtgerencial', { ascending: false })
      .order('hora', { ascending: false })
      .limit(10000);

    // Agrupar por data+hora (proxy de "mesma mesa")
    const transacoesPorMomento: any = {};
    (transacoesPorHora || []).forEach((t: any) => {
      const chave = `${t.trn_dtgerencial}-${t.hora}`;
      if (!transacoesPorMomento[chave]) {
        transacoesPorMomento[chave] = [];
      }
      transacoesPorMomento[chave].push(t.prd_desc);
    });

    // Encontrar combinações frequentes
    const combos: any = {};
    Object.values(transacoesPorMomento).forEach((produtos: any) => {
      if (produtos.length >= 2) {
        const produtosUnicos = [...new Set(produtos)];
        if (produtosUnicos.length >= 2) {
          for (let i = 0; i < produtosUnicos.length; i++) {
            for (let j = i + 1; j < produtosUnicos.length; j++) {
              const combo = [produtosUnicos[i], produtosUnicos[j]].sort().join(' + ');
              combos[combo] = (combos[combo] || 0) + 1;
            }
          }
        }
      }
    });

    const topCombos = Object.entries(combos)
      .map(([combo, frequencia]) => ({ combo, frequencia }))
      .sort((a: any, b: any) => b.frequencia - a.frequencia)
      .slice(0, 20);

    // 5. PRODUTOS COM VENDA DECRESCENTE (comparar últimos 3 meses vs 3 meses anteriores)
    const dataLimite3Meses = new Date();
    dataLimite3Meses.setMonth(dataLimite3Meses.getMonth() - 3);
    const dataLimite6Meses = new Date();
    dataLimite6Meses.setMonth(dataLimite6Meses.getMonth() - 6);

    const { data: vendasRecentes } = await supabase
      .from('contahub_analitico')
      .select('prd_desc, qtd, valorfinal, trn_dtgerencial')
      .eq('bar_id', barId)
      .gte('trn_dtgerencial', dataLimite6Meses.toISOString().split('T')[0])
      .not('prd_desc', 'is', null);

    const vendasPorPeriodo: any = {};
    (vendasRecentes || []).forEach((venda: any) => {
      const produto = venda.prd_desc;
      const data = new Date(venda.trn_dtgerencial);
      const periodo = data >= dataLimite3Meses ? 'recente' : 'anterior';
      
      if (!vendasPorPeriodo[produto]) {
        vendasPorPeriodo[produto] = {
          produto,
          qtd_recente: 0,
          qtd_anterior: 0,
          fat_recente: 0,
          fat_anterior: 0
        };
      }
      
      if (periodo === 'recente') {
        vendasPorPeriodo[produto].qtd_recente += venda.qtd || 0;
        vendasPorPeriodo[produto].fat_recente += venda.valorfinal || 0;
      } else {
        vendasPorPeriodo[produto].qtd_anterior += venda.qtd || 0;
        vendasPorPeriodo[produto].fat_anterior += venda.valorfinal || 0;
      }
    });

    const produtosDecrescentes = Object.values(vendasPorPeriodo)
      .filter((p: any) => p.qtd_anterior > 0 && p.qtd_recente > 0)
      .map((p: any) => ({
        ...p,
        variacao_qtd_pct: ((p.qtd_recente - p.qtd_anterior) / p.qtd_anterior) * 100,
        variacao_fat_pct: ((p.fat_recente - p.fat_anterior) / p.fat_anterior) * 100
      }))
      .filter((p: any) => p.variacao_qtd_pct < -10)
      .sort((a: any, b: any) => a.variacao_qtd_pct - b.variacao_qtd_pct)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      exploracao: {
        top_20_mais_vendidos: topProdutos,
        top_20_maior_margem: produtosComMargem,
        top_20_mais_cancelados: topCancelados,
        top_20_combos: topCombos,
        produtos_decrescentes: produtosDecrescentes
      }
    });

  } catch (error: any) {
    console.error('Erro na exploração de produtos:', error);
    return NextResponse.json(
      { error: 'Erro ao explorar produtos', details: error.message },
      { status: 500 }
    );
  }
}
