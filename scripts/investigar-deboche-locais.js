/**
 * Script para investigar os locais (loc_desc) do Deboche no ContaHub
 * 
 * Objetivo: Verificar quais são os valores únicos de loc_desc para o bar_id=4
 * e como devem ser mapeados para as categorias Bebidas, Drinks e Comidas
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

console.log('🔧 Configuração:');
console.log('  SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Definida' : '❌ Não definida');
console.log('  SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Definida' : '❌ Não definida');
console.log('');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigarLocaisDeboche() {
  console.log('🔍 INVESTIGANDO LOCAIS DO DEBOCHE (bar_id=4)\n');
  console.log('='.repeat(80));

  // 1. Buscar todos os loc_desc únicos do Deboche
  console.log('\n📊 1. LOCAIS ÚNICOS NO CONTAHUB_ANALITICO');
  console.log('-'.repeat(80));
  
  const { data: locais, error: errorLocais } = await supabase
    .from('contahub_analitico')
    .select('loc_desc')
    .eq('bar_id', 4)
    .not('loc_desc', 'is', null);

  if (errorLocais) {
    console.error('❌ Erro ao buscar locais:', errorLocais);
    return;
  }

  // Contar ocorrências de cada local
  const contagemLocais = {};
  locais.forEach(item => {
    const loc = item.loc_desc;
    contagemLocais[loc] = (contagemLocais[loc] || 0) + 1;
  });

  // Ordenar por quantidade (mais usado primeiro)
  const locaisOrdenados = Object.entries(contagemLocais)
    .sort((a, b) => b[1] - a[1]);

  console.log('\nLocais encontrados (ordenados por frequência):');
  locaisOrdenados.forEach(([loc, count]) => {
    console.log(`  - ${loc.padEnd(30)} : ${count.toLocaleString('pt-BR')} registros`);
  });

  // 2. Buscar faturamento por local em uma data recente
  console.log('\n\n💰 2. FATURAMENTO POR LOCAL (ÚLTIMOS 7 DIAS)');
  console.log('-'.repeat(80));

  const dataRecente = new Date();
  dataRecente.setDate(dataRecente.getDate() - 7);
  const dataStr = dataRecente.toISOString().split('T')[0];

  const { data: faturamento, error: errorFat } = await supabase
    .from('contahub_analitico')
    .select('loc_desc, valorfinal, trn_dtgerencial')
    .eq('bar_id', 4)
    .gte('trn_dtgerencial', dataStr)
    .not('loc_desc', 'is', null);

  if (errorFat) {
    console.error('❌ Erro ao buscar faturamento:', errorFat);
    return;
  }

  // Agrupar por local
  const faturamentoPorLocal = {};
  faturamento.forEach(item => {
    const loc = item.loc_desc;
    if (!faturamentoPorLocal[loc]) {
      faturamentoPorLocal[loc] = { total: 0, count: 0 };
    }
    faturamentoPorLocal[loc].total += item.valorfinal || 0;
    faturamentoPorLocal[loc].count += 1;
  });

  // Ordenar por faturamento
  const fatOrdenado = Object.entries(faturamentoPorLocal)
    .sort((a, b) => b[1].total - a[1].total);

  console.log('\nFaturamento por local (últimos 7 dias):');
  fatOrdenado.forEach(([loc, data]) => {
    const percentual = (data.total / faturamento.reduce((sum, i) => sum + (i.valorfinal || 0), 0)) * 100;
    console.log(`  - ${loc.padEnd(30)} : R$ ${data.total.toFixed(2).padStart(12)} (${percentual.toFixed(1)}%) - ${data.count} itens`);
  });

  // 3. Comparar com mapeamento atual do Ordinário
  console.log('\n\n🔄 3. COMPARAÇÃO COM MAPEAMENTO ATUAL');
  console.log('-'.repeat(80));

  const mapeamentoOrdinario = {
    'Bebidas': ['Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar'],
    'Comidas': ['Cozinha', 'Cozinha 1', 'Cozinha 2'],
    'Drinks': ['Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos']
  };

  console.log('\nMapeamento ATUAL (Ordinário):');
  Object.entries(mapeamentoOrdinario).forEach(([categoria, locais]) => {
    console.log(`\n  ${categoria}:`);
    locais.forEach(loc => console.log(`    - ${loc}`));
  });

  // 4. Sugerir mapeamento para Deboche
  console.log('\n\n💡 4. MAPEAMENTO SUGERIDO PARA DEBOCHE');
  console.log('-'.repeat(80));

  console.log('\nBaseado no que o usuário informou:');
  console.log('  - Bar = Drinks (não Bebidas!)');
  console.log('  - Salão = Bebidas');
  console.log('  - Cozinha 1/2 = Comida');

  const mapeamentoDeboche = {
    'Bebidas': ['Salão'],
    'Comidas': ['Cozinha 1', 'Cozinha 2'],
    'Drinks': ['Bar']
  };

  console.log('\nMapeamento PROPOSTO (Deboche):');
  Object.entries(mapeamentoDeboche).forEach(([categoria, locais]) => {
    console.log(`\n  ${categoria}:`);
    locais.forEach(loc => console.log(`    - ${loc}`));
  });

  // 5. Verificar se há locais não mapeados
  console.log('\n\n⚠️  5. LOCAIS NÃO MAPEADOS');
  console.log('-'.repeat(80));

  const todosLocaisMapeados = [
    ...mapeamentoDeboche.Bebidas,
    ...mapeamentoDeboche.Comidas,
    ...mapeamentoDeboche.Drinks
  ];

  const locaisNaoMapeados = locaisOrdenados
    .map(([loc]) => loc)
    .filter(loc => !todosLocaisMapeados.includes(loc));

  if (locaisNaoMapeados.length > 0) {
    console.log('\nLocais que NÃO estão no mapeamento proposto:');
    locaisNaoMapeados.forEach(loc => {
      const count = contagemLocais[loc];
      const fat = faturamentoPorLocal[loc]?.total || 0;
      console.log(`  - ${loc.padEnd(30)} : ${count.toLocaleString('pt-BR')} registros, R$ ${fat.toFixed(2)}`);
    });
  } else {
    console.log('\n✅ Todos os locais estão mapeados!');
  }

  // 6. Verificar eventos recentes do Deboche
  console.log('\n\n📅 6. EVENTOS RECENTES DO DEBOCHE');
  console.log('-'.repeat(80));

  const { data: eventos, error: errorEventos } = await supabase
    .from('eventos_base')
    .select('id, data_evento, nome, percent_b, percent_d, percent_c, percent_stockout, real_r')
    .eq('bar_id', 4)
    .gte('data_evento', dataStr)
    .order('data_evento', { ascending: false })
    .limit(5);

  if (errorEventos) {
    console.error('❌ Erro ao buscar eventos:', errorEventos);
    return;
  }

  console.log('\nÚltimos 5 eventos:');
  eventos.forEach(evt => {
    console.log(`\n  📆 ${evt.data_evento} - ${evt.nome}`);
    console.log(`     Faturamento: R$ ${(evt.real_r || 0).toFixed(2)}`);
    console.log(`     %Bebidas: ${(evt.percent_b || 0).toFixed(1)}%`);
    console.log(`     %Drinks: ${(evt.percent_d || 0).toFixed(1)}%`);
    console.log(`     %Comidas: ${(evt.percent_c || 0).toFixed(1)}%`);
    console.log(`     %Stockout: ${(evt.percent_stockout || 0).toFixed(1)}%`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ INVESTIGAÇÃO CONCLUÍDA!\n');
}

investigarLocaisDeboche().catch(console.error);
