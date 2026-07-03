'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { isPublicRoute } from '@/lib/auth/public-routes';
import { api } from '@/lib/api-client';
import { PesquisaModalView, type PesquisaDef, type RespostaItem } from './pesquisa/PesquisaModalView';

/**
 * Pesquisa de primeira impressão — modal que aparece 1x por usuário (com adiamento até 3x).
 * Montado no shell autenticado (app/layout). Nunca trava o app: qualquer erro é silencioso.
 */
export function PesquisaOnboarding() {
  const { user } = useUser();
  const pathname = usePathname() || '';
  const [pesquisa, setPesquisa] = useState<PesquisaDef | null>(null);
  const buscou = useRef(false);

  useEffect(() => {
    if (buscou.current) return;
    if (!user?.email) return;
    if (isPublicRoute(pathname)) return;
    buscou.current = true;
    (async () => {
      try {
        const r = (await api.get('/api/feedback/pendente')) as { pendente: boolean; pesquisa?: PesquisaDef };
        if (r?.pendente && r.pesquisa) setPesquisa(r.pesquisa);
      } catch {
        /* silencioso — a pesquisa nunca deve atrapalhar o uso do sistema */
      }
    })();
  }, [user?.email, pathname]);

  if (!pesquisa) return null;

  const adiar = async () => {
    const id = pesquisa.id;
    setPesquisa(null);
    try {
      await api.post('/api/feedback/adiar', { pesquisa_id: id });
    } catch {
      /* noop */
    }
  };

  const enviar = async (respostas: RespostaItem[]) => {
    try {
      await api.post('/api/feedback/responder', { pesquisa_id: pesquisa.id, respostas });
      setPesquisa(null);
      toast.success('Valeu pelo feedback! 🙏', { description: 'Sua opinião ajuda demais.' });
    } catch {
      toast.error('Não rolou enviar agora. Tenta de novo?');
    }
  };

  return <PesquisaModalView pesquisa={pesquisa} onEnviar={enviar} onFechar={adiar} />;
}
