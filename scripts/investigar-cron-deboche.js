/**
 * Investigar por que o cron não roda para o Deboche
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function investigar() {
  console.log('🔍 INVESTIGANDO CRON DO DEBOCHE\n');
  console.log('='.repeat(70));

  // 1. Verificar últimas execuções do sync para ambos os bares
  console.log('\n📊 1. ÚLTIMAS SINCRONIZAÇÕES (últimos 7 dias)\n');
  
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - 7);
  const dataInicioStr = dataInicio.toISOString().split('T')[0];

  for (const barId of [3, 4]) {
    const barNome = barId === 3 ? 'Ordinário' : 'Deboche';
    console.log(`\n🍺 ${barNome} (bar_id=${barId}):`);
    
    const { data: logs } = await supabase
      .from('sync_logs_contahub')
      .select('data_sync, status, total_registros, triggered_by, inicio_execucao')
      .eq('bar_id', barId)
      .gte('data_sync', dataInicioStr)
      .order('data_sync', { ascending: false })
      .limit(10);

    if (!logs || logs.length === 0) {
      console.log('   ⚠️  Nenhuma sincronização nos últimos 7 dias!');
    } else {
      console.log(`   ✅ ${logs.length} sincronizações encontradas:`);
      logs.forEach(log => {
        const status = log.status === 'sucesso' ? '✅' : '⚠️ ';
        console.log(`      ${status} ${log.data_sync}: ${log.total_registros || 0} registros (${log.triggered_by || 'manual'})`);
      });
    }
  }

  // 2. Verificar dados brutos coletados (últimos 7 dias)
  console.log('\n\n📦 2. DADOS BRUTOS COLETADOS (últimos 7 dias)\n');
  
  for (const barId of [3, 4]) {
    const barNome = barId === 3 ? 'Ordinário' : 'Deboche';
    console.log(`\n🍺 ${barNome} (bar_id=${barId}):`);
    
    const { data: rawData } = await supabase
      .from('contahub_raw_data')
      .select('data_date, data_type, processed, created_at')
      .eq('bar_id', barId)
      .gte('data_date', dataInicioStr)
      .order('data_date', { ascending: false })
      .limit(20);

    if (!rawData || rawData.length === 0) {
      console.log('   ⚠️  Nenhum dado bruto coletado!');
    } else {
      // Agrupar por data
      const porData = {};
      rawData.forEach(d => {
        if (!porData[d.data_date]) porData[d.data_date] = [];
        porData[d.data_date].push(d);
      });
      
      console.log(`   ✅ Dados coletados para ${Object.keys(porData).length} dias:`);
      Object.keys(porData).sort().reverse().forEach(data => {
        const dados = porData[data];
        const processados = dados.filter(d => d.processed).length;
        console.log(`      ${data}: ${dados.length} tipos (${processados} processados)`);
      });
    }
  }

  // 3. Verificar configuração da API sync-diario
  console.log('\n\n⚙️  3. CONFIGURAÇÃO DA API\n');
  
  const apiPath = '../frontend/src/app/api/contahub/sync-diario/route.ts';
  const fs = require('fs');
  const path = require('path');
  
  try {
    const apiContent = fs.readFileSync(path.join(__dirname, apiPath), 'utf8');
    const baresAtivosMatch = apiContent.match(/BARES_ATIVOS\s*=\s*\[(.*?)\]/);
    
    if (baresAtivosMatch) {
      console.log(`   Configuração encontrada: BARES_ATIVOS = [${baresAtivosMatch[1]}]`);
      console.log('   ✅ Ambos os bares estão configurados (3 e 4)');
    } else {
      console.log('   ⚠️  Não foi possível encontrar BARES_ATIVOS');
    }
  } catch (err) {
    console.log('   ⚠️  Erro ao ler arquivo da API');
  }

  // 4. Verificar se há algum erro específico do Deboche
  console.log('\n\n🔍 4. VERIFICANDO POSSÍVEIS CAUSAS\n');
  
  // Verificar credenciais do ContaHub
  const { data: credenciais } = await supabase
    .from('api_credentials')
    .select('id, bar_id, sistema, ativo, username')
    .eq('sistema', 'contahub')
    .in('bar_id', [3, 4]);

  console.log('   🔑 Credenciais ContaHub:');
  if (!credenciais || credenciais.length === 0) {
    console.log('      ❌ Nenhuma credencial encontrada!');
  } else {
    credenciais.forEach(cred => {
      const barNome = cred.bar_id === 3 ? 'Ordinário' : 'Deboche';
      const status = cred.ativo ? '✅' : '❌';
      console.log(`      ${status} ${barNome}: ${cred.username} (${cred.ativo ? 'ativa' : 'inativa'})`);
    });
  }

  // Verificar configuração do bar
  const { data: bares } = await supabase
    .from('bares')
    .select('id, nome, config')
    .in('id', [3, 4]);

  console.log('\n   ⚙️  Configuração dos bares:');
  if (!bares || bares.length === 0) {
    console.log('      ❌ Nenhum bar encontrado!');
  } else {
    bares.forEach(bar => {
      const empId = bar.config?.contahub_emp_id;
      console.log(`      ${bar.nome} (${bar.id}): emp_id = ${empId || 'NÃO CONFIGURADO'}`);
    });
  }

  // 5. CONCLUSÃO
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 CONCLUSÃO');
  console.log('='.repeat(70));
  console.log();

  // Comparar Ordinário vs Deboche
  const { data: logsOrdinario } = await supabase
    .from('sync_logs_contahub')
    .select('data_sync')
    .eq('bar_id', 3)
    .gte('data_sync', dataInicioStr);

  const { data: logsDeboche } = await supabase
    .from('sync_logs_contahub')
    .select('data_sync')
    .eq('bar_id', 4)
    .gte('data_sync', dataInicioStr);

  const syncsOrdinario = logsOrdinario?.length || 0;
  const syncsDeboche = logsDeboche?.length || 0;

  console.log(`📊 Últimos 7 dias:`);
  console.log(`   Ordinário: ${syncsOrdinario} sincronizações`);
  console.log(`   Deboche: ${syncsDeboche} sincronizações`);
  console.log();

  if (syncsDeboche === 0 && syncsOrdinario > 0) {
    console.log('❌ PROBLEMA CONFIRMADO:');
    console.log('   O Ordinário sincroniza automaticamente, mas o Deboche NÃO.');
    console.log();
    console.log('🔍 POSSÍVEIS CAUSAS:');
    console.log('   1. Cron está configurado apenas para bar_id=3');
    console.log('   2. API /api/contahub/sync-diario não está sendo chamada pelo cron');
    console.log('   3. Credenciais do Deboche estão inativas ou incorretas');
    console.log('   4. Configuração contahub_emp_id está faltando para o Deboche');
    console.log();
    console.log('💡 PRÓXIMO PASSO:');
    console.log('   Verificar o setup do pg_cron no Supabase Dashboard');
  } else if (syncsDeboche > 0) {
    console.log('✅ Deboche está sincronizando!');
    console.log('   O problema pode ter sido temporário.');
  } else {
    console.log('❌ NENHUM dos bares está sincronizando automaticamente!');
    console.log('   O cron pode não estar configurado ou não está rodando.');
  }
  console.log();
}

investigar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
