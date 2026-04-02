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

async function verificar() {
  console.log('🔍 Verificando eventos de Abril 2026 (bar_id = 4)...\n');
  
  const { data, error } = await supabase
    .from('eventos_base')
    .select('id, data_evento, nome, dia_semana, bar_id, m1_r')
    .eq('bar_id', 4)
    .gte('data_evento', '2026-04-01')
    .lte('data_evento', '2026-04-30')
    .order('data_evento');

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log(`📊 Total de eventos encontrados: ${data?.length || 0}\n`);
  
  if (data && data.length > 0) {
    console.log('Eventos por dia da semana:');
    const porDia = {};
    data.forEach(e => {
      porDia[e.dia_semana] = (porDia[e.dia_semana] || 0) + 1;
    });
    Object.entries(porDia).forEach(([dia, count]) => {
      console.log(`  ${dia}: ${count} eventos`);
    });
    
    console.log('\n📅 Primeiros 10 eventos:');
    data.slice(0, 10).forEach(e => {
      console.log(`  ${e.data_evento} (${e.dia_semana}) - ${e.nome.substring(0, 50)} - R$ ${e.m1_r.toFixed(2)}`);
    });
  } else {
    console.log('❌ Nenhum evento encontrado!');
  }
}

verificar();
