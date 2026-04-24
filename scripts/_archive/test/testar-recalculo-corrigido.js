/**
 * Testa o recálculo do mix com a correção aplicada
 */

async function testar() {
  try {
    console.log('🧪 TESTANDO RECÁLCULO COM CORREÇÃO\n');
    console.log('Recalculando mix da semana 12...\n');

    const response = await fetch('http://localhost:3001/api/gestao/desempenho/recalcular-mix?semana=12&ano=2026', {
      method: 'POST',
      headers: { 
        'x-selected-bar-id': '3'
      },
    });

    if (!response.ok) {
      console.log(`❌ Erro HTTP: ${response.status}`);
      const text = await response.text();
      console.log('Resposta:', text);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Recálculo executado!\n');
    console.log('📊 RESULTADO:\n');
    console.log(`Mix Anterior:`);
    console.log(`  Bebidas: ${data.mix_anterior.perc_bebidas.toFixed(4)}%`);
    console.log(`  Drinks: ${data.mix_anterior.perc_drinks.toFixed(4)}%`);
    console.log(`  Comida: ${data.mix_anterior.perc_comida.toFixed(4)}%\n`);

    console.log(`Mix Novo:`);
    console.log(`  Bebidas: ${data.mix_novo.perc_bebidas.toFixed(4)}%`);
    console.log(`  Drinks: ${data.mix_novo.perc_drinks.toFixed(4)}%`);
    console.log(`  Comida: ${data.mix_novo.perc_comida.toFixed(4)}%\n`);

    console.log(`Diferença vs Planilha (67.7%):`);
    console.log(`  ${Math.abs(data.mix_novo.perc_bebidas - 67.7).toFixed(4)}%\n`);

    if (Math.abs(data.mix_novo.perc_bebidas - 67.7) < 0.05) {
      console.log('🎯 ✅ BATE COM A PLANILHA! (diferença < 0.05%)');
    } else {
      console.log('⚠️  Ainda não bate exatamente. Diferença:', Math.abs(data.mix_novo.perc_bebidas - 67.7).toFixed(4), '%');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
