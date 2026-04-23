// Script para sincronizar ORDINÁRIO (bar_id=3) completo
// De 01/03/2025 até 09/04/2026

const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-sync-automatico";
const SUPABASE_URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co";
const BAR_ID = 3;

// Cache de dias já sincronizados
let syncedDaysCache = null;

// Função para adicionar dias a uma data
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Função para formatar data como YYYY-MM-DD (usando UTC)
function formatDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Função para delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para buscar dias já sincronizados
async function getSyncedDays() {
  if (syncedDaysCache) return syncedDaysCache;
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/contahub_raw_data?bar_id=eq.${BAR_ID}&data_date=gte.2025-03-01&select=data_date`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      syncedDaysCache = new Set(data.map(row => row.data_date));
      return syncedDaysCache;
    }
  } catch (error) {
    console.warn('⚠️  Não foi possível buscar dias sincronizados, continuando sem cache');
  }
  
  return new Set();
}

// Função principal
async function syncOrdinario() {
  // Usar UTC para evitar problemas de timezone
  const startDate = new Date(Date.UTC(2025, 2, 1)); // 01/03/2025 (mês 2 = março, pois começa em 0)
  const endDate = new Date(Date.UTC(2026, 3, 9));   // 09/04/2026
  
  const totalDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  let currentDay = 0;
  let successCount = 0;
  let errorCount = 0;
  
  console.log('\x1b[36m🚀 Iniciando sincronização ORDINÁRIO (bar_id=' + BAR_ID + ')\x1b[0m');
  console.log('\x1b[36m📅 Período: 01/03/2025 a 09/04/2026\x1b[0m');
  console.log('\x1b[36m📊 Total de dias: ' + totalDays + '\x1b[0m');
  console.log('\x1b[36m⏱️  Tempo estimado: ~' + Math.round(totalDays * 5 / 60) + ' minutos\x1b[0m');
  console.log('');
  console.log('\x1b[33m🔍 Buscando dias já sincronizados...\x1b[0m');
  
  const syncedDays = await getSyncedDays();
  const alreadySynced = syncedDays.size;
  
  if (alreadySynced > 0) {
    console.log(`\x1b[32m✅ ${alreadySynced} dias já sincronizados (serão pulados)\x1b[0m`);
  }
  console.log('');
  
  let currentDate = new Date(startDate);
  let skippedCount = 0;
  
  while (currentDate <= endDate) {
    currentDay++;
    const dateStr = formatDate(currentDate);
    const progress = ((currentDay / totalDays) * 100).toFixed(1);
    
    // Verificar se já foi sincronizado
    if (syncedDays.has(dateStr)) {
      console.log(`[${currentDay}/${totalDays} - ${progress}%] ${dateStr} \x1b[90m⏭️  JÁ SINCRONIZADO\x1b[0m`);
      skippedCount++;
      currentDate = addDays(currentDate, 1);
      continue;
    }
    
    process.stdout.write(`[${currentDay}/${totalDays} - ${progress}%] Sincronizando ${dateStr}...`);
    
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
        timeout: 30000
      });
      
      if (response.ok) {
        const result = await response.json();
        
        // Mostrar detalhes do processamento
        const info = [];
        
        if (result.summary) {
          // Tipos coletados
          const colCount = result.summary.collected_count || 0;
          if (colCount > 0) info.push(`\x1b[36m${colCount}tipos\x1b[32m`);
          
          // Total de registros
          const totalRecs = result.summary.total_records_collected || 0;
          if (totalRecs > 0) info.push(`${totalRecs}regs`);
          
          // Erros
          const errCount = result.summary.error_count || 0;
          if (errCount > 0) {
            // Se só tem erros e nenhum dado coletado, é dia sem movimento
            if (colCount === 0 && totalRecs === 0) {
              info.push(`\x1b[33mSEM DADOS (${errCount}err)\x1b[32m`);
            } else {
              info.push(`\x1b[31m${errCount}err\x1b[32m`);
            }
          }
          
          // Vendas incluídas
          if (result.summary.includes_vendas) info.push('vendas✓');
        }
        
        // Processamento em background
        if (result.summary?.processing_method === 'pg_cron_background') {
          info.push('\x1b[33mbg\x1b[32m');
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
    
    // Próximo dia
    currentDate = addDays(currentDate, 1);
    
    // Delay de 5 segundos entre requisições
    await sleep(5000);
    
    // A cada 10 dias, mostrar resumo
    if (currentDay % 10 === 0) {
      console.log('');
      console.log(`\x1b[33m📈 Progresso: ${successCount} sucessos, ${errorCount} erros\x1b[0m`);
      console.log('');
    }
  }
  
  console.log('');
  console.log('\x1b[32m✨ Sincronização concluída!\x1b[0m');
  console.log(`\x1b[32m✅ Sucessos: ${successCount}\x1b[0m`);
  console.log(`\x1b[31m❌ Erros: ${errorCount}\x1b[0m`);
  console.log(`\x1b[90m⏭️  Pulados: ${skippedCount}\x1b[0m`);
  console.log(`\x1b[36m📊 Total: ${totalDays} dias\x1b[0m`);
}

// Executar
syncOrdinario().catch(console.error);
