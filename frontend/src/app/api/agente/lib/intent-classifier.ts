import { agora } from '@/lib/timezone';

export function inferContextFromHistory(
  message: string,
  previousMessages: { role: string; content: string; agent?: string }[]
): string | null {
  const messageLower = message.toLowerCase();
  
  const vaguePatterns = [
    /^e (ontem|hoje|amanha)/i,
    /^e (a|o) /i,
    /^comparando/i,
    /^mas e/i,
    /^e se/i,
    /^quanto/i,
    /^como/i,
    /^qual/i
  ];
  
  const isVague = vaguePatterns.some(p => p.test(messageLower)) && messageLower.length < 30;
  
  if (isVague && previousMessages.length > 0) {
    const lastAssistant = [...previousMessages].reverse().find(m => m.role === 'assistant' && m.agent);
    if (lastAssistant?.agent) {
      const agentToIntent: Record<string, string> = {
        'Analista Financeiro': 'faturamento',
        'Analista de Clientes': 'clientes',
        'Analista de Custos': 'cmv',
        'Analista de Metas': 'meta',
        'Analista de Produtos': 'produto',
        'Analista Comparativo': 'comparativo_periodos',
        'Analista de Tendências': 'tendencia'
      };
      return agentToIntent[lastAssistant.agent] || null;
    }
  }
  
  return null;
}

