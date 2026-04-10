const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

async function processarDia(data) {
  console.log(`\n🔄 Processando ${data}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/contahub-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`
      },
      body: JSON.stringify({
        data_date: data,
        bar_id: 3,
        data_types: ['periodo', 'pagamentos', 'analitico', 'tempo', 'fatporhora', 'cancelamentos']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ ${data} processado!`);
    console.log(JSON.stringify(result.summary, null, 2));
    
    return result;

  } catch (error) {
    console.error(`❌ Erro em ${data}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Processando dias 08 e 09/04/2026\n');

  await processarDia('2026-04-08');
  await new Promise(resolve => setTimeout(resolve, 3000));
  await processarDia('2026-04-09');

  console.log('\n✨ Processamento concluído!');
}

main();
