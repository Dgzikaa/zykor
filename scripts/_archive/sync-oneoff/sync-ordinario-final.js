// Script para sincronizar os 2 últimos dias críticos (finais de semana)
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico";
const BAR_ID = 3;

// 2 dias críticos finais (finais de semana)
const DIAS_FINAIS = [
  '2025-09-05', // Sexta
  '2026-01-04'  // Domingo
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function syncDiasFinais() {
  console.log('\x1b[36m🚀 Sincronizando 2 DIAS FINAIS CRÍTICOS (bar_id=' + BAR_ID + ')\x1b[0m');
  console.log('');
  
  for (let i = 0; i < DIAS_FINAIS.length; i++) {
    const dateStr = DIAS_FINAIS[i];
    
    process.stdout.write(`[${i + 1}/2] Sincronizando ${dateStr}...`);
    
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
      } else {
        const errorText = await response.text();
        console.log(` \x1b[31m❌ ERRO HTTP ${response.status}: ${errorText.substring(0, 100)}\x1b[0m`);
      }
    } catch (error) {
      console.log(` \x1b[31m❌ ERRO: ${error.code || error.message}\x1b[0m`);
    }
    
    if (i < DIAS_FINAIS.length - 1) {
      await sleep(15000); // 15s entre os 2 dias
    }
  }
  
  console.log('');
  console.log('\x1b[32m✨ Sincronização final concluída!\x1b[0m');
}

syncDiasFinais().catch(console.error);
