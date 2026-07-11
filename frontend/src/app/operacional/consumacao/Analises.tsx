'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GraficoBarraH, GraficoBarra, GraficoLinha, GraficoDonut } from '@/components/graficos/Charts';

export interface LinhaAnalise {
  categoria: string;
  data: string;
  mesa: string | null;
  motivo: string | null;
  produto: string | null;
  qtd: number;
  valor_bruto: number;
  custo: number;
  tem_ficha: boolean;
}

const LABEL: Record<string, string> = {
  funcionarios_operacao: 'Func. Operação',
  funcionarios_escritorio: 'Func. Escritório',
  aniversario: 'Aniversário',
  programa_pontos: 'Prog. Pontos',
  beneficio_cliente: 'Benefício Cliente',
  influencer: 'Influencer',
  artistas: 'Artistas',
  socios: 'Sócios',
  relacionamento: 'Relacionamento',
  outros: 'Outros',
};

// paleta que funciona em claro/escuro
const PALETA = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#f97316', '#64748b'];
const COR_CAT: Record<string, string> = {
  funcionarios_operacao: '#3b82f6',
  funcionarios_escritorio: '#6366f1',
  aniversario: '#ec4899',
  programa_pontos: '#8b5cf6',
  beneficio_cliente: '#14b8a6',
  influencer: '#d946ef',
  artistas: '#f59e0b',
  socios: '#10b981',
  relacionamento: '#f97316',
  outros: '#64748b',
};

const moeda = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const normMesa = (m: string | null) => (m || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—';
const DOW_L = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dowDe = (s: string) => new Date(s + 'T12:00:00').getDay();

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[11px] text-gray-400">{titulo}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{valor}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{titulo}</p>
        {children}
      </CardContent>
    </Card>
  );
}

