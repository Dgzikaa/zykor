const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

async function callEdgeFunction(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: `/functions/v1/${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': data.length
      },
      timeout: 120000
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(data);
    req.end();
  });
}

async function fix() {
  console.log('🔧 CORRIGINDO DEBOCHE 13/04/2026\n');

  // 1. Sincronizar dados brutos do ContaHub
  console.log('1️⃣ Sincronizando dados do ContaHub...');
  const sync = await callEdgeFunction('contahub-sync-automatico', {
    bar_id: 4,
    data_inicio: '2026-04-13',
    data_fim: '2026-04-13'
  });
  console.log(`   Status: ${sync.status} - ${sync.data.success ? 'OK' : 'ERRO'}`);
  if (!sync.data.success) {
    console.error('   Erro:', sync.data.message);
    return;
  }

  await new Promise(r => setTimeout(r, 3000));

  // 2. Processar dados para contahub_periodo
  console.log('\n2️⃣ Processando dados...');
  const process = await callEdgeFunction('contahub-processor', {
    bar_id: 4,
    data_inicio: '2026-04-13',
    data_fim: '2026-04-13'
  });
  console.log(`   Status: ${process.status} - ${process.data.success ? 'OK' : 'ERRO'}`);

  await new Promise(r => setTimeout(r, 3000));

  // 3. Calcular métricas do eventos_base
  console.log('\n3️⃣ Calculando eventos_base...');
  const metrics = await callEdgeFunction('calculate_evento_metrics', {
    bar_id: 4,
    data_evento: '2026-04-13'
  });
  console.log(`   Status: ${metrics.status} - ${metrics.data.success ? 'OK' : 'ERRO'}`);

  await new Promise(r => setTimeout(r, 2000));

  // 4. Sincronizar stockout
  console.log('\n4️⃣ Sincronizando stockout...');
  const stockout = await callEdgeFunction('contahub-stockout-sync', {
    bar_id: 4,
    data_date: '2026-04-13'
  });
  console.log(`   Status: ${stockout.status} - ${stockout.data.success ? 'OK' : 'ERRO'}`);

  console.log('\n✅ CONCLUÍDO!');
}

fix().catch(console.error);
