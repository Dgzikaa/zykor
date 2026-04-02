const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

let supabaseUrl, supabaseKey;
for (const line of lines) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function atualizarConfig() {
  console.log('🔧 Atualizando configuração do bar 4 (Ordinário)...\n');
  
  // Atualizar para operar em todos os dias da semana
  const { data, error } = await supabase
    .from('bares_config')
    .update({
      opera_segunda: true,
      opera_terca: true,
      opera_quarta: true,
      opera_quinta: true,
      opera_sexta: true,
      opera_sabado: true,
      opera_domingo: true
    })
    .eq('bar_id', 4)
    .select();

  if (error) {
    console.error('❌ Erro ao atualizar:', error);
    return;
  }

  console.log('✅ Configuração atualizada com sucesso!');
  console.log('   O bar agora opera todos os dias da semana.\n');
  console.log('📊 Nova configuração:');
  console.log(JSON.stringify(data[0], null, 2));
}

atualizarConfig();
