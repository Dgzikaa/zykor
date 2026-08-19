'use client';

import { useEffect, useState } from 'react';

/**
 * Se a tela é estreita o bastante para o layout de celular.
 *
 * Nasceu da tela /operacao/plano: uma grade com a semana inteira em 8 colunas é confortável no
 * desktop e ilegível no telefone — cada coluna vira ~40px e o texto quebra letra a letra
 * (ver docs/printMobile.jpg). Nesses casos a saída não é encolher, é MUDAR o layout, e para isso
 * o componente precisa saber onde está.
 *
 * Começa `false` e só decide depois de montar: no servidor não existe `window`, e chutar "mobile"
 * faria a versão desktop piscar no primeiro render.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const aplicar = () => setMobile(mq.matches);
    aplicar();
    mq.addEventListener('change', aplicar);
    return () => mq.removeEventListener('change', aplicar);
  }, [breakpoint]);

  return mobile;
}