export function classifyIntent(message: string): { intent: string; entities: Record<string, string> } {
  const messageLower = message.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const entities: Record<string, string> = {};

  const diasSemana = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const diasMencionados = diasSemana.filter(dia => messageLower.includes(dia));
  if (diasMencionados.length > 0) {
    entities.dias = diasMencionados.join(',');
  }

  const isComparativo = /melhor|pior|mais|menos|comparar|versus|vs|ou\s|subindo|caindo|crescendo|diminuindo|aumentando/.test(messageLower);
  const comparaPeriodos = /essa semana.*(passada|anterior)|semana passada.*(essa|atual)|mes passado|ano passado/.test(messageLower);
  const isTendencia = /subindo|caindo|crescendo|diminuindo|aumentando|tendencia|evoluindo|melhorando|piorando/.test(messageLower);

  const patterns: [string, RegExp][] = [
    ['estoque', /estoque|ruptura|stockout|faltou|acabou|falta de|sem produto|produto.*faltando|produto.*faltou/],
    ['calendario', /quem toca|agenda|programacao|evento.*amanha|amanha.*evento|proximo evento|artista.*confirmado|proxima semana.*evento/],
    ['comparativo_dias', /sexta.*sabado|sabado.*sexta|segunda.*terca|melhor dia|pior dia/],
    ['comparativo_periodos', /essa semana.*passada|semana passada|mes passado|veio mais.*semana|mais gente.*semana/],
    ['tendencia', /ta (caindo|subindo)|esta (caindo|subindo)|evoluindo|tendencia|melhorando|piorando/],
    ['meta_projecao', /quanto.*(falta|precisa|necessario)|falta.*meta|precisa.*dia|fechar.*mes|bater.*meta/],
    ['meta', /meta|objetivo|progresso|atingimento|bateu|batemos|atingiu|atingimos/],
    ['faturamento', /faturamento|faturou|receita|vendas|quanto vendeu|quanto fez|deu quanto/],
    ['clientes', /cliente|pessoa|pax|publico|quantos vieram|visitantes|gente|veio|vieram/],
    ['ticket', /ticket|media|consumo medio|gasto medio/],
    ['cmv', /cmv|custo.*mercadoria|margem/],
    ['produto', /produto|mais vendido|top|ranking|item|vende mais|vendeu mais/],
    ['operacional', /horario|pico|movimento|funcionamento|lotado/],
    ['resumo', /como foi|como esta|como ta|tudo bem|resumo|novidades|o que mudou|visao geral|insights|desempenho/],
  ];

  let intent = 'geral';
  for (const [key, pattern] of patterns) {
    if (pattern.test(messageLower)) {
      intent = key;
      break;
    }
  }

  if (intent === 'geral' && isComparativo && diasMencionados.length >= 2) {
    intent = 'comparativo_dias';
  }
  if (intent === 'geral' && comparaPeriodos) {
    intent = 'comparativo_periodos';
  }
  if (intent === 'geral' && isTendencia) {
    intent = 'tendencia';
  }

  const hoje = agora();
  
  const dataRegexComAno = /(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/;
  const dataMatchComAno = message.match(dataRegexComAno);
  
  const dataRegexSemAno = /(\d{1,2})[./\-](\d{1,2})(?![./\d])/;
  const dataMatchSemAno = message.match(dataRegexSemAno);
  
  const mesesNomes: Record<string, number> = {
    'janeiro': 1, 'fevereiro': 2, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12,
    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12
  };
  const dataRegexPorExtenso = /(?:dia\s+)?(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/i;
  const dataMatchPorExtenso = messageLower.match(dataRegexPorExtenso);
  
  if (dataMatchComAno) {
    const [, dia, mes, anoRaw] = dataMatchComAno;
    let ano = anoRaw;
    if (ano.length === 2) {
      ano = parseInt(ano) < 50 ? `20${ano}` : `19${ano}`;
    }
    const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    entities.periodo = 'data_especifica';
    entities.data = dataFormatada;
  } else if (dataMatchSemAno && !dataMatchComAno) {
    const [, dia, mes] = dataMatchSemAno;
    const ano = hoje.getFullYear();
    const dataFormatada = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    entities.periodo = 'data_especifica';
    entities.data = dataFormatada;
  } else if (dataMatchPorExtenso) {
    const [, dia, mesNome, anoRaw] = dataMatchPorExtenso;
    const mesNum = mesesNomes[mesNome.toLowerCase()];
    if (mesNum) {
      const ano = anoRaw ? parseInt(anoRaw) : hoje.getFullYear();
      const dataFormatada = `${ano}-${String(mesNum).padStart(2, '0')}-${dia.padStart(2, '0')}`;
      entities.periodo = 'data_especifica';
      entities.data = dataFormatada;
    }
  }
  
  if (!entities.periodo) {
    if (/anteontem/.test(messageLower)) {
      const anteontem = new Date(hoje);
      anteontem.setDate(anteontem.getDate() - 2);
      entities.periodo = 'data_especifica';
      entities.data = anteontem.toISOString().split('T')[0];
    }
    else if (/ha\s*(\d+)\s*dias?/.test(messageLower)) {
      const match = messageLower.match(/ha\s*(\d+)\s*dias?/);
      if (match) {
        const diasAtras = parseInt(match[1]);
        const dataCalculada = new Date(hoje);
        dataCalculada.setDate(dataCalculada.getDate() - diasAtras);
        entities.periodo = 'data_especifica';
        entities.data = dataCalculada.toISOString().split('T')[0];
      }
    }
    else if (/(segunda|terca|quarta|quinta|sexta|sabado|domingo)\s+passad[ao]/.test(messageLower)) {
      const diaMatch = messageLower.match(/(segunda|terca|quarta|quinta|sexta|sabado|domingo)\s+passad[ao]/);
      if (diaMatch) {
        const diasMap: Record<string, number> = {
          'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 
          'quinta': 4, 'sexta': 5, 'sabado': 6
        };
        const diaSemanaAlvo = diasMap[diaMatch[1]];
        const dataCalculada = new Date(hoje);
        const diaAtual = dataCalculada.getDay();
        let diasRetroceder = diaAtual - diaSemanaAlvo;
        if (diasRetroceder <= 0) diasRetroceder += 7;
        dataCalculada.setDate(dataCalculada.getDate() - diasRetroceder);
        entities.periodo = 'data_especifica';
        entities.data = dataCalculada.toISOString().split('T')[0];
      }
    }
    else if (/hoje/.test(messageLower)) entities.periodo = 'hoje';
    else if (/ontem/.test(messageLower)) entities.periodo = 'ontem';
    else if (/essa semana|esta semana|semana atual/.test(messageLower)) entities.periodo = 'semana_atual';
    else if (/semana passada|ultima semana/.test(messageLower)) entities.periodo = 'semana_passada';
    else if (/esse mes|este mes|mes atual/.test(messageLower)) entities.periodo = 'mes_atual';
    else if (/mes passado|ultimo mes/.test(messageLower)) entities.periodo = 'mes_passado';
  }

  return { intent, entities };
}
