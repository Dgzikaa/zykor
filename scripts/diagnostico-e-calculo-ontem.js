/**
 * Script FINAL para diagnosticar e calcular evento de 01/03/2026 (Deboche Bar)
 * Com nomes corretos de colunas do banco
 */

require('dotenv').config({ path: '../frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BAR_ID = 4; // Deboche Bar
const DATA_EVENTO = '2026-03-01'; // Ontem
const EVENTO_ID = 858;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnosticarECalcular() {
  console.log('='.repeat(70));
  console.log('🔍 DIAGNÓSTICO: Planejamento Comercial - Deboche Bar');
  console.log('='.repeat(70));
  console.log(`   Data do evento: 01/03/2026 (SÁBADO)`);
  console.log(`   Evento ID: ${EVENTO_ID}`);
  console.log(`   Bar ID: ${BAR_ID}`);
  console.log();

  // 1. Status do evento
  console.log('📋 1. STATUS DO EVENTO');
  console.log('-'.repeat(70));
  const { data: evento, error: eventoError } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('id', EVENTO_ID)
    .single();

  if (eventoError || !evento) {
    console.error('❌ Erro ao buscar evento:', eventoError?.message || 'Evento não encontrado');
    process.exit(1);
  }

  console.log(`   Nome: ${evento.nome}`);
  console.log(`   Data: ${evento.data_evento}`);
  console.log(`   Dia da semana: ${evento.dia_semana}`);
  console.log(`   Real R$: R$ ${(evento.real_r || 0).toFixed(2)}`);
  console.log(`   M-1 R$: R$ ${(evento.m1_r || 0).toFixed(2)}`);
  console.log(`   Clientes Real: ${evento.cl_real || 0}`);
  console.log(`   Clientes Plan: ${evento.cl_plan || 0}`);
  console.log(`   Precisa recálculo: ${evento.precisa_recalculo ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`   Versão cálculo: ${evento.versao_calculo}`);
  console.log(`   Calculado em: ${evento.calculado_em || 'Nunca'}`);
  console.log();

  // 2. ContaHub Vendas
  console.log('📊 2. CONTAHUB (Vendas)');
  console.log('-'.repeat(70));
  const { data: vendas, error: vendasError } = await supabase
    .from('contahub_vendas')
    .select('id, vr_produtos, vr_couvert, vr_pagamentos, dt_contabil, dt_gerencial')
    .eq('bar_id', BAR_ID)
    .eq('dt_contabil', DATA_EVENTO);

  if (vendasError) {
    console.log(`   ❌ Erro: ${vendasError.message}`);
  } else if (!vendas || vendas.length === 0) {
    console.log('   ⚠️  Nenhuma venda encontrada');
    console.log('   💡 O evento pode não ter acontecido ainda ou dados não foram sincronizados');
  } else {
    const totalProdutos = vendas.reduce((s, v) => s + (v.vr_produtos || 0), 0);
    const totalCouvert = vendas.reduce((s, v) => s + (v.vr_couvert || 0), 0);
    const totalPagamentos = vendas.reduce((s, v) => s + (v.vr_pagamentos || 0), 0);
    console.log(`   ✅ ${vendas.length} vendas encontradas`);
    console.log(`   💰 Produtos: R$ ${totalProdutos.toFixed(2)}`);
    console.log(`   💰 Couvert: R$ ${totalCouvert.toFixed(2)}`);
    console.log(`   💰 Total Pagamentos: R$ ${totalPagamentos.toFixed(2)}`);
  }
  console.log();

  // 3. Sympla
  console.log('🎫 3. SYMPLA (Ingressos)');
  console.log('-'.repeat(70));
  const { data: symplaPedidos, error: symplaError } = await supabase
    .from('sympla_pedidos')
    .select('id, valor_liquido')
    .eq('evento_id', EVENTO_ID);

  if (symplaError) {
    console.log(`   ❌ Erro: ${symplaError.message}`);
  } else if (!symplaPedidos || symplaPedidos.length === 0) {
    console.log('   ⚠️  Nenhum pedido Sympla vinculado');
  } else {
    const totalSympla = symplaPedidos.reduce((s, p) => s + (p.valor_liquido || 0), 0);
    console.log(`   ✅ ${symplaPedidos.length} pedidos encontrados`);
    console.log(`   💰 Total líquido: R$ ${totalSympla.toFixed(2)}`);
  }
  console.log();

  // 4. NIBO (Custos)
  console.log('💸 4. NIBO (Custos Artísticos)');
  console.log('-'.repeat(70));
  const { data: nibo, error: niboError } = await supabase
    .from('nibo_agendamentos')
    .select('id, tipo, valor, descricao, categoria_nome, data_vencimento, data_pagamento')
    .eq('bar_id', BAR_ID)
    .or(`data_vencimento.eq.${DATA_EVENTO},data_pagamento.eq.${DATA_EVENTO}`)
    .ilike('categoria_nome', '%atra%');

  if (niboError) {
    console.log(`   ❌ Erro: ${niboError.message}`);
  } else if (!nibo || nibo.length === 0) {
    console.log('   ⚠️  Nenhum custo artístico encontrado');
  } else {
    const totalCustos = nibo.reduce((s, n) => s + (n.valor || 0), 0);
    console.log(`   ✅ ${nibo.length} custos encontrados`);
    console.log(`   💰 Total: R$ ${totalCustos.toFixed(2)}`);
    nibo.forEach(n => {
      console.log(`      - ${n.descricao}: R$ ${n.valor.toFixed(2)}`);
    });
  }
  console.log();

  // 5. Diagnóstico
  console.log('='.repeat(70));
  console.log('📋 DIAGNÓSTICO');
  console.log('='.repeat(70));

  const temVendas = vendas && vendas.length > 0;
  const temSympla = symplaPedidos && symplaPedidos.length > 0;
  const temDados = temVendas || temSympla;

  if (!temDados) {
    console.log('❌ PROBLEMA IDENTIFICADO:');
    console.log();
    console.log('   Não há dados de faturamento para 01/03/2026');
    console.log();
    console.log('🔍 POSSÍVEIS CAUSAS:');
    console.log('   1. O evento ainda NÃO aconteceu (01/03/2026 é SÁBADO)');
    console.log('   2. O evento aconteceu mas dados do ContaHub não foram sincronizados');
    console.log('   3. Não houve vendas de ingressos via Sympla');
    console.log();
    console.log('💡 AÇÕES RECOMENDADAS:');
    console.log('   a) Confirmar se o evento JÁ aconteceu');
    console.log('   b) Se sim, sincronizar dados do ContaHub');
    console.log('   c) Se sim, verificar integração Sympla');
    console.log();
    console.log('⚠️  O cálculo NÃO será executado pois não há dados para processar.');
    console.log();
    return;
  }

  // 6. Executar cálculo
  console.log('✅ DADOS DISPONÍVEIS PARA CÁLCULO!');
  console.log();
  console.log('Fontes de dados encontradas:');
  if (temVendas) {
    const total = vendas.reduce((s, v) => s + (v.vr_pagamentos || 0), 0);
    console.log(`   ✅ ContaHub: R$ ${total.toFixed(2)}`);
  }
  if (temSympla) {
    const total = symplaPedidos.reduce((s, p) => s + (p.valor_liquido || 0), 0);
    console.log(`   ✅ Sympla: R$ ${total.toFixed(2)}`);
  }
  console.log();
  console.log('🚀 Executando cálculo manual agora...');
  console.log();

  const { data: resultado, error: calcError } = await supabase.rpc('calculate_evento_metrics', {
    evento_id: EVENTO_ID,
  });

  if (calcError) {
    console.error('❌ ERRO ao calcular métricas:', calcError.message);
    process.exit(1);
  }

  console.log('✅ Cálculo executado com sucesso!');
  console.log();

  // 7. Buscar dados atualizados
  const { data: eventoAtualizado, error: fetchError2 } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('id', EVENTO_ID)
    .single();

  if (fetchError2) {
    console.error('❌ Erro ao buscar dados atualizados:', fetchError2.message);
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('📊 RESULTADO DO CÁLCULO');
  console.log('='.repeat(70));
  console.log(`   Real R$: R$ ${(eventoAtualizado.real_r || 0).toFixed(2)}`);
  console.log(`   M-1 R$: R$ ${(eventoAtualizado.m1_r || 0).toFixed(2)}`);
  console.log(`   Variação: ${eventoAtualizado.real_r >= eventoAtualizado.m1_r ? '✅' : '❌'} ${((eventoAtualizado.real_r / eventoAtualizado.m1_r - 1) * 100).toFixed(1)}%`);
  console.log();
  console.log(`   Clientes Real: ${eventoAtualizado.cl_real || 0}`);
  console.log(`   Clientes Plan: ${eventoAtualizado.cl_plan || 0}`);
  console.log();
  console.log(`   TE Real: R$ ${(eventoAtualizado.te_real || 0).toFixed(2)}`);
  console.log(`   TB Real: R$ ${(eventoAtualizado.tb_real || 0).toFixed(2)}`);
  console.log(`   T Médio: R$ ${(eventoAtualizado.t_medio || 0).toFixed(2)}`);
  console.log();
  console.log(`   C. Artístico: R$ ${(eventoAtualizado.c_art || 0).toFixed(2)}`);
  console.log(`   % Art/Fat: ${(eventoAtualizado.percent_art_fat || 0).toFixed(1)}%`);
  console.log();
  console.log(`   Precisa recálculo: ${eventoAtualizado.precisa_recalculo ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`   Calculado em: ${eventoAtualizado.calculado_em}`);
  console.log();
  console.log('='.repeat(70));
  console.log('✅ PROCESSO CONCLUÍDO COM SUCESSO!');
  console.log('='.repeat(70));
  console.log();
  console.log('💡 O planejamento comercial agora deve exibir os dados atualizados.');
  console.log('   Acesse: https://zykor.com.br/estrategico/planejamento-comercial');
  console.log();
}

// Executar
diagnosticarECalcular()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
