const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uqtgsvujwcbymjmvkjhy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzQ2NTIyOSwiZXhwIjoyMDQzMDQxMjI5fQ.u9hkHZ_SRlJRdL_Ej3xBCKzRqMVJZmWqYJg7z5wq-Lw'
);

async function consultar() {
  console.log('\n🔍 CONSULTANDO DADOS DO DEBOCHE (bar_id=4)\n');
  console.log('='.repeat(80));

  // 1. Locais únicos
  console.log('\n📊 1. LOCAIS NO CONTAHUB (últimos 30 dias)');
  console.log('-'.repeat(80));
  
  const { data: locaisData, error: errorLocais } = await supabase
    .from('contahub_analitico')
    .select('loc_desc, valorfinal')
    .eq('bar_id', 4)
    .gte('trn_dtgerencial', '2026-02-01');
  
  if (errorLocais) {
    console.error('Erro ao buscar locais:', errorLocais);
  }
  console.log(`Total de registros encontrados: ${(locaisData || []).length}`);

  const locais = {};
  (locaisData || []).forEach(item => {
    const loc = item.loc_desc;
    if (!locais[loc]) locais[loc] = { count: 0, total: 0 };
    locais[loc].count++;
    locais[loc].total += item.valorfinal || 0;
  });

  const locaisOrdenados = Object.entries(locais)
    .sort((a, b) => b[1].total - a[1].total);

  locaisOrdenados.forEach(([loc, data]) => {
    console.log(`  ${loc.padEnd(25)} : R$ ${data.total.toFixed(2).padStart(12)} (${data.count} itens)`);
  });

  // 2. Eventos recentes
  console.log('\n\n📅 2. EVENTOS RECENTES');
  console.log('-'.repeat(80));
  
  const { data: eventos, error: errorEventos } = await supabase
    .from('eventos_base')
    .select('data_evento, nome, percent_b, percent_d, percent_c, percent_stockout, real_r, c_art, c_prod')
    .eq('bar_id', 4)
    .gte('data_evento', '2026-01-01')
    .order('data_evento', { ascending: false })
    .limit(10);
  
  if (errorEventos) {
    console.error('Erro ao buscar eventos:', errorEventos);
  }
  console.log(`Total de eventos encontrados: ${(eventos || []).length}`);

  (eventos || []).forEach(evt => {
    console.log(`\n  📆 ${evt.data_evento} - ${evt.nome}`);
    console.log(`     Fat: R$ ${(evt.real_r || 0).toFixed(2)} | C.Art: R$ ${(evt.c_art || 0).toFixed(2)} | C.Prod: R$ ${(evt.c_prod || 0).toFixed(2)}`);
    console.log(`     %B: ${(evt.percent_b || 0).toFixed(1)}% | %D: ${(evt.percent_d || 0).toFixed(1)}% | %C: ${(evt.percent_c || 0).toFixed(1)}% | Stockout: ${(evt.percent_stockout || 0).toFixed(1)}%`);
  });

  console.log('\n\n💡 3. MAPEAMENTO ATUAL vs SUGERIDO');
  console.log('-'.repeat(80));
  console.log('\nMAPEAMENTO ATUAL (Ordinário):');
  console.log('  Bebidas: Chopp, Baldes, PP, Bar');
  console.log('  Comidas: Cozinha, Cozinha 1, Cozinha 2');
  console.log('  Drinks: Preshh, Drinks, Drinks Autorais, Mexido, Shot e Dose, Batidos');
  
  console.log('\nMAPEAMENTO SUGERIDO (Deboche):');
  console.log('  Bebidas: Salão');
  console.log('  Comidas: Cozinha 1, Cozinha 2');
  console.log('  Drinks: Bar');
  
  console.log('\n' + '='.repeat(80) + '\n');
}

consultar().catch(console.error);
