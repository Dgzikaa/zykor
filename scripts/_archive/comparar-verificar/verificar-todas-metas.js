/**
 * Verifica se há outras semanas com meta_semanal incorreta
 */

async function verificarTodas() {
  console.log('🔍 Verificando metas de todas as semanas de 2026...\n');

  try {
    const response = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();
    const semanas = data.semanas || [];

    console.log(`Total de semanas: ${semanas.length}\n`);

    const problemasEncontrados = [];

    for (const semana of semanas) {
      // Buscar eventos da semana
      const eventosResponse = await fetch(
        `http://localhost:3001/api/debug/mix-vendas-semana?semana=${semana.numero_semana}&ano=2026&recalcular=false`,
        { headers: { 'x-selected-bar-id': '3' } }
      );

      if (!eventosResponse.ok) continue;

      const eventosData = await eventosResponse.json();
      const eventos = eventosData.eventos || [];

      // Calcular soma de m1_r
      const somaM1 = eventos.reduce((acc, e) => acc + (e.m1_receita || 0), 0);
      const metaBanco = semana.meta_semanal || 0;
      const diferenca = Math.abs(somaM1 - metaBanco);

      // Considerar problema se diferença > R$ 1000
      if (diferenca > 1000) {
        problemasEncontrados.push({
          semana: semana.numero_semana,
          periodo: `${semana.data_inicio} até ${semana.data_fim}`,
          meta_banco: metaBanco,
          soma_m1: somaM1,
          diferenca: diferenca,
          eventos_count: eventos.length,
        });

        console.log(`⚠️  Semana ${semana.numero_semana} (${semana.data_inicio} até ${semana.data_fim})`);
        console.log(`   Meta banco: R$ ${metaBanco.toFixed(2)}`);
        console.log(`   Soma M1: R$ ${somaM1.toFixed(2)}`);
        console.log(`   Diferença: R$ ${diferenca.toFixed(2)}`);
        console.log('');
      }
    }

    console.log('\n📊 RESUMO:');
    console.log(`  Semanas verificadas: ${semanas.length}`);
    console.log(`  Semanas com problema: ${problemasEncontrados.length}`);

    if (problemasEncontrados.length > 0) {
      console.log('\n💡 Para corrigir todas de uma vez, rode:');
      console.log('   node scripts/corrigir-todas-metas.js');
    } else {
      console.log('\n✅ Todas as metas estão corretas!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificarTodas();
