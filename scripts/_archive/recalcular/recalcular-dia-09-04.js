const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

async function recalcularDia09() {
  console.log('🔄 Reprocessando dia 09/04/2026...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        data_date: '2026-04-09',
        bar_id: 3,
        data_types: ['periodo', 'pagamentos', 'analitico', 'tempo', 'fatporhora', 'cancelamentos']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Reprocessamento concluído!');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

recalcularDia09();
