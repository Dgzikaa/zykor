/**
 * Script para testar conexão Conta Azul
 * 
 * Uso: node scripts/test-contaazul-connection.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testBarConnection(barId, barName) {
  console.log(`\n🔍 Testando ${barName} (bar_id=${barId})...`);
  console.log('━'.repeat(60));

  try {
    // 1. Verificar status da autenticação
    console.log('\n1️⃣ Verificando status da autenticação...');
    const statusResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/contaazul-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'status',
          bar_id: barId
        })
      }
    );

    const statusData = await statusResponse.json();
    
    if (!statusResponse.ok) {
      console.error('   ❌ Erro ao verificar status:', statusData);
      return false;
    }

    console.log('   ✅ Status:', {
      connected: statusData.connected,
      has_credentials: statusData.has_credentials,
      needs_refresh: statusData.needs_refresh,
      expires_at: statusData.expires_at
    });

    if (!statusData.connected) {
      console.log('\n   ⚠️  Não conectado! Você precisa autenticar via OAuth:');
      console.log(`   👉 https://zykor.com.br/api/financeiro/contaazul/oauth/authorize?bar_id=${barId}`);
      return false;
    }

    // 2. Testar sincronização (apenas categorias para teste rápido)
    console.log('\n2️⃣ Testando sincronização (full_sync)...');
    const syncResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/contaazul-sync`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          bar_id: barId,
          sync_mode: 'full_sync'
        })
      }
    );

    const syncData = await syncResponse.json();

    if (!syncResponse.ok) {
      console.error('   ❌ Erro ao sincronizar:', syncData);
      return false;
    }

    console.log('   ✅ Sincronização concluída!');
    console.log('   📊 Estatísticas:', {
      lancamentos: syncData.stats?.lancamentos || 0,
      categorias: syncData.stats?.categorias || 0,
      centros_custo: syncData.stats?.centros_custo || 0,
      pessoas: syncData.stats?.pessoas || 0,
      contas_financeiras: syncData.stats?.contas_financeiras || 0
    });
    console.log(`   ⏱️  Duração: ${syncData.duration_seconds}s`);

    return true;

  } catch (error) {
    console.error('   ❌ Erro:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Teste de Conexão Conta Azul\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas');
    console.error('   Certifique-se que .env.local existe com:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const ordinarioOk = await testBarConnection(3, 'Ordinário');
  const debocheOk = await testBarConnection(4, 'Deboche');

  console.log('\n' + '━'.repeat(60));
  console.log('\n📊 RESUMO:');
  console.log(`   Ordinário: ${ordinarioOk ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   Deboche: ${debocheOk ? '✅ OK' : '❌ FALHOU'}`);

  if (ordinarioOk && debocheOk) {
    console.log('\n🎉 Todos os testes passaram! Conta Azul está 100% funcional.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Alguns testes falharam. Verifique os erros acima.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
