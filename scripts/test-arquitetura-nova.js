/**
 * Script de Teste: Arquitetura Nova vs Antiga
 * 
 * Compara resultados entre:
 * - Funções antigas (se existirem)
 * - Funções novas (_v2)
 * 
 * Uso: node scripts/test-arquitetura-nova.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tolerância para diferenças (1% para valores monetários)
const TOLERANCIA_PERCENTUAL = 0.01;
const TOLERANCIA_ABSOLUTA = 0.01;

// Campos críticos para validação
const CAMPOS_CRITICOS = [
  'real_r', 'cl_real', 'ticket_medio',
  'percent_b', 'percent_d', 'percent_c', 'percent_happy_hour',
  't_bar', 't_coz',
  'atrasinho_bar', 'atrasinho_cozinha',
  'atrasao_bar', 'atrasao_cozinha',
  'percent_stockout'
];

/**
 * Buscar dados de eventos_base (versão atual)
 */
async function getEventoBase(barId, dataEvento) {
  const { data, error } = await supabase
    .from('eventos_base')
    .select('*')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento)
    .single();
  
  if (error) {
    console.error(`Erro ao buscar evento: ${error.message}`);
    return null;
  }
  
  return data;
}

/**
 * Executar calculate_daily_metrics_v2 e retornar resultado
 */
async function calcularMetricasV2(barId, dataEvento) {
  try {
    const { data, error } = await supabase.rpc('calculate_daily_metrics_v2', {
      p_bar_id: barId,
      p_data_evento: dataEvento
    });
    
    if (error) throw error;
    
    // Buscar o resultado calculado
    return await getEventoBase(barId, dataEvento);
  } catch (error) {
    console.error(`Erro ao calcular v2: ${error.message}`);
    return null;
  }
}

/**
 * Comparar dois conjuntos de métricas
 */
function compararMetricas(old, novo, tolerancia = TOLERANCIA_PERCENTUAL) {
  const diferencas = [];
  
  for (const campo of CAMPOS_CRITICOS) {
    const valorOld = parseFloat(old[campo]) || 0;
    const valorNovo = parseFloat(novo[campo]) || 0;
    
    // Diferença absoluta
    const difAbs = Math.abs(valorNovo - valorOld);
    
    // Diferença percentual (se valor > 0)
    const difPerc = valorOld > 0 ? difAbs / valorOld : 0;
    
    // Verificar se excede tolerância
    if (difAbs > TOLERANCIA_ABSOLUTA && difPerc > tolerancia) {
      diferencas.push({
        campo,
        valorOld,
        valorNovo,
        difAbsoluta: difAbs.toFixed(2),
        difPercentual: (difPerc * 100).toFixed(2) + '%'
      });
    }
  }
  
  return diferencas;
}

/**
 * Testar cálculo diário
 */
async function testarCalculoDiario(barId, dataEvento) {
  console.log(`\n📊 Testando Bar ${barId} - ${dataEvento}`);
  console.log('='.repeat(60));
  
  // Buscar estado atual (antes de recalcular)
  const estadoAtual = await getEventoBase(barId, dataEvento);
  
  if (!estadoAtual) {
    console.log('❌ Evento não encontrado no banco');
    return { sucesso: false, motivo: 'evento_nao_encontrado' };
  }
  
  console.log(`✅ Estado atual encontrado: R$ ${estadoAtual.real_r || 0}`);
  
  // Executar cálculo v2
  console.log('🔄 Executando calculate_daily_metrics_v2...');
  const novoCalculo = await calcularMetricasV2(barId, dataEvento);
  
  if (!novoCalculo) {
    console.log('❌ Erro ao executar função v2');
    return { sucesso: false, motivo: 'erro_calculo_v2' };
  }
  
  console.log(`✅ Novo cálculo: R$ ${novoCalculo.real_r || 0}`);
  
  // Comparar resultados
  const diferencas = compararMetricas(estadoAtual, novoCalculo);
  
  if (diferencas.length === 0) {
    console.log('✅ SUCESSO: Nenhuma diferença significativa encontrada');
    return { sucesso: true, diferencas: [] };
  } else {
    console.log(`⚠️ ATENÇÃO: ${diferencas.length} diferença(s) encontrada(s):`);
    console.table(diferencas);
    return { sucesso: false, diferencas };
  }
}

/**
 * Testar agregação semanal
 */
