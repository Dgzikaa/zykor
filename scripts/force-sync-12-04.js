const https = require('https');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";

async function syncDia(dataDate) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      bar_id: 3,
      data_date: dataDate,
      automated: false,
      source: 'force_sync_script',
      debug: true
    });

    console.log(`\n📤 Enviando requisição para ${dataDate}...`);
    console.log(`Body: ${body}`);

    const cacheBust = Date.now();
    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: `/functions/v1/contahub-sync-automatico?_cb=${cacheBust}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      console.log(`📥 Status: ${res.statusCode}`);
      console.log(`📥 Headers:`, res.headers);
      
      res.on('data', (chunk) => { 
        data += chunk;
        process.stdout.write('.');
      });
      
      res.on('end', () => {
        console.log(`\n📦 Resposta completa recebida (${data.length} bytes)`);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            console.log(`✅ Sucesso:`, JSON.stringify(result, null, 2));
            resolve(result);
          } catch (e) {
            console.log(`⚠️ Resposta não é JSON:`, data.substring(0, 500));
            resolve({ raw: data });
          }
        } else {
          console.error(`❌ Erro HTTP ${res.statusCode}:`, data);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Erro de rede:`, error);
      reject(error);
    });

    req.setTimeout(180000, () => {
      console.error(`❌ Timeout após 3 minutos`);
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 FORÇANDO SINCRONIZAÇÃO DE 12/04/2026\n');
  console.log('=' .repeat(60));

  try {
    const result = await syncDia('2026-04-12');
    console.log('\n' + '='.repeat(60));
    console.log('✅ SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ FALHA NA SINCRONIZAÇÃO:', error.message);
    console.log('='.repeat(60));
    process.exit(1);
  }
}

main();
