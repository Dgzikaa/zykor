/**
 * Testar processamento para AMBOS os bares (Ordinário e Deboche)
 * Data: 01/03/2026
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_EVENTO = '2026-03-01';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testarAmbosBares() {
  console.log('='.repeat(70));
  console.log('🧪 TESTE: Processamento para AMBOS os bares - 01/03/2026');
  console.log('='.repeat(70));
  console.log();

  const bares = [
    { id: 3, nome: 'Ordinário Bar', evento_id: 913 },
    { id: 4, nome: 'Deboche Bar', evento_id: 858 }
  ];

  for (const bar of bares) {
    console.log('\n' + '═'.repeat(70));
    console.log(`🍺 ${bar.nome.toUpperCase()} (bar_id=${bar.id})`);
    console.log('═'.repeat(70));

    // 1. Verificar dados brutos
    const { data: rawData } = await supabase
      .from('contahub_raw_data')
      .select('id, data_type, processed, record_count')
      .eq('bar_id', bar.id)
      .eq('data_date', DATA_EVENTO)
      .order('data_type');

    console.log('\n📦 Dados brutos:');
    if (!rawData || rawData.length === 0) {
      console.log('   ⚠️  Nenhum dado bruto encontrado');
      continue;
    }

    rawData.forEach(d => {
      console.log(`   ${d.processed ? '✅' : '⚠️ '} ${d.data_type}`);
    });

    // 2. Verificar dados processados
    console.log('\n📊 Dados processados:');
    
    const tabelas = [
      { nome: 'analitico', campo: 'trn_dtgerencial' },
      { nome: 'fatporhora', campo: 'vd_dtgerencial' },
      { nome: 'pagamentos', campo: 'dt_gerencial' },
      { nome: 'periodo', campo: 'prd_dtgerencial' },
      { nome: 'tempo', campo: 'dia' }
    ];

    const contagens = {};
    for (const { nome, campo } of tabelas) {
      try {
        let query = supabase
          .from(`contahub_${nome}`)
          .select('id', { count: 'exact', head: true })
          .eq('bar_id', bar.id);
        
        if (nome === 'tempo' || nome === 'analitico' || nome === 'fatporhora') {
          query = query.gte(campo, DATA_EVENTO).lt(campo, '2026-03-02');
        } else {
          query = query.eq(campo, DATA_EVENTO);
        }
        
        const { count } = await query;
        contagens[nome] = count || 0;
        console.log(`   ${count > 0 ? '✅' : '⚠️ '} ${nome}: ${count || 0} registros`);
      } catch (err) {
        console.log(`   ❌ ${nome}: Erro`);
        contagens[nome] = 0;
      }
    }

    // 3. Verificar evento
    const { data: evento } = await supabase
      .from('eventos_base')
      .select('id, nome, real_r, m1_r, cl_real, te_real, tb_real, t_medio, calculado_em')
      .eq('id', bar.evento_id)
      .single();

    console.log('\n📅 Evento:');
    if (!evento) {
      console.log('   ⚠️  Evento não encontrado');
    } else {
      console.log(`   Nome: ${evento.nome}`);
      console.log(`   Real R$: R$ ${(evento.real_r || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`   M-1 R$: R$ ${(evento.m1_r || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      
      if (evento.real_r > 0 && evento.m1_r > 0) {
        const variacao = ((evento.real_r / evento.m1_r - 1) * 100);
        console.log(`   Variação: ${variacao >= 0 ? '✅' : '❌'} ${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)}%`);
      }
      
      console.log(`   Clientes: ${evento.cl_real || 0}`);
      console.log(`   TE: R$ ${(evento.te_real || 0).toFixed(2)}`);
      console.log(`   TB: R$ ${(evento.tb_real || 0).toFixed(2)}`);
      console.log(`   T Médio: R$ ${(evento.t_medio || 0).toFixed(2)}`);
      console.log(`   Calculado em: ${evento.calculado_em || 'Nunca'}`);
    }

    // 4. Status geral
    console.log('\n📋 Status:');
    const todosProcessados = Object.values(contagens).every(c => c > 0);
    if (todosProcessados && evento && evento.real_r > 0) {
      console.log('   ✅ TUDO OK - Dados completos e evento calculado');
    } else if (evento && evento.real_r > 0) {
      console.log('   ⚠️  PARCIAL - Evento calculado mas faltam dados de tempo/fatporhora');
    } else {
      console.log('   ❌ PROBLEMA - Dados incompletos ou evento não calculado');
    }
  }

  // 5. Comparação final
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 COMPARAÇÃO FINAL');
  console.log('═'.repeat(70));

  const { data: eventos } = await supabase
    .from('eventos_base')
    .select('id, bar_id, nome, real_r, cl_real')
    .in('id', [913, 858]);

  console.log();
  eventos?.forEach(e => {
    const barNome = e.bar_id === 3 ? 'Ordinário' : 'Deboche';
    console.log(`${barNome}:`);
    console.log(`   Faturamento: R$ ${(e.real_r || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Clientes: ${e.cl_real || 0}`);
    console.log();
  });

  console.log('═'.repeat(70));
  console.log('✅ Teste concluído!');
  console.log('═'.repeat(70));
  console.log();
  console.log('💡 Se ambos os bares mostrarem dados OK, as alterações não quebraram nada.');
  console.log();
}

testarAmbosBares()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
