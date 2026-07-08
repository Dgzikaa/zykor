'use client';

import { useCallback, useEffect, useState } from 'react';
import { DreTab } from '../../estrategico/orcamentacao/components/DreTab';
import { DreLancamentosModal, DreLancamento } from './DreLancamentosModal';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api-client';
import { usePageTitle } from '@/contexts/PageTitleContext';

/**
 * DRE principal (ano corrente) + comparativo (ano anterior, ocultável).
 * Cada DreTab tem seu próprio seletor de ano. Clicar numa célula de mês de uma
 * sub-linha abre o popup com os lançamentos daquela categoria/mês (drill-down).
 */
export function DreComparativo({ barId, anoAtual }: { barId: number; anoAtual: number }) {
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('📊 DRE');
    return () => setPageTitle('');
  }, [setPageTitle]);
  const [mostrarComparativo, setMostrarComparativo] = useState(false);
  const [drill, setDrill] = useState<{
    open: boolean; loading: boolean; titulo: string;
    lancamentos: DreLancamento[]; total: number; erro: string | null;
  }>({ open: false, loading: false, titulo: '', lancamentos: [], total: 0, erro: null });

  const abrirDrill = useCallback(async (p: { categoria_macro: string; canon: string; mes: number; ano: number; label: string }) => {
    setDrill({ open: true, loading: true, titulo: p.label, lancamentos: [], total: 0, erro: null });
    try {
      const qs = new URLSearchParams({
        bar_id: String(barId), ano: String(p.ano), mes: String(p.mes),
        categoria_macro: p.categoria_macro, categoria_canon: p.canon,
      });
      const res = await api.get(`/api/financeiro/dre/lancamentos?${qs.toString()}`);
      setDrill(d => ({ ...d, loading: false, lancamentos: res.lancamentos || [], total: res.total || 0 }));
    } catch (e: any) {
      setDrill(d => ({ ...d, loading: false, erro: e?.message || 'Erro ao carregar lançamentos' }));
    }
  }, [barId]);

  const fecharDrill = useCallback(() => setDrill(d => ({ ...d, open: false })), []);

  return (
    <div className="space-y-2">
      <DreTab barId={barId} anoInicial={anoAtual} onDrill={abrirDrill} />

      <div className="mt-3 mb-1 flex items-center justify-end px-1">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setMostrarComparativo(v => !v)}>
          {mostrarComparativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {mostrarComparativo ? 'Ocultar comparativo' : 'Mostrar comparativo'}
        </Button>
      </div>

      {mostrarComparativo && <DreTab barId={barId} anoInicial={anoAtual - 1} onDrill={abrirDrill} />}

      <DreLancamentosModal
        open={drill.open} onClose={fecharDrill} titulo={drill.titulo}
        loading={drill.loading} lancamentos={drill.lancamentos} total={drill.total} erro={drill.erro}
      />
    </div>
  );
}
