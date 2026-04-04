// Script de teste para verificar search_names do Falaê
const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

async function testDebugAPI() {
  console.log('🔍 Testando API de debug do Falaê...\n');
  
  try {
    // Teste 1: Verificar respostas do Falaê
    console.log('📊 Buscando respostas do Falaê (bar_id=4)...');
    const response1 = await fetch(`${SUPABASE_URL}/rest/v1/falae_respostas?bar_id=eq.4&select=search_name,created_at&order=created_at.desc&limit=10`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });
    
    const respostas = await response1.json();
    console.log(`✅ Encontradas ${respostas.length} respostas recentes`);
    
    if (respostas.length > 0) {
      console.log('\n📋 Últimas respostas:');
      respostas.forEach((r, i) => {
        console.log(`  ${i+1}. search_name: "${r.search_name || '(vazio)'}" - ${r.created_at}`);
      });
    }
    
    // Teste 2: Agrupar por search_name
    console.log('\n\n📊 Agrupando por search_name...');
    const response2 = await fetch(`${SUPABASE_URL}/rest/v1/falae_respostas?bar_id=eq.4&select=search_name`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });
    
    const todasRespostas = await response2.json();
    const grouped = todasRespostas.reduce((acc, r) => {
      const name = r.search_name || '(vazio)';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n📈 Contagem por search_name:');
    Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => {
        console.log(`  - "${name}": ${count} respostas`);
      });
    
    // Teste 3: Verificar tabela nps_falae_diario_pesquisa
    console.log('\n\n📊 Verificando nps_falae_diario_pesquisa...');
    const response3 = await fetch(`${SUPABASE_URL}/rest/v1/nps_falae_diario_pesquisa?bar_id=eq.4&select=search_name,data_referencia,respostas_total,nps_score&order=data_referencia.desc&limit=10`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });
    
    const npsDiario = await response3.json();
    console.log(`✅ Encontrados ${npsDiario.length} registros recentes`);
    
    if (npsDiario.length > 0) {
      console.log('\n📋 Últimos registros:');
      npsDiario.forEach((r, i) => {
        console.log(`  ${i+1}. "${r.search_name}" - ${r.data_referencia} - NPS: ${r.nps_score} (${r.respostas_total} respostas)`);
      });
    } else {
      console.log('⚠️ Nenhum registro encontrado na tabela nps_falae_diario_pesquisa!');
    }
    
    // Teste 4: Testar RPC calcular_nps_semanal_por_pesquisa
    console.log('\n\n🔧 Testando RPC calcular_nps_semanal_por_pesquisa...');
    const hoje = new Date();
    const semanaAtras = new Date(hoje);
    semanaAtras.setDate(hoje.getDate() - 7);
    
    const dataInicio = semanaAtras.toISOString().split('T')[0];
    const dataFim = hoje.toISOString().split('T')[0];
    
    console.log(`📅 Período: ${dataInicio} até ${dataFim}`);
    
    const response4 = await fetch(`${SUPABASE_URL}/rest/v1/rpc/calcular_nps_semanal_por_pesquisa`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_bar_id: 4,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim,
      })
    });
    
    const rpcResult = await response4.json();
    console.log('\n📊 Resultado da RPC:');
    if (Array.isArray(rpcResult) && rpcResult.length > 0) {
      rpcResult.forEach(r => {
        console.log(`  - "${r.search_name}": NPS ${r.nps_score} (${r.total_respostas} respostas)`);
      });
    } else {
      console.log('  ⚠️ Nenhum resultado retornado pela RPC');
    }
    
    console.log('\n\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
  }
}

testDebugAPI();
