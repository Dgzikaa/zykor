/**
 * Testa diferentes formas de arredondamento para ver qual bate com a planilha
 */

async function testar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();

    console.log('🧪 TESTANDO DIFERENTES ARREDONDAMENTOS\n');

    const eventos = data.eventos;
    const fatTotal = data.faturamento_total;

    // Método 1: Sem arredondamento intermediário (atual)
    let soma1 = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = e.percent_b || 0;
      soma1 += fat * (perc / 100);
    });
    const mix1 = (soma1 / fatTotal) * 100;

    // Método 2: Arredondando percentuais para 1 casa
    let soma2 = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = Math.round((e.percent_b || 0) * 10) / 10;
      soma2 += fat * (perc / 100);
    });
    const mix2 = (soma2 / fatTotal) * 100;

    // Método 3: Arredondando percentuais para inteiro
    let soma3 = 0;
    eventos.forEach(e => {
      const fat = e.faturamento || 0;
      const perc = Math.round(e.percent_b || 0);
      soma3 += fat * (perc / 100);
    });
    const mix3 = (soma3 / fatTotal) * 100;

    // Método 4: Arredondando faturamentos para 2 casas
    let soma4 = 0;
    eventos.forEach(e => {
      const fat = Math.round((e.faturamento || 0) * 100) / 100;
      const perc = e.percent_b || 0;
      soma4 += fat * (perc / 100);
    });
    const mix4 = (soma4 / fatTotal) * 100;

    // Método 5: Arredondando resultado final para 1 casa
    const mix5 = Math.round(mix1 * 10) / 10;

    // Método 6: Truncando em vez de arredondar
    const mix6 = Math.floor(mix1 * 10) / 10;

    console.log('Método 1 (sem arredondamento): ' + mix1.toFixed(4) + '%');
    console.log('Método 2 (% com 1 casa):        ' + mix2.toFixed(4) + '%');
    console.log('Método 3 (% inteiro):           ' + mix3.toFixed(4) + '%');
    console.log('Método 4 (fat com 2 casas):     ' + mix4.toFixed(4) + '%');
    console.log('Método 5 (arredondar final):    ' + mix5.toFixed(4) + '%');
    console.log('Método 6 (truncar final):       ' + mix6.toFixed(4) + '%');
    console.log('');
    console.log('🎯 Planilha: 67.7%');
    console.log('');
    console.log('Diferenças:');
    console.log('  Método 1: ' + Math.abs(mix1 - 67.7).toFixed(4) + '%');
    console.log('  Método 2: ' + Math.abs(mix2 - 67.7).toFixed(4) + '%');
    console.log('  Método 3: ' + Math.abs(mix3 - 67.7).toFixed(4) + '%');
    console.log('  Método 4: ' + Math.abs(mix4 - 67.7).toFixed(4) + '%');
    console.log('  Método 5: ' + Math.abs(mix5 - 67.7).toFixed(4) + '% ' + (Math.abs(mix5 - 67.7) < 0.01 ? '✅ BATE!' : ''));
    console.log('  Método 6: ' + Math.abs(mix6 - 67.7).toFixed(4) + '% ' + (Math.abs(mix6 - 67.7) < 0.01 ? '✅ BATE!' : ''));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
