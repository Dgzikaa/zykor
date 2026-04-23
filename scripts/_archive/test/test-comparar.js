async function testar() {
  try {
    const response = await fetch('http://localhost:3001/api/debug/comparar-vendas-item', {
      headers: { 'x-selected-bar-id': '3' },
    });

    const data = await response.json();
    
    console.log('📊 COMPARAÇÃO ENTRE SEMANAS:\n');
    
    data.semanas.forEach(s => {
      console.log(`Semana ${s.semana} (${s.periodo})`);
      console.log(`  Eventos: R$ ${s.eventos.total.toFixed(2)} (${s.eventos.count} dias)`);
      console.log(`  Vendas Item: R$ ${s.vendas_item.total.toFixed(2)} (${s.vendas_item.registros} registros)`);
      console.log(`  Cobertura: ${s.cobertura.percentual.toFixed(2)}% (faltando R$ ${s.cobertura.faltando.toFixed(2)})`);
      console.log(`  Mix VI: B=${s.vendas_item.mix.bebidas.toFixed(1)}% D=${s.vendas_item.mix.drinks.toFixed(1)}% C=${s.vendas_item.mix.comida.toFixed(1)}%`);
      console.log(`  Locais não mapeados: ${s.vendas_item.locais_nao_mapeados.length > 0 ? s.vendas_item.locais_nao_mapeados.join(', ') : 'nenhum'}`);
      console.log('');
    });

    console.log('🎯 ANÁLISE:', JSON.stringify(data.analise, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testar();
