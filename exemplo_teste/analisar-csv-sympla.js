/**
 * Script para analisar CSV do Sympla
 */

const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'Lista de participantes - 13.02Sex_Abre_Alas_com_Samba_da_Tia_Zlia__Convidados__Carna_Vira-Lata__Ordinrio_Bar__Msica (3288882).csv');

console.log('📄 Lendo CSV do Sympla...\n');

const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

console.log(`Total de linhas: ${lines.length}`);

// Encontrar a linha do cabeçalho
let headerIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Ordem de inscri') || lines[i].includes('N° ingresso')) {
    headerIndex = i;
    break;
  }
}

if (headerIndex === -1) {
  console.error('❌ Cabeçalho não encontrado!');
  process.exit(1);
}

console.log(`✅ Cabeçalho encontrado na linha ${headerIndex + 1}\n`);

const headers = lines[headerIndex].split(';').map(h => h.trim());
console.log('📋 Colunas:', headers);

const checkinIndex = headers.findIndex(h => h.includes('Check-in'));
const tipoIndex = headers.findIndex(h => h.includes('Tipo de ingresso'));
const nomeIndex = headers.findIndex(h => h === 'Nome');

console.log(`\nÍndice Check-in: ${checkinIndex}`);
console.log(`Índice Tipo: ${tipoIndex}`);
console.log(`Índice Nome: ${nomeIndex}\n`);

// Processar dados
const participantes = [];
let totalComCheckin = 0;
let totalSemCheckin = 0;

for (let i = headerIndex + 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const cols = line.split(';');
  if (cols.length < 10) continue; // Linha inválida
  
  const checkin = cols[checkinIndex]?.trim();
  const tipo = cols[tipoIndex]?.trim();
  const nome = cols[nomeIndex]?.trim();
  
  if (checkin === 'Sim') {
    totalComCheckin++;
  } else if (checkin === 'Não' || checkin === 'N�o') {
    totalSemCheckin++;
  }
  
  participantes.push({ nome, tipo, checkin });
}

console.log('📊 RESULTADO DA ANÁLISE:');
console.log('='.repeat(60));
console.log(`👥 Total de participantes: ${participantes.length}`);
console.log(`✅ Com check-in: ${totalComCheckin}`);
console.log(`❌ Sem check-in: ${totalSemCheckin}`);
console.log(`📊 Percentual: ${((totalComCheckin / participantes.length) * 100).toFixed(2)}%\n`);

// Agrupar por tipo
const porTipo = {};
participantes.forEach(p => {
  const tipo = p.tipo || 'Sem tipo';
  if (!porTipo[tipo]) {
    porTipo[tipo] = { total: 0, checkins: 0 };
  }
  porTipo[tipo].total++;
  if (p.checkin === 'Sim') {
    porTipo[tipo].checkins++;
  }
});

console.log('📋 CHECKINS POR TIPO DE INGRESSO:');
console.log('-'.repeat(60));
Object.entries(porTipo).forEach(([tipo, stats]) => {
  const percentual = ((stats.checkins / stats.total) * 100).toFixed(1);
  console.log(`\n${tipo}:`);
  console.log(`  Total: ${stats.total}`);
  console.log(`  Checkins: ${stats.checkins} (${percentual}%)`);
});

console.log('\n' + '='.repeat(60));
console.log('✅ Análise concluída!');
console.log('='.repeat(60));
