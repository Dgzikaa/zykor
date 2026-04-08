/**
 * Script para calcular qual é a semana 14 de 2026
 */

function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

console.log('📅 Calculando semanas de 2026...\n');

// Verificar semana de 30.03 - 05.04
const data30_03 = new Date('2026-03-30');
const data05_04 = new Date('2026-04-05');

console.log(`30/03/2026: Semana ${getWeekNumber(data30_03)}`);
console.log(`05/04/2026: Semana ${getWeekNumber(data05_04)}`);

// Verificar semanas de março/abril
console.log('\n📊 Todas as semanas de março/abril 2026:');
for (let dia = 1; dia <= 30; dia++) {
  const data = new Date(`2026-03-${dia.toString().padStart(2, '0')}`);
  const semana = getWeekNumber(data);
  const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()];
  console.log(`  ${dia.toString().padStart(2, '0')}/03/2026 (${diaSemana}): Semana ${semana}`);
}

console.log('');
for (let dia = 1; dia <= 30; dia++) {
  const data = new Date(`2026-04-${dia.toString().padStart(2, '0')}`);
  const semana = getWeekNumber(data);
  const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()];
  console.log(`  ${dia.toString().padStart(2, '0')}/04/2026 (${diaSemana}): Semana ${semana}`);
}
