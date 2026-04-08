/**
 * Script para debugar a discrepância no NPS da semana 14
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function debugNpsSemana14() {
  console.log('🔍 Debug NPS Semana 14 (30.03 - 05.04/2026)...\n');

  const barId = 3;

  // 1. Buscar todas as respostas brutas do período
  console.log('📝 1. Respostas brutas (falae_respostas):');
  const { data: respostas, error: errRespostas } = await supabase
    .from('falae_respostas')
    .select('id, created_at, data_visita, nps, search_name')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lte('created_at', '2026-04-05T23:59:59')
    .order('created_at');

  if (errRespostas) {
    console.error('❌ Erro:', errRespostas);
    return;
  }

  console.log(`   Total: ${respostas?.length || 0} respostas\n`);

  // Analisar cada resposta
  respostas?.forEach((r, idx) => {
    const createdAt = new Date(r.created_at);
    const dataVisita = r.data_visita ? new Date(r.data_visita + 'T00:00:00') : null;
    const semanaCreated = getWeekNumber(createdAt);
    const semanaVisita = dataVisita ? getWeekNumber(dataVisita) : null;

    console.log(`   ${idx + 1}. ID: ${r.id}`);
    console.log(`      created_at: ${r.created_at} (Semana ${semanaCreated})`);
    console.log(`      data_visita: ${r.data_visita || 'NULL'} ${dataVisita ? `(Semana ${semanaVisita})` : ''}`);
    console.log(`      NPS: ${r.nps} | Tipo: ${r.search_name || 'NULL'}`);
    console.log('');
  });

  // 2. Buscar dados agregados
  console.log('\n📊 2. Dados agregados (nps_falae_diario):');
  const { data: agregados, error: errAgregados } = await supabase
    .from('nps_falae_diario')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lte('data_referencia', '2026-04-05')
    .order('data_referencia');

  if (errAgregados) {
    console.error('❌ Erro:', errAgregados);
    return;
  }

  console.log(`   Total de dias: ${agregados?.length || 0}\n`);

  agregados?.forEach(a => {
    const data = new Date(a.data_referencia + 'T00:00:00');
    const semana = getWeekNumber(data);
    console.log(`   ${a.data_referencia} (Semana ${semana}):`);
    console.log(`      Respostas: ${a.respostas_total}`);
    console.log(`      P:${a.promotores} N:${a.neutros} D:${a.detratores}`);
    console.log(`      NPS: ${a.nps_score} | Média: ${a.nps_media}`);
    console.log('');
  });

  // 3. Verificar se há respostas com data_visita diferente de created_at
  console.log('\n⚠️  3. Análise de data_visita vs created_at:');
  const respostasComDataDiferente = respostas?.filter(r => {
    if (!r.data_visita) return false;
    const createdDate = r.created_at.split('T')[0];
    return r.data_visita !== createdDate;
  });

  console.log(`   Respostas com data_visita diferente: ${respostasComDataDiferente?.length || 0}`);
  respostasComDataDiferente?.forEach(r => {
    console.log(`      ID ${r.id}: created_at=${r.created_at.split('T')[0]} | data_visita=${r.data_visita}`);
  });

  // 4. Verificar respostas que estão sendo incluídas no agregado mas não deveriam
  console.log('\n🔎 4. Verificando respostas fora do período (created_at):');
  const { data: respostasForaPeriodo, error: errFora } = await supabase
    .from('falae_respostas')
    .select('id, created_at, data_visita, nps')
    .eq('bar_id', barId)
    .or(`data_visita.gte.2026-03-30,data_visita.lte.2026-04-05`)
    .not('created_at', 'gte', '2026-03-30T00:00:00')
    .not('created_at', 'lte', '2026-04-05T23:59:59');

  if (!errFora && respostasForaPeriodo && respostasForaPeriodo.length > 0) {
    console.log(`   ⚠️  Encontradas ${respostasForaPeriodo.length} respostas fora do período (created_at):`);
    respostasForaPeriodo.forEach(r => {
      console.log(`      ID ${r.id}: created_at=${r.created_at} | data_visita=${r.data_visita} | NPS=${r.nps}`);
    });
  } else {
    console.log('   ✅ Nenhuma resposta fora do período');
  }

  console.log('\n✅ Debug concluído!');
}

debugNpsSemana14().catch(console.error);
