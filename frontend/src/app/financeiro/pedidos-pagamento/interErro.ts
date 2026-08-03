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
    // DUPLICIDADE no Conta Azul — vem antes de tudo. Casava com o padrão genérico de "conta azul"
    // e a tela mandava "Reconecte e agende de novo": a pior orientação possível, porque reagendar
    // é exatamente o que a trava anti-duplicado está impedindo (o CA não exclui por API).
    // Real em 30/07/2026: FGTS de R$ 248,45 (Beatriz), com o Conta Azul conectado o tempo todo.
    re: /duplicad/i,
    out: {
      titulo: 'Possível pagamento duplicado no Conta Azul',
      acao: 'A trava do Zykor barrou porque já existe lançamento igual. Confira no Conta Azul ANTES de reenviar — reenviar duplica (o CA não exclui por API).',
    },
  },
  {
    // Conta Azul REALMENTE desconectado: token expirado, credencial ausente, refresh que falhou.
    // O padrão era só /conta azul/ e engolia qualquer erro que citasse o CA — inclusive
    // duplicidade e categoria inválida — mandando reconectar uma integração que estava no ar.
    // Casa as mensagens que lib/contaazul/token.ts realmente produz.
    re: /conta\s*azul\s*desconectado|credenciais\s+do\s+conta\s*azul|token\s+ca\b|token\s+do\s+conta\s*azul|conta\s*azul\s+n[ãa]o\s+retornou\s+o\s+token/i,
    out: { titulo: 'Conta Azul desconectado', acao: 'Reconecte o Conta Azul em Integrações e agende o pedido de novo.' },
  },
  {
    // Boleto (erro_inter): o Inter devolve estes três o tempo todo e nenhum é problema de chave PIX.
    re: /t[íi]tulo\s+j[áa]\s+liquidado|j[áa]\s+baixado/i,
    out: { titulo: 'Boleto já pago/baixado no banco emissor', acao: 'Confira o extrato: se já foi pago, use "Marcar como pago" em vez de reenviar.' },
  },
  {
    re: /boleto\s+n[ãa]o\s+registrado|boleto\s+inv[áa]lido|c[óo]digo\s+de\s+barras/i,
    out: { titulo: 'Boleto não registrado/inválido no banco emissor', acao: 'Recapture o boleto (linha digitável) ou peça a 2ª via ao fornecedor.' },
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
    re: /saldo\s+insuficiente|insufficient|sem\s+saldo|60168/i,
    out: {
      titulo: 'Saldo insuficiente na conta pagadora',
      acao: 'O dinheiro NÃO saiu. Garanta saldo na conta do Inter e agende de novo — o PIX anterior morreu, este botão emite um novo.',
    },
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
    // ATENÇÃO ao mexer aqui: /rede/ SEM \b casa dentro de "c-rede-ncial" — qualquer erro de
    // credencial virava "Inter indisponível, tente de novo em instantes", mandando o financeiro
    // re-tentar pra sempre um problema que retry nenhum resolve. Mesma armadilha em "manutenção"
    // vs "manutençãozinha"? não — mas mantenha os termos curtos SEMPRE com \b.
    re: /hor[áa]rio|indispon[íi]vel|manuten[çc][ãa]o|timeout|comunica[çc][ãa]o|\brede\b|resposta\s+vazia|HTTP\s+5\d\d|HTTP\s+429/i,
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
