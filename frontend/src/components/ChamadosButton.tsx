'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

/**
 * Botão da Central de Chamados no header (ao lado do sino). Ícone de interrogação →
 * leva pra /chamados. Badge = chamados com novidade pro usuário logado (fila do suporte
 * ou os próprios chamados). Contagem independe do bar selecionado (o sino filtra por bar).
 */
export function ChamadosButton() {
  const router = useRouter();
  const [naoLidos, setNaoLidos] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get('/api/chamados?resumo=1');
      if (r?.success) setNaoLidos(Number(r.data?.nao_lidos) || 0);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    const onFocus = () => carregar();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [carregar]);

  return (
    <Button
      variant="ghost"
      onClick={() => router.push('/chamados')}
      className="relative rounded-[4px] hover:text-gray-500 text-gray-500 h-8 p-2 py-2"
      aria-label="Central de chamados"
      title="Central de chamados"
    >
      <HelpCircle className="h-4 w-4" />
      {naoLidos > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-900 tabular-nums"
          aria-label={`${naoLidos} chamados com novidade`}
        >
          {naoLidos > 99 ? '99+' : naoLidos}
        </span>
      )}
    </Button>
  );
}

export default ChamadosButton;
