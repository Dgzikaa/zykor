import { describe, it, expect } from 'vitest';
import { motivoErroInter, mensagemFalhaInter } from '@/lib/inter/erroPagamento';
import { interErroAmigavel } from '@/app/financeiro/pedidos-pagamento/interErro';

// Payload REAL do webhook do Inter (financial.inter_webhook_logs #2219, 31/07/2026 06:08):
// o cachê da banda do Pagode Vira-Lata que não saiu.
const WEBHOOK_SALDO = {
  chave: '+5561992953033',
  erros: [{ codigoErro: '60168', descricaoErro: 'Saldo Insuficiente.', codigoErroComplementar: '60168' }],
  valor: '1200.0',
  status: 'ERRO',
  recebedor: { nome: 'VITOR SANTOS LIMA', cpfCnpj: '***502311**' },
  descricaoPagamento: 'Pagode Vira-Lata Banda Bonsai',
};

describe('motivoErroInter', () => {
  it('extrai o motivo de erros[] com o código do banco', () => {
    expect(motivoErroInter(WEBHOOK_SALDO)).toBe('Saldo Insuficiente. (Inter 60168)');
  });

  it('junta múltiplos erros em vez de mostrar só o primeiro', () => {
    const m = motivoErroInter({ erros: [{ descricaoErro: 'A' }, { descricaoErro: 'B', codigoErro: '9' }] });
    expect(m).toBe('A; B (Inter 9)');
  });

  it('entende o formato RFC 7807 dos 4xx (title + detail)', () => {
    expect(motivoErroInter({ title: 'Erro', detail: 'Chave não cadastrada' })).toBe('Erro: Chave não cadastrada');
  });

  it('devolve null quando o banco não disse nada', () => {
    expect(motivoErroInter({ status: 'ERRO' })).toBeNull();
    expect(motivoErroInter(null)).toBeNull();
  });
});

describe('mensagemFalhaInter', () => {
  it('NUNCA devolve vazio — sem motivo, ao menos diz o status cru', () => {
    // O bug original: erro_mensagem NULL virava "Falha no pagamento (sem detalhe do banco)".
    const msg = mensagemFalhaInter({ status: 'ERRO' }, 'ERRO');
    expect(msg).toContain('ERRO');
    expect(msg.length).toBeGreaterThan(10);
  });
});

describe('interErroAmigavel', () => {
  it('saldo insuficiente vira aviso de saldo, não de chave PIX', () => {
    const e = interErroAmigavel(mensagemFalhaInter(WEBHOOK_SALDO, 'ERRO'));
    expect(e.titulo).toMatch(/saldo insuficiente/i);
    expect(e.chaveInvalida).toBeFalsy();
    expect(e.acao).toMatch(/n[ÃA]O saiu/i);
  });

  it('duplicidade no CA NÃO manda reconectar o Conta Azul', () => {
    // Regressão 30/07/2026: o padrão genérico /conta azul/ mandava "Reconecte e agende de novo",
    // que é justamente o que a trava anti-duplicado está impedindo.
    const e = interErroAmigavel('Possivel pagamento duplicado detectado no Conta Azul.');
    expect(e.titulo).toMatch(/duplicad/i);
    expect(e.acao).not.toMatch(/reconecte/i);
  });

  it('desconexão de verdade do CA continua mandando reconectar', () => {
    for (const msg of [
      'Conta Azul desconectado. Reconecte o Conta Azul em Integrações.',
      'Credenciais do Conta Azul não encontradas',
      'Token CA expirado. Reconecte o Conta Azul.',
    ]) {
      expect(interErroAmigavel(msg).titulo).toBe('Conta Azul desconectado');
    }
  });

  it('boleto já liquidado não vira erro de chave PIX', () => {
    const e = interErroAmigavel('Ocorreu um erro!: Título já liquidado / baixado.');
    expect(e.titulo).toMatch(/j[áa] pago/i);
    expect(e.chaveInvalida).toBeFalsy();
  });

  it('chave PIX inexistente continua destacando o campo da chave', () => {
    const e = interErroAmigavel('Chave não cadastrada no DICT');
    expect(e.chaveInvalida).toBe(true);
  });
});
