/**
 * Script para debugar problema de timezone
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTimezone() {
  console.log('🔍 Debugando problema de timezone...\n');

  const barId = 3;

  // Buscar respostas do dia 30/03 e 31/03
  const { data: respostas, error } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lt('created_at', '2026-04-01T00:00:00')
    .order('created_at');

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log(`📝 Total de respostas 30-31/03: ${respostas?.length || 0}\n`);

  // Agrupar por data (como o código faz)
  const byDay = new Map<string, number>();

  respostas?.forEach(r => {
    // Simular o que o código faz
    const day = String(r.created_at).slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
    
    console.log(`ID: ${r.id.substring(0, 8)}...`);
    console.log(`   created_at: ${r.created_at}`);
    console.log(`   Data extraída: ${day}`);
    console.log(`   NPS: ${r.nps}`);
    console.log('');
  });

  console.log('\n📊 Agrupamento por dia:');
  byDay.forEach((count, day) => {
    console.log(`   ${day}: ${count} respostas`);
  });

  // Verificar o que está no nps_falae_diario
  console.log('\n📊 Dados em nps_falae_diario:');
  const { data: agregados } = await supabase
    .from('nps_falae_diario')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lt('data_referencia', '2026-04-01')
    .order('data_referencia');

  agregados?.forEach(a => {
    console.log(`   ${a.data_referencia}: ${a.respostas_total} respostas | P:${a.promotores} N:${a.neutros} D:${a.detratores}`);
  });

  console.log('\n✅ Debug concluído!');
}

debugTimezone().catch(console.error);
