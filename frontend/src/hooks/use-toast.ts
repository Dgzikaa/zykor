'use client';

import { useCallback, useContext } from 'react';
import { ToastContext } from '@/components/ui/toast';

/**
 * ATENÇÃO — este hook era um TOAST FANTASMA até 22/08/2026.
 *
 * Ele guardava as mensagens num `useState` local e **devolvia** o array; nenhum componente
 * renderizava esse array. Resultado: as 75 telas que importam daqui chamavam `toast({...})`,
 * nada aparecia, e só sobrava um `console.log`. Reportado pela operação do Ordinário via Mafê:
 * *"me pediram se tem como colocar uma mensagem de confirmação depois que os registros de
 * desperdício são lançados, pq eles nunca sabem se salvou ou não"* — a tela de Desperdício já
 * chamava `toast({ title: 'Registro salvo' })` desde sempre; era o hook que engolia.
 *
 * Agora delega pro ToastProvider de verdade (montado no layout raiz), mantendo esta assinatura
 * — assim as 75 telas passam a mostrar toast sem precisar tocar em nenhuma delas.
 *
 * Também saiu daqui o `new Notification(...)`: pedia permissão de notificação do navegador a cada
 * toast, o que é intrusivo e, negado uma vez, silenciava tudo de novo.
 */

interface ToastInput {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

/** "Gerando exportação..." não é sucesso, é andamento — não merece o ✓ verde. */
const ehAndamento = (titulo: string) => /(\.\.\.|…)\s*$/.test(titulo);

export function useToast() {
  const ctx = useContext(ToastContext);

  const toast = useCallback(({ title, description, variant = 'default' }: ToastInput) => {
    if (!ctx) {
      // Fora do provider (ex.: error boundary) não dá pra mostrar — mas engolir calado foi o bug
      // que isto conserta, então pelo menos registra.
      console.warn(`[toast sem provider] ${title}${description ? ': ' + description : ''}`);
      return;
    }
    ctx.showToast({
      type: variant === 'destructive' ? 'error' : ehAndamento(title) ? 'info' : 'success',
      title,
      message: description,
    });
  }, [ctx]);

  const dismiss = useCallback((toastId: string) => { ctx?.removeToast(toastId); }, [ctx]);

  return { toast, dismiss, toasts: ctx?.toasts ?? [] };
}
