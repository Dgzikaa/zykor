'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Zap } from 'lucide-react';

const brDate = (d: string | null) => (d ? d.split('T')[0].split('-').reverse().join('/') : null);

/**
 * Toggle "Lançamento automático" por (bar, tipo). Verdinho = cron ligado. O botão manual não depende
 * disto. Ao ligar, o automático passa a valer só pros NOVOS (o histórico segue manual).
 * `disponivel=false` → mostra desabilitado ("em breve") pras abas ainda sem automação.
 */
export function AutoToggle({ tipo, disponivel = true }: { tipo: string; disponivel?: boolean }) {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const [ativo, setAtivo] = useState(false);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id || !disponivel) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/financeiro/fechamento/auto-config?bar_id=${selectedBar.id}`);
      const c = r?.config?.[tipo];
      setAtivo(!!c?.ativo); setCutoff(c?.cutoff || null);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }, [selectedBar?.id, tipo, disponivel]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggle = async () => {
    if (!selectedBar?.id || salvando) return;
    const novo = !ativo;
    setSalvando(true);
    try {
      const r = await api.put('/api/financeiro/fechamento/auto-config', { bar_id: selectedBar.id, tipo, ativo: novo });
      if (r?.ok) {
        setAtivo(novo); setCutoff(r.cutoff || null);
        showToast({ type: 'success', title: novo ? 'Automático ligado — vale só pros novos' : 'Automático desligado' });
      } else showToast({ type: 'error', title: 'Falha ao alterar', message: r?.error || 'Erro' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Falha ao alterar', message: e?.message });
    } finally { setSalvando(false); }
  };

  if (!disponivel) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/50" title="Automação em breve">
        <Zap className="h-3.5 w-3.5" /> Automático (em breve)
      </span>
    );
  }

  const corte = ativo && cutoff ? brDate(cutoff) : null;
  return (
    <button onClick={toggle} disabled={salvando || loading}
      className="inline-flex items-center gap-2 rounded-lg border px-2.5 h-9 text-xs hover:bg-muted/40 disabled:opacity-60"
      title={ativo ? (corte ? `Automático desde ${corte} (só novos)` : 'Automático ligado') : 'Ativar lançamento automático'}>
      <span className="text-muted-foreground">Lançamento automático</span>
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ativo ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {(salvando || loading) && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </button>
  );
}
