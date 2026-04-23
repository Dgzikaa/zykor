const https = require('https');

const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const BAR_ID = 3;
const DIAS = ['2026-04-11', '2026-04-12'];

async function syncDia(dataDate) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      bar_id: BAR_ID,
      data_date: dataDate,
      automated: false,
      source: 'manual_fix_11_12'
    });

    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: '/functions/v1/contahub-sync-automatico',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 Sincronizando dias 11 e 12 de abril...\n');

  for (const dia of DIAS) {
    try {
      console.log(`📅 Sincronizando ${dia}...`);
      const result = await syncDia(dia);
      console.log(`✅ ${dia}: ${JSON.stringify(result, null, 2)}\n`);
      
      // Aguardar 5 segundos entre requisições
      if (dia !== DIAS[DIAS.length - 1]) {
        console.log('⏳ Aguardando 5 segundos...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`❌ Erro em ${dia}:`, error.message, '\n');
    }
  }

  console.log('✅ Sincronização concluída!');
}

main().catch(console.error);
