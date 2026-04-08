/**
 * Script para verificar NPS da semana 14 (30.03 - 05.04)
 * Comparar dados do Falae (50) vs Zykor (46)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Semana ISO
function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function verificarNpsSemana14() {
  console.log('🔍 Verificando NPS da Semana 14 (30.03 - 05.04)...\n');

  // 0. Verificar bars disponíveis
  console.log('🏢 0. Verificando bars disponíveis:');
  const { data: bars, error: errBars } = await supabase
    .from('bares')
    .select('id, nome');

  if (errBars) {
    console.error('❌ Erro ao buscar bars:', errBars);
    return;
  }

  console.log(`   Bars encontrados: ${bars?.length || 0}`);
  bars?.forEach(b => console.log(`   - ID ${b.id}: ${b.nome}`));
  console.log('');

  // Usar o Ordinário Bar (ID: 3) que tem os dados
  const barId = 3;
  const barNome = bars?.find(b => b.id === barId)?.nome || 'Ordinário Bar';
  console.log(`📍 Usando bar ID: ${barId} (${barNome})\n`);

  // 0.1 Verificar últimas respostas do Falae (qualquer data)
  console.log('🕐 0.1. Verificando últimas respostas do Falae:');
  const { data: ultimasRespostas, error: errUltimas } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (errUltimas) {
    console.error('❌ Erro ao buscar últimas respostas:', errUltimas);
  } else {
    console.log(`   Total de respostas recentes: ${ultimasRespostas?.length || 0}`);
    if (ultimasRespostas && ultimasRespostas.length > 0) {
      console.log(`   Última resposta: ${ultimasRespostas[0].created_at} (NPS: ${ultimasRespostas[0].nps})`);
      console.log(`   Primeira resposta: ${ultimasRespostas[ultimasRespostas.length - 1].created_at}`);
    } else {
      console.log('   ⚠️  Nenhuma resposta encontrada no banco!');
    }
  }

  // 0.2 Verificar todas as respostas de março/abril 2026
  console.log('\n📅 0.2. Verificando todas as respostas de março/abril 2026:');
  const { data: todasRespostas, error: errTodas } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-01T00:00:00')
    .lte('created_at', '2026-04-30T23:59:59')
    .order('created_at', { ascending: true });

  if (errTodas) {
    console.error('❌ Erro ao buscar todas as respostas:', errTodas);
  } else {
    console.log(`   Total de respostas março/abril: ${todasRespostas?.length || 0}`);
    if (todasRespostas && todasRespostas.length > 0) {
      // Agrupar por semana
      const semanas = new Map<string, { respostas: number; promotores: number; detratores: number; neutros: number }>();
      todasRespostas.forEach(r => {
        const data = new Date(r.created_at);
        const semana = getWeekNumber(data);
        const ano = data.getFullYear();
        const key = `Semana ${semana}/${ano}`;
        
        if (!semanas.has(key)) {
          semanas.set(key, { respostas: 0, promotores: 0, detratores: 0, neutros: 0 });
        }
        const s = semanas.get(key)!;
        s.respostas++;
        const nps = Number(r.nps) || 0;
        if (nps >= 9) s.promotores++;
        else if (nps >= 7) s.neutros++;
        else s.detratores++;
      });

      semanas.forEach((v, k) => {
        const npsScore = v.respostas > 0
          ? Math.round((((v.promotores - v.detratores) / v.respostas) * 100) * 10) / 10
          : 0;
        console.log(`   ${k}: ${v.respostas} respostas | P:${v.promotores} N:${v.neutros} D:${v.detratores} | NPS: ${npsScore}`);
      });
    }
  }
  console.log('');

  // 1. Verificar dados diários do nps_falae_diario
  console.log('📊 1. Dados diários (nps_falae_diario):');
  const { data: dadosDiarios, error: errDiarios } = await supabase
    .from('nps_falae_diario')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lte('data_referencia', '2026-04-05')
    .order('data_referencia');

  if (errDiarios) {
    console.error('❌ Erro ao buscar dados diários:', errDiarios);
    return;
  }

  console.log(`   Total de dias: ${dadosDiarios?.length || 0}`);
  dadosDiarios?.forEach(d => {
    const npsScore = d.respostas_total > 0
      ? Math.round((((d.promotores - d.detratores) / d.respostas_total) * 100) * 10) / 10
      : 0;
    console.log(`   ${d.data_referencia}: ${d.respostas_total} respostas | P:${d.promotores} N:${d.neutros} D:${d.detratores} | NPS: ${npsScore} | Média: ${d.nps_media}`);
  });

  // 2. Calcular agregação semanal (como no desempenho-service.ts)
  console.log('\n📈 2. Agregação Semanal (cálculo do Zykor):');
  let totalRespostas = 0;
  let totalPromotores = 0;
  let totalDetratores = 0;
  let mediaPonderada = 0;

  dadosDiarios?.forEach(d => {
    const respostas = Number(d.respostas_total) || 0;
    totalRespostas += respostas;
    totalPromotores += Number(d.promotores) || 0;
    totalDetratores += Number(d.detratores) || 0;
    mediaPonderada += (Number(d.nps_media) || 0) * respostas;
  });

  const totalNeutros = Math.max(0, totalRespostas - totalPromotores - totalDetratores);
  const npsScore = totalRespostas > 0
    ? Math.round((((totalPromotores - totalDetratores) / totalRespostas) * 100) * 10) / 10
    : 0;
  const npsMedia = totalRespostas > 0
    ? Math.round((mediaPonderada / totalRespostas) * 10) / 10
    : 0;

  console.log(`   Total de Respostas: ${totalRespostas}`);
  console.log(`   Promotores: ${totalPromotores} (${totalRespostas > 0 ? ((totalPromotores / totalRespostas) * 100).toFixed(1) : 0}%)`);
  console.log(`   Neutros: ${totalNeutros} (${totalRespostas > 0 ? ((totalNeutros / totalRespostas) * 100).toFixed(1) : 0}%)`);
  console.log(`   Detratores: ${totalDetratores} (${totalRespostas > 0 ? ((totalDetratores / totalRespostas) * 100).toFixed(1) : 0}%)`);
  console.log(`   NPS Score: ${npsScore}`);
  console.log(`   NPS Média: ${npsMedia}`);

  // 3. Verificar dados brutos do falae_respostas
  console.log('\n📝 3. Dados brutos (falae_respostas):');
  const { data: respostasBrutas, error: errBrutas } = await supabase
    .from('falae_respostas')
    .select('id, created_at, nps, search_name')
    .eq('bar_id', barId)
    .gte('created_at', '2026-03-30T00:00:00')
    .lte('created_at', '2026-04-05T23:59:59')
    .order('created_at');

  if (errBrutas) {
    console.error('❌ Erro ao buscar respostas brutas:', errBrutas);
    return;
  }

  console.log(`   Total de respostas brutas: ${respostasBrutas?.length || 0}`);
  
  let brutosPromotores = 0;
  let brutosNeutros = 0;
  let brutosDetratores = 0;
  let somaNotas = 0;

  respostasBrutas?.forEach(r => {
    const nps = Number(r.nps) || 0;
    somaNotas += nps;
    if (nps >= 9) brutosPromotores++;
    else if (nps >= 7) brutosNeutros++;
    else brutosDetratores++;
  });

  const totalBrutas = respostasBrutas?.length || 0;
  const npsScoreBruto = totalBrutas > 0
    ? Math.round((((brutosPromotores - brutosDetratores) / totalBrutas) * 100) * 10) / 10
    : 0;
  const npsMediaBruta = totalBrutas > 0
    ? Math.round((somaNotas / totalBrutas) * 10) / 10
    : 0;

  console.log(`   Promotores (NPS 9-10): ${brutosPromotores} (${totalBrutas > 0 ? ((brutosPromotores / totalBrutas) * 100).toFixed(1) : 0}%)`);
  console.log(`   Neutros (NPS 7-8): ${brutosNeutros} (${totalBrutas > 0 ? ((brutosNeutros / totalBrutas) * 100).toFixed(1) : 0}%)`);
  console.log(`   Detratores (NPS 0-6): ${brutosDetratores} (${totalBrutas > 0 ? ((brutosDetratores / totalBrutas) * 100).toFixed(1) : 0}%)`);
  console.log(`   NPS Score: ${npsScoreBruto}`);
  console.log(`   NPS Média: ${npsMediaBruta}`);

  // 4. Comparação
  console.log('\n🔎 4. Comparação:');
  console.log(`   Falae (esperado): NPS 50`);
  console.log(`   Zykor (agregado): NPS ${npsScore}`);
  console.log(`   Bruto (calculado): NPS ${npsScoreBruto}`);
  console.log(`   Diferença Falae vs Zykor: ${50 - npsScore}`);
  console.log(`   Diferença Falae vs Bruto: ${50 - npsScoreBruto}`);

  // 5. Verificar se há diferença entre dados diários e brutos
  console.log('\n⚠️  5. Análise de Discrepâncias:');
  if (totalRespostas !== totalBrutas) {
    console.log(`   ❌ PROBLEMA: Total de respostas não bate!`);
    console.log(`      - nps_falae_diario: ${totalRespostas} respostas`);
    console.log(`      - falae_respostas: ${totalBrutas} respostas`);
    console.log(`      - Diferença: ${Math.abs(totalRespostas - totalBrutas)} respostas`);
  }

  if (totalPromotores !== brutosPromotores || totalDetratores !== brutosDetratores) {
    console.log(`   ❌ PROBLEMA: Classificação de promotores/detratores não bate!`);
    console.log(`      - nps_falae_diario: P:${totalPromotores} N:${totalNeutros} D:${totalDetratores}`);
    console.log(`      - falae_respostas: P:${brutosPromotores} N:${brutosNeutros} D:${brutosDetratores}`);
  }

  if (Math.abs(npsScore - npsScoreBruto) > 0.5) {
    console.log(`   ❌ PROBLEMA: NPS calculado difere entre agregado e bruto!`);
    console.log(`      - Diferença: ${Math.abs(npsScore - npsScoreBruto).toFixed(1)} pontos`);
  }

  // 6. Verificar nps_falae_diario_pesquisa
  console.log('\n📋 6. Dados por tipo de pesquisa (nps_falae_diario_pesquisa):');
  const { data: dadosPesquisa, error: errPesquisa } = await supabase
    .from('nps_falae_diario_pesquisa')
    .select('*')
    .eq('bar_id', barId)
    .gte('data_referencia', '2026-03-30')
    .lte('data_referencia', '2026-04-05')
    .order('search_name', { ascending: true })
    .order('data_referencia', { ascending: true });

  if (errPesquisa) {
    console.error('❌ Erro ao buscar dados por pesquisa:', errPesquisa);
  } else {
    const pesquisaMap = new Map<string, { respostas: number; promotores: number; neutros: number; detratores: number }>();
    
    dadosPesquisa?.forEach(d => {
      const key = d.search_name || 'Sem Pesquisa';
      if (!pesquisaMap.has(key)) {
        pesquisaMap.set(key, { respostas: 0, promotores: 0, neutros: 0, detratores: 0 });
      }
      const p = pesquisaMap.get(key)!;
      p.respostas += Number(d.respostas_total) || 0;
      p.promotores += Number(d.promotores) || 0;
      p.neutros += Number(d.neutros) || 0;
      p.detratores += Number(d.detratores) || 0;
    });

    pesquisaMap.forEach((v, k) => {
      const nps = v.respostas > 0
        ? Math.round((((v.promotores - v.detratores) / v.respostas) * 100) * 10) / 10
        : 0;
      console.log(`   ${k}: ${v.respostas} respostas | P:${v.promotores} N:${v.neutros} D:${v.detratores} | NPS: ${nps}`);
    });
  }

  console.log('\n✅ Verificação concluída!');
}

verificarNpsSemana14().catch(console.error);
