/**
 * Script para validar inconsistências nos dados do Falaê
 * 
 * Uso:
 * npx tsx scripts/validar-falae-inconsistencias.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas');
  console.error('   Certifique-se de que frontend/.env.local existe e contém:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ValidationResult {
  check: string;
  status: 'OK' | 'WARNING' | 'ERROR';
  details: string;
  count?: number;
  percentage?: number;
}

const results: ValidationResult[] = [];

async function validarCredenciais() {
  console.log('\n🔐 Validando Credenciais...');
  
  const { data, error } = await supabase
    .from('api_credentials')
    .select('bar_id, sistema, empresa_id, ativo, atualizado_em')
    .eq('sistema', 'falae');

  if (error) {
    results.push({
      check: 'Credenciais Falaê',
      status: 'ERROR',
      details: `Erro ao buscar: ${error.message}`
    });
    return;
  }

  const ativas = data?.filter(c => c.ativo) || [];
  const inativas = data?.filter(c => !c.ativo) || [];

  results.push({
    check: 'Credenciais Falaê Ativas',
    status: ativas.length > 0 ? 'OK' : 'WARNING',
    details: `${ativas.length} ativas, ${inativas.length} inativas`,
    count: ativas.length
  });

  console.log(`  ✅ ${ativas.length} credenciais ativas`);
  console.log(`  ⚠️  ${inativas.length} credenciais inativas`);
}

async function validarCamposNulos() {
  console.log('\n📋 Validando Campos Nulos...');

  const { data, error } = await supabase
    .from('falae_respostas')
    .select('client_name, client_email, client_phone, data_visita, discursive_question');

  if (error) {
    results.push({
      check: 'Campos Nulos',
      status: 'ERROR',
      details: `Erro ao buscar: ${error.message}`
    });
    return;
  }

  const total = data?.length || 0;
  if (total === 0) {
    results.push({
      check: 'Dados Falaê',
      status: 'WARNING',
      details: 'Nenhuma resposta encontrada no banco'
    });
    return;
  }

  const clientNameNull = data?.filter(r => !r.client_name).length || 0;
  const clientEmailNull = data?.filter(r => !r.client_email).length || 0;
  const clientPhoneNull = data?.filter(r => !r.client_phone).length || 0;
  const dataVisitaNull = data?.filter(r => !r.data_visita).length || 0;
  const comentarioNull = data?.filter(r => !r.discursive_question).length || 0;

  const checks = [
    { field: 'client_name', nullCount: clientNameNull },
    { field: 'client_email', nullCount: clientEmailNull },
    { field: 'client_phone', nullCount: clientPhoneNull },
    { field: 'data_visita', nullCount: dataVisitaNull },
    { field: 'comentario', nullCount: comentarioNull }
  ];

  for (const check of checks) {
    const percentage = Math.round((check.nullCount / total) * 100);
    const status = percentage > 90 ? 'WARNING' : percentage > 50 ? 'WARNING' : 'OK';
    
    results.push({
      check: `Campo ${check.field}`,
      status,
      details: `${check.nullCount}/${total} nulos (${percentage}%)`,
      count: check.nullCount,
      percentage
    });

    const emoji = percentage > 90 ? '⚠️' : percentage > 50 ? '⚠️' : '✅';
    console.log(`  ${emoji} ${check.field}: ${percentage}% nulos (${check.nullCount}/${total})`);
  }
}

async function validarDataReferencia() {
  console.log('\n📅 Validando Data de Referência...');

  const { data, error } = await supabase
    .from('falae_respostas')
    .select('created_at, data_visita');

  if (error) {
    results.push({
      check: 'Data de Referência',
      status: 'ERROR',
      details: `Erro ao buscar: ${error.message}`
    });
    return;
  }

  const total = data?.length || 0;
  let divergencias = 0;

  for (const row of data || []) {
    const createdDate = row.created_at?.split('T')[0];
    const visitaDate = row.data_visita;

    if (visitaDate && createdDate && visitaDate !== createdDate) {
      divergencias++;
    }
  }

  const percentage = total > 0 ? Math.round((divergencias / total) * 100) : 0;
  
  results.push({
    check: 'Divergência created_at vs data_visita',
    status: percentage > 20 ? 'WARNING' : 'OK',
    details: `${divergencias}/${total} registros (${percentage}%)`,
    count: divergencias,
    percentage
  });

  console.log(`  ${percentage > 20 ? '⚠️' : '✅'} ${divergencias} divergências (${percentage}%)`);
  console.log(`  💡 Isso é normal: clientes respondem dias depois da visita`);
}

async function validarAgregacoes() {
  console.log('\n📊 Validando Agregações...');

  // Total de respostas brutas
  const { data: respostas, error: errRespostas } = await supabase
    .from('falae_respostas')
    .select('bar_id, created_at, data_visita')
    .gte('created_at', '2026-03-01');

  if (errRespostas) {
    results.push({
      check: 'Agregações',
      status: 'ERROR',
      details: `Erro ao buscar respostas: ${errRespostas.message}`
    });
    return;
  }

  // Total agregado
  const { data: agregado, error: errAgregado } = await supabase
    .from('nps_falae_diario')
    .select('respostas_total')
    .gte('data_referencia', '2026-03-01');

  if (errAgregado) {
    results.push({
      check: 'Agregações',
      status: 'ERROR',
      details: `Erro ao buscar agregações: ${errAgregado.message}`
    });
    return;
  }

  const totalRespostas = respostas?.length || 0;
  const totalAgregado = agregado?.reduce((sum, r) => sum + (r.respostas_total || 0), 0) || 0;
  const diferenca = Math.abs(totalRespostas - totalAgregado);
  const percentualDif = totalRespostas > 0 ? Math.round((diferenca / totalRespostas) * 100) : 0;

  results.push({
    check: 'Consistência Agregações',
    status: percentualDif > 5 ? 'WARNING' : 'OK',
    details: `Respostas: ${totalRespostas}, Agregado: ${totalAgregado}, Dif: ${diferenca} (${percentualDif}%)`,
    count: diferenca,
    percentage: percentualDif
  });

  console.log(`  Total de respostas brutas: ${totalRespostas}`);
  console.log(`  Total agregado: ${totalAgregado}`);
  console.log(`  Diferença: ${diferenca} (${percentualDif}%)`);
  
  if (percentualDif > 5) {
    console.log(`  ⚠️  Diferença maior que 5% - verificar recálculo`);
  } else {
    console.log(`  ✅ Agregações consistentes`);
  }
}

async function validarCriterios() {
  console.log('\n🎯 Validando Critérios...');

  const { data, error } = await supabase
    .from('falae_respostas')
    .select('criterios')
    .not('criterios', 'is', null);

  if (error) {
    results.push({
      check: 'Critérios',
      status: 'ERROR',
      details: `Erro ao buscar: ${error.message}`
    });
    return;
  }

  const total = data?.length || 0;
  let comRating = 0;
  let comData = 0;
  let comAtendente = 0;
  const criteriosUnicos = new Set<string>();

  for (const row of data || []) {
    const criterios = row.criterios as any[];
    if (!Array.isArray(criterios)) continue;

    for (const c of criterios) {
      criteriosUnicos.add(c.nick || 'Sem nome');
      
      if (c.type === 'Rating') comRating++;
      if (c.type === 'Data') comData++;
      if (c.type === 'Atendente') comAtendente++;
    }
  }

  results.push({
    check: 'Critérios Válidos',
    status: 'OK',
    details: `${total} respostas com critérios, ${criteriosUnicos.size} tipos únicos`,
    count: total
  });

  console.log(`  ✅ ${total} respostas com critérios`);
  console.log(`  📊 Tipos encontrados:`);
  console.log(`     - Rating: ${comRating}`);
  console.log(`     - Data: ${comData}`);
  console.log(`     - Atendente: ${comAtendente}`);
  console.log(`  📝 Critérios únicos: ${criteriosUnicos.size}`);
  console.log(`     ${Array.from(criteriosUnicos).slice(0, 10).join(', ')}${criteriosUnicos.size > 10 ? '...' : ''}`);
}

async function validarNPS() {
  console.log('\n🎯 Validando Cálculo de NPS...');

  const { data, error } = await supabase
    .from('falae_respostas')
    .select('nps');

  if (error) {
    results.push({
      check: 'Cálculo NPS',
      status: 'ERROR',
      details: `Erro ao buscar: ${error.message}`
    });
    return;
  }

  const total = data?.length || 0;
  const promotores = data?.filter(r => r.nps >= 9).length || 0;
  const neutros = data?.filter(r => r.nps >= 7 && r.nps <= 8).length || 0;
  const detratores = data?.filter(r => r.nps <= 6).length || 0;
  const invalidos = data?.filter(r => r.nps < 0 || r.nps > 10).length || 0;

  const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0;

  results.push({
    check: 'Distribuição NPS',
    status: invalidos > 0 ? 'WARNING' : 'OK',
    details: `Score: ${npsScore}, P: ${promotores}, N: ${neutros}, D: ${detratores}, Inválidos: ${invalidos}`,
    count: total
  });

  console.log(`  📊 Total de respostas: ${total}`);
  console.log(`  🟢 Promotores (9-10): ${promotores} (${Math.round((promotores/total)*100)}%)`);
  console.log(`  🟡 Neutros (7-8): ${neutros} (${Math.round((neutros/total)*100)}%)`);
  console.log(`  🔴 Detratores (0-6): ${detratores} (${Math.round((detratores/total)*100)}%)`);
  console.log(`  📈 NPS Score: ${npsScore}`);
  
  if (invalidos > 0) {
    console.log(`  ⚠️  ${invalidos} respostas com NPS inválido (fora de 0-10)`);
  }
}

async function gerarRelatorio() {
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('📋 RELATÓRIO DE VALIDAÇÃO - API FALAÊ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const erros = results.filter(r => r.status === 'ERROR');
  const warnings = results.filter(r => r.status === 'WARNING');
  const oks = results.filter(r => r.status === 'OK');

  console.log(`✅ Checks OK: ${oks.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Erros: ${erros.length}`);

  if (erros.length > 0) {
    console.log('\n❌ ERROS CRÍTICOS:');
    for (const err of erros) {
      console.log(`  • ${err.check}: ${err.details}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  ATENÇÕES:');
    for (const warn of warnings) {
      console.log(`  • ${warn.check}: ${warn.details}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📄 Relatório completo salvo em: .cursor/DIAGNOSTICO-API-FALAE.md');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Salvar resultados em JSON
  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(process.cwd(), '.cursor', 'falae-validation-results.json');
  
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      ok: oks.length,
      warnings: warnings.length,
      errors: erros.length
    },
    results
  }, null, 2));

  console.log(`💾 Resultados JSON salvos em: ${outputPath}\n`);
}

async function main() {
  console.log('🚀 Iniciando validação de dados do Falaê...\n');

  try {
    await validarCredenciais();
    await validarCamposNulos();
    await validarDataReferencia();
    await validarAgregacoes();
    await validarCriterios();
    await validarNPS();
    await gerarRelatorio();

    const hasErrors = results.some(r => r.status === 'ERROR');
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Erro fatal durante validação:', error);
    process.exit(1);
  }
}

main();
