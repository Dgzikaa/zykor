/**
 * Script simples para recalcular o mix da semana 12
 */

async function recalcular() {
  console.log('🔄 Recalculando mix da semana 12/2026...\n');

  try {
    const response = await fetch('http://localhost:3001/api/gestao/desempenho/recalcular-mix?semana=12&ano=2026', {
      method: 'POST',
      headers: { 'x-selected-bar-id': '3' },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Erro:', error);
      return;
    }

    const data = await response.json();

    console.log('✅ Recálculo concluído!\n');
    console.log('📅 Período:', data.semana.periodo);
    console.log('');
    console.log('📊 MIX ANTERIOR:');
    console.log('  Bebidas:', data.mix_anterior.perc_bebidas?.toFixed(2) + '%');
    console.log('  Drinks:', data.mix_anterior.perc_drinks?.toFixed(2) + '%');
    console.log('  Comida:', data.mix_anterior.perc_comida?.toFixed(2) + '%');
    console.log('');
    console.log('📊 MIX NOVO:');
    console.log('  Bebidas:', data.mix_novo.perc_bebidas.toFixed(2) + '%');
    console.log('  Drinks:', data.mix_novo.perc_drinks.toFixed(2) + '%');
    console.log('  Comida:', data.mix_novo.perc_comida.toFixed(2) + '%');
    console.log('');
    console.log('📉 DIFERENÇAS:');
    console.log('  Bebidas:', data.diferencas.bebidas.toFixed(2) + '%');
    console.log('  Drinks:', data.diferencas.drinks.toFixed(2) + '%');
    console.log('  Comida:', data.diferencas.comida.toFixed(2) + '%');
    console.log('');
    console.log('🎯 Comparação com planilha:');
    console.log('  Esperado: 67.7% bebidas');
    console.log('  Obtido:', data.mix_novo.perc_bebidas.toFixed(2) + '% bebidas');
    const diff = Math.abs(data.mix_novo.perc_bebidas - 67.7);
    console.log('  Diferença:', diff.toFixed(2) + '%', diff < 0.5 ? '✅' : '⚠️');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recalcular();
