/**
 * De que aparelho veio a requisição, a partir do user-agent.
 *
 * Existe porque o financeiro precisava responder "esses boletos foram subidos pelo celular?"
 * (David, 20/08/2026) e não havia como: a trilha de auditoria gravava `user_agent` vazio em tudo.
 *
 * Classificação deliberadamente grosseira — 'celular' | 'tablet' | 'computador'. A pergunta real
 * é "estava em pé com o telefone na mão ou sentado?"; marca e versão do navegador não mudam
 * decisão nenhuma e só dariam a impressão de precisão que o user-agent não tem.
 *
 * Ordem importa: iPad e Android-tablet contêm as mesmas pistas de mobile, então o teste de tablet
 * vem antes. iPad recente se anuncia como Macintosh — nesse caso vira 'computador' mesmo, e tudo
 * bem: ninguém decide nada diferente por causa disso.
 */
export type Dispositivo = 'celular' | 'tablet' | 'computador';

export function dispositivoDeUA(ua: string | null | undefined): Dispositivo | null {
  const s = (ua || '').toLowerCase();
  if (!s) return null;
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(s)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/.test(s)) return 'celular';
  return 'computador';
}

/** Rótulo curto pro badge. */
export const LABEL_DISPOSITIVO: Record<Dispositivo, string> = {
  celular: 'Celular',
  tablet: 'Tablet',
  computador: 'Computador',
};
