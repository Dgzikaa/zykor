/**
 * Script para atualizar desempenho_semanal com dados do Falaê
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

function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

async function atualizarSemana(barId: number, numeroSemana: number, ano: number) {
  console.log(`\n📊 Atualizando semana ${numeroSemana}/${ano} para bar ${barId}...`);

  // 1. Buscar dados de nps_falae_diario
  const { data: falaeDiario, error: errFalae } = await supabase
    .from('nps_falae_diario')
    .select('data_referencia, respostas_total, promotores, neutros, detratores, nps_media')
    .eq('bar_id', barId);

  if (errFalae) {
    console.error('   ❌ Erro ao buscar nps_falae_diario:', errFalae);
    return { success: false };
  }

  // 2. Agrupar por semana
  const porSemana = new Map<string, {
    respostas: number;
    promotores: number;
    detratores: number;
    neutros: number;
  }>();

  for (const d of falaeDiario || []) {
    const data = new Date(`${d.data_referencia}T12:00:00`);
    const { semana, ano: anoCalc } = getWeekAndYear(data);
    const key = `${anoCalc}-${semana}`;

    if (!porSemana.has(key)) {
      porSemana.set(key, { respostas: 0, promotores: 0, detratores: 0, neutros: 0 });
    }

    const bucket = porSemana.get(key)!;
    bucket.respostas += Number(d.respostas_total) || 0;
    bucket.promotores += Number(d.promotores) || 0;
    bucket.detratores += Number(d.detratores) || 0;
    bucket.neutros += Number(d.neutros) || 0;
  }

  const key = `${ano}-${numeroSemana}`;
  const dados = porSemana.get(key);

  if (!dados || dados.respostas === 0) {
    console.log(`   ⚠️  Nenhum dado encontrado para semana ${numeroSemana}/${ano}`);
    return { success: true, respostas: 0 };
  }

  const npsScore = dados.respostas > 0
    ? Math.round(((dados.promotores - dados.detratores) / dados.respostas) * 100)
    : null;

  console.log(`   📈 Dados calculados:`);
  console.log(`      Respostas: ${dados.respostas}`);
  console.log(`      Promotores: ${dados.promotores}`);
  console.log(`      Detratores: ${dados.detratores}`);
  console.log(`      NPS Score: ${npsScore}`);

  // 3. Atualizar desempenho_semanal
  const { error: errUpdate } = await supabase
    .from('desempenho_semanal')
    .update({
      nps_digital_respostas: dados.respostas,
      nps_digital: npsScore,
      atualizado_em: new Date().toISOString(),
      atualizado_por: 'system',
      atualizado_por_nome: 'Sync Automático Falaê',
    })
    .eq('bar_id', barId)
    .eq('ano', ano)
    .eq('numero_semana', numeroSemana);

  if (errUpdate) {
    console.error('   ❌ Erro ao atualizar desempenho_semanal:', errUpdate);
    return { success: false, error: errUpdate };
  }

  console.log(`   ✅ desempenho_semanal atualizado!`);
  return { success: true, respostas: dados.respostas, nps: npsScore };
}

async function main() {
  console.log('🚀 Atualizando desempenho_semanal com dados do Falaê...\n');

  const barIdArg = process.argv[2];
  const semanaArg = process.argv[3];
  const anoArg = process.argv[4];

  if (barIdArg && semanaArg && anoArg) {
    // Atualizar semana específica
    const barId = parseInt(barIdArg, 10);
    const semana = parseInt(semanaArg, 10);
    const ano = parseInt(anoArg, 10);

    const result = await atualizarSemana(barId, semana, ano);
    process.exit(result.success ? 0 : 1);
  } else {
    // Atualizar semana atual e anterior para todos os bares
    const hoje = new Date();
    const { semana: semanaAtual, ano: anoAtual } = getWeekAndYear(hoje);
    const semanaAnterior = semanaAtual - 1;

    const { data: bares } = await supabase
      .from('api_credentials')
      .select('bar_id')
      .eq('sistema', 'falae')
      .eq('ativo', true);

    const barIds = [...new Set((bares || []).map(b => b.bar_id))];

    console.log(`📅 Atualizando semanas ${semanaAnterior} e ${semanaAtual} de ${anoAtual}`);
    console.log(`🏪 Bares: ${barIds.join(', ')}\n`);

    for (const barId of barIds) {
      await atualizarSemana(barId, semanaAnterior, anoAtual);
      await atualizarSemana(barId, semanaAtual, anoAtual);
    }

    console.log('\n🎉 Atualização concluída!');
    process.exit(0);
  }
}

main();
