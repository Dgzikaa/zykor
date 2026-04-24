// Script para resincronizar dias que falharam (timeout/lock)
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico";
const BAR_ID = 3;

// Dias que falharam por timeout/lock (CRÍTICOS - finais de semana)
const DIAS_CRITICOS = [
  '2025-05-23', // Sexta
  '2025-05-24', // Sábado
  '2025-05-25', // Domingo
  '2025-05-26', // Segunda
  '2025-05-27', // Terça
  '2025-05-28', // Quarta
  '2025-05-29', // Quinta
  '2025-05-30', // Sexta
  '2025-05-31', // Sábado
  '2025-06-01', // Domingo
  '2025-06-02', // Segunda
  '2025-06-03', // Terça
  '2025-06-04', // Quarta
  '2025-06-05', // Quinta
  '2025-06-06', // Sexta
  '2025-06-07', // Sábado
  '2025-06-08', // Domingo
  '2026-01-16', // Sexta
  '2026-01-17', // Sábado
  '2026-01-18', // Domingo
  '2026-01-19', // Segunda
  '2026-01-20', // Terça
  '2026-01-21', // Quarta
  '2026-01-22', // Quinta
  '2026-01-23', // Sexta
  '2026-01-24', // Sábado
  '2026-01-25', // Domingo
  '2026-01-26'  // Segunda
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para gerar delay aleatório entre min e max segundos
function randomDelay(minSeconds, maxSeconds) {
  const ms = (Math.random() * (maxSeconds - minSeconds) + minSeconds) * 1000;
  return Math.round(ms);
}

async function syncDiasCriticos() {
  const totalDays = DIAS_CRITICOS.length;
  let successCount = 0;
  let errorCount = 0;
  
  console.log('\x1b[36m🚀 Resincronizando dias CRÍTICOS (bar_id=' + BAR_ID + ')\x1b[0m');
  console.log('\x1b[36m📊 Total de dias: ' + totalDays + '\x1b[0m');
  console.log('\x1b[36m⏱️  Tempo estimado: ~' + Math.round(totalDays * 20 / 60) + ' minutos (delay aleatório 10-30s)\x1b[0m');
  console.log('');
  
  for (let i = 0; i < DIAS_CRITICOS.length; i++) {
    const dateStr = DIAS_CRITICOS[i];
    const progress = (((i + 1) / totalDays) * 100).toFixed(1);
    
    process.stdout.write(`[${i + 1}/${totalDays} - ${progress}%] Sincronizando ${dateStr}...`);
    
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
        timeout: 60000 // 60 segundos de timeout
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
        console.log(` \x1b[31m❌ ERRO HTTP ${response.status}: ${errorText.substring(0, 100)}\x1b[0m`);
        errorCount++;
      }
    } catch (error) {
      console.log(` \x1b[31m❌ ERRO: ${error.code || error.message}\x1b[0m`);
      errorCount++;
    }
    
    // Delay aleatório entre 10-30 segundos (humanizado)
    const delayMs = randomDelay(10, 30);
    const delaySec = (delayMs / 1000).toFixed(1);
    process.stdout.write(`\x1b[90m   ⏳ Aguardando ${delaySec}s...\x1b[0m\r`);
    await sleep(delayMs);
    process.stdout.write('\x1b[K'); // Limpar linha
    
    // A cada 5 dias, mostrar resumo
    if ((i + 1) % 5 === 0) {
      console.log('');
      console.log(`\x1b[33m📈 Progresso: ${successCount} sucessos, ${errorCount} erros\x1b[0m`);
      console.log('');
    }
  }
  
  console.log('');
  console.log('\x1b[32m✨ Resincronização concluída!\x1b[0m');
  console.log(`\x1b[32m✅ Sucessos: ${successCount}\x1b[0m`);
  console.log(`\x1b[31m❌ Erros: ${errorCount}\x1b[0m`);
  console.log(`\x1b[36m📊 Total: ${totalDays} dias\x1b[0m`);
}

syncDiasCriticos().catch(console.error);
