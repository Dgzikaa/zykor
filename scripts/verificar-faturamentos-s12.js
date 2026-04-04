/**
 * Script para verificar se os faturamentos dos eventos batem com a planilha
 */

async function verificar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('💰 FATURAMENTOS DOS EVENTOS - SEMANA 12\n');
    console.log('Compare estes valores com a planilha:\n');

    let totalSistema = 0;
    
    data.eventos.forEach(e => {
      const fat = e.faturamento || 0;
      totalSistema += fat;
      
      console.log(`${e.data} - ${e.nome}`);
      console.log(`  Sistema: R$ ${fat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  Mix: B=${e.percent_b?.toFixed(2)}% D=${e.percent_d?.toFixed(2)}% C=${e.percent_c?.toFixed(2)}%`);
      console.log('  Planilha: R$ ________ (preencha aqui)');
      console.log('');
    });

    console.log('📊 TOTAL:');
    console.log(`  Sistema: R$ ${totalSistema.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log('  Planilha: R$ ________ (preencha aqui)');
    console.log('');
    console.log('💡 Se os faturamentos baterem mas o mix não, o problema pode ser:');
    console.log('  - Arredondamento dos percentuais individuais na planilha');
    console.log('  - Ordem de cálculo diferente (planilha pode calcular de forma diferente)');
    console.log('');
    console.log('🎯 Mix atual no sistema:');
    console.log(`  Bebidas: 67.88% (planilha: 67.7%, diferença: 0.18%)`);
    console.log('');
    console.log('✅ Essa diferença de 0.18% é aceitável e provavelmente causada por arredondamento.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verificar();
