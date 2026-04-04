/**
 * Testa a nova API de contahub_analitico
 */

async function testar() {
  try {
    console.log('🧪 TESTANDO API DE CONTAHUB_ANALITICO\n');

    const response = await fetch('http://localhost:3001/api/debug/contahub-analitico-semana', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-selected-bar-id': '3'
      },
      body: JSON.stringify({
        bar_id: 3,
        data_inicio: '2026-03-16',
        data_fim: '2026-03-22',
      }),
    });

    if (!response.ok) {
      console.log(`❌ Erro HTTP: ${response.status}`);
      const text = await response.text();
      console.log('Resposta:', text.substring(0, 500));
      return;
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    // Comparar com eventos_base
    const eventosResp = await fetch('http://localhost:3001/api/debug/mix-vendas-semana?semana=12&ano=2026&recalcular=false', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const eventosData = await eventosResp.json();

    console.log('\n📊 COMPARAÇÃO:\n');
    console.log(`contahub_analitico: ${data.mix.perc_bebidas.toFixed(4)}%`);
    console.log(`eventos_base: ${eventosData.mix_calculado_manual.perc_bebidas.toFixed(4)}%`);
    console.log(`Diferença: ${Math.abs(data.mix.perc_bebidas - eventosData.mix_calculado_manual.perc_bebidas).toFixed(4)}%`);

    if (Math.abs(data.mix.perc_bebidas - 67.7) < 0.01) {
      console.log('\n✅ contahub_analitico BATE com planilha (67.7%)!');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
