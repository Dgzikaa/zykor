/**
 * Vocabulário da escala: os marcadores e turnos que a operação usa, e o parser do texto.
 *
 * Mora fora do page.tsx porque o modal de escala padrão precisa das MESMAS listas e do MESMO
 * parser. Importar de um arquivo de rota do Next funciona por acidente — este módulo existe
 * pra que a gramática da escala tenha um dono só.
 */
/**
 * Marcadores que a operação usa. Digitar qualquer um deles no lugar do horário grava o
 * marcador — o casamento é pelas 4 primeiras letras, então não há colisão entre eles.
 *
 * MANUTENÇÃO vem antes de MANUTENÇÕES de propósito: a planilha tem as duas grafias para a
 * mesma coisa (10 e 2 lançamentos) e daqui pra frente as duas gravam a forma singular. O
 * histórico fica como está — passado é registro.
 */
export const MARCADORES = [
  'FOLGA', 'FÉRIAS', 'ATESTADO', 'BANCO',
  'ABRE', 'FECHA', 'INTERMEDIÁRIO', 'PRODUÇÃO', 'MANUTENÇÃO', 'MANUTENÇÕES',
];

/** Botões do painel: valem para qualquer função. */
export const MARCADORES_RAPIDOS = ['FOLGA', 'FÉRIAS', 'ATESTADO', 'BANCO'];

/**
 * A LIDERANÇA tem vocabulário próprio, e é só dela: ABRE (415 lançamentos), FECHA (277),
 * PRODUÇÃO (74), INTERMEDIÁRIO (11) e MANUTENÇÃO (12) não aparecem em nenhuma outra função.
 * ABRE e FECHA são o 2º e o 3º marcadores mais usados da casa — mais que FÉRIAS e ATESTADO
 * somados — e estavam fora dos botões, só no digitado.
 */
export const MARCADORES_LIDERANCA = ['ABRE', 'FECHA', 'PRODUÇÃO', 'INTERMEDIÁRIO', 'MANUTENÇÃO'];
export const COD_LIDERANCA = 'lideranca';

/**
 * Turnos padrão da casa, na ordem de uso REAL (contagem em `escala_dia` desde 01/06):
 * 367, 307, 162, 147, 95 lançamentos. Não são invenção — são os horários que a operação
 * já usa, e cobrem a grande maioria dos dias. O 18:00-02:30 entra porque é o da segurança.
 */
export const PRESETS = ['17:00-02:30', '15:00-01:00', '15:00-02:30', '17:00-03:00', '16:00-02:00', '18:00-02:30'];

/**
 * Texto digitado -> o que vai pro banco. Um lugar só, porque a mesma gramática ("15:00-01:00"
 * ou um marcador) vale pra célula da semana E pra escala padrão da pessoa — se divergirem,
 * o mesmo texto passa a significar coisas diferentes em duas telas da mesma tela.
 */
export function parseTextoEscala(txt: string): { entra: string | null; sai: string | null; marcador: string | null; horas: number | null } {
  const limpo = (txt || '').trim();
  if (!limpo) return { entra: null, sai: null, marcador: null, horas: null };
  const m = /^(\d{1,2}):?(\d{2})\s*[-–a]\s*(\d{1,2}):?(\d{2})$/.exec(limpo);
  if (m) {
    let dur = (Number(m[3]) * 60 + Number(m[4])) - (Number(m[1]) * 60 + Number(m[2]));
    if (dur < 0) dur += 24 * 60; // virou o dia
    return {
      entra: `${m[1].padStart(2, '0')}:${m[2]}`,
      sai: `${m[3].padStart(2, '0')}:${m[4]}`,
      marcador: null,
      horas: Math.round((dur / 60) * 100) / 100,
    };
  }
  const up = limpo.toUpperCase();
  return { entra: null, sai: null, marcador: MARCADORES.find(x => up.startsWith(x.slice(0, 4))) || up, horas: null };
}

