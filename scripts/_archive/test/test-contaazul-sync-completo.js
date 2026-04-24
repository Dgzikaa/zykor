/**
 * Script para testar sincronização completa do Conta Azul
 * Testa: categorias, centros de custo, stakeholders e lançamentos
 */

require('dotenv').config({ path: './frontend/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

async function testSync(barId, syncMode = 'daily_incremental') {
  console.log(`\n🔄 Testando sincronização ${syncMode} para bar_id=${barId}...\n`);

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/contaazul-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          bar_id: barId,
          sync_mode: syncMode
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro na sincronização:', data);
      return;
    }

    console.log('✅ Sincronização concluída!\n');
    console.log('📊 Estatísticas:');
    console.log(`  - Categorias: ${data.stats?.categorias || 0}`);
    console.log(`  - Centros de Custo: ${data.stats?.centros_custo || 0}`);
    console.log(`  - Pessoas: ${data.stats?.pessoas || 0}`);
    console.log(`  - Contas Financeiras: ${data.stats?.contas_financeiras || 0}`);
    console.log(`  - Lançamentos: ${data.stats?.lancamentos || 0}`);
    console.log(`  - Erros: ${data.stats?.erros || 0}`);

  } catch (error) {
    console.error('❌ Erro ao chamar Edge Function:', error.message);
  }
}

async function testEndpoints(barId) {
  console.log(`\n🧪 Testando endpoints de API para bar_id=${barId}...\n`);

  const endpoints = [
    { name: 'Categorias', url: `/api/financeiro/contaazul/categorias?bar_id=${barId}` },
    { name: 'Centros de Custo', url: `/api/financeiro/contaazul/centros-custo?bar_id=${barId}` },
    { name: 'Stakeholders', url: `/api/financeiro/contaazul/stakeholders?bar_id=${barId}` },
    { name: 'Lançamentos', url: `/api/financeiro/contaazul/lancamentos?bar_id=${barId}&page=1&limit=10` }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3001${endpoint.url}`);
      const data = await response.json();

      if (response.ok) {
        const count = data.categorias?.length || data.centros_custo?.length || 
                     data.pessoas?.length || data.lancamentos?.length || 0;
        console.log(`✅ ${endpoint.name}: ${count} registros`);
      } else {
        console.log(`❌ ${endpoint.name}: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint.name}: ${error.message}`);
    }
  }
}

async function main() {
  const barId = process.argv[2] || 3; // Default: Ordinário
  const mode = process.argv[3] || 'daily_incremental';

  console.log('='.repeat(60));
  console.log('  TESTE DE SINCRONIZAÇÃO COMPLETA - CONTA AZUL');
  console.log('='.repeat(60));

  // Testar sincronização via Edge Function
  await testSync(barId, mode);

  // Aguardar um pouco
  console.log('\n⏳ Aguardando 3 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Testar endpoints de API
  await testEndpoints(barId);

  console.log('\n' + '='.repeat(60));
  console.log('  TESTE CONCLUÍDO');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
