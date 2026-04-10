const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

async function syncDia(data) {
  console.log(`\n🔄 Sincronizando ${data}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub-sync-automatico`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        bar_id: 3,
        data_date: data,
        automated: false,
        source: 'manual-resync',
        force: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ ${data} - ${result.collected_count || 0} tipos coletados`);
    
    return result;

  } catch (error) {
    console.error(`❌ Erro em ${data}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Sincronizando dias 08 e 09/04/2026\n');

  await syncDia('2026-04-08');
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay
  await syncDia('2026-04-09');

  console.log('\n✨ Sincronização concluída!');
}

main();
