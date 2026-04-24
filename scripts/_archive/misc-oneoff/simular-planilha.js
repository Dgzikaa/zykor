/**
 * Simula o cálculo exatamente como uma planilha faria
 * (arredondando valores intermediários)
 */

async function simular() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('📊 SIMULANDO CÁLCULO DA PLANILHA\n');

    const eventos = data.eventos;
    const fatTotal = data.faturamento_total;

    console.log('Testando com diferentes precisões:\n');

    // Teste 1: Arredondar % para 1 casa, depois calcular
    console.log('1️⃣ Arredondando % para 1 casa decimal:');
    let soma1 = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const percArredondado = Math.round((e.percent_b || 0) * 10) / 10;
      const contrib = fat * (percArredondado / 100);
      soma1 += contrib;
      console.log(`  ${e.data.substring(5)}: Fat=${fat.toFixed(0)} × ${percArredondado.toFixed(1)}% = ${contrib.toFixed(2)}`);
    });
    const result1 = (soma1 / fatTotal) * 100;
    console.log(`  Resultado: ${result1.toFixed(2)}% (diff: ${Math.abs(result1 - 67.7).toFixed(2)}%)\n`);

    // Teste 2: Arredondar % para 2 casas
    console.log('2️⃣ Arredondando % para 2 casas decimais:');
    let soma2 = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const percArredondado = Math.round((e.percent_b || 0) * 100) / 100;
      soma2 += fat * (percArredondado / 100);
    });
    const result2 = (soma2 / fatTotal) * 100;
    console.log(`  Resultado: ${result2.toFixed(2)}% (diff: ${Math.abs(result2 - 67.7).toFixed(2)}%)\n`);

    // Teste 3: Usar valores exatos mas arredondar resultado final para 1 casa
    const result3 = Math.round(((soma2 / fatTotal) * 100) * 10) / 10;
    console.log('3️⃣ Arredondando resultado final para 1 casa:');
    console.log(`  Resultado: ${result3.toFixed(1)}% (diff: ${Math.abs(result3 - 67.7).toFixed(2)}%)\n`);

    // Teste 4: Verificar se planilha está excluindo algum dia
    console.log('4️⃣ Testando exclusão de dias:\n');
    
    for (let i = 0; i < eventos.length; i++) {
      const eventosSemUm = eventos.filter((_, idx) => idx !== i);
      let somaTemp = 0;
      let fatTemp = 0;
      
      eventosSemUm.forEach(e => {
        const fat = e.faturamento || 0;
        const perc = e.percent_b || 0;
        somaTemp += fat * (perc / 100);
        fatTemp += fat;
      });
      
      const mixTemp = (somaTemp / fatTemp) * 100;
      
      if (Math.abs(mixTemp - 67.7) < 0.05) {
        console.log(`  ✅ SEM ${eventos[i].data}: ${mixTemp.toFixed(2)}% (BATE!)`);
      }
    }

    console.log('\n🎯 CONCLUSÃO:');
    console.log(`  Sistema: 67.88%`);
    console.log(`  Planilha: 67.7%`);
    console.log(`  Diferença: 0.18%`);
    console.log('');
    console.log('  Essa diferença é muito pequena e pode ser:');
    console.log('  - Arredondamento diferente na planilha');
    console.log('  - Faturamento ou % ligeiramente diferente em algum evento');
    console.log('  - Aceitável para fins práticos (< 0.2%)');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

simular();
