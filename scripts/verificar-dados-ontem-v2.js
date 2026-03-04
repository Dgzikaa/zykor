/**
 * Script para verificar se existem dados de faturamento para 01/03/2026
 * no ContaHub, Sympla e Yuzer (versão corrigida com nomes de colunas corretos)
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

async function verificarDados() {
  console.log('🔍 Verificando dados de faturamento para 01/03/2026 (Deboche Bar)...\n');
  console.log(`   Evento ID: ${EVENTO_ID}`);
  console.log(`   Bar ID: ${BAR_ID}`);
  console.log(`   Data: ${DATA_EVENTO}`);
  console.log();

  // 1. Verificar ContaHub Vendas
  console.log('📊 ContaHub (vendas):');
  const { data: vendas, error: vendasError } = await supabase
    .from('contahub_vendas')
    .select('id, valor_total, data_venda, hora_venda')
    .eq('bar_id', BAR_ID)
    .eq('data_venda', DATA_EVENTO)
    .order('hora_venda', { ascending: true });

  if (vendasError) {
    console.log('   ❌ Erro ao buscar vendas:', vendasError.message);
  } else if (!vendas || vendas.length === 0) {
    console.log('   ⚠️  Nenhuma venda encontrada para 01/03/2026');
  } else {
    const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_total || 0), 0);
    console.log(`   ✅ ${vendas.length} vendas encontradas`);
    console.log(`   💰 Total: R$ ${totalVendas.toFixed(2)}`);
    console.log(`   Primeira venda: ${vendas[0].hora_venda}`);
    console.log(`   Última venda: ${vendas[vendas.length - 1].hora_venda}`);
  }
  console.log();

  // 2. Verificar Sympla Pedidos
  console.log('🎫 Sympla (pedidos):');
  const { data: symplaPedidos, error: symplaError } = await supabase
    .from('sympla_pedidos')
    .select('id, evento_sympla_id, valor_liquido, data_compra')
    .eq('evento_id', EVENTO_ID);

  if (symplaError) {
    console.log('   ❌ Erro ao buscar pedidos Sympla:', symplaError.message);
  } else if (!symplaPedidos || symplaPedidos.length === 0) {
    console.log('   ⚠️  Nenhum pedido Sympla vinculado ao evento 858');
  } else {
    const totalSympla = symplaPedidos.reduce((sum, s) => sum + (s.valor_liquido || 0), 0);
    console.log(`   ✅ ${symplaPedidos.length} pedidos Sympla vinculados`);
    console.log(`   💰 Total líquido: R$ ${totalSympla.toFixed(2)}`);
  }
  console.log();

  // 3. Verificar Sympla Participantes (check-ins)
  console.log('👥 Sympla (participantes/check-ins):');
  const { data: symplaParticipantes, error: symplaPartError } = await supabase
    .from('sympla_participantes')
    .select('id, nome, data_checkin')
    .eq('evento_id', EVENTO_ID)
    .not('data_checkin', 'is', null);

  if (symplaPartError) {
    console.log('   ❌ Erro ao buscar participantes Sympla:', symplaPartError.message);
  } else if (!symplaParticipantes || symplaParticipantes.length === 0) {
    console.log('   ⚠️  Nenhum check-in Sympla registrado para o evento 858');
  } else {
    console.log(`   ✅ ${symplaParticipantes.length} check-ins registrados`);
  }
  console.log();

  // 4. Verificar Yuzer Pedidos
  console.log('🎟️  Yuzer (pedidos):');
  const { data: yuzerPedidos, error: yuzerError } = await supabase
    .from('yuzer_pedidos')
    .select('id, evento_yuzer_id, valor_liquido, data_compra')
    .eq('evento_id', EVENTO_ID);

  if (yuzerError) {
    console.log('   ❌ Erro ao buscar pedidos Yuzer:', yuzerError.message);
  } else if (!yuzerPedidos || yuzerPedidos.length === 0) {
    console.log('   ⚠️  Nenhum pedido Yuzer vinculado ao evento 858');
  } else {
    const totalYuzer = yuzerPedidos.reduce((sum, y) => sum + (y.valor_liquido || 0), 0);
    console.log(`   ✅ ${yuzerPedidos.length} pedidos Yuzer vinculados`);
    console.log(`   💰 Total líquido: R$ ${totalYuzer.toFixed(2)}`);
  }
  console.log();

  // 5. Verificar NIBO (custos)
  console.log('💸 NIBO (custos artísticos):');
  const { data: nibo, error: niboError } = await supabase
    .from('nibo_agendamentos')
    .select('id, tipo, valor, descricao, categoria_nome, data_vencimento, data_pagamento')
    .eq('bar_id', BAR_ID)
    .or(`data_vencimento.eq.${DATA_EVENTO},data_pagamento.eq.${DATA_EVENTO}`)
    .ilike('categoria_nome', '%atra%');

  if (niboError) {
    console.log('   ❌ Erro ao buscar dados NIBO:', niboError.message);
  } else if (!nibo || nibo.length === 0) {
    console.log('   ⚠️  Nenhum custo artístico encontrado para 01/03/2026');
  } else {
    const totalCustos = nibo.reduce((sum, n) => sum + (n.valor || 0), 0);
    console.log(`   ✅ ${nibo.length} custos encontrados`);
    console.log(`   💰 Total: R$ ${totalCustos.toFixed(2)}`);
    nibo.forEach(n => {
      console.log(`      - ${n.descricao} (${n.categoria_nome}): R$ ${n.valor}`);
    });
  }
  console.log();

  // 6. Verificar evento_base atual
  console.log('📋 Status do evento na base:');
  const { data: evento, error: eventoError } = await supabase
    .from('eventos_base')
    .select('id, nome, data_evento, real_r, m1_r, cl_real, precisa_recalculo, calculado_em')
    .eq('id', EVENTO_ID)
    .single();

  if (eventoError) {
    console.log('   ❌ Erro ao buscar evento:', eventoError.message);
  } else {
    console.log(`   ID: ${evento.id}`);
    console.log(`   Nome: ${evento.nome}`);
    console.log(`   Data: ${evento.data_evento}`);
    console.log(`   Real R$: ${evento.real_r || 0}`);
    console.log(`   M-1 R$: ${evento.m1_r || 0}`);
    console.log(`   Clientes Real: ${evento.cl_real || 0}`);
    console.log(`   Precisa recálculo: ${evento.precisa_recalculo}`);
    console.log(`   Calculado em: ${evento.calculado_em || 'Nunca'}`);
  }
  console.log();

  console.log('='.repeat(60));
  console.log('📋 DIAGNÓSTICO');
  console.log('='.repeat(60));
  
  const temVendas = vendas && vendas.length > 0;
  const temSympla = symplaPedidos && symplaPedidos.length > 0;
  const temYuzer = yuzerPedidos && yuzerPedidos.length > 0;
  const temCustos = nibo && nibo.length > 0;
  
  if (!temVendas && !temSympla && !temYuzer) {
    console.log('❌ PROBLEMA: Não há dados de faturamento para 01/03/2026');
    console.log();
    console.log('Possíveis causas:');
    console.log('1. O evento ainda não aconteceu (01/03/2026 é SÁBADO)');
    console.log('2. Os dados do ContaHub não foram sincronizados');
    console.log('3. Não houve vendas de ingressos via Sympla/Yuzer');
    console.log();
    console.log('💡 Ações recomendadas:');
    console.log('   a) Verificar se o evento JÁ aconteceu');
    console.log('   b) Sincronizar dados do ContaHub manualmente');
    console.log('   c) Verificar se há ingressos vendidos no Sympla/Yuzer');
  } else {
    console.log('✅ Há dados disponíveis para cálculo!');
    console.log();
    console.log('Fontes de dados encontradas:');
    if (temVendas) console.log(`   ✅ ContaHub: R$ ${vendas.reduce((s, v) => s + v.valor_total, 0).toFixed(2)}`);
    if (temSympla) console.log(`   ✅ Sympla: R$ ${symplaPedidos.reduce((s, p) => s + p.valor_liquido, 0).toFixed(2)}`);
    if (temYuzer) console.log(`   ✅ Yuzer: R$ ${yuzerPedidos.reduce((s, p) => s + p.valor_liquido, 0).toFixed(2)}`);
    if (temCustos) console.log(`   ✅ NIBO: R$ ${nibo.reduce((s, n) => s + n.valor, 0).toFixed(2)}`);
    console.log();
    console.log('💡 O cálculo deveria ter rodado automaticamente.');
    console.log('   Vamos forçar o recálculo agora...');
  }
}

// Executar
verificarDados()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
