/**
 * Types do dominio "Bar".
 */

export type Bar = {
  id: number;
  nome: string;
  ativo: boolean;
};

export type BarConfigOperacao = {
  opera_segunda: boolean;
  opera_terca: boolean;
  opera_quarta: boolean;
  opera_quinta: boolean;
  opera_sexta: boolean;
  opera_sabado: boolean;
  opera_domingo: boolean;
};
