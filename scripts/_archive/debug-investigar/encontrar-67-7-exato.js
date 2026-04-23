/**
 * Tenta encontrar qual combinação resulta em exatamente 67.7%
 */

async function encontrar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();
    const eventos = data.eventos;

    console.log('🎯 TENTANDO ENCONTRAR 67.7% EXATO\n');

    // Teste 1: Verificar se algum % individual está arredondado diferente
    console.log('1️⃣ TESTANDO COM % ARREDONDADOS PARA 1 CASA:\n');
    
    let somaTemp = 0;
    let fatTemp = 0;
    
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const percOriginal = e.percent_b || 0;
      const percArredondado = Math.round(percOriginal * 10) / 10;
      
      somaTemp += fat * percArredondado;
      fatTemp += fat;
      
      if (Math.abs(percOriginal - percArredondado) > 0.01) {
        console.log(`  ${e.data}: ${percOriginal.toFixed(4)}% → ${percArredondado.toFixed(1)}%`);
      }
    });
    
    const mix1 = (somaTemp / fatTemp) * 100;
    console.log(`  Resultado: ${mix1.toFixed(4)}%`);
    console.log(`  Diferença vs 67.7%: ${Math.abs(mix1 - 67.7).toFixed(4)}%\n`);

    // Teste 2: Verificar se faturamento total está diferente
    console.log('2️⃣ TESTANDO COM FATURAMENTO TOTAL AJUSTADO:\n');
    
    const fatAtual = data.faturamento_total;
    const contribAtual = eventos.reduce((acc, e) => acc + (e.faturamento || 0) * (e.percent_b || 0), 0);
    
    // Calcular qual faturamento total resultaria em 67.7%
    const fatNecessario = contribAtual / 67.7;
    const diferencaFat = fatAtual - fatNecessario;
    
    console.log(`  Fat. atual: R$ ${fatAtual.toFixed(2)}`);
    console.log(`  Fat. necessário para 67.7%: R$ ${fatNecessario.toFixed(2)}`);
    console.log(`  Diferença: R$ ${diferencaFat.toFixed(2)}\n`);

    // Teste 3: Verificar se algum evento tem faturamento diferente
    console.log('3️⃣ TESTANDO AJUSTES INDIVIDUAIS DE FATURAMENTO:\n');
    
    for (let i = 0; i < eventos.length; i++) {
      const evento = eventos[i];
      const fatOriginal = evento.faturamento || 0;
      
      // Testar pequenas variações no faturamento deste evento
      for (let ajuste = -500; ajuste <= 500; ajuste += 50) {
        const fatAjustado = fatOriginal + ajuste;
        
        let somaTest = 0;
        let fatTest = 0;
        
        eventos.forEach((e, idx) => {
          const fat = idx === i ? fatAjustado : (e.faturamento || 0);
          const perc = e.percent_b || 0;
          somaTest += fat * perc;
          fatTest += fat;
        });
        
        const mixTest = (somaTest / fatTest) * 100;
        
        if (Math.abs(mixTest - 67.7) < 0.01) {
          console.log(`  ✅ ${evento.data}: Fat ${fatOriginal.toFixed(2)} → ${fatAjustado.toFixed(2)} (${ajuste >= 0 ? '+' : ''}${ajuste}) = ${mixTest.toFixed(4)}%`);
        }
      }
    }

    // Teste 4: Verificar se algum % individual está diferente
    console.log('\n4️⃣ TESTANDO AJUSTES INDIVIDUAIS DE %:\n');
    
    for (let i = 0; i < eventos.length; i++) {
      const evento = eventos[i];
      const percOriginal = evento.percent_b || 0;
      
      // Testar pequenas variações no % deste evento
      for (let ajuste = -2; ajuste <= 2; ajuste += 0.1) {
        const percAjustado = percOriginal + ajuste;
        
        let somaTest = 0;
        let fatTest = 0;
        
        eventos.forEach((e, idx) => {
          const fat = e.faturamento || 0;
          const perc = idx === i ? percAjustado : (e.percent_b || 0);
          somaTest += fat * perc;
          fatTest += fat;
        });
        
        const mixTest = (somaTest / fatTest) * 100;
        
        if (Math.abs(mixTest - 67.7) < 0.01) {
          console.log(`  ✅ ${evento.data}: % ${percOriginal.toFixed(2)}% → ${percAjustado.toFixed(2)}% (${ajuste >= 0 ? '+' : ''}${ajuste.toFixed(1)}) = ${mixTest.toFixed(4)}%`);
        }
      }
    }

    console.log('\n💡 CONCLUSÃO:');
    console.log('   Se nenhum ajuste individual resultar em 67.7% exato,');
    console.log('   então a diferença é realmente só arredondamento acumulado.');
    console.log('   0.18% é uma diferença muito pequena e aceitável.');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

encontrar();
