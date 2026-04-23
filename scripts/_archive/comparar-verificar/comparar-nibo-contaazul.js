/**
 * Script para comparar dados do Nibo vs Conta Azul mês a mês
 */

require('dotenv').config({ path: './frontend/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function compararMesAMes(barId) {
  console.log(`\n📊 Comparação Nibo vs Conta Azul - Bar ${barId}\n`);
  console.log('='.repeat(100));
  console.log('| Mês         | Nibo Qtd | Nibo Valor    | CA Qtd  | CA Valor      | Diferença Valor | Status |');
  console.log('='.repeat(100));

  // Gerar lista de meses dos últimos 24 meses
  const meses = [];
  const hoje = new Date();
  
  for (let i = 0; i < 24; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    meses.push({ mes });
  }

  const comparacoes = [];

  for (const mesRow of meses) {
    const mes = mesRow.mes;
    
    // Dados do Nibo (excluindo transferências)
    const { data: niboData } = await supabase
      .from('nibo_agendamentos')
      .select('valor, descricao')
      .eq('bar_id', barId)
      .gte('data_competencia', `${mes}-01`)
      .lte('data_competencia', `${mes}-31`);

    // Filtrar transferências e aplicações
    const niboFiltrado = niboData?.filter(item => {
      const desc = (item.descricao || '').toLowerCase();
      return !desc.includes('transferência') && !desc.includes('aplicação');
    }) || [];

    const niboQtd = niboFiltrado.length;
    // Nibo armazena valores em centavos, então dividimos por 100
    const niboValor = niboFiltrado.reduce((sum, item) => sum + (parseFloat(item.valor || 0) / 100), 0);

    // Dados do Conta Azul
    const { data: caData } = await supabase
      .from('contaazul_lancamentos')
      .select('valor_bruto')
      .eq('bar_id', barId)
      .gte('data_competencia', `${mes}-01`)
      .lte('data_competencia', `${mes}-31`);

    const caQtd = caData?.length || 0;
    const caValor = caData?.reduce((sum, item) => sum + parseFloat(item.valor_bruto || 0), 0) || 0;

    const diferenca = Math.abs(niboValor - caValor);
    const percentualDif = niboValor > 0 ? (diferenca / niboValor * 100) : 0;
    
    let status = '✅';
    if (caQtd === 0 && niboQtd > 0) status = '❌ CA vazio';
    else if (niboQtd === 0 && caQtd > 0) status = '⚠️ Nibo vazio';
    else if (percentualDif > 10) status = '⚠️ Diferença >10%';
    else if (percentualDif > 1) status = '⚠️ Pequena dif';

    comparacoes.push({
      mes,
      niboQtd,
      niboValor,
      caQtd,
      caValor,
      diferenca,
      percentualDif,
      status
    });

    const formatValor = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    console.log(
      `| ${mes}    | ${String(niboQtd).padStart(8)} | ${formatValor(niboValor).padStart(13)} | ${String(caQtd).padStart(7)} | ${formatValor(caValor).padStart(13)} | ${formatValor(diferenca).padStart(15)} | ${status.padEnd(6)} |`
    );
  }

  console.log('='.repeat(100));

  // Resumo
  const totalNibo = comparacoes.reduce((sum, c) => sum + c.niboValor, 0);
  const totalCA = comparacoes.reduce((sum, c) => sum + c.caValor, 0);
  const diferencaTotal = Math.abs(totalNibo - totalCA);

  console.log(`\n📊 TOTAIS:`);
  console.log(`   Nibo:       ${comparacoes.reduce((sum, c) => sum + c.niboQtd, 0)} lançamentos = R$ ${totalNibo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Conta Azul: ${comparacoes.reduce((sum, c) => sum + c.caQtd, 0)} lançamentos = R$ ${totalCA.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença:  R$ ${diferencaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${((diferencaTotal / totalNibo) * 100).toFixed(2)}%)`);

  // Análise
  const mesesProblema = comparacoes.filter(c => c.status.includes('❌') || c.status.includes('⚠️'));
  
  if (mesesProblema.length === 0) {
    console.log('\n✅ Todos os meses estão consistentes!');
  } else {
    console.log(`\n⚠️  ${mesesProblema.length} meses com problemas:`);
    mesesProblema.forEach(m => {
      console.log(`   - ${m.mes}: ${m.status}`);
    });
  }
}

async function main() {
  const barId = process.argv[2] ? parseInt(process.argv[2]) : 3;
  await compararMesAMes(barId);
}

main().catch(console.error);
