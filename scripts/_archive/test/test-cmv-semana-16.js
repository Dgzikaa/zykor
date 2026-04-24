const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzI1MzYyMSwiZXhwIjoyMDIyODI5NjIxfQ.aBUe7kkSr5Oj5OZhSWZlhZZGhbmZZZZZZZZZZZZZZZZ';

function testCMVAuto() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ 
      bar_id: 3,
      ano: 2026,
      semana: 16,
      todas_semanas: false
    });
    
    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: '/functions/v1/cmv-semanal-auto',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}\n`);
        console.log('Resposta:');
        console.log(JSON.stringify(JSON.parse(data), null, 2));
        resolve();
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

console.log('🚀 Chamando cmv-semanal-auto para semana 16...\n');
testCMVAuto().catch(console.error);
