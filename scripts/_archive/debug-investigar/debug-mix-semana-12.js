/**
 * Script para debugar o mix de vendas da semana 12
 * 
 * Uso: node scripts/debug-mix-semana-12.js
 */

const API_URL = 'http://localhost:3001/api/debug/mix-vendas-semana';
const BAR_ID = 3; // Deboche

async function debugMixSemana12() {
  console.log('🔍 Investigando mix de vendas da semana 12...\n');

  try {
    // Primeiro, buscar dados sem recalcular
    const response = await fetch(`${API_URL}?semana=12&ano=2026&recalcular=false`, {
      headers: {
        'x-selected-bar-id': String(BAR_ID),
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Erro na API:', error);
      return;
    }

    const result = await response.json();

    console.log('📅 Período:', result.semana.data_inicio, 'até', result.semana.data_fim);
    console.log('💰 Faturamento Total:', result.faturamento_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    console.log('');

    console.log('📊 MIX ATUAL NO BANCO (desempenho_semanal):');
    console.log('  Bebidas:', result.mix_atual_banco.perc_bebidas?.toFixed(2) + '%');
    console.log('  Drinks:', result.mix_atual_banco.perc_drinks?.toFixed(2) + '%');
    console.log('  Comida:', result.mix_atual_banco.perc_comida?.toFixed(2) + '%');
    console.log('');

    console.log('🧮 MIX CALCULADO MANUALMENTE (média ponderada dos eventos):');
    console.log('  Bebidas:', result.mix_calculado_manual.perc_bebidas.toFixed(2) + '%');
    console.log('  Drinks:', result.mix_calculado_manual.perc_drinks.toFixed(2) + '%');
    console.log('  Comida:', result.mix_calculado_manual.perc_comida.toFixed(2) + '%');
    console.log('');

    if (result.mix_rpc) {
      console.log('🔧 MIX VIA RPC (calcular_mix_vendas):');
      console.log('  Bebidas:', result.mix_rpc.perc_bebidas.toFixed(2) + '%');
      console.log('  Drinks:', result.mix_rpc.perc_drinks.toFixed(2) + '%');
      console.log('  Comida:', result.mix_rpc.perc_comidas.toFixed(2) + '%');
      console.log('');
    }

    console.log('📋 EVENTOS DA SEMANA:');
    result.eventos.forEach((e) => {
      console.log(`  ${e.data} - ${e.nome}`);
      console.log(`    Faturamento: ${e.faturamento?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
      console.log(`    Mix: B=${e.percent_b?.toFixed(1)}% D=${e.percent_d?.toFixed(1)}% C=${e.percent_c?.toFixed(1)}%`);
      console.log(`    Contribuição: B=R$${e.contribuicao_bebidas?.toFixed(2)} D=R$${e.contribuicao_drinks?.toFixed(2)} C=R$${e.contribuicao_comida?.toFixed(2)}`);
      console.log('');
    });

    console.log('🔍 DIAGNÓSTICO:');
    console.log('  Diferença Manual vs Banco:');
    console.log(`    Bebidas: ${result.diagnostico.diferenca_manual_vs_banco.bebidas.toFixed(2)}%`);
    console.log(`    Drinks: ${result.diagnostico.diferenca_manual_vs_banco.drinks.toFixed(2)}%`);
    console.log(`    Comida: ${result.diagnostico.diferenca_manual_vs_banco.comida.toFixed(2)}%`);
    console.log('');

    if (result.diagnostico.diferenca_rpc_vs_banco) {
      console.log('  Diferença RPC vs Banco:');
      console.log(`    Bebidas: ${result.diagnostico.diferenca_rpc_vs_banco.bebidas.toFixed(2)}%`);
      console.log(`    Drinks: ${result.diagnostico.diferenca_rpc_vs_banco.drinks.toFixed(2)}%`);
      console.log(`    Comida: ${result.diagnostico.diferenca_rpc_vs_banco.comida.toFixed(2)}%`);
      console.log('');
    }

    if (result.diagnostico.diferenca_manual_vs_rpc) {
      console.log('  Diferença Manual vs RPC:');
      console.log(`    Bebidas: ${result.diagnostico.diferenca_manual_vs_rpc.bebidas.toFixed(2)}%`);
      console.log(`    Drinks: ${result.diagnostico.diferenca_manual_vs_rpc.drinks.toFixed(2)}%`);
      console.log(`    Comida: ${result.diagnostico.diferenca_manual_vs_rpc.comida.toFixed(2)}%`);
      console.log('');
    }

    // Perguntar se quer recalcular
    if (!recalcular) {
      console.log('💡 Para recalcular e atualizar o banco, rode:');
      console.log(`   node scripts/debug-mix-semana-12.js recalcular`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Verificar se deve recalcular
const deveRecalcular = process.argv.includes('recalcular');

if (deveRecalcular) {
  console.log('🔄 Modo RECALCULAR ativado\n');
  
  fetch(`${API_URL}?semana=12&ano=2026&recalcular=true`, {
    headers: {
      'x-selected-bar-id': String(BAR_ID),
    },
  })
    .then(res => res.json())
    .then(result => {
      if (result.success) {
        console.log('✅ Mix recalculado com sucesso!');
        console.log('');
        console.log('📊 NOVO MIX (via RPC):');
        console.log('  Bebidas:', result.mix_rpc.perc_bebidas.toFixed(2) + '%');
        console.log('  Drinks:', result.mix_rpc.perc_drinks.toFixed(2) + '%');
        console.log('  Comida:', result.mix_rpc.perc_comidas.toFixed(2) + '%');
      } else {
        console.error('❌ Erro ao recalcular:', result.error);
      }
    })
    .catch(err => console.error('❌ Erro:', err));
} else {
  debugMixSemana12();
}
