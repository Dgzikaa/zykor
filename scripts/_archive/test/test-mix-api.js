/**
 * Script simples para testar a API de investigação do mix
 */

async function testar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/investigar-mix-semana-12', {
      headers: {
        'x-selected-bar-id': '3',
      },
    });

    const data = await response.json();
    
    console.log('✅ Resposta recebida!\n');
    console.log('📊 RESUMO:', JSON.stringify(data.resumo, null, 2));
    console.log('\n🏦 MIX NO BANCO:', JSON.stringify(data.mix_banco, null, 2));
    console.log('\n🧮 MIX MANUAL (eventos):', JSON.stringify(data.mix_manual_eventos, null, 2));
    console.log('\n🔧 MIX RPC:', JSON.stringify(data.mix_rpc, null, 2));
    console.log('\n📦 MIX VENDAS_ITEM:', JSON.stringify(data.mix_vendas_item, null, 2));
    console.log('\n💰 TOTAIS:', JSON.stringify(data.totais, null, 2));
    console.log('\n🔍 DIAGNÓSTICO:', JSON.stringify(data.diagnostico, null, 2));
    
    console.log('\n📋 VENDAS POR DATA:');
    data.vendas_item_por_data.forEach(d => {
      console.log(`  ${d.data}: R$ ${d.total.toFixed(2)} - B=${d.perc_bebidas.toFixed(1)}% D=${d.perc_drinks.toFixed(1)}% C=${d.perc_comida.toFixed(1)}%`);
    });

    console.log('\n📋 EVENTOS:');
    data.eventos.forEach(e => {
      console.log(`  ${e.data_evento} - ${e.nome}`);
      console.log(`    Fat: R$ ${e.real_r?.toFixed(2)} - B=${e.percent_b?.toFixed(1)}% D=${e.percent_d?.toFixed(1)}% C=${e.percent_c?.toFixed(1)}%`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
