/**
 * Script para limpar completamente e recalcular NPS do zero
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function limparERecalcular() {
  console.log('🧹 Limpando e recalculando NPS do zero...\n');

  const barId = 3;

  // 1. Deletar TODOS os dados agregados do bar
  console.log('🗑️  1. Deletando dados agregados antigos...');
  
  const { error: del1 } = await supabase
    .from('nps_falae_diario')
    .delete()
    .eq('bar_id', barId);

  if (del1) {
    console.error('❌ Erro ao deletar nps_falae_diario:', del1);
  } else {
    console.log('   ✅ nps_falae_diario deletado');
  }

  const { error: del2 } = await supabase
    .from('nps_falae_diario_pesquisa')
    .delete()
    .eq('bar_id', barId);

  if (del2) {
    console.error('❌ Erro ao deletar nps_falae_diario_pesquisa:', del2);
  } else {
    console.log('   ✅ nps_falae_diario_pesquisa deletado');
  }

  // 2. Aguardar um pouco
  console.log('\n⏳ Aguardando 2 segundos...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. Recalcular via API
  console.log('\n🔄 3. Recalculando via API...');
  
  const response = await fetch('https://zykor.com.br/api/falae/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bar_id: barId,
      days_back: 60, // Últimos 60 dias
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('❌ Erro ao recalcular:', result);
    return;
  }

  console.log('✅ Recalculado com sucesso!');
  console.log(`   Respostas processadas: ${result.respostas?.inseridas_atualizadas || 0}`);
  console.log(`   NPS do período: ${result.nps_periodo ?? 'N/A'}`);
  console.log(`   Dias atualizados: ${result.nps_diario?.dias_atualizados || 0}`);

  // 4. Verificar dados da semana 14
  console.log('\n📊 4. Verificando semana 14 (30.03 - 05.04)...');
  
  const { data: agregados, error: err } = await supabase
    .from('nps_falae_diario')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lte('data_referencia', '2026-04-05')
    .order('data_referencia');

  if (err) {
    console.error('❌ Erro:', err);
    return;
  }

  let totalRespostas = 0;
  let totalPromotores = 0;
  let totalDetratores = 0;

  console.log('\n   Dados por dia:');
  agregados?.forEach(a => {
    console.log(`      ${a.data_referencia}: ${a.respostas_total} respostas | P:${a.promotores} N:${a.neutros} D:${a.detratores} | NPS: ${a.nps_score}`);
    totalRespostas += a.respostas_total;
    totalPromotores += a.promotores;
    totalDetratores += a.detratores;
  });

  const npsScore = totalRespostas > 0
    ? Math.round((((totalPromotores - totalDetratores) / totalRespostas) * 100) * 10) / 10
    : 0;

  console.log(`\n   📊 Total agregado:`);
  console.log(`      Respostas: ${totalRespostas}`);
  console.log(`      Promotores: ${totalPromotores}`);
  console.log(`      Detratores: ${totalDetratores}`);
  console.log(`      NPS: ${npsScore}`);

  // 5. Comparar com dados brutos
  const { data: brutos, error: err2 } = await supabase
    .from('falae_respostas')
    .select('nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lte('created_at', '2026-04-05T23:59:59');

  let brutosPromotores = 0;
  let brutosDetratores = 0;
  brutos?.forEach(r => {
    if (r.nps >= 9) brutosPromotores++;
    else if (r.nps <= 6) brutosDetratores++;
  });

  const npsScoreBruto = brutos && brutos.length > 0
    ? Math.round((((brutosPromotores - brutosDetratores) / brutos.length) * 100) * 10) / 10
    : 0;

  console.log(`\n   📝 Dados brutos (created_at):`);
  console.log(`      Respostas: ${brutos?.length || 0}`);
  console.log(`      Promotores: ${brutosPromotores}`);
  console.log(`      Detratores: ${brutosDetratores}`);
  console.log(`      NPS: ${npsScoreBruto}`);

  console.log(`\n   ✅ Diferença: ${Math.abs(totalRespostas - (brutos?.length || 0))} respostas`);
  console.log(`   ✅ NPS Agregado vs Bruto: ${npsScore} vs ${npsScoreBruto}`);

  console.log('\n🎉 Concluído!');
}

limparERecalcular().catch(console.error);
