const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const data = JSON.stringify({
  bar_id: 3,
  ano: 2026,
  semana: 15
});

const options = {
  hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
  port: 443,
  path: '/functions/v1/cmv-semanal-auto',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Length': data.length
  },
  timeout: 120000
};

console.log('🚀 Chamando cmv-semanal-auto...\n');

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`\nResposta:`);
    try {
      const json = JSON.parse(responseData);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro:', error.message);
});

req.on('timeout', () => {
  console.error('❌ Timeout após 120s');
  req.destroy();
});

req.write(data);
req.end();
