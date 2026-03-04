/**
 * Verificar se o Ordinário Bar tem o mesmo problema
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ORDINARIO = 3;
const DATA_ONTEM = '2026-03-01';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verificar() {
  console.log('🔍 Verificando Ordinário Bar (bar_id=3)\n');

  // 1. Verificar dados brutos de ontem
  const { data: rawData } = await supabase
    .from('contahub_raw_data')
    .select('id, data_type, processed, created_at')
    .eq('bar_id', BAR_ORDINARIO)
    .eq('data_date', DATA_ONTEM);

  console.log('📦 Dados brutos de 01/03/2026:');
  if (!rawData || rawData.length === 0) {
    console.log('   ⚠️  Nenhum dado bruto encontrado\n');
  } else {
    rawData.forEach(d => {
      console.log(`   ${d.processed ? '✅' : '⚠️ '} ${d.data_type} (${d.created_at})`);
    });
    console.log();
  }

  // 2. Verificar dados processados
  console.log('📊 Dados processados de 01/03/2026:');
  
  const tabelas = [
    { nome: 'analitico', campo: 'trn_dtgerencial' },
    { nome: 'vendas', campo: 'vd_dtcontabil' },
    { nome: 'periodo', campo: 'prd_dtgerencial' },
    { nome: 'pagamentos', campo: 'dt_gerencial' },
    { nome: 'tempo', campo: 'dia' },
    { nome: 'fatporhora', campo: 'vd_dtgerencial' }
  ];

  for (const { nome, campo } of tabelas) {
    try {
      let query = supabase
        .from(`contahub_${nome}`)
        .select('id', { count: 'exact', head: true })
        .eq('bar_id', BAR_ORDINARIO);
      
      if (nome === 'tempo' || nome === 'analitico') {
        query = query.gte(campo, DATA_ONTEM).lt(campo, '2026-03-02');
      } else {
        query = query.eq(campo, DATA_ONTEM);
      }
      
      const { count } = await query;
      console.log(`   ${count > 0 ? '✅' : '⚠️ '} ${nome}: ${count || 0} registros`);
    } catch (err) {
      console.log(`   ❌ ${nome}: Erro`);
    }
  }
  console.log();

  // 3. Verificar logs de sync
  const { data: logs } = await supabase
    .from('sync_logs_contahub')
    .select('data_sync, status, total_registros, triggered_by, inicio_execucao')
    .eq('bar_id', BAR_ORDINARIO)
    .eq('data_sync', DATA_ONTEM)
    .order('inicio_execucao', { ascending: false })
    .limit(3);

  console.log('📋 Logs de sincronização:');
  if (!logs || logs.length === 0) {
    console.log('   ⚠️  Nenhum log encontrado\n');
  } else {
    logs.forEach(log => {
      console.log(`   ${log.status === 'sucesso' ? '✅' : '⚠️ '} ${log.inicio_execucao}: ${log.status} (${log.total_registros || 0} registros)`);
    });
    console.log();
  }

  // 4. Verificar evento de ontem
  const { data: evento } = await supabase
    .from('eventos_base')
    .select('id, nome, real_r, cl_real, calculado_em')
    .eq('bar_id', BAR_ORDINARIO)
    .eq('data_evento', DATA_ONTEM)
    .single();

  console.log('📅 Evento de 01/03/2026:');
  if (!evento) {
    console.log('   ⚠️  Nenhum evento encontrado\n');
  } else {
    console.log(`   ID: ${evento.id}`);
    console.log(`   Nome: ${evento.nome}`);
    console.log(`   Real R$: R$ ${(evento.real_r || 0).toFixed(2)}`);
    console.log(`   Clientes: ${evento.cl_real || 0}`);
    console.log(`   Calculado: ${evento.calculado_em || 'Nunca'}\n`);
  }

  // 5. CONCLUSÃO
  console.log('='.repeat(60));
  console.log('📋 CONCLUSÃO');
  console.log('='.repeat(60));
  
  const temDadosBrutos = rawData && rawData.length > 0;
  const temDadosProcessados = tabelas.some(async ({ nome, campo }) => {
    const { count } = await supabase
      .from(`contahub_${nome}`)
      .select('id', { count: 'exact', head: true })
      .eq('bar_id', BAR_ORDINARIO)
      .eq(campo, DATA_ONTEM);
    return count > 0;
  });

  if (!temDadosBrutos) {
    console.log('❌ Ordinário: COLETA NÃO RODOU para 01/03/2026');
    console.log('   O problema afeta AMBOS os bares!\n');
  } else {
    const pendentes = rawData.filter(d => !d.processed);
    if (pendentes.length > 0) {
      console.log('⚠️  Ordinário: Coleta OK, mas PROCESSAMENTO PENDENTE');
      console.log(`   ${pendentes.length} tipos de dados não processados:`);
      pendentes.forEach(d => console.log(`      - ${d.data_type}`));
      console.log('\n   O problema de "semana" afeta AMBOS os bares!\n');
    } else {
      console.log('✅ Ordinário: Coleta e processamento OK!');
      console.log('   O problema é específico do Deboche.\n');
    }
  }
}

verificar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
