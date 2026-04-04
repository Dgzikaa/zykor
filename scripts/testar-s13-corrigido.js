/**
 * Testa semana 13 com a correção
 */

async function testar() {
  try {
    console.log('🧪 TESTANDO SEMANA 13 COM CORREÇÃO\n');

    const response = await fetch('http://localhost:3001/api/gestao/desempenho/recalcular-mix?semana=13&ano=2026', {
      method: 'POST',
      headers: { 
        'x-selected-bar-id': '3'
      },
    });

    if (!response.ok) {
      console.log(`❌ Erro HTTP: ${response.status}`);
      const text = await response.text();
      console.log('Resposta:', text);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Recálculo executado!\n');
    console.log('📊 RESULTADO:\n');
    console.log(`Mix Anterior: ${data.mix_anterior.perc_bebidas.toFixed(4)}%`);
    console.log(`Mix Novo: ${data.mix_novo.perc_bebidas.toFixed(4)}%`);
    console.log(`Planilha: 60.3000%\n`);
    console.log(`Diferença vs Planilha: ${Math.abs(data.mix_novo.perc_bebidas - 60.3).toFixed(4)}%\n`);

    if (Math.abs(data.mix_novo.perc_bebidas - 60.3) < 0.05) {
      console.log('🎯 ✅ BATE COM A PLANILHA! (diferença < 0.05%)');
    } else {
      console.log('⚠️  Diferença maior que esperado');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
