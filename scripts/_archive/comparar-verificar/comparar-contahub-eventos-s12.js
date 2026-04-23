/**
 * Compara contahub_analitico com eventos_base para semana 12
 */

async function comparar() {
  try {
    console.log('🔍 COMPARANDO contahub_analitico vs eventos_base - SEMANA 12\n');

    const barId = 3;
    const dataInicio = '2026-03-16';
    const dataFim = '2026-03-22';

    // 1. Buscar de contahub_analitico
    const contahubResp = await fetch('http://localhost:3001/api/debug/contahub-analitico-semana', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-selected-bar-id': '3'
      },
      body: JSON.stringify({
        bar_id: barId,
        data_inicio: dataInicio,
        data_fim: dataFim,
      }),
    });

    if (!contahubResp.ok) {
      console.log('⚠️  API de contahub_analitico não existe. Criando...\n');
      console.log('Precisamos criar uma API para buscar dados de contahub_analitico');
      console.log('e comparar com eventos_base.\n');
      
      console.log('💡 ALTERNATIVA:');
      console.log('   Podemos consultar direto no Supabase via SQL:');
      console.log('');
      console.log('   SELECT');
      console.log('     categoria_produto,');
      console.log('     SUM(valor_final) as total');
      console.log('   FROM contahub_analitico');
      console.log(`   WHERE bar_id = ${barId}`);
      console.log(`     AND data_venda >= '${dataInicio}'`);
      console.log(`     AND data_venda <= '${dataFim}'`);
      console.log('   GROUP BY categoria_produto;');
      console.log('');
      
      return;
    }

    const contahubData = await contahubResp.json();

    // 2. Buscar de eventos_base
    const eventosResp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const eventosData = await eventosResp.json();

    console.log('📊 FATURAMENTO TOTAL:\n');
    console.log(`   contahub_analitico: R$ ${contahubData.faturamento_total.toFixed(2)}`);
    console.log(`   eventos_base: R$ ${eventosData.faturamento_total.toFixed(2)}`);
    console.log(`   Diferença: R$ ${Math.abs(contahubData.faturamento_total - eventosData.faturamento_total).toFixed(2)}\n`);

    console.log('📊 MIX DE VENDAS:\n');
    console.log(`   contahub_analitico: ${contahubData.mix.perc_bebidas.toFixed(4)}%`);
    console.log(`   eventos_base: ${eventosData.mix_calculado_manual.perc_bebidas.toFixed(4)}%`);
    console.log(`   Diferença: ${Math.abs(contahubData.mix.perc_bebidas - eventosData.mix_calculado_manual.perc_bebidas).toFixed(4)}%\n`);

    console.log('🎯 CONCLUSÃO:');
    if (Math.abs(contahubData.mix.perc_bebidas - 67.7) < 0.01) {
      console.log('   ✅ contahub_analitico bate com planilha (67.7%)');
      console.log('   A diferença está em eventos_base ter dados diferentes');
    } else {
      console.log('   ⚠️  Nenhuma fonte bate exatamente com 67.7%');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

comparar();
