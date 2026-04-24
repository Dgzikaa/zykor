/**
 * Script para sincronizar histórico completo do Conta Azul
 * 
 * Sincroniza todos os lançamentos desde uma data inicial até hoje
 * 
 * Uso: node scripts/sync-contaazul-historico.js [bar_id] [data_inicial]
 * 
 * Exemplos:
 *   node scripts/sync-contaazul-historico.js 3 2020-01-01
 *   node scripts/sync-contaazul-historico.js 4 2021-01-01
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function syncHistorico(barId, barName, dataInicial, dataFinal) {
  console.log(`\n🔄 Sincronizando histórico ${barName} (bar_id=${barId})`);
  console.log(`   📅 Período: ${dataInicial} até ${dataFinal}`);
  console.log('━'.repeat(60));

  try {
    // Fazer sincronização com período customizado
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/contaazul-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          bar_id: barId,
          sync_mode: 'custom',
          date_from: dataInicial,
          date_to: dataFinal
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('   ❌ Erro ao sincronizar:', data);
      return false;
    }

    console.log('   ✅ Sincronização concluída!');
    console.log('   📊 Estatísticas:', {
      lancamentos: data.stats?.lancamentos || 0,
      categorias: data.stats?.categorias || 0,
      centros_custo: data.stats?.centros_custo || 0,
      pessoas: data.stats?.pessoas || 0,
      contas_financeiras: data.stats?.contas_financeiras || 0
    });
    console.log(`   ⏱️  Duração: ${data.duration_seconds}s`);

    return true;

  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    return false;
  }
}

async function syncPorAno(barId, barName, anoInicial, anoFinal) {
  console.log(`\n📆 Sincronizando por ano de ${anoInicial} até ${anoFinal}...\n`);

  const resultados = [];

  for (let ano = anoInicial; ano <= anoFinal; ano++) {
    const dataInicio = `${ano}-01-01`;
    const dataFim = ano === anoFinal ? 
      new Date().toISOString().split('T')[0] : // Se é o ano atual, vai até hoje
      `${ano}-12-31`;

    console.log(`\n📅 Ano ${ano} (${dataInicio} até ${dataFim})`);
    
    const sucesso = await syncHistorico(barId, barName, dataInicio, dataFim);
    resultados.push({ ano, sucesso });

    // Aguardar 2 segundos entre cada ano para não sobrecarregar a API
    if (ano < anoFinal) {
      console.log('\n   ⏳ Aguardando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return resultados;
}

async function main() {
  console.log('🚀 Sincronização Histórica Conta Azul\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas');
    process.exit(1);
  }

  // Parâmetros da linha de comando
  const barId = process.argv[2] ? parseInt(process.argv[2]) : null;
  const dataInicial = process.argv[3] || '2020-01-01';

  if (!barId) {
    console.log('❌ Erro: bar_id é obrigatório\n');
    console.log('Uso: node scripts/sync-contaazul-historico.js [bar_id] [data_inicial]\n');
    console.log('Exemplos:');
    console.log('  node scripts/sync-contaazul-historico.js 3 2020-01-01');
    console.log('  node scripts/sync-contaazul-historico.js 4 2021-01-01');
    console.log('\nPara sincronizar ambos os bares:');
    console.log('  node scripts/sync-contaazul-historico.js 3 2020-01-01');
    console.log('  node scripts/sync-contaazul-historico.js 4 2020-01-01');
    process.exit(1);
  }

  const barName = barId === 3 ? 'Ordinário' : barId === 4 ? 'Deboche' : `Bar ${barId}`;
  const dataFinal = new Date().toISOString().split('T')[0]; // Hoje

  // Extrair ano inicial e final
  const anoInicial = parseInt(dataInicial.split('-')[0]);
  const anoAtual = new Date().getFullYear();

  console.log(`📊 Configuração:`);
  console.log(`   Bar: ${barName} (ID: ${barId})`);
  console.log(`   Período: ${dataInicial} até ${dataFinal}`);
  console.log(`   Anos: ${anoInicial} até ${anoAtual}\n`);

  // Confirmar antes de começar
  console.log('⚠️  ATENÇÃO: Esta operação pode demorar vários minutos dependendo do volume de dados.');
  console.log('   Aguarde até o final da sincronização.\n');

  // Sincronizar por ano (para evitar timeout)
  const resultados = await syncPorAno(barId, barName, anoInicial, anoAtual);

  // Resumo final
  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 RESUMO FINAL:\n');
  
  const sucessos = resultados.filter(r => r.sucesso).length;
  const falhas = resultados.filter(r => !r.sucesso).length;

  resultados.forEach(({ ano, sucesso }) => {
    console.log(`   ${ano}: ${sucesso ? '✅ OK' : '❌ FALHOU'}`);
  });

  console.log(`\n   Total: ${sucessos} anos sincronizados, ${falhas} falhas`);

  if (sucessos === resultados.length) {
    console.log('\n🎉 Sincronização histórica concluída com sucesso!');
    console.log('\n💡 Próximo passo: Verifique os dados com:');
    console.log(`   node scripts/verificar-dados-contaazul.js ${barId}`);
    process.exit(0);
  } else {
    console.log('\n⚠️  Alguns anos falharam. Verifique os erros acima.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
