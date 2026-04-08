'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { verificarCredenciais } from '../services/agendamento-service';

export interface CredenciaisVerificadasResult {
  inter: boolean;
}

export interface AgendamentoCredenciaisProps {
  barId: number | null;
  barNome?: string | null;
  onCredenciaisVerificadas: (result: CredenciaisVerificadasResult) => void;
}

/**
 * Verifica credenciais PIX Inter ao montar ou quando o bar muda; notifica o pai e exibe aviso se faltar.
 */
export function AgendamentoCredenciais({
  barId,
  barNome,
  onCredenciaisVerificadas,
}: AgendamentoCredenciaisProps) {
  const notifyRef = useRef(onCredenciaisVerificadas);
  notifyRef.current = onCredenciaisVerificadas;

  const [verificando, setVerificando] = useState(false);
  const [inter, setInter] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function executar() {
      if (!barId) {
        if (!cancelado) {
          setVerificando(false);
          setInter(false);
          setConcluido(true);
          notifyRef.current({ inter: false });
        }
        return;
      }

      setVerificando(true);
      setConcluido(false);

      try {
        const res = await verificarCredenciais(barId);
        if (cancelado) return;

        const result = res.ok
          ? { inter: res.data.inter ?? false }
          : { inter: false };

        if (!result.inter) {
          console.warn(
            `[AGENDAMENTO] Bar ${barId}${barNome ? ` (${barNome})` : ''} sem credencial Inter PIX`
          );
        }

        setInter(result.inter);
        setConcluido(true);
        notifyRef.current(result);
      } catch (e) {
        console.error('Erro ao verificar credenciais:', e);
        if (cancelado) return;
        setInter(false);
        setConcluido(true);
        notifyRef.current({ inter: false });
      } finally {
        if (!cancelado) setVerificando(false);
      }
    }

    void executar();
    return () => {
      cancelado = true;
    };
  }, [barId, barNome]);

  if (verificando) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        <span>Verificando credenciais…</span>
      </div>
    );
  }

  if (!concluido || !barId || inter) {
    return null;
  }

  const nomeExibicao = barNome?.trim() || `Bar #${barId}`;

  return (
    <Card
      className="card-dark border-amber-200/80 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30 shadow-sm"
      role="status"
    >
      <CardContent className="flex gap-3 py-3 px-4">
        <AlertCircle
          className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <div className="min-w-0 space-y-2 text-sm">
          <p className="font-medium text-foreground">
            PIX Inter não configurado para {nomeExibicao}
          </p>
          <p className="text-muted-foreground">
            Configure a integração Inter PIX nas configurações para habilitar pagamentos.
          </p>
          <ul className="flex flex-col gap-1 text-xs sm:text-sm">
            <li className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span>PIX Inter: não configurado</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
