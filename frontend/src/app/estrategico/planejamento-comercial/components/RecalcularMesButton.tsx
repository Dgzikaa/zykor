'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';

/**
 * Recalcula os custos (calculate_evento_metrics) de TODOS os dias do mês selecionado
 * a partir do Conta Azul ao vivo — atalho pra não esperar o cron diário das 11:45
 * quando houve correção de lançamento no CA. Fica na lateral "Controles".
 */
export function RecalcularMesButton({ barId, mes, ano }: { barId?: number; mes: number; ano: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const recalcular = async () => {
    if (!barId || loading) return;
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/planejamento/recalcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(barId) },
        body: JSON.stringify({ ano, mes }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j?.error || 'falha ao recalcular');
      setMsg(`${j.recalculados}/${j.total} dia(s) recalculado(s) do Conta Azul.`);
      router.refresh(); // re-executa o server component → tabela pega os novos valores
    } catch (e: any) {
      setMsg(`Erro: ${e?.message || 'tente de novo'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        onClick={recalcular}
        disabled={loading || !barId}
        className="w-full h-8"
        leftIcon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      >
        Recalcular custos do mês (CA)
      </Button>
      {msg && <p className="text-[11px] text-muted-foreground leading-tight">{msg}</p>}
    </div>
  );
}
