/**
 * Script para recalcular a semana 12 com o novo método de cálculo de mix
 * 
 * Uso: node scripts/recalcular-semana-12.js
 */

async function recalcularSemana12() {
  console.log('🔄 Recalculando semana 12/2026...\n');

  try {
    // Primeiro, mostrar dados atuais
    console.log('📊 Buscando dados atuais...');
    const investigarResponse = await fetch('http://localhost:3001/api/debug/investigar-mix-semana-12', {
      headers: { 'x-selected-bar-id': '3' },
    });
    const investigar = await investigarResponse.json();

    console.log('Antes do recálculo:');
    console.log('  Mix no banco: Bebidas=' + investigar.mix_banco.perc_bebidas + '% (esperado: 67.7%)');
    console.log('  Mix calculado dos eventos: Bebidas=' + investigar.mix_manual_eventos.perc_bebidas.toFixed(2) + '%');
    console.log('  Diferença: ' + Math.abs(investigar.mix_banco.perc_bebidas - investigar.mix_manual_eventos.perc_bebidas).toFixed(2) + '%\n');

    // Recalcular
    console.log('🔧 Executando recálculo...');
    const recalcularResponse = await fetch('http://localhost:3001/api/debug/recalcular-semana?semana=12&ano=2026&mode=write', {
      method: 'POST',
      headers: { 'x-selected-bar-id': '3' },
    });

    if (!recalcularResponse.ok) {
      const error = await recalcularResponse.json();
      console.error('❌ Erro ao recalcular:', error);
      return;
    }

    const resultado = await recalcularResponse.json();

    console.log('\n✅ Recálculo concluído!\n');
    console.log('Depois do recálculo:');
    console.log('  Mix novo: Bebidas=' + resultado.resumo.mix_novo.bebidas + '%');
    console.log('  Drinks=' + resultado.resumo.mix_novo.drinks + '%');
    console.log('  Comida=' + resultado.resumo.mix_novo.comida + '%');
    console.log('  Happy Hour=' + resultado.resumo.mix_novo.happy_hour + '%');
    console.log('\n📝 Atualizado em:', resultado.dados_atualizados.atualizado_em);

    // Verificar se bateu com o esperado (67.7%)
    const bebidas = resultado.resumo.mix_novo.bebidas;
    const esperado = 67.7;
    const diferenca = Math.abs(bebidas - esperado);
    
    console.log('\n🎯 Verificação:');
    console.log('  Esperado: ' + esperado + '%');
    console.log('  Obtido: ' + bebidas + '%');
    console.log('  Diferença: ' + diferenca.toFixed(2) + '%');
    
    if (diferenca < 0.5) {
      console.log('  ✅ Valores batem!');
    } else {
      console.log('  ⚠️  Ainda há diferença significativa');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

recalcularSemana12();
