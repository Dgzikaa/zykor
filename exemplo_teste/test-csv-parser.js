/**
 * Testar parser do CSV Sympla
 */

const fs = require('fs');
const path = require('path');

// Encontrar o arquivo CSV
const csvFile = fs.readdirSync('./exemplo_teste')
  .find(f => f.endsWith('.csv'));

if (!csvFile) {
  console.log('❌ Nenhum arquivo CSV encontrado em exemplo_teste/');
  process.exit(1);
}

console.log(`📄 Lendo arquivo: ${csvFile}\n`);

const text = fs.readFileSync(`./exemplo_teste/${csvFile}`, 'utf8');
const lines = text.split('\n').filter(line => line.trim());

console.log(`📊 Total de linhas: ${lines.length}\n`);

// Encontrar cabeçalho
let headerIndex = -1;
for (let i = 0; i < Math.min(20, lines.length); i++) {
  if (lines[i].includes('ingresso') || lines[i].includes('N? ingresso')) {
    headerIndex = i;
    break;
  }
}

if (headerIndex === -1) {
  console.log('❌ Cabeçalho não encontrado!');
  process.exit(1);
}

console.log(`✅ Cabeçalho encontrado na linha ${headerIndex + 1}\n`);

const header = lines[headerIndex].split(';');
const rows = lines.slice(headerIndex + 1);

console.log('📋 COLUNAS ENCONTRADAS:');
header.forEach((col, i) => {
  if (col.trim()) {
    console.log(`   ${i}: ${col}`);
  }
});

// Mapear colunas
const colIndexes = {
  numeroIngresso: header.findIndex(h => 
    h.includes('ingresso') && !h.includes('Tipo')
  ),
  tipoIngresso: header.findIndex(h => h.includes('Tipo de ingresso')),
  statusCheckin: header.findIndex(h => h.includes('Check-in') && !h.includes('Data')),
  dataCheckin: header.findIndex(h => h.includes('Data Check-in')),
  nome: header.findIndex(h => h === 'Nome'),
  sobrenome: header.findIndex(h => h === 'Sobrenome'),
  email: header.findIndex(h => h === 'Email' || h === 'E-mail'),
};

console.log('\n🔍 ÍNDICES DAS COLUNAS:');
Object.entries(colIndexes).forEach(([key, index]) => {
  console.log(`   ${key}: ${index} ${index >= 0 ? '✅' : '❌'}`);
});

// Processar linhas
console.log('\n📊 PROCESSANDO LINHAS...\n');

let totalComCheckin = 0;
let totalSemCheckin = 0;
const porTipo = {};

rows.forEach((row, i) => {
  const cols = row.split(';');
  
  const numeroIngresso = cols[colIndexes.numeroIngresso]?.trim();
  const tipoIngresso = cols[colIndexes.tipoIngresso]?.trim();
  const statusCheckin = cols[colIndexes.statusCheckin]?.trim().toLowerCase();
  const dataCheckin = cols[colIndexes.dataCheckin]?.trim();

  if (!numeroIngresso) return;

  const fezCheckin = statusCheckin === 'sim' || 
                     statusCheckin === 'confirmado' || 
                     statusCheckin === 'checked in';

  if (fezCheckin) {
    totalComCheckin++;
  } else {
    totalSemCheckin++;
  }

  // Agrupar por tipo
  if (!porTipo[tipoIngresso]) {
    porTipo[tipoIngresso] = { total: 0, checkins: 0 };
  }
  porTipo[tipoIngresso].total++;
  if (fezCheckin) {
    porTipo[tipoIngresso].checkins++;
  }

  // Mostrar primeiros 3
  if (i < 3) {
    console.log(`Linha ${i + 1}:`);
    console.log(`   Ingresso: ${numeroIngresso}`);
    console.log(`   Tipo: ${tipoIngresso}`);
    console.log(`   Status: ${statusCheckin}`);
    console.log(`   Fez checkin? ${fezCheckin ? 'SIM' : 'NÃO'}`);
    if (dataCheckin) {
      console.log(`   Data: ${dataCheckin}`);
    }
    console.log('');
  }
});

console.log('='.repeat(60));
console.log('📊 RESULTADO FINAL');
console.log('='.repeat(60));
console.log(`Total de participantes: ${rows.length}`);
console.log(`Com checkin: ${totalComCheckin}`);
console.log(`Sem checkin: ${totalSemCheckin}`);

console.log('\n📋 POR TIPO DE INGRESSO:');
Object.entries(porTipo)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([tipo, stats]) => {
    console.log(`\n${tipo}:`);
    console.log(`   Total: ${stats.total}`);
    console.log(`   Checkins: ${stats.checkins}`);
    console.log(`   % checkin: ${(stats.checkins / stats.total * 100).toFixed(1)}%`);
  });

console.log('\n' + '='.repeat(60));
console.log('✅ Teste concluído!');
console.log('='.repeat(60));
