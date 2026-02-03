// Teste para simular filtro do Edge Function
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNTI4ODQ5NCwiZXhwIjoyMDQwODY0NDk0fQ.OvZ8FKwf6PlGqxQKhq5QzYMjzBLCkFDtKIb3mAl6F1g';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAtrasos() {
  console.log('🔍 Buscando dados contahub_tempo semana 05/2026...\n');
  
  const { data, error } = await supabase
    .from('contahub_tempo')
    .select('categoria, loc_desc, t0_t2, t0_t3, t1_t2, itm_qtd')
    .eq('bar_id', 3)
    .gte('data', '2026-01-26')
    .lte('data', '2026-02-01')
    .not('t0_t3', 'is', null);
  
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  console.log(`📊 Total de registros: ${data.length}\n`);
  
  // Filtro EXATO do Edge Function
  const locaisDrinks = ['Batidos', 'Montados', 'Mexido', 'Preshh', 'Drinks', 'Drinks Autorais', 'Shot e Dose'];
  const tempoDrinks = data.filter(item => 
    locaisDrinks.some(l => item.loc_desc?.includes(l))
  );
  
  console.log(`🍹 Registros de Drinks Preparados: ${tempoDrinks.length}`);
  console.log(`   Locais: ${[...new Set(tempoDrinks.map(i => i.loc_desc))].join(', ')}\n`);
  
  // Atrasos > 10 min
  const atrasosDrinks = tempoDrinks.filter(item => (parseFloat(item.t0_t3) || 0) > 600);
  console.log(`⏱️  Atrasos > 10 min: ${atrasosDrinks.length}`);
  console.log(`   Percentual: ${((atrasosDrinks.length / tempoDrinks.length) * 100).toFixed(2)}%\n`);
  
  // Distribuição por loc_desc
  const distribuicao = {};
  tempoDrinks.forEach(item => {
    if (!distribuicao[item.loc_desc]) {
      distribuicao[item.loc_desc] = { total: 0, atrasos: 0 };
    }
    distribuicao[item.loc_desc].total++;
    if ((parseFloat(item.t0_t3) || 0) > 600) {
      distribuicao[item.loc_desc].atrasos++;
    }
  });
  
  console.log('📋 Distribuição por local:');
  Object.entries(distribuicao).forEach(([loc, stats]) => {
    console.log(`   ${loc}: ${stats.total} drinks, ${stats.atrasos} atrasos`);
  });
}

testAtrasos();
