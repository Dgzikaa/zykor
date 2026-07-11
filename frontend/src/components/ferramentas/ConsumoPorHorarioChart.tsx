'use client';

import { useEffect, useMemo, useState } from 'react';
import { GraficoBase } from '@/components/graficos/GraficoBase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBar } from '@/contexts/BarContext';
import { Package } from 'lucide-react';

interface ProdutoHora {
  produto: string;
  grupo: string;
  categoria: string | null;
  quantidade: number;
  valor: number;
  rank: number;
}
interface Hora {
  hora: number;
  total_qtd: number;
  total_valor: number;
  produtos: ProdutoHora[];
  outros_qtd: number;
  outros_valor: number;
}

interface Props {
  dataSelecionada: string;
}

// cores por posição (1º..5º) + cinza p/ "Outros"
const CORES = ['#2563eb', '#16a34a', '#d97706', '#8b5cf6', '#db2777'];
const COR_OUTROS = '#cbd5e1';
const CATEGORIAS = [
  { key: '', label: 'Todas' },
  { key: 'BEBIDA', label: 'Bebida' },
  { key: 'DRINK', label: 'Drink' },
  { key: 'COMIDA', label: 'Comida' },
];

export function ConsumoPorHorarioChart({ dataSelecionada }: Props) {
  const { selectedBar } = useBar();
  const [horas, setHoras] = useState<Hora[]>([]);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<'qtd' | 'valor'>('qtd');
  const [categoria, setCategoria] = useState('');

  useEffect(() => {
    if (!dataSelecionada || !selectedBar) return;
    setLoading(true);
    const params = new URLSearchParams({
      data: dataSelecionada,
      bar_id: String(selectedBar.id),
      top: '5',
      metric,
    });
    if (categoria) params.set('categoria', categoria);
    fetch(`/api/analitico/evento/consumo-hora?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => setHoras(j.success ? j.horas : []))
      .catch(() => setHoras([]))
      .finally(() => setLoading(false));
  }, [dataSelecionada, selectedBar?.id, metric, categoria]);

  // monta dados do gráfico: chaves posicionais p0..p4 + outros (cada hora tem produtos diferentes)
  const chartData = useMemo(() => {
    return horas.map((h) => {
      const row: any = {
        horaLabel: `${String(h.hora).padStart(2, '0')}h`,
        _produtos: h.produtos,
      };
      for (let i = 0; i < 5; i++) {
        const p = h.produtos[i];
        row[`p${i}`] = p ? (metric === 'valor' ? p.valor : p.quantidade) : 0;
        row[`p${i}_nome`] = p ? p.produto : null;
      }
      row.outros = metric === 'valor' ? h.outros_valor : h.outros_qtd;
      return row;
    });
  }, [horas, metric]);

  // séries posicionais fixas: 1º..5º produto de cada hora + "Outros" (cores preservadas por posição)
  const chartSeries = [
    { key: 'p0', label: '1º' },
    { key: 'p1', label: '2º' },
    { key: 'p2', label: '3º' },
    { key: 'p3', label: '4º' },
    { key: 'p4', label: '5º' },
    { key: 'outros', label: 'Outros' },
  ];

  return (
    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Consumo por horário
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Top 5 produtos de cada hora (o restante vai em “Outros”) • {dataSelecionada}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* métrica */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
              {(['qtd', 'valor'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 ${
                    metric === m
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {m === 'qtd' ? 'Quantidade' : 'Valor'}
                </button>
              ))}
            </div>
            {/* categoria */}
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1.5"
            >
              {CATEGORIAS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[320px] flex items-center justify-center text-sm text-gray-400">
            Carregando…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 text-center">
            Sem dados de produto×hora para esta data ainda.
            <br />
            (Disponível após a coleta/backfill da query de produtos por horário.)
          </div>
        ) : (
          <GraficoBase
            tipo="barra"
            stacked
            data={chartData}
            xKey="horaLabel"
            series={chartSeries}
            cores={[...CORES, COR_OUTROS]}
            height={360}
            formatY={(v) => (metric === 'valor' ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
          />
        )}
      </CardContent>
    </Card>
  );
}
