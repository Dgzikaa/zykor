const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MzUzNzIsImV4cCI6MjA1MDMxMTM3Mn0.eXOLMVhCZmLzVQxeXWqQDtjAVZXYhBgJlQYP-Rl5Uxo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testarRecalculo() {
  console.log('🔄 Testando recálculo de desempenho para ambos os bares...\n');

  try {
    // 1. Verificar estado ANTES do recálculo
    console.log('📊 ANTES DO RECÁLCULO:');
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];
    console.log(`   Buscando semanas com data_fim >= ${dataLimiteStr}\n`);
    
    const { data: antes } = await supabase
      .from('desempenho_semanal')
      .select('id, bar_id, numero_semana, data_fim, faturamento_total, updated_at')
      .gte('data_fim', dataLimiteStr)
      .order('data_fim', { ascending: false });

    const bar3Antes = antes?.filter(s => s.bar_id === 3) || [];
    const bar4Antes = antes?.filter(s => s.bar_id === 4) || [];

    console.log(`\n🍺 Ordinário (bar_id=3): ${bar3Antes.length} semanas`);
    bar3Antes.forEach(s => {
      console.log(`  - Semana ${s.numero_semana} (${s.data_fim}): R$ ${s.faturamento_total?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Atualizado: ${s.updated_at}`);
    });

    console.log(`\n🎭 Deboche (bar_id=4): ${bar4Antes.length} semanas`);
    bar4Antes.forEach(s => {
      console.log(`  - Semana ${s.numero_semana} (${s.data_fim}): R$ ${s.faturamento_total?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Atualizado: ${s.updated_at}`);
    });

    // 2. Chamar a função de recálculo
    console.log('\n\n🚀 Chamando recalcular-desempenho-auto...');
    const response = await fetch(`${supabaseUrl}/functions/v1/recalcular-desempenho-auto`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const resultado = await response.json();
    console.log('\n✅ Resposta da função:', JSON.stringify(resultado, null, 2));

    // 3. Aguardar 2 segundos para garantir que o update foi processado
    console.log('\n⏳ Aguardando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verificar estado DEPOIS do recálculo
    console.log('\n📊 DEPOIS DO RECÁLCULO:');
    const { data: depois } = await supabase
      .from('desempenho_semanal')
      .select('id, bar_id, numero_semana, data_fim, faturamento_total, updated_at')
      .gte('data_fim', dataLimiteStr)
      .order('data_fim', { ascending: false });

    const bar3Depois = depois?.filter(s => s.bar_id === 3) || [];
    const bar4Depois = depois?.filter(s => s.bar_id === 4) || [];

    console.log(`\n🍺 Ordinário (bar_id=3): ${bar3Depois.length} semanas`);
    bar3Depois.forEach(s => {
      const semanaAntes = bar3Antes.find(a => a.id === s.id);
      const mudou = semanaAntes && semanaAntes.updated_at !== s.updated_at ? '✅ ATUALIZADO' : '';
      console.log(`  - Semana ${s.numero_semana} (${s.data_fim}): R$ ${s.faturamento_total?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Atualizado: ${s.updated_at} ${mudou}`);
    });

    console.log(`\n🎭 Deboche (bar_id=4): ${bar4Depois.length} semanas`);
    bar4Depois.forEach(s => {
      const semanaAntes = bar4Antes.find(a => a.id === s.id);
      const mudou = semanaAntes && semanaAntes.updated_at !== s.updated_at ? '✅ ATUALIZADO' : '';
      console.log(`  - Semana ${s.numero_semana} (${s.data_fim}): R$ ${s.faturamento_total?.toLocaleString('pt-BR', {minimumFractionDigits: 2})} | Atualizado: ${s.updated_at} ${mudou}`);
    });

    // 5. Resumo
    const atualizadasBar3 = bar3Depois.filter(s => {
      const antes = bar3Antes.find(a => a.id === s.id);
      return antes && antes.updated_at !== s.updated_at;
    }).length;

    const atualizadasBar4 = bar4Depois.filter(s => {
      const antes = bar4Antes.find(a => a.id === s.id);
      return antes && antes.updated_at !== s.updated_at;
    }).length;

    console.log('\n\n📈 RESUMO:');
    console.log(`  Ordinário: ${atualizadasBar3}/${bar3Depois.length} semanas atualizadas`);
    console.log(`  Deboche: ${atualizadasBar4}/${bar4Depois.length} semanas atualizadas`);
    console.log(`  Total: ${atualizadasBar3 + atualizadasBar4} semanas recalculadas`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testarRecalculo();
