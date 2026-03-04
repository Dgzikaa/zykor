/**
 * FASE 1: Estrutura do Banco
 * Executar 5 scripts SQL para adicionar campos e criar tabela bares_config
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executarSQL(nome, sql) {
  console.log(`\n📊 Executando: ${nome}`);
  console.log('='.repeat(60));
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // Tentar método alternativo se rpc não existir
      const { data: data2, error: error2 } = await supabase.from('_sql').insert({ query: sql });
      
      if (error2) {
        console.error(`❌ Erro: ${error.message || error2.message}`);
        return false;
      }
    }
    
    console.log(`✅ Sucesso!`);
    return true;
  } catch (err) {
    console.error(`❌ Exceção: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  FASE 1: ESTRUTURA DO BANCO                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const scripts = [
    {
      nome: 'Script 1: Adicionar campos em eventos_base',
      sql: `
        ALTER TABLE eventos_base 
        ADD COLUMN IF NOT EXISTS cancelamentos NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS descontos NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS conta_assinada NUMERIC DEFAULT 0;
        
        COMMENT ON COLUMN eventos_base.cancelamentos IS 
          'Valor total de cancelamentos do dia (em R$)';
        COMMENT ON COLUMN eventos_base.descontos IS 
          'Valor total de descontos dados no dia (em R$)';
        COMMENT ON COLUMN eventos_base.conta_assinada IS 
          'Valor consumido em conta assinada (pago depois)';
      `
    },
    {
      nome: 'Script 2: Adicionar campos em desempenho_semanal',
      sql: `
        ALTER TABLE desempenho_semanal
        ADD COLUMN IF NOT EXISTS ter_qua_qui NUMERIC,
        ADD COLUMN IF NOT EXISTS sex_sab NUMERIC;
        
        COMMENT ON COLUMN desempenho_semanal.ter_qua_qui IS 
          'Faturamento Terça+Quarta+Quinta (APENAS Deboche)';
        COMMENT ON COLUMN desempenho_semanal.sex_sab IS 
          'Faturamento Sexta+Sábado (APENAS Deboche)';
      `
    },
    {
      nome: 'Script 3: Criar tabela bares_config',
      sql: `
        CREATE TABLE IF NOT EXISTS bares_config (
          id SERIAL PRIMARY KEY,
          bar_id INTEGER UNIQUE REFERENCES bares(id),
          
          -- Dias de operação
          opera_segunda BOOLEAN DEFAULT true,
          opera_terca BOOLEAN DEFAULT true,
          opera_quarta BOOLEAN DEFAULT true,
          opera_quinta BOOLEAN DEFAULT true,
          opera_sexta BOOLEAN DEFAULT true,
          opera_sabado BOOLEAN DEFAULT true,
          opera_domingo BOOLEAN DEFAULT true,
          
          -- Horários de operação
          horario_abertura TIME DEFAULT '18:00',
          horario_fechamento TIME DEFAULT '02:00',
          
          -- Happy hour
          happy_hour_inicio TIME DEFAULT '18:00',
          happy_hour_fim TIME DEFAULT '20:00',
          
          -- Integrações
          tem_api_yuzer BOOLEAN DEFAULT false,
          tem_api_sympla BOOLEAN DEFAULT false,
          tem_api_contahub BOOLEAN DEFAULT true,
          
          -- Faturamento
          dias_principais TEXT[],
          
          -- Audit
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        COMMENT ON TABLE bares_config IS 
          'Configurações operacionais de cada bar - FONTE ÚNICA DE VERDADE';
        COMMENT ON COLUMN bares_config.dias_principais IS 
          'Array de dias da semana principais para agregação (ex: QUI+SÁB+DOM)';
        
        -- Inserir configuração Ordinário
        INSERT INTO bares_config (
          bar_id,
          opera_segunda, opera_terca, opera_quarta, opera_quinta,
          opera_sexta, opera_sabado, opera_domingo,
          horario_abertura, horario_fechamento,
          happy_hour_inicio, happy_hour_fim,
          tem_api_yuzer, tem_api_sympla, tem_api_contahub,
          dias_principais
        ) VALUES (
          3,
          true, true, true, true, true, true, true,
          '18:00', '02:00',
          '18:00', '20:00',
          true, true, true,
          ARRAY['Quinta', 'Sábado', 'Domingo']
        )
        ON CONFLICT (bar_id) DO UPDATE SET
          opera_segunda = EXCLUDED.opera_segunda,
          opera_terca = EXCLUDED.opera_terca,
          opera_quarta = EXCLUDED.opera_quarta,
          opera_quinta = EXCLUDED.opera_quinta,
          opera_sexta = EXCLUDED.opera_sexta,
          opera_sabado = EXCLUDED.opera_sabado,
          opera_domingo = EXCLUDED.opera_domingo,
          horario_abertura = EXCLUDED.horario_abertura,
          horario_fechamento = EXCLUDED.horario_fechamento,
          happy_hour_inicio = EXCLUDED.happy_hour_inicio,
          happy_hour_fim = EXCLUDED.happy_hour_fim,
          tem_api_yuzer = EXCLUDED.tem_api_yuzer,
          tem_api_sympla = EXCLUDED.tem_api_sympla,
          tem_api_contahub = EXCLUDED.tem_api_contahub,
          dias_principais = EXCLUDED.dias_principais,
          updated_at = NOW();
        
        -- Inserir configuração Deboche
        INSERT INTO bares_config (
          bar_id,
          opera_segunda, opera_terca, opera_quarta, opera_quinta,
          opera_sexta, opera_sabado, opera_domingo,
          horario_abertura, horario_fechamento,
          happy_hour_inicio, happy_hour_fim,
          tem_api_yuzer, tem_api_sympla, tem_api_contahub,
          dias_principais
        ) VALUES (
          4,
          false, true, true, true, true, true, true,
          '18:00', '02:00',
          '18:00', '20:00',
          false, true, true,
          ARRAY['Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
        )
        ON CONFLICT (bar_id) DO UPDATE SET
          opera_segunda = EXCLUDED.opera_segunda,
          opera_terca = EXCLUDED.opera_terca,
          opera_quarta = EXCLUDED.opera_quarta,
          opera_quinta = EXCLUDED.opera_quinta,
          opera_sexta = EXCLUDED.opera_sexta,
          opera_sabado = EXCLUDED.opera_sabado,
          opera_domingo = EXCLUDED.opera_domingo,
          horario_abertura = EXCLUDED.horario_abertura,
          horario_fechamento = EXCLUDED.horario_fechamento,
          happy_hour_inicio = EXCLUDED.happy_hour_inicio,
          happy_hour_fim = EXCLUDED.happy_hour_fim,
          tem_api_yuzer = EXCLUDED.tem_api_yuzer,
          tem_api_sympla = EXCLUDED.tem_api_sympla,
          tem_api_contahub = EXCLUDED.tem_api_contahub,
          dias_principais = EXCLUDED.dias_principais,
          updated_at = NOW();
      `
    },
    {
      nome: 'Script 4: Criar índices',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_eventos_base_bar_data 
          ON eventos_base(bar_id, data_evento);
        
        CREATE INDEX IF NOT EXISTS idx_desempenho_semanal_bar_semana 
          ON desempenho_semanal(bar_id, ano, numero_semana);
        
        CREATE INDEX IF NOT EXISTS idx_eventos_base_cancelamentos 
          ON eventos_base(cancelamentos) WHERE cancelamentos > 0;
        
        CREATE INDEX IF NOT EXISTS idx_eventos_base_conta_assinada 
          ON eventos_base(conta_assinada) WHERE conta_assinada > 0;
        
        CREATE INDEX IF NOT EXISTS idx_bares_config_bar_id 
          ON bares_config(bar_id);
      `
    }
  ];
  
  let sucessos = 0;
  let falhas = 0;
  
  for (const script of scripts) {
    const sucesso = await executarSQL(script.nome, script.sql);
    if (sucesso) {
      sucessos++;
    } else {
      falhas++;
    }
    // Aguardar um pouco entre comandos
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Script 5: Validação
  console.log(`\n📊 Executando: Script 5: Validação`);
  console.log('='.repeat(60));
  
  try {
    // Verificar campos em eventos_base
    const { data: colunasEventos } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'eventos_base')
      .in('column_name', ['cancelamentos', 'descontos', 'conta_assinada']);
    
    console.log('\n✅ Campos eventos_base:');
    console.table(colunasEventos || []);
    
    // Verificar campos em desempenho_semanal
    const { data: colunasSemanal } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'desempenho_semanal')
      .in('column_name', ['ter_qua_qui', 'sex_sab']);
    
    console.log('\n✅ Campos desempenho_semanal:');
    console.table(colunasSemanal || []);
    
    // Verificar tabela bares_config
    const { data: baresConfig, error } = await supabase
      .from('bares_config')
      .select('*')
      .order('bar_id');
    
    if (!error && baresConfig) {
      console.log('\n✅ Tabela bares_config:');
      console.table(baresConfig);
    }
    
  } catch (err) {
    console.error(`❌ Erro na validação: ${err.message}`);
  }
  
  // Resumo final
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RESUMO DA FASE 1                                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);
  
  if (falhas === 0) {
    console.log('\n🎉 FASE 1 CONCLUÍDA COM SUCESSO! 🎉');
  } else {
    console.log('\n⚠️ FASE 1 COM FALHAS - Verifique os erros acima');
  }
}

// Executar
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Erro fatal:', error);
      process.exit(1);
    });
}

module.exports = { executarSQL, main };
