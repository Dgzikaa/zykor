// Classificador de TEMAS dos comentários abertos do Falae (determinístico, por palavra-chave).
// Cobre os motivos recorrentes de elogio/reclamação. É rule-based de propósito: rápido, sem custo
// nem latência de LLM, e auditável. Dá pra evoluir pra classificação por IA depois se precisar de nuance.

const TEMAS: Array<{ tema: string; re: RegExp }> = [
  { tema: 'Atendimento', re: /atend|gar[çc]o|educ|grosso|mal atend|equipe|funcion|recepc/i },
  { tema: 'Música / som', re: /m[úu]sic|\bsom\b|\bdj\b|banda|volume|barulh|alto demais/i },
  { tema: 'Fila / espera', re: /fila|espera|demor|lent|aguard|tempo de/i },
  { tema: 'Lotação / espaço', re: /lotad|cheio|apertad|espa[çc]o|estrutura|acomod/i },
  { tema: 'Reserva / mesa', re: /reserva|\bmesa\b|lugar|sentar|acento|assento/i },
  { tema: 'Preço', re: /pre[çc]|\bcaro\b|\bcara\b|custo|benef|valor alto/i },
  { tema: 'Comida', re: /comida|prato|petisco|sabor|cozinha|por[çc][aã]o|lanche|hamb|pizza|fri[oa]/i },
  { tema: 'Bebida / drinks', re: /drink|bebida|chopp|cerveja|caipir|\bdose\b|gelad/i },
  { tema: 'Limpeza / banheiro', re: /banheiro|limpeza|sujo|higien|nojo/i },
  { tema: 'Cigarro / fumaça', re: /cigarr|fuma|tabac|narguil/i },
  { tema: 'Calor / ventilação', re: /calor|quente|abafad|ar condicion|ventil|abafo/i },
  { tema: 'Segurança', re: /seguran[çc]|assalt|roub|briga|confus/i },
  { tema: 'Estacionamento', re: /estacion|vaga|valet/i },
];

export function temasDe(comentario: string): string[] {
  const t = String(comentario || '');
  return TEMAS.filter((x) => x.re.test(t)).map((x) => x.tema);
}
