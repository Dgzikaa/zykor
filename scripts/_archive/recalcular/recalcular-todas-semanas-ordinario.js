// Script para recalcular TODAS as semanas do Ordinário (2025 e 2026)
const fetch = require('node-fetch');

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0";
const URL = "https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/recalcular-desempenho-v2";
const BAR_ID = 3;

// Ordinário começou em Março/2025 (semana 10)
// 2025: semanas 10-52 (43 semanas)
// 2026: semanas 1-15 (15 semanas até hoje)
// Total: 58 semanas

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function recalcularTodasSemanas() {
  const semanas = [];
  
  // 2025: semanas 10 a 52 (Março a Dezembro)
  for (let sem = 10; sem <= 52; sem++) {
    semanas.push({ ano: 2025, semana: sem });
  }
  
  // 2026: semanas 1 a 15 (Janeiro a Abril)
  for (let sem = 1; sem <= 15; sem++) {
    semanas.push({ ano: 2026, semana: sem });
  }
  
  const total = semanas.length;
  let successCount = 0;
  let errorCount = 0;
  let diffsCount = 0;
  
  console.log('\x1b[36m🔄 Recalculando TODAS as semanas do ORDINÁRIO (bar_id=' + BAR_ID + ')\x1b[0m');
  console.log('\x1b[36m📊 Total de semanas: ' + total + '\x1b[0m');
  console.log('\x1b[36m⏱️  Tempo estimado: ~' + Math.round(total * 3 / 60) + ' minutos (3s por semana)\x1b[0m');
  console.log('');
  
  for (let i = 0; i < semanas.length; i++) {
    const { ano, semana } = semanas[i];
    const progress = (((i + 1) / total) * 100).toFixed(1);
    
    process.stdout.write(`[${i + 1}/${total} - ${progress}%] Semana ${semana}/${ano}...`);
    
    try {
      const response = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_KEY}`
        },
        body: JSON.stringify({
          bar_id: BAR_ID,
          ano: ano,
          numero_semana: semana,
          mode: 'write'
        }),
        timeout: 30000
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.results && result.results[0]) {
          const r = result.results[0];
          const info = [];
          
          // Clientes
          if (r.registro_atual_encontrado) {
            const clientes = r.diff_summary?.significant_diffs?.find(d => d.field === 'clientes_atendidos');
            if (clientes) {
              info.push(`\x1b[36mcli:${clientes.calculado}\x1b[32m`);
            }
          }
          
          // Diferenças encontradas
          const diffs = r.total_fields_divergent || 0;
          if (diffs > 0) {
            info.push(`\x1b[33m${diffs}diffs\x1b[32m`);
            diffsCount += diffs;
          }
          
          // Write executado
          if (r.write_executed) {
            info.push('✓');
          }
          
          const infoStr = info.length > 0 ? ` [${info.join(' ')}]` : '';
          console.log(` \x1b[32m✅${infoStr}\x1b[0m`);
          successCount++;
        } else {
          console.log(` \x1b[33m⚠️  ${result.message || 'sem resultado'}\x1b[0m`);
          successCount++;
        }
      } else {
        const errorText = await response.text();
        console.log(` \x1b[31m❌ HTTP ${response.status}\x1b[0m`);
        errorCount++;
      }
    } catch (error) {
      console.log(` \x1b[31m❌ ${error.code || error.message}\x1b[0m`);
      errorCount++;
    }
    
    // Delay de 3 segundos entre semanas
    await sleep(3000);
    
    // A cada 10 semanas, mostrar resumo
    if ((i + 1) % 10 === 0) {
      console.log('');
      console.log(`\x1b[33m📈 Progresso: ${successCount} sucessos, ${errorCount} erros, ${diffsCount} diffs corrigidas\x1b[0m`);
      console.log('');
    }
  }
  
  console.log('');
  console.log('\x1b[32m✨ Recálculo concluído!\x1b[0m');
  console.log(`\x1b[32m✅ Sucessos: ${successCount}\x1b[0m`);
  console.log(`\x1b[31m❌ Erros: ${errorCount}\x1b[0m`);
  console.log(`\x1b[33m🔧 Total de diferenças corrigidas: ${diffsCount}\x1b[0m`);
  console.log(`\x1b[36m📊 Total: ${total} semanas\x1b[0m`);
}

recalcularTodasSemanas().catch(console.error);
