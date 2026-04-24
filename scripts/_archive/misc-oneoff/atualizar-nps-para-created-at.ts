/**
 * Script para atualizar NPS para usar created_at ao invés de data_visita
 * Alinha 100% com o Falae
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function atualizarNpsParaCreatedAt() {
  console.log('🔄 Atualizando NPS para usar created_at...\n');

  try {
    // 1. Atualizar função SQL
    console.log('📝 1. Atualizando função SQL recalcular_nps_diario_pesquisa...');
    const sqlPath = path.join(__dirname, '..', 'database', 'functions', 'recalcular_nps_diario_pesquisa_v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error: sqlError } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (sqlError) {
      console.error('❌ Erro ao atualizar função SQL:', sqlError);
      // Tentar método alternativo
      console.log('   Tentando método alternativo...');
      const { error: altError } = await (supabase as any).rpc('execute_raw_sql', { query: sql });
      if (altError) {
        console.error('❌ Erro no método alternativo:', altError);
        console.log('   ⚠️  Você precisará executar manualmente o SQL no Supabase Dashboard');
        console.log(`   📄 Arquivo: ${sqlPath}`);
      } else {
        console.log('   ✅ Função SQL atualizada com sucesso!');
      }
    } else {
      console.log('   ✅ Função SQL atualizada com sucesso!');
    }

    // 2. Limpar dados antigos
    console.log('\n🗑️  2. Limpando dados antigos das tabelas agregadas...');
    
    const { error: deleteError1 } = await supabase
      .from('nps_falae_diario')
      .delete()
      .neq('bar_id', 0); // Deleta tudo

    if (deleteError1) {
      console.error('❌ Erro ao limpar nps_falae_diario:', deleteError1);
    } else {
      console.log('   ✅ nps_falae_diario limpo');
    }

    const { error: deleteError2 } = await supabase
      .from('nps_falae_diario_pesquisa')
      .delete()
      .neq('bar_id', 0); // Deleta tudo

    if (deleteError2) {
      console.error('❌ Erro ao limpar nps_falae_diario_pesquisa:', deleteError2);
    } else {
      console.log('   ✅ nps_falae_diario_pesquisa limpo');
    }

    // 3. Recalcular dados para cada bar
    console.log('\n🔄 3. Recalculando dados para todos os bars...');
    
    const { data: bars, error: barsError } = await supabase
      .from('bares')
      .select('id, nome')
      .eq('ativo', true);

    if (barsError) {
      console.error('❌ Erro ao buscar bars:', barsError);
      return;
    }

    for (const bar of bars || []) {
      console.log(`\n   📍 ${bar.nome} (ID: ${bar.id})`);
      
      // Buscar data mínima e máxima de respostas
      const { data: minMax, error: minMaxError } = await supabase
        .from('falae_respostas')
        .select('created_at')
        .eq('bar_id', bar.id)
        .order('created_at', { ascending: true })
        .limit(1);

      if (minMaxError || !minMax || minMax.length === 0) {
        console.log('      ⚠️  Nenhuma resposta encontrada');
        continue;
      }

      const dataInicio = new Date(minMax[0].created_at);
      dataInicio.setDate(dataInicio.getDate() - 1); // 1 dia antes
      const dataFim = new Date();
      dataFim.setDate(dataFim.getDate() + 1); // 1 dia depois

      console.log(`      Período: ${dataInicio.toISOString().split('T')[0]} até ${dataFim.toISOString().split('T')[0]}`);

      // Reprocessar usando a API de sync
      const response = await fetch('https://zykor.com.br/api/falae/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: bar.id,
          days_back: Math.ceil((dataFim.getTime() - dataInicio.getTime()) / (1000 * 60 * 60 * 24)),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('      ❌ Erro ao reprocessar:', result);
      } else {
        console.log(`      ✅ Reprocessado: ${result.respostas?.inseridas_atualizadas || 0} respostas`);
        console.log(`         NPS do período: ${result.nps_periodo ?? 'N/A'}`);
        console.log(`         Dias atualizados: ${result.nps_diario?.dias_atualizados || 0}`);
      }
    }

    console.log('\n🎉 Atualização concluída!');
    console.log('\n📊 Próximos passos:');
    console.log('   1. Verifique no Zykor se os números batem com o Falae');
    console.log('   2. Teste a semana 14 (30.03-05.04) para confirmar NPS 55');

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

atualizarNpsParaCreatedAt();
