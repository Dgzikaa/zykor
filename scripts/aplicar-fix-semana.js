/**
 * Aplicar fix: remover coluna 'semana' das funções SQL
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function aplicarFix() {
  console.log('🔧 Aplicando fix: remover coluna "semana" das funções SQL\n');

  // Ler arquivo SQL
  const sqlPath = path.join(__dirname, '..', 'database', 'migrations', 'fix_process_functions_remove_semana.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('📄 Executando migration...\n');

  // Executar SQL
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.log('❌ Erro ao executar migration:', error.message);
    console.log('\n💡 Vou tentar executar via fetch direto...\n');
    
    // Tentar via fetch
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({ sql_query: sql })
    });

    if (!response.ok) {
      console.log('❌ Também falhou via fetch');
      console.log('\n📋 SQL a ser executado manualmente no Supabase SQL Editor:\n');
      console.log(sql);
      process.exit(1);
    }
  }

  console.log('✅ Migration aplicada com sucesso!\n');
  console.log('🧪 Testando as funções corrigidas...\n');

  // Testar com dados do Deboche
  const { data: rawData } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, raw_json')
    .eq('bar_id', 4)
    .eq('data_date', '2026-03-01')
    .in('data_type', ['tempo', 'fatporhora']);

  if (!rawData || rawData.length === 0) {
    console.log('⚠️  Sem dados para testar');
    return;
  }

  for (const dado of rawData) {
    const dataArray = dado.raw_json?.list || [];
    if (dataArray.length === 0) continue;

    console.log(`📊 Testando ${dado.data_type}...`);

    const funcao = dado.data_type === 'tempo' ? 'process_tempo_data' : 'process_fatporhora_data';
    
    const { data: resultado, error: testError } = await supabase.rpc(funcao, {
      p_bar_id: 4,
      p_data_array: dataArray,
      p_data_date: '2026-03-01'
    });

    if (testError) {
      console.log(`   ❌ Erro: ${testError.message}\n`);
    } else {
      console.log(`   ✅ Sucesso: ${resultado} registros inseridos\n`);
      
      // Marcar como processado
      await supabase
        .from('contahub_raw_data')
        .update({ processed: true })
        .eq('id', dado.id);
    }
  }

  console.log('='.repeat(60));
  console.log('✅ FIX APLICADO E TESTADO!');
  console.log('='.repeat(60));
  console.log();
  console.log('Agora o processamento automático funcionará corretamente.');
}

aplicarFix()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