async function testarAgregacaoSemanal(barId, ano, semana) {
  console.log(`\n📅 Testando Agregação Bar ${barId} - Semana ${semana}/${ano}`);
  console.log('='.repeat(60));
  
  // Buscar estado atual
  const { data: estadoAtual, error: erro1 } = await supabase
    .from('desempenho_semanal')
    .select('*')
    .eq('bar_id', barId)
    .eq('ano', ano)
    .eq('numero_semana', semana)
    .single();
  
  if (erro1) {
    console.log('❌ Semana não encontrada no banco');
    return { sucesso: false, motivo: 'semana_nao_encontrada' };
  }
  
  console.log(`✅ Estado atual: R$ ${estadoAtual.faturamento_total || 0}`);
  
  // Executar agregação v2 (quando existir)
  try {
    const { error } = await supabase.rpc('aggregate_weekly_metrics_v2', {
      p_bar_id: barId,
      p_ano: ano,
      p_semana: semana
    });
    
    if (error) throw error;
    
    // Buscar novo resultado
    const { data: novoCalculo } = await supabase
      .from('desempenho_semanal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('numero_semana', semana)
      .single();
    
    console.log(`✅ Novo cálculo: R$ ${novoCalculo.faturamento_total || 0}`);
    
    // Comparar (usando campos de desempenho_semanal)
    const camposSemanal = [
      'faturamento_total', 'clientes_atendidos', 'ticket_medio',
      'perc_bebidas', 'perc_drinks', 'perc_comida',
      'tempo_saida_bar', 'tempo_saida_cozinha'
    ];
    
    const diferencas = [];
    for (const campo of camposSemanal) {
      const valorOld = parseFloat(estadoAtual[campo]) || 0;
      const valorNovo = parseFloat(novoCalculo[campo]) || 0;
      const difAbs = Math.abs(valorNovo - valorOld);
      const difPerc = valorOld > 0 ? difAbs / valorOld : 0;
      
      if (difAbs > TOLERANCIA_ABSOLUTA && difPerc > TOLERANCIA_PERCENTUAL) {
        diferencas.push({ campo, valorOld, valorNovo, difAbsoluta: difAbs.toFixed(2) });
      }
    }
    
    if (diferencas.length === 0) {
      console.log('✅ SUCESSO: Agregação semanal correta');
      return { sucesso: true };
    } else {
      console.log(`⚠️ ${diferencas.length} diferença(s) na agregação:`);
      console.table(diferencas);
      return { sucesso: false, diferencas };
    }
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { sucesso: false, motivo: error.message };
  }
}

/**
 * Validar estrutura do banco
 */
async function validarEstruturaBanco() {
  console.log('\n🔍 Validando estrutura do banco de dados');
  console.log('='.repeat(60));
  
  const validacoes = [];
  
  // Verificar campos em eventos_base
  const { data: colunasEventos } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'eventos_base' 
        AND column_name IN ('cancelamentos', 'descontos', 'conta_assinada')
    `
  });
  
  validacoes.push({
    item: 'Campos eventos_base',
    status: colunasEventos?.length === 3 ? '✅' : '❌',
    detalhes: `${colunasEventos?.length || 0}/3 campos`
  });
  
  // Verificar campos em desempenho_semanal
  const { data: colunasSemanal } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'desempenho_semanal' 
        AND column_name IN ('ter_qua_qui', 'sex_sab')
    `
  });
  
  validacoes.push({
    item: 'Campos desempenho_semanal',
    status: colunasSemanal?.length === 2 ? '✅' : '❌',
    detalhes: `${colunasSemanal?.length || 0}/2 campos`
  });
  
  // Verificar tabela bares_config
  const { data: baresConfig } = await supabase
    .from('bares_config')
    .select('bar_id')
    .order('bar_id');
  
  validacoes.push({
    item: 'Tabela bares_config',
    status: baresConfig?.length === 2 ? '✅' : '❌',
    detalhes: `${baresConfig?.length || 0}/2 bares configurados`
  });
  
  // Verificar functions v2
  const { data: functions } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT proname 
      FROM pg_proc 
      WHERE proname LIKE '%_v2%'
    `
  });
  
  validacoes.push({
    item: 'Database functions v2',
    status: functions?.length > 0 ? '✅' : '⚠️',
    detalhes: `${functions?.length || 0} função(ões) v2`
  });
  
  console.table(validacoes);
  
  return validacoes.every(v => v.status === '✅');
}

/**
 * Suite de testes completa
 */
async function executarTodosTestes() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE DA NOVA ARQUITETURA ZYKOR                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const resultados = {
    estrutura: false,
    calculosDiarios: [],
    agregacoesSemanal: [],
    timestamp: new Date().toISOString()
  };
  
  // 1. Validar estrutura
  resultados.estrutura = await validarEstruturaBanco();
  
  // 2. Testar cálculos diários
  const diasTeste = [
    { barId: 3, data: '2026-02-23' }, // Ordinário - Domingo
    { barId: 3, data: '2026-02-22' }, // Ordinário - Sábado
    { barId: 4, data: '2026-02-24' }, // Deboche - Segunda (não deve calcular)
    { barId: 4, data: '2026-02-25' }, // Deboche - Terça (deve calcular)
  ];
  
  for (const teste of diasTeste) {
    const resultado = await testarCalculoDiario(teste.barId, teste.data);
    resultados.calculosDiarios.push({ ...teste, ...resultado });
  }
  
  // 3. Testar agregações semanais (se função existir)
  const semanasTeste = [
    { barId: 3, ano: 2026, semana: 8 },
    { barId: 4, ano: 2026, semana: 8 }
  ];
  
  for (const teste of semanasTeste) {
    const resultado = await testarAgregacaoSemanal(teste.barId, teste.ano, teste.semana);
    resultados.agregacoesSemanal.push({ ...teste, ...resultado });
  }
  
  // Resumo final
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMO DOS TESTES                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const sucessos = resultados.calculosDiarios.filter(r => r.sucesso).length;
  const falhas = resultados.calculosDiarios.filter(r => !r.sucesso).length;
  
  console.log(`\n📊 Estrutura: ${resultados.estrutura ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`📊 Cálculos Diários: ${sucessos}/${sucessos + falhas} sucessos`);
  console.log(`📊 Agregações Semanais: ${resultados.agregacoesSemanal.filter(r => r.sucesso).length}/${resultados.agregacoesSemanal.length} sucessos`);
  
  // Salvar relatório
  const fs = require('fs');
  const relatorio = `backups/relatorio-teste-${new Date().toISOString().replace(/:/g, '-')}.json`;
  fs.writeFileSync(relatorio, JSON.stringify(resultados, null, 2));
  console.log(`\n📄 Relatório salvo em: ${relatorio}`);
  
  return resultados;
}

// Executar se chamado diretamente
if (require.main === module) {
  executarTodosTestes()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = {
  testarCalculoDiario,
  testarAgregacaoSemanal,
  validarEstruturaBanco,
  executarTodosTestes
};
