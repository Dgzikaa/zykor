#!/usr/bin/env node

/**
 * Script para excluir dados de período de 2026 (query ID incorreto = 5)
 * e repuxar com o query ID correto (51)
 * 
 * Com delays aleatórios entre 10-30 segundos para parecer mais humano
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar .env.local do frontend
dotenv.config({ path: join(__dirname, '../frontend/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função para delay aleatório entre 10-30 segundos
function randomDelay() {
  const seconds = Math.floor(Math.random() * (30 - 10 + 1)) + 10;
  return seconds * 1000; // Converte para milissegundos
}

// Função para esperar com log
async function waitRandom(dataAtual, total) {
  const delayMs = randomDelay();
  const seconds = (delayMs / 1000).toFixed(1);
  console.log(`⏳ Aguardando ${seconds}s antes da próxima requisição... (${dataAtual}/${total} concluídos)`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

// Função para formatar data para exibição
function formatarData(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function main() {
  console.log('🚀 Iniciando reprocessamento de dados de PERÍODO 2026...\n');

  try {
    // 1. Buscar todos os registros de período de 2026
    console.log('📊 Buscando registros de período de 2026...');
    const { data: registros, error: errorBusca } = await supabase
      .from('contahub_raw_data')
      .select('id, data_date, record_count, created_at')
      .eq('data_type', 'periodo')
      .gte('data_date', '2026-01-01')
      .lte('data_date', '2026-12-31')
      .order('data_date', { ascending: true });

    if (errorBusca) {
      throw new Error(`Erro ao buscar registros: ${errorBusca.message}`);
    }

    if (!registros || registros.length === 0) {
      console.log('✅ Nenhum registro de período encontrado em 2026. Nada a fazer.');
      console.log('\n📝 Mas vou processar todas as datas de 2026 mesmo assim (de 01/01 a 16/04)...\n');
      
      // Gerar lista de datas de 2026-01-01 até hoje
      const dataInicio = new Date('2026-01-01');
      const dataFim = new Date(); // Hoje
      const datasParaProcessar = [];
      
      let currentDate = new Date(dataInicio);
      while (currentDate <= dataFim) {
        datasParaProcessar.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      console.log(`📅 Total de datas para processar: ${datasParaProcessar.length}\n`);
      
      await processarDatas(datasParaProcessar);
      return;
    }

    console.log(`\n📋 Encontrados ${registros.length} registros de período em 2026:`);
    registros.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${formatarData(r.data_date)} - ${r.record_count} registros - ID: ${r.id}`);
    });

    // 2. Confirmar exclusão
    console.log('\n⚠️  ATENÇÃO: Os seguintes dados serão EXCLUÍDOS:');
    console.log(`   - ${registros.length} registros da tabela contahub_raw_data`);
    console.log(`   - Todos os registros correspondentes na tabela contahub_periodo`);
    console.log('\n❓ Deseja continuar? (pressione Ctrl+C para cancelar)');
    
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 3. Excluir registros de contahub_periodo primeiro (dependências)
    console.log('\n🗑️  Excluindo registros de contahub_periodo de 2026...');
    const { error: errorDeletePeriodo } = await supabase
      .from('contahub_periodo')
      .delete()
      .eq('bar_id', 3)
      .gte('dt_gerencial', '2026-01-01')
      .lte('dt_gerencial', '2026-12-31');

    if (errorDeletePeriodo) {
      throw new Error(`Erro ao excluir contahub_periodo: ${errorDeletePeriodo.message}`);
    }
    console.log('✅ Registros de contahub_periodo excluídos');

    // 4. Excluir registros de contahub_raw_data
    console.log('🗑️  Excluindo registros de contahub_raw_data...');
    const { error: errorDeleteRaw } = await supabase
      .from('contahub_raw_data')
      .delete()
      .eq('data_type', 'periodo')
      .gte('data_date', '2026-01-01')
      .lte('data_date', '2026-12-31');

    if (errorDeleteRaw) {
      throw new Error(`Erro ao excluir contahub_raw_data: ${errorDeleteRaw.message}`);
    }
    console.log('✅ Registros de contahub_raw_data excluídos\n');

    // Extrair datas únicas dos registros excluídos
    const datasUnicas = [...new Set(registros.map(r => r.data_date))].sort();
    console.log(`📅 Total de datas únicas para reprocessar: ${datasUnicas.length}\n`);

    await processarDatas(datasUnicas);

  } catch (error) {
    console.error('\n❌ Erro fatal:', error.message);
    process.exit(1);
  }
}

// Função separada para processar lista de datas
async function processarDatas(datas) {
  // 5. Repuxar dados com query ID correto (51)
  console.log('🔄 Iniciando coleta de dados com Query ID correto (51)...\n');
  
  let sucessos = 0;
  let erros = 0;

  for (let i = 0; i < datas.length; i++) {
    const dataDate = datas[i];
    const progresso = `[${i + 1}/${datas.length}]`;

    console.log(`${progresso} 📅 Processando ${formatarData(dataDate)}...`);

    try {
      // Chamar a Edge Function de sync
      const response = await fetch(`${supabaseUrl}/functions/v1/contahub-sync-automatico`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          bar_id: 3,
          data_date: dataDate
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (result.success) {
        sucessos++;
        console.log(`   ✅ ${formatarData(dataDate)} - ${result.results?.periodo?.record_count || 0} registros`);
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }

      // Aguardar tempo aleatório antes da próxima requisição (exceto na última)
      if (i < datas.length - 1) {
        await waitRandom(i + 1, datas.length);
      }
    } catch (error) {
      erros++;
      console.error(`   ❌ ${formatarData(dataDate)} - Erro: ${error.message}`);
    }
  }

  // 6. Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DO REPROCESSAMENTO');
  console.log('='.repeat(60));
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Erros: ${erros}`);
  console.log(`📅 Total processado: ${datas.length} datas`);
  console.log('='.repeat(60));

  if (erros > 0) {
    console.log('\n⚠️  Algumas datas falharam. Execute o script novamente para reprocessá-las.');
    process.exit(1);
  } else {
    console.log('\n🎉 Reprocessamento concluído com sucesso!');
  }
}

main();
