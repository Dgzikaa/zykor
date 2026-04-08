/**
 * Script para recalcular agregações do Falaê
 * 
 * Uso:
 * npx tsx scripts/recalcular-agregacoes-falae.ts [bar_id]
 * 
 * Exemplos:
 * npx tsx scripts/recalcular-agregacoes-falae.ts        # Todos os bares
 * npx tsx scripts/recalcular-agregacoes-falae.ts 3      # Apenas bar_id 3
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalcularBar(barId: number, dataInicio: string, dataFim: string) {
  console.log(`\n📊 Recalculando agregações para bar_id ${barId}...`);
  console.log(`   Período: ${dataInicio} até ${dataFim}`);

  try {
    // 1. Buscar respostas do período
    console.log('   🔍 Buscando respostas...');
    const { data: respostas, error: errRespostas } = await supabase
      .from('falae_respostas')
      .select('created_at, data_visita, nps')
      .eq('bar_id', barId)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`);

    if (errRespostas) {
      console.error(`   ❌ Erro ao buscar respostas:`, errRespostas);
      return { success: false, error: errRespostas };
    }

    const totalRespostas = respostas?.length || 0;
    console.log(`   ✅ ${totalRespostas} respostas encontradas`);

    if (totalRespostas === 0) {
      console.log(`   ⚠️  Nenhuma resposta para recalcular`);
      return { success: true };
    }

    // 2. Agregar por dia
    console.log('   🔄 Agregando por dia...');
    const byDay = new Map<
      string,
      { total: number; promotores: number; neutros: number; detratores: number; somaNps: number }
    >();

    for (const row of respostas || []) {
      const day = row.data_visita || String(row.created_at).slice(0, 10);
      if (!day) continue;
      
      if (!byDay.has(day)) {
        byDay.set(day, { total: 0, promotores: 0, neutros: 0, detratores: 0, somaNps: 0 });
      }
      
      const bucket = byDay.get(day)!;
      const nps = Number(row.nps) || 0;
      bucket.total += 1;
      bucket.somaNps += nps;
      
      if (nps >= 9) bucket.promotores += 1;
      else if (nps <= 6) bucket.detratores += 1;
      else bucket.neutros += 1;
    }

    // 3. Preparar dados para upsert
    const now = new Date().toISOString();
    const dailyRows = Array.from(byDay.entries()).map(([dataReferencia, v]) => ({
      bar_id: barId,
      data_referencia: dataReferencia,
      respostas_total: v.total,
      promotores: v.promotores,
      neutros: v.neutros,
      detratores: v.detratores,
      nps_score: v.total > 0 ? Math.round(((v.promotores - v.detratores) / v.total) * 100) : null,
      nps_media: v.total > 0 ? Math.round((v.somaNps / v.total) * 100) / 100 : null,
      atualizado_em: now,
    }));

    // 4. Fazer upsert em nps_falae_diario
    console.log(`   💾 Salvando ${dailyRows.length} dias em nps_falae_diario...`);
    const { error: errUpsert } = await supabase
      .from('nps_falae_diario')
      .upsert(dailyRows, { onConflict: 'bar_id,data_referencia' });

    if (errUpsert) {
      console.error(`   ❌ Erro ao salvar nps_falae_diario:`, errUpsert);
      return { success: false, error: errUpsert };
    }

    console.log(`   ✅ nps_falae_diario recalculado (${dailyRows.length} dias)`);

    // 5. Recalcular nps_falae_diario_pesquisa
    console.log('   🔄 Recalculando nps_falae_diario_pesquisa...');
    const { data: resultPesquisa, error: errPesquisa } = await supabase
      .rpc('recalcular_nps_diario_pesquisa', {
        p_bar_id: barId,
        p_data_inicio: dataInicio,
        p_data_fim: dataFim
      });

    if (errPesquisa) {
      console.error(`   ❌ Erro ao recalcular nps_falae_diario_pesquisa:`, errPesquisa);
      return { success: false, error: errPesquisa };
    }

    console.log(`   ✅ nps_falae_diario_pesquisa recalculado (${resultPesquisa || 0} registros)`);

    // 6. Validar resultados
    const { data: respostasValidacao, error: errRespostasValidacao } = await supabase
      .from('falae_respostas')
      .select('id')
      .eq('bar_id', barId)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`);

    const { data: agregadoValidacao, error: errAgregadoValidacao } = await supabase
      .from('nps_falae_diario')
      .select('respostas_total')
      .eq('bar_id', barId)
      .gte('data_referencia', dataInicio)
      .lte('data_referencia', dataFim);

    if (!errRespostasValidacao && !errAgregadoValidacao) {
      const totalRespostasValidacao = respostasValidacao?.length || 0;
      const totalAgregadoValidacao = agregadoValidacao?.reduce((sum, r) => sum + (r.respostas_total || 0), 0) || 0;
      const diferencaValidacao = Math.abs(totalRespostasValidacao - totalAgregadoValidacao);
      const percentualValidacao = totalRespostasValidacao > 0 ? Math.round((diferencaValidacao / totalRespostasValidacao) * 100) : 0;

      console.log(`\n   📈 Validação:`);
      console.log(`      Total de respostas: ${totalRespostasValidacao}`);
      console.log(`      Total agregado: ${totalAgregadoValidacao}`);
      console.log(`      Diferença: ${diferencaValidacao} (${percentualValidacao}%)`);

      if (percentualValidacao <= 5) {
        console.log(`      ✅ Agregações consistentes!`);
      } else {
        console.log(`      ⚠️  Ainda há diferença de ${percentualValidacao}%`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`   ❌ Erro ao recalcular bar ${barId}:`, error);
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 Iniciando recálculo de agregações do Falaê...\n');

  const barIdArg = process.argv[2];
  const dataInicio = '2026-01-01';
  const dataFim = new Date().toISOString().split('T')[0];

  let barsParaRecalcular: number[] = [];

  if (barIdArg) {
    // Recalcular apenas um bar específico
    const barId = parseInt(barIdArg, 10);
    if (isNaN(barId)) {
      console.error('❌ bar_id inválido. Use um número inteiro.');
      process.exit(1);
    }
    barsParaRecalcular = [barId];
  } else {
    // Buscar todos os bares que têm respostas do Falaê
    console.log('🔍 Buscando bares com respostas do Falaê...');
    const { data, error } = await supabase
      .from('falae_respostas')
      .select('bar_id')
      .order('bar_id');

    if (error) {
      console.error('❌ Erro ao buscar bares:', error);
      process.exit(1);
    }

    const uniqueBars = [...new Set(data?.map(r => r.bar_id) || [])];
    barsParaRecalcular = uniqueBars;
    console.log(`   ✅ Encontrados ${uniqueBars.length} bares: ${uniqueBars.join(', ')}\n`);
  }

  if (barsParaRecalcular.length === 0) {
    console.log('⚠️  Nenhum bar encontrado para recalcular.');
    process.exit(0);
  }

  console.log(`📅 Período de recálculo: ${dataInicio} até ${dataFim}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');

  let sucessos = 0;
  let falhas = 0;

  for (const barId of barsParaRecalcular) {
    const result = await recalcularBar(barId, dataInicio, dataFim);
    if (result.success) {
      sucessos++;
    } else {
      falhas++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📋 RESUMO DO RECÁLCULO');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`✅ Sucessos: ${sucessos}`);
  console.log(`❌ Falhas: ${falhas}`);
  console.log(`📊 Total: ${barsParaRecalcular.length} bares processados\n`);

  if (falhas > 0) {
    console.log('⚠️  Alguns bares falharam no recálculo. Verifique os logs acima.');
    process.exit(1);
  } else {
    console.log('🎉 Todos os bares foram recalculados com sucesso!\n');
    console.log('💡 Execute o script de validação para confirmar:');
    console.log('   npx tsx scripts/validar-falae-inconsistencias.ts\n');
    process.exit(0);
  }
}

main();
