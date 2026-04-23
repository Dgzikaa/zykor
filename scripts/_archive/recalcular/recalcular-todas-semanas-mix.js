/**
 * Recalcula o mix de todas as semanas
 */

async function recalcular() {
  try {
    console.log('🔄 RECALCULANDO MIX DE TODAS AS SEMANAS\n');

    const semanas = [10, 11, 12, 13];

    for (const semana of semanas) {
      console.log(`\n📊 SEMANA ${semana}:`);
      
      const response = await fetch(`http://localhost:3001/api/gestao/desempenho/recalcular-mix?semana=${semana}&ano=2026`, {
        method: 'POST',
        headers: { 
          'x-selected-bar-id': '3'
        },
      });

      if (!response.ok) {
        console.log(`   ❌ Erro HTTP: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      console.log(`   Anterior: ${data.mix_anterior.perc_bebidas.toFixed(4)}%`);
      console.log(`   Novo: ${data.mix_novo.perc_bebidas.toFixed(4)}%`);
      console.log(`   ✅ Atualizado!`);

      // Aguardar 500ms entre chamadas
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n🎯 VERIFICANDO RESULTADOS FINAIS:\n');

    // Buscar todas as semanas atualizadas
    const semanaResp = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const semanasData = await semanaResp.json();

    const mixPlanilha = {
      10: null,
      11: null,
      12: 67.7,
      13: 60.3,
    };

    semanas.forEach(numSemana => {
      const semana = semanasData.semanas.find(s => s.numero_semana === numSemana);
      const mixPlan = mixPlanilha[numSemana];
      
      console.log(`Semana ${numSemana}: ${semana?.perc_bebidas?.toFixed(4)}%`);
      
      if (mixPlan !== null) {
        const diff = Math.abs((semana?.perc_bebidas || 0) - mixPlan);
        console.log(`  Planilha: ${mixPlan.toFixed(4)}%`);
        console.log(`  Diferença: ${diff.toFixed(4)}% ${diff < 0.05 ? '✅' : '⚠️'}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recalcular();
