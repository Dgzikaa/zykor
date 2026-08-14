/**
 * Ata semanal do RH — objetivo 3 da ata de 13/08/2026: "ENVIO AUTOMÁTICO DA MENSAGEM SEMANAL".
 *
 * A mensagem de toda segunda deixa de ser escrita à mão. Este módulo só formata; quem busca os
 * dados é /api/rh/ata-semanal. Separado porque o texto é o produto — é ele que vai pro grupo — e
 * precisa ser lido e ajustado sem mexer em query.
 *
 * A Pesquisa da Felicidade fica de fora por enquanto, como combinado na reunião.
 */

export type Pessoa = { nome: string; detalhe?: string | null };

export type BlocosAta = {
  bar_nome: string;
  inicio: string;              // segunda (YYYY-MM-DD)
  fim: string;                 // domingo (YYYY-MM-DD)
  cmo: { freelas: number; fixo: number; total: number; faturamento: number; pct: number | null } | null;
  faltas: Pessoa[];
  atestados: Pessoa[];
  /** Turnos escalados x turnos com check-in do líder — mede a confiança do bloco de faltas. */
  cobertura: { escalados: number; com_checkin: number };
  absenteismo_pct: number | null;
  entradas: Pessoa[];
  saidas: Pessoa[];
  cartoes: Pessoa[];
  vagas: Pessoa[];
  experiencia: Pessoa[];
  onboarding: Pessoa[];
  avisos_previos: Pessoa[];
};

const dia = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);

/** Bloco com título e lista; some inteiro quando não há nada — a mensagem à mão também some. */
function bloco(titulo: string, itens: Pessoa[], vazio?: string): string {
  if (itens.length === 0) return vazio ? `*${titulo}*\n${vazio}` : '';
  const linhas = itens.map((p) => `• ${p.nome}${p.detalhe ? ` — ${p.detalhe}` : ''}`).join('\n');
  return `*${titulo}* (${itens.length})\n${linhas}`;
}

export function renderAta(b: BlocosAta): string {
  const partes: string[] = [];

  partes.push(`*RH — semana ${dia(b.inicio)} a ${dia(b.fim)}*\n${b.bar_nome}`);

  if (b.cmo) {
    partes.push(
      `*CMO da semana*\n` +
      `• Freelas: ${real(b.cmo.freelas)}\n` +
      `• Fixo (folha rateada): ${real(b.cmo.fixo)}\n` +
      `• Total: ${real(b.cmo.total)} sobre ${real(b.cmo.faturamento)} = *${pct(b.cmo.pct)}*`
    );
  }

  // O bloco de faltas vale o que o check-in dos líderes cobrir. Sem essa linha o número parece
  // fechado quando na verdade metade da escala nunca foi conferida — e o ponto sozinho
  // superconta (PJ e liderança não batem).
  const cob = b.cobertura;
  if (cob.com_checkin === 0) {
    // "Nenhuma falta" aqui seria mentira: ninguém conferiu. Dizer isso é o que faz o líder ir lá.
    partes.push(
      `*Faltas*\n` +
      (cob.escalados > 0
        ? `Nenhum dos ${cob.escalados} turnos da semana teve check-in do líder — sem isso não dá pra afirmar quem faltou.`
        : 'Sem escala registrada nesta semana.')
    );
  } else {
    partes.push(
      bloco('Faltas', b.faltas, 'Nenhuma falta registrada.') +
      (cob.com_checkin < cob.escalados
        ? `\n_${cob.com_checkin} de ${cob.escalados} turnos com check-in do líder — o resto ainda não foi conferido._`
        : '')
    );
  }

  const opcionais = [
    bloco('Atestados', b.atestados),
    b.absenteismo_pct != null ? `*Absenteísmo*\n${pct(b.absenteismo_pct)} dos turnos escalados` : '',
    bloco('Entradas', b.entradas),
    bloco('Saídas', b.saidas),
    bloco('Súmula (cartões)', b.cartoes),
    bloco('Avisos prévios trabalhados', b.avisos_previos),
    bloco('Fim de período de experiência', b.experiencia),
    bloco('Onboarding a fazer', b.onboarding),
    bloco('Vagas abertas', b.vagas),
  ].filter(Boolean);

  return [...partes, ...opcionais].join('\n\n');
}

/** Segunda-feira da semana de uma data qualquer (a semana do RH é segunda→domingo). */
export function segundaDe(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d));
  x.setUTCDate(x.getUTCDate() - (x.getUTCDay() === 0 ? 6 : x.getUTCDay() - 1));
  return x.toISOString().slice(0, 10);
}

export function somaDias(iso: string, n: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}
