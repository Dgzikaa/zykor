/**
 * Verifica a meta da semana 14 (30/03 a 05/04)
 */

async function verificar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=14&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('📅 SEMANA 14 - 30/03 a 05/04\n');
    
    console.log('📋 EVENTOS:');
    let somaM1 = 0;
    let somaReal = 0;
    
    data.eventos.forEach(e => {
      const m1 = e.m1_receita || 0;
      const real = e.faturamento || 0;
      somaM1 += m1;
      somaReal += real;
      
      const mes = e.data.substring(5, 7);
      const dia = e.data.substring(8, 10);
      
      console.log(`  ${dia}/${mes} - ${e.nome}`);
      console.log(`    M1: R$ ${m1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`    Real: R$ ${real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });

    console.log('\n💰 TOTAIS:');
    console.log(`  Soma M1: R$ ${somaM1.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Soma Real: R$ ${somaReal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Atingimento: ${somaM1 > 0 ? ((somaReal / somaM1) * 100).toFixed(1) : 0}%`);

    // Buscar o que está no desempenho_semanal
    const response2 = await fetch('http://localhost:3001/api/estrategico/desempenho/todas-semanas?ano=2026', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const todasSemanas = await response2.json();
    const semana14 = todasSemanas.semanas.find(s => s.numero_semana === 14);

    if (semana14) {
      console.log('\n📊 NO BANCO (desempenho_semanal):');
      console.log(`  Meta Semanal: R$ ${semana14.meta_semanal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`  Faturamento: R$ ${semana14.faturamento_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`  Atingimento: ${semana14.atingimento?.toFixed(1)}%`);
      
      console.log('\n🔍 COMPARAÇÃO:');
      console.log(`  Soma M1 calculada: R$ ${somaM1.toFixed(2)}`);
      console.log(`  Meta no banco: R$ ${semana14.meta_semanal?.toFixed(2)}`);
      console.log(`  Diferença: R$ ${Math.abs(somaM1 - (semana14.meta_semanal || 0)).toFixed(2)}`);
      
      if (Math.abs(somaM1 - (semana14.meta_semanal || 0)) > 1000) {
        console.log('\n❌ PROBLEMA CONFIRMADO! Meta no banco está errada.');
        console.log('   Provavelmente está pegando apenas 1 dia em vez de somar todos.');
      } else {
        console.log('\n✅ Meta no banco está correta.');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificar();
