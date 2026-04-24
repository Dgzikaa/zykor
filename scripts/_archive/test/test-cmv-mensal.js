const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcwNzI1MzYyMSwiZXhwIjoyMDIyODI5NjIxfQ.aBUe7kkSr5Oj5OZhSWZlhZZGhbmZZZZZZZZZZZZZZZZ';

function testCMVMensal() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'zykor.com.br',
      port: 443,
      path: '/api/cmv-semanal/mensal?bar_id=3&mes=4&ano=2026',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`\nStatus: ${res.statusCode}\n`);
        if (res.statusCode === 200) {
          const json = JSON.parse(data);
          console.log('Resposta:');
          console.log(JSON.stringify(json, null, 2));
          
          if (json.mes) {
            console.log('\n📊 RESUMO:');
            console.log(`Faturamento Bruto: R$ ${parseFloat(json.mes.vendas_brutas).toFixed(2)}`);
            console.log(`Faturamento CMVível: R$ ${parseFloat(json.mes.faturamento_cmvivel).toFixed(2)}`);
            console.log(`CMV Real: R$ ${parseFloat(json.mes.cmv_real).toFixed(2)}`);
            console.log(`CMV %: ${parseFloat(json.mes.cmv_limpo_percentual).toFixed(2)}%`);
            console.log(`\nFonte: ${json.fonte || 'semanas'}`);
            console.log(`Semanas: ${json.semanasIncluidas?.join(', ') || 'N/A'}`);
          }
        } else {
          console.log('Erro:', data);
        }
        resolve();
      });
    });

    req.on('error', reject);
    req.end();
  });
}

console.log('🚀 Testando CMV Mensal - Abril/2026...\n');
testCMVMensal().catch(console.error);
