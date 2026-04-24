/**
 * Debug da sincronização do Deboche
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testSync() {
  console.log('🔍 Debug Sincronização Deboche\n');

  const barId = 4;
  const dateFrom = '2026-03-01';
  const dateTo = '2026-04-04';

  console.log(`📊 Parâmetros:`);
  console.log(`   bar_id: ${barId}`);
  console.log(`   date_from: ${dateFrom}`);
  console.log(`   date_to: ${dateTo}\n`);

  try {
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
          date_from: dateFrom,
          date_to: dateTo
        })
      }
    );

    console.log(`📡 Status: ${response.status} ${response.statusText}\n`);

    const text = await response.text();
    console.log('📦 Resposta bruta:');
    console.log(text);
    console.log('\n');

    if (!response.ok) {
      console.error('❌ Erro na requisição');
      return;
    }

    const data = JSON.parse(text);
    console.log('✅ Resposta parseada:');
    console.log(JSON.stringify(data, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  }
}

testSync();
