/**
 * Traduz o erro cru que a Meta devolve no callback do Instagram Business Login em algo
 * que a pessoa consegue resolver sozinha.
 *
 * O callback (`api/integracoes/instagram/callback`) repassa `error_description` da Meta
 * direto pra URL. Isso vira toast tipo "Falha: Função de desenvolvedor é insuficiente",
 * que não diz nada pra quem está tentando conectar — a causa real está no painel da Meta,
 * não no Zykor.
 */
export type ErroIgTraduzido = { titulo: string; detalhe: string };

const REGRAS: Array<{ re: RegExp; titulo: string; detalhe: string }> = [
  {
    // "Insufficient developer role" — o app está em modo Desenvolvimento e a conta que
    // tentou autorizar não tem papel nele. É o caso do Deboche: o Ordinário conecta porque
    // já é testador; uma conta nova, não.
    re: /fun[çc][ãa]o de desenvolvedor|insufficient developer role|developer role/i,
    titulo: 'Essa conta do Instagram ainda não tem permissão no app da Meta',
    detalhe:
      'O app está em modo Desenvolvimento, então só contas cadastradas como Testador conseguem conectar. ' +
      'No painel da Meta: App > Funções do app > Testadores do Instagram > adicionar o @ da conta. ' +
      'Depois, DENTRO do Instagram dessa conta: Configurações > Apps e sites > Convites de testador > Aceitar. ' +
      'Feito isso, tente conectar de novo.',
  },
  {
    re: /professional|profissional|business account|conta comercial/i,
    titulo: 'A conta precisa ser Profissional',
    detalhe:
      'O Instagram Business Login não aceita conta Pessoal. No Instagram: Configurações > Tipo de conta > ' +
      'mudar para Profissional (Empresa). Depois tente de novo.',
  },
  {
    re: /access_denied|permiss[ãa]o negada|user denied|cancel/i,
    titulo: 'Autorização cancelada',
    detalhe: 'A permissão foi negada na tela da Meta. Refaça a conexão e aceite todas as permissões pedidas.',
  },
  {
    re: /state_invalido|state inv[áa]lido|expired/i,
    titulo: 'O link de conexão expirou',
    detalhe: 'A janela de conexão vale 30 minutos. Clique em Conectar de novo e conclua sem sair do fluxo.',
  },
  {
    re: /parametros_ausentes/i,
    titulo: 'A Meta voltou sem os dados da conexão',
    detalhe: 'Tente novamente. Se repetir, confira se a URL de redirecionamento do app da Meta bate com a do Zykor.',
  },
];

export function traduzirErroIg(msgCru: string): ErroIgTraduzido {
  const msg = (msgCru || '').trim();
  const regra = REGRAS.find(r => r.re.test(msg));
  if (regra) return { titulo: regra.titulo, detalhe: regra.detalhe };
  return { titulo: 'Não foi possível conectar o Instagram', detalhe: msg || 'Erro desconhecido' };
}
