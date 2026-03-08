/**
 * Script para processar dados brutos pendentes dos dias 05, 06 e 07 de março de 2026
 * 
 * Uso: node scripts/processar-dados-pendentes-marco.js
 */

require('dotenv').config({ path: './frontend/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente não encontradas');
  console.log('Certifique-se de ter NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em frontend/.env.local');
  process.exit(1);
}

async function main() {
  console.log('🔄 Iniciando processamento de dados pendentes de março...\n');
  
  // Primeiro, verificar quantos dados estão pendentes
  const checkUrl = `${SUPABASE_URL}/rest/v1/contahub_raw_data?select=id,data_type,data_date,bar_id&processed=eq.false&order=data_date.asc`;
  
  const checkResponse = await fetch(checkUrl, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
    }
  });
  
  if (!checkResponse.ok) {
    console.error('❌ Erro ao verificar dados pendentes:', checkResponse.statusText);
    process.exit(1);
  }
  
  const pendingData = await checkResponse.json();
  
  if (pendingData.length === 0) {
    console.log('✅ Nenhum dado pendente para processar!');
    console.log('\n⚠️ Isso pode significar:');
    console.log('   1. Os dados já foram processados');
    console.log('   2. A coleta (sync) não foi executada para esses dias');
    console.log('\n💡 Sugestão: Execute a coleta retroativa primeiro:');
    console.log('   curl -X POST "https://seu-site.vercel.app/api/contahub/sync-retroativo" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"bar_id": 3, "data_inicio": "2026-03-05", "data_fim": "2026-03-07"}\'');
    return;
  }
  
  console.log(`📊 Encontrados ${pendingData.length} registros pendentes:\n`);
  
  // Agrupar por bar_id e data
  const grouped = {};
  pendingData.forEach(item => {
    const key = `bar_${item.bar_id}_${item.data_date}`;
    if (!grouped[key]) {
      grouped[key] = { bar_id: item.bar_id, data_date: item.data_date, types: [] };
    }
    grouped[key].types.push(item.data_type);
  });
  
  Object.values(grouped).forEach(g => {
    console.log(`   📦 Bar ${g.bar_id} - ${g.data_date}: ${g.types.join(', ')}`);
  });
  
  console.log('\n🚀 Processando via Edge Function contahub_processor...\n');
  
  // Processar para cada bar
  const barIds = [...new Set(pendingData.map(d => d.bar_id))];
  
  for (const barId of barIds) {
    console.log(`\n📦 Processando Bar ID ${barId}...`);
    
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/contahub-processor`;
    
    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          process_all: true,
          bar_id: barId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro para bar ${barId}:`, errorText);
        continue;
      }
      
      const result = await response.json();
      
      console.log(`✅ Bar ${barId}:`);
      console.log(`   - Processados: ${result.processed_count || 0}`);
      console.log(`   - Sucessos: ${result.success_count || 0}`);
      console.log(`   - Erros: ${result.error_count || 0}`);
      console.log(`   - Tempo: ${result.processing_time_seconds?.toFixed(2) || 0}s`);
      
      if (result.results && result.results.length > 0) {
        result.results.forEach(r => {
          const status = r.success ? '✅' : '❌';
          console.log(`      ${status} ${r.data_type}: ${r.inserted_records} registros`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Erro ao processar bar ${barId}:`, error.message);
    }
  }
  
  console.log('\n🎉 Processamento concluído!');
  console.log('\n💡 Próximo passo: Verificar se os eventos foram atualizados:');
  console.log('   SELECT * FROM eventos_base WHERE data_evento >= \'2026-03-05\' ORDER BY data_evento;');
}

main().catch(console.error);
