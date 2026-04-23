/**
 * Investiga em detalhes de onde vem a diferença de 0.18%
 */

async function investigar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('🔍 INVESTIGAÇÃO DETALHADA - SEMANA 12\n');
    console.log('Sistema: 67.88% bebidas');
    console.log('Planilha: 67.7% bebidas');
    console.log('Diferença: 0.18%\n');

    console.log('📋 DADOS DE CADA EVENTO:\n');

    let totalFat = 0;
    let totalContribB = 0;

    data.eventos.forEach((e, idx) => {
      const fat = e.faturamento || 0;
      const percB = e.percent_b || 0;
      const contrib = fat * percB;
      
      totalFat += fat;
      totalContribB += contrib;

      console.log(`${idx + 1}. ${e.data} - ${e.nome}`);
      console.log(`   Faturamento: R$ ${fat.toFixed(2)}`);
      console.log(`   % Bebidas: ${percB.toFixed(4)}%`);
      console.log(`   Contribuição: R$ ${contrib.toFixed(2)}`);
      console.log('');
    });

    console.log('🧮 CÁLCULO PASSO A PASSO:\n');
    console.log(`1. Soma das contribuições: R$ ${totalContribB.toFixed(2)}`);
    console.log(`2. Faturamento total: R$ ${totalFat.toFixed(2)}`);
    console.log(`3. Divisão: ${totalContribB.toFixed(2)} / ${totalFat.toFixed(2)}`);
    console.log(`4. Resultado: ${(totalContribB / totalFat).toFixed(10)}`);
    console.log(`5. Em %: ${((totalContribB / totalFat) * 100).toFixed(10)}%`);
    console.log('');

    console.log('🎯 HIPÓTESES PARA A DIFERENÇA:\n');
    console.log('1. Planilha pode estar usando faturamento diferente');
    console.log('   → Verifique se os R$ 410.736,43 batem com a planilha');
    console.log('');
    console.log('2. Planilha pode ter % individuais diferentes');
    console.log('   → Verifique se os % de cada dia batem');
    console.log('');
    console.log('3. Planilha pode estar excluindo algum evento');
    console.log('   → Verifique se são 7 eventos na planilha');
    console.log('');
    console.log('4. Planilha pode estar usando dados de contahub_analitico direto');
    console.log('   → Em vez de usar os % já calculados dos eventos');
    console.log('');

    // Testar se excluindo algum evento bate
    console.log('🧪 TESTANDO EXCLUSÃO DE EVENTOS:\n');
    
    for (let i = 0; i < data.eventos.length; i++) {
      const eventosSemUm = data.eventos.filter((_, idx) => idx !== i);
      
      let somaTemp = 0;
      let fatTemp = 0;
      
      eventosSemUm.forEach(e => {
        const fat = e.faturamento || 0;
        const perc = e.percent_b || 0;
        somaTemp += fat * perc;
        fatTemp += fat;
      });
      
      const mixTemp = (somaTemp / fatTemp) * 100;
      const diff = Math.abs(mixTemp - 67.7);
      
      if (diff < 0.05) {
        console.log(`✅ SEM ${data.eventos[i].data}: ${mixTemp.toFixed(2)}% (BATE COM 67.7%!)`);
      } else if (diff < 0.3) {
        console.log(`⚠️  SEM ${data.eventos[i].data}: ${mixTemp.toFixed(2)}% (diff: ${diff.toFixed(2)}%)`);
      }
    }

    console.log('\n💡 PRÓXIMO PASSO:');
    console.log('   Compare os valores acima com a planilha:');
    console.log('   - Os 7 eventos estão na planilha?');
    console.log('   - Os faturamentos batem?');
    console.log('   - Os % de bebidas batem?');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

investigar();
