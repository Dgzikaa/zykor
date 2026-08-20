/**
 * Pesquisa da Felicidade — banco de perguntas, sorteio da rodada e leitura do resultado.
 *
 * As 5 dimensões e as 11 perguntas de cada uma vêm da planilha que a operação já usa desde
 * 2024 (docs/Perguntas Pesquisa de Felicidade.xlsx). A rodada é UMA pergunta por dimensão,
 * sorteada do banco — o Gonza quis que variasse a cada semana, e é o que a planilha fazia
 * girando o ciclo 1.1 → 1.11.
 */

/**
 * As três pesquisas. Mesmo motor (rodada + link + respostas), formulários diferentes.
 * A de Calibração fica pra depois — depende da Avaliação de Desempenho (Gonza, 20/08/2026).
 */
export const TIPOS_PESQUISA = {
  felicidade: {
    titulo: 'Pesquisa da Felicidade',
    convite: 'São 5 perguntas, menos de 1 minuto, e é anônima',
    anonima: true,
  },
  marca_empregadora: {
    titulo: 'Marca Empregadora',
    convite: 'Uma pergunta e uma sugestão. É 100% anônima',
    anonima: true,
  },
  feedback: {
    titulo: 'Pesquisa de Feedback',
    // essa NÃO é anônima de propósito: a pergunta é sobre o líder direto de cada um
    convite: 'Uma pergunta só, sobre a conversa com o seu líder',
    anonima: false,
  },
} as const;

export type TipoPesquisa = keyof typeof TIPOS_PESQUISA;

/** Pergunta fixa da Marca Empregadora — é sempre a mesma, não sai de banco. */
export const PERGUNTA_MARCA = 'O quanto você recomendaria o {bar} para um amigo trabalhar?';
export const SUGESTAO_MARCA = 'Você possui alguma sugestão para fazer do {bar} um lugar melhor para se trabalhar?';
/** Pergunta fixa da Pesquisa de Feedback. */
export const PERGUNTA_FEEDBACK = 'O seu líder direto já teve uma conversa de feedback contigo este mês?';

export const DIMENSOES = [
  { chave: 'engajamento', titulo: 'Eu comigo', descricao: 'Engajamento' },
  { chave: 'pertencimento', titulo: 'Eu com a empresa', descricao: 'Pertencimento' },
  { chave: 'relacionamento', titulo: 'Eu com meus colegas', descricao: 'Relacionamento' },
  { chave: 'gestor', titulo: 'Eu com meu gestor', descricao: 'Liderança' },
  { chave: 'reconhecimento', titulo: 'Justiça e reconhecimento', descricao: 'Reconhecimento' },
] as const;

export type Dimensao = (typeof DIMENSOES)[number]['chave'];
export const CHAVES_DIMENSAO = DIMENSOES.map((d) => d.chave) as readonly string[];

/**
 * Escala de resposta. É Likert de 5 e não nota 0-10 porque o indicador da casa é do tipo eNPS:
 * % favorável − % desfavorável, que pode ser NEGATIVO. Misturar escalas aqui quebraria a série
 * histórica que vem da planilha.
 */
export const ESCALA = [
  { valor: 1, rotulo: 'Discordo totalmente' },
  { valor: 2, rotulo: 'Discordo' },
  { valor: 3, rotulo: 'Nem concordo nem discordo' },
  { valor: 4, rotulo: 'Concordo' },
  { valor: 5, rotulo: 'Concordo totalmente' },
] as const;

/**
 * Nome do bar como a pesquisa fala dele: "Ordinário Bar" vira "Ordinário".
 * "Tenho orgulho de trabalhar no Ordinário Bar" soa a formulário, não a gente.
 */
export function nomeCurtoDoBar(nome: string | null | undefined): string {
  return String(nome || '').replace(/\s+bar$/i, '').trim() || 'empresa';
}

/** Troca o marcador `{bar}` pelo nome da casa. O banco é um só; o texto é de cada bar. */
export function aplicarNomeDoBar(texto: string, nomeBar: string): string {
  return texto.replace(/\{bar\}/g, nomeCurtoDoBar(nomeBar));
}

/**
 * Score de uma dimensão: % favorável (4-5) − % desfavorável (1-2), em pontos de -100 a 100.
 * Neutro (3) entra no denominador e em nenhum dos dois lados — igual à conta do eNPS.
 */
export function scoreDimensao(notas: number[]): number | null {
  const validas = notas.filter((n) => n >= 1 && n <= 5);
  if (!validas.length) return null;
  const fav = validas.filter((n) => n >= 4).length;
  const desfav = validas.filter((n) => n <= 2).length;
  return Math.round(((fav - desfav) / validas.length) * 1000) / 10;
}

/**
 * Sorteia 1 pergunta por dimensão, evitando as usadas nas últimas rodadas, e EMBARALHA a ordem.
 *
 * Embaralhar foi pedido explícito ("não precisa começar sempre com a pergunta de dimensão 1"):
 * com a ordem fixa, quem responde toda semana decora a sequência e passa a responder no
 * automático — o que estraga justamente o indicador.
 */
export function sortearRodada(
  banco: { id: number; dimensao: string; texto: string }[],
  usadasRecentes: Set<number>,
  aleatorio: () => number = Math.random,
): { dimensao: string; pergunta_id: number; texto: string }[] {
  const escolhidas = DIMENSOES.map((d) => {
    const daDimensao = banco.filter((p) => p.dimensao === d.chave);
    if (!daDimensao.length) return null;
    // só cai nas repetidas quando o banco inteiro já rodou — senão a pesquisa repetiria
    // pergunta antes de usar as 11.
    const novas = daDimensao.filter((p) => !usadasRecentes.has(p.id));
    const pool = novas.length ? novas : daDimensao;
    const escolhida = pool[Math.floor(aleatorio() * pool.length)];
    return { dimensao: d.chave, pergunta_id: escolhida.id, texto: escolhida.texto };
  }).filter(Boolean) as { dimensao: string; pergunta_id: number; texto: string }[];

  // Fisher-Yates com o mesmo gerador, pra continuar testável com um aleatorio() fixo.
  for (let i = escolhidas.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [escolhidas[i], escolhidas[j]] = [escolhidas[j], escolhidas[i]];
  }
  return escolhidas;
}

/** Segunda-feira da semana de uma data (a pesquisa é semanal). */
export function segundaDaSemana(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (x.getDay() + 6) % 7; // 0 = segunda
  x.setDate(x.getDate() - diff);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
