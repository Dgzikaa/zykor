#!/usr/bin/env node

/**
 * Script para atualizar a função calculate_evento_metrics
 * Substitui referências de tabelas antigas para bronze schema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function atualizarFuncao() {
  console.log('🔄 Buscando definição atual da função...\n');
  
  const { data, error } = await supabase.rpc('execute_sql', {
    query: `SELECT pg_get_functiondef(oid) as definition 
            FROM pg_proc 
            WHERE proname = 'calculate_evento_metrics' 
              AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');`
  });
  
  if (error) {
    console.error('❌ Erro ao buscar função:', error);
    process.exit(1);
  }
  
  let funcaoSQL = data[0]?.definition;
  
  if (!funcaoSQL) {
    console.error('❌ Função não encontrada');
    process.exit(1);
  }
  
  console.log('✅ Função encontrada\n');
  console.log('🔄 Aplicando substituições...\n');
  
  // Substituições
  const substituicoes = [
    { de: 'FROM contahub_pagamentos', para: 'FROM bronze.bronze_contahub_financeiro_pagamentosrecebidos' },
    { de: 'FROM contahub_periodo', para: 'FROM bronze.bronze_contahub_avendas_vendasperiodo' },
    { de: 'FROM contahub_fatporhora', para: 'FROM bronze.bronze_contahub_avendas_vendasdiahoraanalitico' },
    { de: 'FROM contahub_analitico', para: 'FROM bronze.bronze_contahub_avendas_porproduto_analitico' },
    { de: 'FROM contahub_tempo', para: 'FROM bronze.bronze_contahub_produtos_temposproducao' },
  ];
  
  let totalSubstituicoes = 0;
  substituicoes.forEach(({ de, para }) => {
    const antes = funcaoSQL.split(de).length - 1;
    funcaoSQL = funcaoSQL.replaceAll(de, para);
    const depois = funcaoSQL.split(para).length - 1;
    if (antes > 0) {
      console.log(`   ✅ ${de} → ${para} (${antes}x)`);
      totalSubstituicoes += antes;
    }
  });
  
  console.log(`\n📊 Total de substituições: ${totalSubstituicoes}\n`);
  
  // Executar função atualizada
  console.log('💾 Aplicando função atualizada no banco...\n');
  
  const { error: updateError } = await supabase.rpc('execute_sql', {
    query: funcaoSQL
  });
  
  if (updateError) {
    console.error('❌ Erro ao atualizar função:', updateError);
    process.exit(1);
  }
  
  console.log('✅ Função calculate_evento_metrics atualizada com sucesso!\n');
}

atualizarFuncao();
