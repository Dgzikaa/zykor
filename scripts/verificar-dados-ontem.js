/**
 * Script para verificar se existem dados de faturamento para 01/03/2026
 * no ContaHub, Sympla e Yuzer
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

  // 1. Verificar ContaHub
  console.log('📊 ContaHub (comandas):');
  const { data: comandas, error: comandasError } = await supabase
    .from('comandas')
    .select('id, numero_comanda, valor_total, data_abertura, data_fechamento')
    .eq('bar_id', BAR_ID)
    .gte('data_abertura', '2026-03-01T00:00:00')
    .lt('data_abertura', '2026-03-02T00:00:00')
    .order('data_abertura', { ascending: true });

  if (comandasError) {
    console.log('   ❌ Erro ao buscar comandas:', comandasError.message);
  } else if (!comandas || comandas.length === 0) {
    console.log('   ⚠️  Nenhuma comanda encontrada para 01/03/2026');
  } else {
    const totalComandas = comandas.reduce((sum, c) => sum + (c.valor_total || 0), 0);
    console.log(`   ✅ ${comandas.length} comandas encontradas`);
    console.log(`   💰 Total: R$ ${totalComandas.toFixed(2)}`);
    console.log(`   Primeira: ${comandas[0].data_abertura}`);
    console.log(`   Última: ${comandas[comandas.length - 1].data_abertura}`);
  }
  console.log();

  // 2. Verificar Sympla
  console.log('🎫 Sympla (ingressos):');
  const { data: sympla, error: symplaError } = await supabase
    .from('sympla_eventos')
    .select('id, nome_evento, total_liquido, total_checkins')
    .eq('evento_id', EVENTO_ID);

  if (symplaError) {
    console.log('   ❌ Erro ao buscar dados Sympla:', symplaError.message);
  } else if (!sympla || sympla.length === 0) {
    console.log('   ⚠️  Nenhum dado Sympla vinculado ao evento 858');
  } else {
    const totalSympla = sympla.reduce((sum, s) => sum + (s.total_liquido || 0), 0);
    const totalCheckins = sympla.reduce((sum, s) => sum + (s.total_checkins || 0), 0);
    console.log(`   ✅ ${sympla.length} eventos Sympla vinculados`);
    console.log(`   💰 Total líquido: R$ ${totalSympla.toFixed(2)}`);
    console.log(`   👥 Total check-ins: ${totalCheckins}`);
  }
  console.log();

  // 3. Verificar Yuzer
  console.log('🎟️  Yuzer (ingressos):');
  const { data: yuzer, error: yuzerError } = await supabase
    .from('yuzer_eventos')
    .select('id, nome_evento, total_liquido, total_ingressos')
    .eq('evento_id', EVENTO_ID);

  if (yuzerError) {
    console.log('   ❌ Erro ao buscar dados Yuzer:', yuzerError.message);
  } else if (!yuzer || yuzer.length === 0) {
    console.log('   ⚠️  Nenhum dado Yuzer vinculado ao evento 858');
  } else {
    const totalYuzer = yuzer.reduce((sum, y) => sum + (y.total_liquido || 0), 0);
    const totalIngressos = yuzer.reduce((sum, y) => sum + (y.total_ingressos || 0), 0);
    console.log(`   ✅ ${yuzer.length} eventos Yuzer vinculados`);
    console.log(`   💰 Total líquido: R$ ${totalYuzer.toFixed(2)}`);
    console.log(`   🎫 Total ingressos: ${totalIngressos}`);
  }
  console.log();

  // 4. Verificar vendas de itens
  console.log('🍺 Vendas de itens (pedidos):');
  const { data: pedidos, error: pedidosError } = await supabase
    .from('pedidos')
    .select('id, valor_total, criado_em')
    .eq('bar_id', BAR_ID)
    .gte('criado_em', '2026-03-01T00:00:00')
    .lt('criado_em', '2026-03-02T00:00:00');

  if (pedidosError) {
    console.log('   ❌ Erro ao buscar pedidos:', pedidosError.message);
  } else if (!pedidos || pedidos.length === 0) {
    console.log('   ⚠️  Nenhum pedido encontrado para 01/03/2026');
  } else {
    const totalPedidos = pedidos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    console.log(`   ✅ ${pedidos.length} pedidos encontrados`);
    console.log(`   💰 Total: R$ ${totalPedidos.toFixed(2)}`);
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

  console.log('='.repeat(60));
  console.log('📋 RESUMO');
  console.log('='.repeat(60));
  console.log('Se não há dados acima, significa que:');
  console.log('1. O evento ainda não aconteceu (01/03/2026 é sábado)');
  console.log('2. Os dados ainda não foram sincronizados do ContaHub');
  console.log('3. Não há ingressos vendidos via Sympla/Yuzer');
  console.log('4. Não há custos artísticos registrados no NIBO');
  console.log();
  console.log('💡 Ação recomendada:');
  console.log('   - Se o evento JÁ aconteceu: sincronizar ContaHub, Sympla, Yuzer e NIBO');
  console.log('   - Se o evento NÃO aconteceu: aguardar o evento e sincronização automática');
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
