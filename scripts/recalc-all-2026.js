const https = require('https');

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

// Hoje é 13/04/2026, então semana 15 ainda não fechou (vai até 12/04)
// Vamos recalcular semanas 1 a 15 de 2026
const ANO = 2026;
const SEMANAS = Array.from({length: 15}, (_, i) => i + 1); // 1 a 15
const BARES = [
  { id: 3, nome: 'Ordinário' },
  { id: 4, nome: 'Deboche' }
];

function callRecalcular(barId, barNome, semana) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      bar_id: barId,
      ano: ANO,
      numero_semana: semana,
      mode: 'write'
    });

    const options = {
      hostname: 'uqtgsvujwcbymjmvkjhy.supabase.co',
      port: 443,
      path: '/functions/v1/recalcular-desempenho-v2',
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

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          if (json.success) {
            const result = json.results[0];
            console.log(`✅ ${barNome} S${semana}: Fat=${result.diff_summary?.significant_diffs?.find(d => d.field === 'faturamento_total')?.calculado || 'OK'}`);
            resolve({ bar: barNome, semana, success: true, result });
          } else {
            console.log(`❌ ${barNome} S${semana}: ${json.message || 'Erro'}`);
            resolve({ bar: barNome, semana, success: false, error: json.message });
          }
        } catch (e) {
          console.log(`❌ ${barNome} S${semana}: Parse error`);
          resolve({ bar: barNome, semana, success: false, error: e.message });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ ${barNome} S${semana}: ${error.message}`);
      resolve({ bar: barNome, semana, success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.error(`❌ ${barNome} S${semana}: Timeout`);
      req.destroy();
      resolve({ bar: barNome, semana, success: false, error: 'Timeout' });
    });

    req.write(data);
    req.end();
  });
}

async function recalcularTudo() {
  console.log('🔄 RECALCULANDO TODAS AS SEMANAS DE 2026\n');
  console.log(`Total: ${BARES.length} bares × ${SEMANAS.length} semanas = ${BARES.length * SEMANAS.length} recálculos\n`);

  const results = [];
  
  for (const bar of BARES) {
    console.log(`\n📊 ${bar.nome} (bar_id=${bar.id})`);
    console.log('='.repeat(50));
    
    for (const semana of SEMANAS) {
      const result = await callRecalcular(bar.id, bar.nome, semana);
      results.push(result);
      
      // Aguardar 500ms entre chamadas para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('📈 RESUMO FINAL');
  console.log('='.repeat(50));
  
  const sucessos = results.filter(r => r.success).length;
  const falhas = results.filter(r => !r.success).length;
  
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);
  
  if (falhas > 0) {
    console.log('\n❌ Semanas com erro:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.bar} S${r.semana}: ${r.error}`);
    });
  }
}

recalcularTudo().catch(console.error);
