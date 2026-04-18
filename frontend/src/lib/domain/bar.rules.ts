/**
 * Regras de negocio puras para Bar (sem dependencia de banco).
 */
import type { BarConfigOperacao } from './bar.types';

/**
 * Verifica se o bar opera num dia da semana.
 * @param dow 0=Domingo, 1=Segunda, ..., 6=Sabado
 */
export function barOperaNoDia(config: BarConfigOperacao, dow: number): boolean {
  switch (dow) {
    case 0: return config.opera_domingo;
    case 1: return config.opera_segunda;
    case 2: return config.opera_terca;
    case 3: return config.opera_quarta;
    case 4: return config.opera_quinta;
    case 5: return config.opera_sexta;
    case 6: return config.opera_sabado;
    default: return false;
  }
}

/**
 * Verifica se o bar opera numa data especifica (formato 'YYYY-MM-DD').
 * Usa UTC para evitar problemas de timezone.
 */
export function barOperaNaData(config: BarConfigOperacao, dataIso: string): boolean {
  const data = new Date(dataIso + 'T00:00:00Z');
  return barOperaNoDia(config, data.getUTCDay());
}
