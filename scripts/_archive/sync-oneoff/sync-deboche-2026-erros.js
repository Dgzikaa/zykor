// Script para resincronizar dias do Deboche 2026 que tiveram erros
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico";
const BAR_ID = 4;

// Dias que tiveram erros parciais (menos de 7 tipos coletados)
const DIAS_COM_ERROS = [
  '2026-01-12', // 6 tipos (faltou 1)
  '2026-01-19', // 6 tipos (faltou 1)
  '2026-01-26', // 6 tipos (faltou 1)
  '2026-02-02', // 1 tipo (faltaram 5!)
  '2026-02-18', // 6 tipos (faltou 1)
  '2026-03-03', // 6 tipos (faltou 1)
  '2026-04-01', // 6 tipos (faltou 1)
  '2026-04-07', // 6 tipos (faltou 1)
  '2026-04-08'  // 6 tipos (faltou 1)
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(minSeconds, maxSeconds) {
  const ms = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  return Math.round(ms);
}

async function resincronizarErros() {
  const total = DIAS_COM_ERROS.length;
  let successCount = 0;
  let errorCount = 0;
  
  console.log('\x1b[36m🔄 Resincronizando dias com erros - DEBOCHE 2026 (bar_id=' + BAR_ID + ')\x1b[0m');
  console.log('\x1b[36m📊 Total de dias: ' + total + '\x1b[0m');
  console.log('\x1b[36m⏱️  Tempo estimado: ~' + Math.round(total * 20 / 60) + ' minutos (delay 10-30s)\x1b[0m');
  console.log('');
  
  for (let i = 0; i < DIAS_COM_ERROS.length; i++) {
    const dateStr = DIAS_COM_ERROS[i];
    const progress = (((i + 1) / total) * 100).toFixed(1);
    
    process.stdout.write(`[${i + 1}/${total} - ${progress}%] Resincronizando ${dateStr}...`);
    
    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({
          bar_id: BAR_ID,
          data_date: dateStr
        }),
        timeout: 60000
      });
      
      if (response.ok) {
        const result = await response.json();
        
        const info = [];
        if (result.summary) {
          const colCount = result.summary.collected_count || 0;
          if (colCount > 0) info.push(`\x1b[36m${colCount}tipos\x1b[32m`);
          
          const totalRecs = result.summary.total_records_collected || 0;
          if (totalRecs > 0) info.push(`${totalRecs}regs`);
          
          const errCount = result.summary.error_count || 0;
          if (errCount > 0) {
            if (colCount === 0 && totalRecs === 0) {
              info.push(`\x1b[33mSEM DADOS (${errCount}err)\x1b[32m`);
            } else {
              info.push(`\x1b[31m${errCount}err\x1b[32m`);
            }
          }
          
          if (result.summary.includes_vendas) info.push('vendas✓');
        }
        
        const infoStr = info.length > 0 ? ` [${info.join(' ')}]` : '';
        console.log(` \x1b[32m✅ OK${infoStr}\x1b[0m`);
        successCount++;
      } else {
        const errorText = await response.text();
        console.log(` \x1b[31m❌ ERRO HTTP ${response.status}\x1b[0m`);
        errorCount++;
      }
    } catch (error) {
      console.log(` \x1b[31m❌ ERRO: ${error.code || error.message}\x1b[0m`);
      errorCount++;
    }
    
    const delayMs = randomDelay(10, 30);
    await sleep(delayMs);
  }
  
  console.log('');
  console.log('\x1b[32m✨ Resincronização concluída!\x1b[0m');
  console.log(`\x1b[32m✅ Sucessos: ${successCount}\x1b[0m`);
  console.log(`\x1b[31m❌ Erros: ${errorCount}\x1b[0m`);
}

resincronizarErros().catch(console.error);
