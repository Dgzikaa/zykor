/**
 * Script para debugar as 4 respostas extras na agregação
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRespostasExtras() {
  console.log('🔍 Debugando respostas extras...\n');

  const barId = 3;

  // 1. Buscar todas as respostas do período (created_at)
  console.log('📝 1. Respostas por created_at (30.03 - 05.04):');
  const { data: respostasCreatedAt, error: err1 } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lte('created_at', '2026-04-05T23:59:59')
    .order('created_at');

  console.log(`   Total: ${respostasCreatedAt?.length || 0} respostas\n`);

  // 2. Buscar dados agregados por dia
  console.log('📊 2. Dados agregados (nps_falae_diario):');
  const { data: agregados, error: err2 } = await supabase
    .from('nps_falae_diario')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lte('data_referencia', '2026-04-05')
    .order('data_referencia');

  let totalAgregado = 0;
  agregados?.forEach(a => {
    console.log(`   ${a.data_referencia}: ${a.respostas_total} respostas`);
    totalAgregado += a.respostas_total;
  });
  console.log(`   Total agregado: ${totalAgregado}\n`);

  // 3. Verificar se há respostas com created_at no dia 30/03
  console.log('🔎 3. Detalhando dia 30/03:');
  const { data: dia30, error: err3 } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lt('created_at', '2026-03-31T00:00:00')
    .order('created_at');

  console.log(`   Total de respostas no dia 30/03: ${dia30?.length || 0}`);
  
  // 4. Verificar se há respostas com created_at no dia 31/03
  console.log('\n🔎 4. Detalhando dia 31/03:');
  const { data: dia31, error: err4 } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-31T00:00:00')
    .lt('created_at', '2026-04-01T00:00:00')
    .order('created_at');

  console.log(`   Total de respostas no dia 31/03: ${dia31?.length || 0}`);
  dia31?.forEach((r, idx) => {
    console.log(`      ${idx + 1}. ${r.created_at} | NPS: ${r.nps}`);
  });

  // 5. Verificar agregação do dia 31/03
  console.log('\n📊 5. Agregação do dia 31/03:');
  const agregado31 = agregados?.find(a => a.data_referencia === '2026-03-31');
  if (agregado31) {
    console.log(`   Respostas agregadas: ${agregado31.respostas_total}`);
    console.log(`   P:${agregado31.promotores} N:${agregado31.neutros} D:${agregado31.detratores}`);
    console.log(`   NPS: ${agregado31.nps_score}`);
  }

  console.log('\n✅ Debug concluído!');
  console.log(`\n📊 Resumo:`);
  console.log(`   Respostas brutas (created_at 30.03-05.04): ${respostasCreatedAt?.length || 0}`);
  console.log(`   Respostas agregadas (data_referencia 30.03-05.04): ${totalAgregado}`);
  console.log(`   Diferença: ${totalAgregado - (respostasCreatedAt?.length || 0)}`);
}

debugRespostasExtras().catch(console.error);
