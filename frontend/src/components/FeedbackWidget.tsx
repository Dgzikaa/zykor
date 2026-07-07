'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageSquarePlus, X, Loader2, Send } from 'lucide-react';

/**
 * Widget de feedback flutuante (aba na borda direita, em toda tela autenticada).
 * Qualquer usuário escreve um feedback da tela em que está; grava quem + a rota
 * (usePathname) + a mensagem via POST /api/feedback, e avisa os admins no sino.
 * Montado no MinimalLayout.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (msg.trim().length < 3) {
      toast.error('Escreva seu feedback.');
      return;
    }
    setEnviando(true);
    try {
      const res = await api.post('/api/feedback', {
        mensagem: msg.trim(),
        rota: pathname,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      if (res?.success) {
        toast.success('Feedback enviado! Obrigado 🙌');
        setMsg('');
        setOpen(false);
      } else {
        toast.error(res?.error || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-2 py-3 rounded-l-lg shadow-lg flex items-center gap-1.5 [writing-mode:vertical-rl] rotate-180"
          title="Enviar feedback desta tela"
        >
          <MessageSquarePlus className="w-4 h-4 rotate-90" /> Feedback
        </button>
      )}

      {open && (
        <div className="fixed right-4 bottom-20 sm:bottom-4 z-50 w-[min(92vw,360px)] rounded-xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="font-medium text-sm flex items-center gap-1.5">
              <MessageSquarePlus className="w-4 h-4 text-purple-600" /> Enviar feedback
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              Sobre esta tela (<span className="font-mono">{pathname}</span>). Vai com seu nome, pra
              gente poder te chamar se precisar.
            </p>
            <textarea
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              placeholder="O que poderia melhorar aqui? Achou um bug? Tem uma ideia?"
              className="w-full rounded-md border bg-background p-2 text-sm resize-none"
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={enviar} disabled={enviando || msg.trim().length < 3}>
                {enviando ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Send className="w-4 h-4 mr-1" />
                )}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default FeedbackWidget;
