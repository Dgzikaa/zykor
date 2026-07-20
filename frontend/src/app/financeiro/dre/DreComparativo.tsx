'use client';

import { useCallback, useEffect, useState } from 'react';
import { DreTab } from '../../estrategico/orcamentacao/components/DreTab';
import { DreEventosTab } from './DreEventosTab';
import { DreLancamentosModal, DreLancamento } from './DreLancamentosModal';
import { CategoriasTab } from './CategoriasTab';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api-client';
import { usePageTitle } from '@/contexts/PageTitleContext';

/**
 * DRE principal (ano corrente) + comparativo (ano anterior, ocultável).
 * Cada DreTab tem seu próprio seletor de ano. Clicar numa célula de mês de uma
 * sub-linha abre o popup com os lançamentos daquela categoria/mês (drill-down).
 * A aba "Categorias" é a Central de Categorias (config das macros da DRE).
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
    <Tabs defaultValue="dre" className="space-y-2">
      <TabsList>
        <TabsTrigger value="dre">DRE</TabsTrigger>
        <TabsTrigger value="dre-bar">DRE Bar</TabsTrigger>
        <TabsTrigger value="dre-eventos">DRE Eventos</TabsTrigger>
        <TabsTrigger value="categorias">Categorias</TabsTrigger>
      </TabsList>

      <TabsContent value="dre" className="space-y-2 mt-2">
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
      </TabsContent>

      <TabsContent value="dre-bar" className="space-y-2 mt-2">
        {/* Espelho da DRE isolando a operação de bar: deduz entrada (couvert+ingresso+Sympla)
            da Receita e remove o grupo Atrações & Eventos. Drill-down da dedução é bloqueado
            no DreTab (linha sintética, sem lançamentos no ContaAzul). */}
        <DreTab barId={barId} anoInicial={anoAtual} onDrill={abrirDrill} modoBar />
      </TabsContent>

      <TabsContent value="dre-eventos" className="space-y-2 mt-2">
        {/* Complemento da DRE Bar: só a economia do show (entrada − imposto/taxa − artístico).
            As linhas artísticas são drilláveis (macro real 'Despesas Comerciais' no CA). */}
        <DreEventosTab barId={barId} anoInicial={anoAtual} onDrill={abrirDrill} />
        <DreLancamentosModal
          open={drill.open} onClose={fecharDrill} titulo={drill.titulo}
          loading={drill.loading} lancamentos={drill.lancamentos} total={drill.total} erro={drill.erro}
        />
      </TabsContent>

      <TabsContent value="categorias" className="mt-2">
        <CategoriasTab />
      </TabsContent>
    </Tabs>
  );
}