export default function Analises({ linhas, fator }: { linhas: LinhaAnalise[]; fator: number }) {
  const kpis = useMemo(() => {
    const custo = linhas.reduce((s, l) => s + l.custo, 0);
    const bruto = linhas.reduce((s, l) => s + l.valor_bruto, 0);
    const pessoas = new Set(linhas.map((l) => normMesa(l.mesa))).size;
    const comFicha = linhas.filter((l) => l.tem_ficha).length;
    return {
      custo,
      bruto,
      lancamentos: linhas.length,
      pessoas,
      pctFicha: linhas.length ? (comFicha / linhas.length) * 100 : 0,
      ticketPessoa: pessoas ? custo / pessoas : 0,
    };
  }, [linhas]);

  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linhas) m.set(l.categoria, (m.get(l.categoria) || 0) + l.custo);
    return Array.from(m.entries())
      .map(([k, v]) => ({ cat: k, nome: LABEL[k] || k, custo: Math.round(v) }))
      .sort((a, b) => b.custo - a.custo);
  }, [linhas]);

  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linhas) m.set(l.data, (m.get(l.data) || 0) + l.custo);
    return Array.from(m.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([d, v]) => ({ dia: d.slice(8, 10) + '/' + d.slice(5, 7), custo: Math.round(v) }));
  }, [linhas]);

  const topPessoas = useMemo(() => {
    const m = new Map<string, { nome: string; custo: number }>();
    for (const l of linhas) {
      const k = normMesa(l.mesa);
      const a = m.get(k) || { nome: l.mesa || '(sem mesa)', custo: 0 };
      a.custo += l.custo;
      a.nome = l.mesa || a.nome;
      m.set(k, a);
    }
    return Array.from(m.values())
      .map((x) => ({ ...x, custo: Math.round(x.custo) }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 10);
  }, [linhas]);

  const porDow = useMemo(() => {
    const arr = DOW_L.map((l) => ({ dow: l, custo: 0 }));
    for (const l of linhas) arr[dowDe(l.data)].custo += l.custo;
    return arr.map((x) => ({ ...x, custo: Math.round(x.custo) }));
  }, [linhas]);

  const ficha = useMemo(() => {
    let com = 0;
    let sem = 0;
    for (const l of linhas) {
      if (l.tem_ficha) com += l.custo;
      else sem += l.custo;
    }
    return [
      { nome: 'Com ficha (real)', valor: Math.round(com), cor: '#10b981' },
      { nome: `Sem ficha (×${fator})`, valor: Math.round(sem), cor: '#94a3b8' },
    ];
  }, [linhas, fator]);

  const topProdutos = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of linhas) {
      const p = l.produto || '(sem produto)';
      m.set(p, (m.get(p) || 0) + l.custo);
    }
    return Array.from(m.entries())
      .map(([nome, v]) => ({ nome, custo: Math.round(v) }))
      .sort((a, b) => b.custo - a.custo)
      .slice(0, 8);
  }, [linhas]);

  const insights = useMemo(() => {
    const out: string[] = [];
    if (!linhas.length) return out;
    const topCat = porCategoria[0];
    if (topCat && kpis.custo > 0) out.push(`${topCat.nome} concentra ${((topCat.custo / kpis.custo) * 100).toFixed(0)}% do custo (${moeda(topCat.custo)}).`);
    const topP = topPessoas[0];
    if (topP) out.push(`Quem mais consome: ${topP.nome} (${moeda(topP.custo)}).`);
    const semFicha = ficha[1].valor;
    if (kpis.custo > 0) out.push(`${((semFicha / kpis.custo) * 100).toFixed(0)}% do custo é estimado (itens sem ficha técnica).`);
    const diaTop = [...porDow].sort((a, b) => b.custo - a.custo)[0];
    if (diaTop && diaTop.custo > 0) out.push(`Dia da semana com maior consumo: ${diaTop.dow}.`);
    return out;
  }, [linhas, porCategoria, topPessoas, ficha, porDow, kpis]);

  if (!linhas.length) {
    return <div className="py-16 text-center text-gray-400">Sem dados no período/filtro para analisar.</div>;
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi titulo="Custo real" valor={moeda(kpis.custo)} sub={`bruto ${moeda(kpis.bruto)}`} />
        <Kpi titulo="Lançamentos" valor={kpis.lancamentos.toLocaleString('pt-BR')} />
        <Kpi titulo="Pessoas/mesas" valor={kpis.pessoas.toLocaleString('pt-BR')} />
        <Kpi titulo="Ticket médio/pessoa" valor={moeda(kpis.ticketPessoa)} />
        <Kpi titulo="% com ficha" valor={`${kpis.pctFicha.toFixed(0)}%`} sub="resto estimado" />
        <Kpi titulo="Custo médio/lanç." valor={moeda(kpis.lancamentos ? kpis.custo / kpis.lancamentos : 0)} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">💡 Destaques</p>
            <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
              {insights.map((i, k) => (
                <li key={k}>{i}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloco titulo="Custo por categoria">
          <GraficoBarraH
            data={porCategoria}
            xKey="nome"
            valueKey="custo"
            height={260}
            formatV={moeda}
            corPorItem={(d) => COR_CAT[d.cat] || '#64748b'}
          />
        </Bloco>

        <Bloco titulo="Evolução do custo por dia">
          <GraficoLinha
            data={porDia}
            xKey="dia"
            series={[{ key: 'custo', nome: 'Custo', cor: '#6366f1' }]}
            area
            height={260}
            formatV={moeda}
          />
        </Bloco>

        <Bloco titulo="Top 10 pessoas/mesas por custo">
          <GraficoBarraH data={topPessoas} xKey="nome" valueKey="custo" cor="#0ea5e9" height={300} formatV={moeda} />
        </Bloco>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Bloco titulo="Custo por dia da semana">
            <GraficoBarra data={porDow} xKey="dow" valueKey="custo" cor="#f59e0b" height={260} formatV={moeda} />
          </Bloco>

          <Bloco titulo="Real (ficha) × Estimado">
            <GraficoDonut data={ficha} nameKey="nome" valueKey="valor" cores={ficha.map((f) => f.cor)} height={260} formatV={moeda} />
            <div className="flex justify-center gap-4 text-xs text-gray-500">
              {ficha.map((f) => (
                <span key={f.nome} className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: f.cor }} />
                  {f.nome}: {moeda(f.valor)}
                </span>
              ))}
            </div>
          </Bloco>
        </div>
      </div>

      <Bloco titulo="Top produtos consumidos (por custo)">
        <GraficoBarraH data={topProdutos} xKey="nome" valueKey="custo" cor="#8b5cf6" height={280} formatV={moeda} />
      </Bloco>
    </div>
  );
}
