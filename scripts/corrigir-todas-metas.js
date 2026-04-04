/**
 * Corrige a meta_semanal de todas as semanas com problema
 */

async function corrigirTodas() {
  console.log('🔧 Corrigindo metas de todas as semanas...\n');

  try {
    // 1. Buscar todas as semanas
    const response = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();
    const semanas = data.semanas || [];

    console.log(`Total de semanas: ${semanas.length}\n`);

    const semanasParaCorrigir = [];

    // 2. Verificar quais semanas têm problema
    for (const semana of semanas) {
      const eventosResponse = await fetch(
        `http://localhost:3001/api/debug/mix-vendas-semana?semana=${semana.numero_semana}&ano=2026&recalcular=false`,
        { headers: { 'x-selected-bar-id': '3' } }
      );

      if (!eventosResponse.ok) continue;

      const eventosData = await eventosResponse.json();
      const eventos = eventosData.eventos || [];

      const somaM1 = eventos.reduce((acc, e) => acc + (e.m1_receita || 0), 0);
      const metaBanco = semana.meta_semanal || 0;
      const diferenca = Math.abs(somaM1 - metaBanco);

      if (diferenca > 1000) {
        semanasParaCorrigir.push({
          id: semana.id,
          numero: semana.numero_semana,
          meta_banco: metaBanco,
          soma_m1: somaM1,
          diferenca: diferenca,
        });
      }
    }

    console.log(`📊 Semanas com problema: ${semanasParaCorrigir.length}\n`);

    if (semanasParaCorrigir.length === 0) {
      console.log('✅ Todas as metas estão corretas!');
      return;
    }

    console.log('Semanas a corrigir:');
    semanasParaCorrigir.forEach(s => {
      console.log(`  Semana ${s.numero}: R$ ${s.meta_banco.toFixed(2)} → R$ ${s.soma_m1.toFixed(2)}`);
    });
    console.log('');

    // 3. Recalcular cada semana
    let corrigidas = 0;
    let erros = 0;

    for (const semana of semanasParaCorrigir) {
      try {
        console.log(`🔄 Recalculando semana ${semana.numero}...`);

        const recalcResponse = await fetch('http://localhost:3001/api/gestao/desempenho/recalcular', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-selected-bar-id': '3',
          },
          body: JSON.stringify({
            semana_id: semana.id,
            recalcular_todas: false,
          }),
        });

        if (recalcResponse.ok) {
          console.log(`   ✅ Semana ${semana.numero} corrigida`);
          corrigidas++;
        } else {
          const error = await recalcResponse.json();
          console.error(`   ❌ Erro na semana ${semana.numero}:`, error.error);
          erros++;
        }

      } catch (error) {
        console.error(`   ❌ Erro na semana ${semana.numero}:`, error.message);
        erros++;
      }

      // Aguardar um pouco entre as requisições
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 RESULTADO:');
    console.log(`  Corrigidas: ${corrigidas}`);
    console.log(`  Erros: ${erros}`);
    console.log(`  Total: ${semanasParaCorrigir.length}`);

    if (corrigidas === semanasParaCorrigir.length) {
      console.log('\n✅ Todas as metas foram corrigidas com sucesso!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

corrigirTodas();
