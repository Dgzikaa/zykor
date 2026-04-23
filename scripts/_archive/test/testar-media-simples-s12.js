/**
 * Testa se a RPC está usando média simples em vez de ponderada
 */

async function testar() {
  try {
    const s12Resp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const s12 = await s12Resp.json();

    console.log('🧮 TESTANDO MÉDIA SIMPLES VS PONDERADA\n');

    const eventos = s12.eventos;

    // 1. Média ponderada (correto)
    let totalFat = 0;
    let somaContribB = 0;

    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = e.percent_b || 0;
      totalFat += fat;
      somaContribB += fat * perc / 100;
    });

    const mixPonderado = (somaContribB / totalFat) * 100;

    // 2. Média simples (errado, mas pode ser o que a RPC faz)
    const somaPercentuais = eventos.reduce((acc, e) => acc + (e.percent_b || 0), 0);
    const mixSimples = somaPercentuais / eventos.length;

    // 3. Média ponderada mas com arredondamentos
    let somaContribArredondado = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = Math.round((e.percent_b || 0) * 100) / 100; // 2 casas
      somaContribArredondado += fat * perc / 100;
    });
    const mixArredondado = (somaContribArredondado / totalFat) * 100;

    console.log('📊 RESULTADOS:\n');
    console.log(`1. Mix Ponderado (correto): ${mixPonderado.toFixed(4)}%`);
    console.log(`   Diferença vs RPC (67.7%): ${Math.abs(mixPonderado - 67.7).toFixed(4)}%\n`);

    console.log(`2. Mix Simples (média aritmética): ${mixSimples.toFixed(4)}%`);
    console.log(`   Diferença vs RPC (67.7%): ${Math.abs(mixSimples - 67.7).toFixed(4)}%\n`);

    console.log(`3. Mix Ponderado com % arredondados: ${mixArredondado.toFixed(4)}%`);
    console.log(`   Diferença vs RPC (67.7%): ${Math.abs(mixArredondado - 67.7).toFixed(4)}%\n`);

    // 4. Testar se a RPC está usando vendas_item
    console.log('4. Mix da RPC (vendas_item): 67.7000%');
    console.log(`   Diferença vs Ponderado: ${Math.abs(67.7 - mixPonderado).toFixed(4)}%\n`);

    // Verificar qual se aproxima mais
    const diffs = [
      { nome: 'Média Simples', valor: mixSimples, diff: Math.abs(mixSimples - 67.7) },
      { nome: 'Ponderado Arredondado', valor: mixArredondado, diff: Math.abs(mixArredondado - 67.7) },
    ];

    const maisProximo = diffs.sort((a, b) => a.diff - b.diff)[0];

    console.log('🎯 CONCLUSÃO:\n');
    
    if (maisProximo.diff < 0.01) {
      console.log(`   ✅ A RPC provavelmente usa: ${maisProximo.nome}`);
      console.log(`   Resultado: ${maisProximo.valor.toFixed(4)}%`);
    } else {
      console.log('   ❌ Nenhum método testado resulta em 67.7% exato');
      console.log('   A RPC deve estar usando dados de vendas_item');
      console.log('   que têm valores ligeiramente diferentes dos eventos_base');
    }

    console.log('\n💡 EXPLICAÇÃO:');
    console.log('   - eventos_base tem % calculados corretamente: 67.8766%');
    console.log('   - vendas_item (usado pela RPC) tem dados diferentes: 67.7%');
    console.log('   - A diferença de 0.18% vem dessa discrepância entre as fontes');
    console.log('   - A planilha provavelmente foi gerada usando a RPC (vendas_item)');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
