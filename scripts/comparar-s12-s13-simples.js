/**
 * Compara semanas 12 e 13 de forma simples
 */

async function comparar() {
  try {
    console.log('🔍 COMPARANDO SEMANAS 12 E 13\n');

    // Semana 12
    const s12Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s12 = await s12Resp.json();

    // Semana 13
    const s13Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=13&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s13 = await s13Resp.json();

    console.log('📊 SEMANA 12:');
    console.log(`   Eventos: ${s12.eventos.length}`);
    console.log(`   Faturamento: R$ ${s12.faturamento_total.toFixed(2)}`);
    console.log(`   Mix calculado: ${s12.mix_calculado.perc_bebidas.toFixed(4)}%`);
    console.log(`   Mix planilha: 67.7000%`);
    console.log(`   ❌ Diferença: ${Math.abs(s12.mix_calculado.perc_bebidas - 67.7).toFixed(4)}%\n`);

    console.log('📊 SEMANA 13:');
    console.log(`   Eventos: ${s13.eventos.length}`);
    console.log(`   Faturamento: R$ ${s13.faturamento_total.toFixed(2)}`);
    console.log(`   Mix calculado: ${s13.mix_calculado.perc_bebidas.toFixed(4)}%`);
    console.log(`   Mix planilha: 60.3000%`);
    console.log(`   ✅ Diferença: ${Math.abs(s13.mix_calculado.perc_bebidas - 60.3).toFixed(4)}%\n`);

    // Comparar eventos individualmente
    console.log('🔍 COMPARANDO EVENTOS INDIVIDUAIS:\n');
    
    console.log('SEMANA 12:');
    s12.eventos.forEach(e => {
      console.log(`   ${e.data}: R$ ${(e.faturamento || 0).toFixed(2)} - ${(e.percent_b || 0).toFixed(2)}%`);
    });

    console.log('\nSEMANA 13:');
    s13.eventos.forEach(e => {
      console.log(`   ${e.data}: R$ ${(e.faturamento || 0).toFixed(2)} - ${(e.percent_b || 0).toFixed(2)}%`);
    });

    // Verificar se há algum padrão diferente
    console.log('\n🧮 ANÁLISE DE PRECISÃO:\n');
    
    const s12Decimais = s12.eventos.map(e => {
      const perc = e.percent_b || 0;
      const decimais = perc.toString().split('.')[1]?.length || 0;
      return decimais;
    });
    const s13Decimais = s13.eventos.map(e => {
      const perc = e.percent_b || 0;
      const decimais = perc.toString().split('.')[1]?.length || 0;
      return decimais;
    });

    console.log(`   S12 - Casas decimais nos %: ${Math.max(...s12Decimais)}`);
    console.log(`   S13 - Casas decimais nos %: ${Math.max(...s13Decimais)}`);

    // Verificar se algum evento da S12 tem valores "estranhos"
    console.log('\n🔎 VERIFICANDO VALORES SUSPEITOS NA S12:\n');
    
    s12.eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = e.percent_b || 0;
      
      // Verificar se tem muitas casas decimais
      const fatStr = fat.toString();
      const percStr = perc.toString();
      
      if (fatStr.includes('.') && fatStr.split('.')[1].length > 2) {
        console.log(`   ⚠️  ${e.data}: Faturamento com ${fatStr.split('.')[1].length} casas decimais`);
      }
      
      if (percStr.includes('.') && percStr.split('.')[1].length > 4) {
        console.log(`   ⚠️  ${e.data}: % com ${percStr.split('.')[1].length} casas decimais`);
      }
    });

    console.log('\n💡 HIPÓTESE:');
    console.log('   Se S13 bate exato e S12 não, pode ser que:');
    console.log('   1. A planilha foi gerada ANTES da S12 ser recalculada');
    console.log('   2. Algum evento da S12 teve ajuste manual posterior');
    console.log('   3. A S12 tem algum valor com precisão diferente');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

comparar();
