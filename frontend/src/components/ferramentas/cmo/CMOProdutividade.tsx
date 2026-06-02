'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface ProdRow {
  mes: string;
  cmo_total: number;
  cmo_fixo: number;
  cmo_variavel: number;
  faturamento_liquido: number;
  pessoas: number;
  cmo_pct: number | null;
  cmo_por_cliente: number | null;
}

const moeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const mesLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MESES[Number(m)]}/${a.slice(2)}`;
};

/**
 * Produtividade da mão de obra: CMO% sobre faturamento, custo por cliente e split
 * fixo vs variável (mensal). Complementa o CMODashboard (que é semanal, em R$).
 * Fonte: gold.cmo_produtividade_mensal via /api/ferramentas/cmo/produtividade.
 */
export default function CMOProdutividade() {
  const { selectedBar } = useBar();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<ProdRow[]>([]);
  const ano = new Date().getFullYear();

  useEffect(() => {
    if (!selectedBar?.id) return;
    let ativo = true;
    setLoading(true);
    fetch(`/api/ferramentas/cmo/produtividade?ano=${ano}`, {
      headers: { 'x-selected-bar-id': String(selectedBar.id) },
    })
      .then((r) => r.json())
      .then((j) => { if (ativo) setDados(j.success ? j.data : []); })
      .catch(() => { if (ativo) setDados([]); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [selectedBar?.id, ano]);

  // Último mês fechado = tem faturamento (cmo_pct não nulo).
  const fechados = dados.filter((d) => d.cmo_pct != null);
  const atual = fechados[fechados.length - 1];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!atual) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Sem dados de produtividade para {ano}.
        </CardContent>
      </Card>
    );
  }

  const pctFixo = atual.cmo_total > 0 ? (atual.cmo_fixo / atual.cmo_total) * 100 : 0;
  const corCmo = (pct: number) => (pct <= 25 ? 'text-green-600' : pct <= 35 ? 'text-amber-600' : 'text-red-600');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Produtividade da Mão de Obra</h3>
        <p className="text-sm text-muted-foreground">
          CMO sobre faturamento e por cliente — mês de referência: {mesLabel(atual.mes)}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CMO % do faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${corCmo(atual.cmo_pct || 0)}`}>{(atual.cmo_pct || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">{moeda(atual.cmo_total)} / {moeda(atual.faturamento_liquido)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Custo MO / cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moeda(atual.cmo_por_cliente)}</div>
            <p className="text-xs text-muted-foreground mt-1">{Number(atual.pessoas).toLocaleString('pt-BR')} clientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fixo (salário/encargos)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moeda(atual.cmo_fixo)}</div>
            <p className="text-xs text-muted-foreground mt-1">{pctFixo.toFixed(0)}% do CMO</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Variável (freela)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{moeda(atual.cmo_variavel)}</div>
            <p className="text-xs text-muted-foreground mt-1">{(100 - pctFixo).toFixed(0)}% do CMO</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Por mês ({ano})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1 font-medium">Mês</th>
                <th className="text-right py-1 font-medium">CMO</th>
                <th className="text-right py-1 font-medium">Faturamento</th>
                <th className="text-right py-1 font-medium">CMO %</th>
                <th className="text-right py-1 font-medium">R$/cliente</th>
              </tr>
            </thead>
            <tbody>
              {fechados.map((d) => (
                <tr key={d.mes} className="border-b last:border-0">
                  <td className="py-1">{mesLabel(d.mes)}</td>
                  <td className="text-right py-1">{moeda(d.cmo_total)}</td>
                  <td className="text-right py-1">{moeda(d.faturamento_liquido)}</td>
                  <td className={`text-right py-1 font-semibold ${corCmo(d.cmo_pct || 0)}`}>{(d.cmo_pct || 0).toFixed(1)}%</td>
                  <td className="text-right py-1">{moeda(d.cmo_por_cliente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
