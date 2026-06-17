'use client';

import { useEffect, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChefHat } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CustoManualEditor from './CustoManualEditor';
import HistoricoPrecos from './HistoricoPrecos';

const fmt = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(n));
const fmtMoeda = (n: number | null | undefined) => (n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n));

const classes = {
  star: { cor: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200', icone: '⭐', titulo: 'Stars', dica: 'Manter, dar destaque. Cardápio premium.' },
  plowhorse: { cor: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200', icone: '🐴', titulo: 'Plowhorses', dica: 'Popular mas margem baixa. Reduzir custo, aumentar preço pouco, ou repensar receita.' },
  puzzle: { cor: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200', icone: '🧩', titulo: 'Puzzles', dica: 'Margem boa mas pouco vendido. Promover, foto melhor, posição no cardápio.' },
  dog: { cor: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200', icone: '🐶', titulo: 'Dogs', dica: 'Pouco vendido e margem baixa. Considerar retirar do cardápio.' },
} as const;

const COR_PONTO: Record<string, string> = {
  star: '#eab308', plowhorse: '#3b82f6', puzzle: '#a855f7', dog: '#ef4444',
};

export default function CardapioPage() {
  const { selectedBar } = useBar();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [classeAtiva, setClasseAtiva] = useState<keyof typeof classes>('star');

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    fetch(`/api/cardapio/engenharia?bar_id=${selectedBar.id}&dias=${dias}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  const resumo = data?.resumo || {};
  const porClasse = data?.por_classe || {};
  const lista = porClasse[classeAtiva] || [];

  const scatter = ['star','plowhorse','puzzle','dog'].flatMap(cls =>
    (porClasse[cls] || []).map((p: any) => ({
      classe: cls,
      x: Math.min(p.popularidade_norm, 5),
      y: Math.min(p.margem_norm, 5),
      nome: p.produto_desc,
      qtd: p.qtd_vendida,
      margem: p.margem_unitaria,
    }))
  );

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ChefHat className="w-6 h-6 text-pink-600" /> Engenharia de Cardápio</h1>
          <p className="text-sm text-gray-500">Star / Plowhorse / Puzzle / Dog com base em popularidade × margem.</p>
        </div>
        <select
          value={dias}
          onChange={e => setDias(Number(e.target.value))}
          className="text-sm border rounded px-3 py-1.5 bg-white dark:bg-gray-900"
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={60}>Últimos 60 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      <Tabs defaultValue="engenharia" className="space-y-6">
        <TabsList>
          <TabsTrigger value="engenharia">Engenharia</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="historico">Histórico de preços</TabsTrigger>
        </TabsList>

        <TabsContent value="engenharia" className="space-y-6 mt-0">
          {loading ? (
            <Skeleton className="h-96" />
          ) : (
          <>
      {/* 4 cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['star','plowhorse','puzzle','dog'] as const).map(c => {
          const meta = classes[c];
          const r = resumo[c] || { qtd: 0, receita_total: 0, margem_total: 0, margem_perc_media: 0 };
          return (
            <button
              key={c}
              onClick={() => setClasseAtiva(c)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${meta.bg} ${classeAtiva === c ? 'ring-2 ring-offset-2 ring-pink-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{meta.icone}</span>
                <span className={`text-xl font-bold ${meta.cor}`}>{r.qtd}</span>
              </div>
              <p className={`text-sm font-semibold ${meta.cor}`}>{meta.titulo}</p>
              <p className="text-xs text-gray-500 mt-1">Receita: {fmtMoeda(r.receita_total)}</p>
              <p className="text-xs text-gray-500">Margem: {fmtMoeda(r.margem_total)}</p>
            </button>
          );
        })}
      </div>

      {/* Matriz 2x2 (scatter) */}
      <Card className="p-6">
        <h2 className="font-semibold mb-1">Matriz de classificação</h2>
        <p className="text-xs text-gray-500 mb-4">Linha tracejada = mediana. Pontos no canto direito-cima são stars.</p>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" dataKey="x" name="Popularidade" domain={[0, 5]}
              label={{ value: 'Popularidade (× mediana)', position: 'insideBottom', offset: -5, fontSize: 11 }} fontSize={11} />
            <YAxis type="number" dataKey="y" name="Margem" domain={[0, 5]}
              label={{ value: 'Margem unit. (× mediana)', angle: -90, position: 'insideLeft', fontSize: 11 }} fontSize={11} />
            <ReferenceLine x={1} stroke="#9ca3af" strokeDasharray="3 3" />
            <ReferenceLine y={1} stroke="#9ca3af" strokeDasharray="3 3" />
            <Tooltip
              content={({ active, payload }: any) => {
                if (!active || !payload?.[0]) return null;
                const p = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-gray-900 border rounded p-2 text-xs shadow-lg">
                    <p className="font-semibold">{p.nome}</p>
                    <p className="text-gray-500">{p.qtd} vendidos · margem R$ {p.margem.toFixed(2)}</p>
                  </div>
                );
              }}
            />
            {(['star','plowhorse','puzzle','dog'] as const).map(cls => (
              <Scatter
                key={cls}
                name={classes[cls].titulo}
                data={scatter.filter(s => s.classe === cls)}
                fill={COR_PONTO[cls]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Lista da classe selecionada */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold flex items-center gap-2">
            <span className="text-xl">{classes[classeAtiva].icone}</span>
            {classes[classeAtiva].titulo} ({lista.length})
          </h2>
        </div>
        <p className={`text-sm mb-4 ${classes[classeAtiva].cor}`}>💡 {classes[classeAtiva].dica}</p>
        {lista.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhum produto nessa classe.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Produto</th>
                  <th className="text-left py-2">Grupo</th>
                  <th className="text-right py-2">Qtd</th>
                  <th className="text-right py-2">Preço méd.</th>
                  <th className="text-right py-2">Custo méd.</th>
                  <th className="text-right py-2">Margem unit.</th>
                  <th className="text-right py-2">Margem %</th>
                  <th className="text-right py-2">Receita</th>
                  <th className="text-right py-2">Margem total</th>
                </tr>
              </thead>
              <tbody>
                {lista
                  .sort((a: any, b: any) => b.margem_total - a.margem_total)
                  .slice(0, 50)
                  .map((p: any) => (
                    <tr key={p.produto_codigo} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td className="py-2 max-w-xs truncate">{p.produto_desc}</td>
                      <td className="py-2 text-xs text-gray-500">{p.grupo_desc}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(p.qtd_vendida)}</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoeda(p.preco_medio)}</td>
                      <td className="py-2 text-right tabular-nums text-gray-500">{fmtMoeda(p.custo_medio)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{fmtMoeda(p.margem_unitaria)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(p.margem_perc)}%</td>
                      <td className="py-2 text-right tabular-nums">{fmtMoeda(p.receita_total)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{fmtMoeda(p.margem_total)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

          </>
          )}
        </TabsContent>

        <TabsContent value="custos" className="mt-0">
          <CustoManualEditor dias={dias} />
        </TabsContent>

        <TabsContent value="historico" className="mt-0">
          <HistoricoPrecos dias={dias} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
