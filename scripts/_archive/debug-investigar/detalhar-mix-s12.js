/**
 * Script para detalhar o cálculo do mix da semana 12 evento por evento
 */

async function detalhar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('📊 DETALHAMENTO DO MIX - SEMANA 12\n');
    console.log('Faturamento Total:', data.faturamento_total.toFixed(2), '\n');

    let somaBebidasPonderado = 0;
    let somaDrinksPonderado = 0;
    let somaComidaPonderado = 0;

    console.log('📋 CONTRIBUIÇÃO DE CADA EVENTO:\n');
    
    data.eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const contribB = fat * (e.percent_b / 100);
      const contribD = fat * (e.percent_d / 100);
      const contribC = fat * (e.percent_c / 100);
      
      somaBebidasPonderado += contribB;
      somaDrinksPonderado += contribD;
      somaComidaPonderado += contribC;

      console.log(`${e.data} - ${e.nome}`);
      console.log(`  Faturamento: R$ ${fat.toFixed(2)}`);
      console.log(`  Mix: B=${e.percent_b?.toFixed(2)}% D=${e.percent_d?.toFixed(2)}% C=${e.percent_c?.toFixed(2)}%`);
      console.log(`  Contribuição: B=R$ ${contribB.toFixed(2)} D=R$ ${contribD.toFixed(2)} C=R$ ${contribC.toFixed(2)}`);
      console.log('');
    });

    const fatTotal = data.faturamento_total;
    const percB = (somaBebidasPonderado / fatTotal) * 100;
    const percD = (somaDrinksPonderado / fatTotal) * 100;
    const percC = (somaComidaPonderado / fatTotal) * 100;

    console.log('🧮 CÁLCULO FINAL (Média Ponderada):');
    console.log(`  Soma Bebidas Ponderado: R$ ${somaBebidasPonderado.toFixed(2)}`);
    console.log(`  Soma Drinks Ponderado: R$ ${somaDrinksPonderado.toFixed(2)}`);
    console.log(`  Soma Comida Ponderado: R$ ${somaComidaPonderado.toFixed(2)}`);
    console.log(`  Faturamento Total: R$ ${fatTotal.toFixed(2)}`);
    console.log('');
    console.log(`  % Bebidas = ${somaBebidasPonderado.toFixed(2)} / ${fatTotal.toFixed(2)} * 100 = ${percB.toFixed(4)}%`);
    console.log(`  % Drinks = ${somaDrinksPonderado.toFixed(2)} / ${fatTotal.toFixed(2)} * 100 = ${percD.toFixed(4)}%`);
    console.log(`  % Comida = ${somaComidaPonderado.toFixed(2)} / ${fatTotal.toFixed(2)} * 100 = ${percC.toFixed(4)}%`);
    console.log('');
    console.log('🎯 Comparação:');
    console.log(`  Planilha: 67.7%`);
    console.log(`  Calculado: ${percB.toFixed(2)}%`);
    console.log(`  Diferença: ${Math.abs(percB - 67.7).toFixed(4)}%`);
    console.log('');
    console.log('💡 Possíveis causas da diferença:');
    console.log('  1. Arredondamento na planilha vs sistema');
    console.log('  2. Algum evento tem faturamento ou % ligeiramente diferente na planilha');
    console.log('  3. Planilha pode estar usando dados de outra fonte');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

detalhar();
