const https = require('https');

// Buscar de 01/02 até 30/06 para capturar TODOS os lançamentos com competência em março
const data = JSON.stringify({
  bar_id: 3,
  sync_mode: 'custom',
  date_from: '2026-02-01',
  date_to: '2026-06-30'
});

const options = {
  hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
  port: 443,
  path: '/functions/v1/contaazul-sync',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0'
  }
};

console.log('Sincronizando Conta Azul (fev-jun 2026) para capturar todos lancamentos de marco...\n');

const req = https.request(options, (res) => {
  let body = '';

  res.on('data', (chunk) => {
    body += chunk;
  });

  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('\nResposta:');
    try {
      const json = JSON.parse(body);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(body);
    }
  });
});

req.on('error', (error) => {
  console.error('Erro:', error);
});

req.write(data);
req.end();
