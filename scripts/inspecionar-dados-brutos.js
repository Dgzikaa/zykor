/**
 * Script para inspecionar o conteúdo dos dados brutos coletados
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4;
const DATA_EVENTO = '2026-03-01';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function inspecionarDadosBrutos() {
  console.log('🔍 Inspecionando dados brutos de 01/03/2026...\n');

  const { data: rawData, error } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, data_date, processed, record_count, raw_json, created_at')
    .eq('bar_id', BAR_ID)
    .eq('data_date', DATA_EVENTO)
    .order('data_type', { ascending: true });

  if (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }

  if (!rawData || rawData.length === 0) {
    console.log('❌ Nenhum dado bruto encontrado!');
    process.exit(1);
  }

  console.log(`✅ ${rawData.length} tipos de dados encontrados:\n`);

  for (const dado of rawData) {
    console.log('='.repeat(70));
    console.log(`📊 ${dado.data_type.toUpperCase()}`);
    console.log('='.repeat(70));
    console.log(`   ID: ${dado.id}`);
    console.log(`   Data: ${dado.data_date}`);
    console.log(`   Processado: ${dado.processed ? 'SIM' : 'NÃO'}`);
    console.log(`   Record Count: ${dado.record_count || 0}`);
    console.log(`   Criado em: ${dado.created_at}`);
    console.log();
    
    // Inspecionar o JSON
    if (dado.raw_json) {
      const json = dado.raw_json;
      
      if (json.list && Array.isArray(json.list)) {
        console.log(`   📦 JSON contém array 'list' com ${json.list.length} itens`);
        
        if (json.list.length > 0) {
          console.log(`   📝 Primeiro item:`);
          console.log(JSON.stringify(json.list[0], null, 2).split('\n').map(l => `      ${l}`).join('\n'));
        } else {
          console.log(`   ⚠️  Array 'list' está VAZIO!`);
        }
      } else if (Array.isArray(json)) {
        console.log(`   📦 JSON é um array direto com ${json.length} itens`);
        
        if (json.length > 0) {
          console.log(`   📝 Primeiro item:`);
          console.log(JSON.stringify(json[0], null, 2).split('\n').map(l => `      ${l}`).join('\n'));
        } else {
          console.log(`   ⚠️  Array está VAZIO!`);
        }
      } else {
        console.log(`   📦 Estrutura do JSON:`);
        console.log(`      Tipo: ${typeof json}`);
        console.log(`      Keys: ${Object.keys(json).join(', ')}`);
        console.log(`      Conteúdo resumido:`);
        console.log(JSON.stringify(json, null, 2).substring(0, 500).split('\n').map(l => `      ${l}`).join('\n'));
      }
    } else {
      console.log(`   ⚠️  raw_json está NULL ou vazio!`);
    }
    console.log();
  }

  console.log('='.repeat(70));
  console.log('📋 CONCLUSÃO');
  console.log('='.repeat(70));
  console.log();
  
  const todosVazios = rawData.every(d => {
    if (!d.raw_json) return true;
    if (d.raw_json.list && Array.isArray(d.raw_json.list)) return d.raw_json.list.length === 0;
    if (Array.isArray(d.raw_json)) return d.raw_json.length === 0;
    return false;
  });

  if (todosVazios) {
    console.log('❌ PROBLEMA: Todos os dados brutos estão VAZIOS!');
    console.log();
    console.log('   Isso significa que a API do ContaHub retornou arrays vazios.');
    console.log('   Possíveis causas:');
    console.log('   1. Não há vendas no ContaHub para 01/03/2026');
    console.log('   2. O evento não aconteceu ainda');
    console.log('   3. Erro na API do ContaHub (credenciais, filtros, etc)');
    console.log();
    console.log('💡 Verifique manualmente no ContaHub se há vendas para 01/03/2026');
  } else {
    console.log('✅ Há dados nos JSONs brutos!');
    console.log('   O processamento deve converter esses dados para as tabelas.');
  }
  console.log();
}

inspecionarDadosBrutos()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
