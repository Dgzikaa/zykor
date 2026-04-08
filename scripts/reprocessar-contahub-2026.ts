/**
 * Script para reprocessar dados do ContaHub de 2026
 * Usa os dados raw salvos e reprocessa com a lógica corrigida
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jqcxlxhqbvvfxuhtvyfa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxY3hseGhxYnZ2Znh1aHR2eWZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTU3MjY0MCwiZXhwIjoyMDUxMTQ4NjQwfQ.s7wZKH_kqmkp-LkQvNNlqWfJhECOdJQYEkHPjXx3LJQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function reprocessar() {
  console.log('🔄 Reprocessando dados de março e abril 2026...\n');

  // Buscar todos os raw_data de março e abril
  const { data: rawData, error } = await supabase
    .from('contahub_raw_data')
    .select('*')
    .eq('bar_id', 3)
    .eq('data_type', 'pagamentos')
    .gte('data_date', '2026-03-01')
    .lte('data_date', '2026-04-30')
    .order('data_date');

  if (error) {
    console.error('❌ Erro ao buscar raw_data:', error);
    return;
  }

  console.log(`📦 Encontrados ${rawData.length} registros raw para reprocessar\n`);

  let processados = 0;
  let erros = 0;

  for (const raw of rawData) {
    console.log(`📅 Processando ${raw.data_date}...`);

    const response = await fetch(`${supabaseUrl}/functions/v1/contahub-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        raw_data_id: raw.id,
        force_reprocess: true
      })
    });

    if (response.ok) {
      processados++;
      console.log(`  ✅ Processado`);
    } else {
      erros++;
      const error = await response.text();
      console.log(`  ❌ Erro: ${error}`);
    }

    // Delay entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n✅ Reprocessamento concluído!`);
  console.log(`   Processados: ${processados}`);
  console.log(`   Erros: ${erros}`);
}

reprocessar().catch(console.error);
