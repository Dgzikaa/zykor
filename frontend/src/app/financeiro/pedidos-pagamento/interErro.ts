// Traduz o erro CRU do Inter/Conta Azul (gravado em pedidos_pagamento.erro_mensagem)
// numa mensagem curta e clara pro financeiro. O Inter devolve "title: detail" (RFC 7807),
// nem sempre óbvio ("chave não cadastrada", "saldo insuficiente", etc.). Aqui a gente
// reconhece os casos comuns e sugere a ação — mantendo o texto original como detalhe.

export interface ErroAmigavel {
  /** Frase curta e clara ("Chave PIX não encontrada no banco"). */
  titulo: string;
  /** O que fazer ("Confira/edite a chave e tente de novo"). Opcional. */
  acao?: string;
  /** true quando o problema é a CHAVE PIX (destaca o campo pra corrigir). */
  chaveInvalida?: boolean;
}

// Padrões (regex) → mensagem amigável. Ordem importa (mais específico primeiro).
const PADROES: Array<{ re: RegExp; out: ErroAmigavel }> = [
  {
    // Conta Azul (erro_ca): token expirado / credenciais ausentes / conta a pagar não criada.
    // Vem ANTES do padrão de PIX de propósito: "Credenciais do Conta Azul não encontradas" casava
    // com "não encontrada" e aparecia como erro de chave PIX, confundindo o financeiro (o PIX estava
    // certo — o problema é a conexão do Conta Azul).
    re: /conta\s+azul|token\s+ca\b|credenciais.*conta/i,
    out: { titulo: 'Conta Azul desconectado', acao: 'Reconecte o Conta Azul em Integrações e agende o pedido de novo.' },
  },
  {
    re: /n[ãa]o\s+cadastrada|n[ãa]o\s+encontrada|not\s+registered|not\s+found|chave\s+inv[áa]lida|dict|chave.*inexist/i,
    out: {
      titulo: 'Chave PIX não encontrada no banco',
      acao: 'Confira a chave com o beneficiário, corrija e tente de novo.',
      chaveInvalida: true,
    },
  },
  {
    re: /saldo\s+insuficiente|insufficient|sem\s+saldo/i,
    out: { titulo: 'Saldo insuficiente na conta pagadora', acao: 'Garanta saldo na conta e tente de novo.' },
  },
  {
    re: /cpf|cnpj|documento.*(diverge|inv[áa]lid|n[ãa]o\s+confere)/i,
    out: {
      titulo: 'CPF/CNPJ do favorecido não confere com a chave',
      acao: 'Confira o documento do beneficiário e a chave; corrija e tente de novo.',
      chaveInvalida: true,
    },
  },
  {
    re: /limite|excede|acima\s+do\s+valor|valor\s+m[áa]ximo/i,
    out: { titulo: 'Valor acima do limite do Inter', acao: 'Reduza o valor ou ajuste o limite no app do Inter.' },
  },
  {
    re: /acesso\s+negado|unauthorized|forbidden|401|403|permiss/i,
    out: { titulo: 'Acesso negado no Inter (credencial/permissão)', acao: 'Verifique a credencial/conta pagadora do bar.' },
  },
  {
    re: /hor[áa]rio|indispon[íi]vel|manuten[çc][ãa]o|timeout|comunica[çc][ãa]o|rede/i,
    out: { titulo: 'Inter indisponível no momento', acao: 'Foi problema de comunicação; tente de novo em instantes.' },
  },
  {
    re: /agendamento\s+anterior\s+n[ãa]o\s+concluiu/i,
    out: { titulo: 'Tentativa anterior não concluiu', acao: 'Destravado — tente agendar de novo.' },
  },
];

/**
 * Recebe o erro_mensagem cru e devolve uma versão amigável. Se não reconhecer,
 * usa o próprio texto do banco como título (melhor mostrar algo do que nada).
 */
export function interErroAmigavel(msg?: string | null): ErroAmigavel {
  const texto = (msg || '').trim();
  if (!texto) return { titulo: 'Falha no pagamento (sem detalhe do banco)' };
  for (const p of PADROES) {
    if (p.re.test(texto)) return p.out;
  }
  // Desconhecido: mostra o texto do Inter (encurtado), sem "Erro 400:" na frente.
  const limpo = texto.replace(/^erro\s+\d+:\s*/i, '').replace(/^inter\s+http\s+\d+/i, 'Falha no Inter');
  return { titulo: limpo.length > 140 ? `${limpo.slice(0, 140)}…` : limpo };
}
