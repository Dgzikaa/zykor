'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, RefreshCw, Calendar, Sparkles, ChevronDown } from 'lucide-react';

type Relatorio = {
  id: number;
  bar_id: number;
  tipo: string;
  periodo_ini: string;
  periodo_fim: string;
  resumo_executivo: string;
  dados_brutos: any;
  modelo_usado: string;
  tokens_input: number;
  tokens_output: number;
  criado_em: string;
};

const NOMES_BAR: Record<number, string> = { 3: 'Ordinário', 4: 'Deboche' };

function fmtData(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function ResumoMarkdown({ texto }: { texto: string }) {
  // Renderizador simples markdown - headings, bold, listas
  const linhas = texto.split('\n');
  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed">
      {linhas.map((linha, i) => {
        if (linha.startsWith('## ')) {
          return <h2 key={i} className="text-base font-bold mt-4 mb-2 text-pink-700 dark:text-pink-400">{linha.replace(/^## /, '')}</h2>;
        }
        if (linha.startsWith('# ')) {
          return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{linha.replace(/^# /, '')}</h1>;
        }
        if (linha.startsWith('- ') || linha.startsWith('* ')) {
          return <li key={i} className="ml-4">{linha.replace(/^[-*] /, '')}</li>;
        }
        if (!linha.trim()) return <div key={i} className="h-2" />;
        const partes = linha.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="my-1">
            {partes.map((p, j) =>
              p.startsWith('**') ? <strong key={j}>{p.replace(/\*\*/g, '')}</strong> : p
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function RelatorioSemanalPage() {
  const [rels, setRels] = useState<Relatorio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [barFilter, setBarFilter] = useState<number | 'todos'>('todos');
  const [expandido, setExpandido] = useState<Set<number>>(new Set());

  const carregar = async () => {
    setCarregando(true);
    const url = barFilter === 'todos'
      ? '/api/relatorio-executivo?limit=12'
      : `/api/relatorio-executivo?limit=12&bar_id=${barFilter}`;
    const r = await fetch(url);
    const j = await r.json();
    setRels(j?.relatorios ?? []);
    if (j?.relatorios?.[0]) setExpandido(new Set([j.relatorios[0].id]));
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [barFilter]);

  const gerar = async () => {
    if (!confirm('Gerar relatórios da última semana pra TODOS os bares ativos? Custa tokens Anthropic.')) return;
    setGerando(true);
    try {
      const r = await fetch('/api/relatorio-executivo', { method: 'POST', body: '{}' });
      const j = await r.json();
      if (j?.success) {
        alert(`Gerados ${j.resultados.length} relatórios. Tokens totais: ${j.resultados.reduce((s: number, x: any) => s + (x.tokens?.in || 0) + (x.tokens?.out || 0), 0)}`);
        await carregar();
      } else {
        alert('Erro: ' + (j?.erro || 'desconhecido'));
      }
    } finally { setGerando(false); }
  };

  const toggle = (id: number) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-pink-600" /> Relatório Executivo Semanal
          </h1>
          <p className="text-sm text-gray-500">
            Resumo cross-área gerado por IA: vendas, CMV, IG, NPS, alertas, clube, previsões.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={String(barFilter)}
            onChange={e => setBarFilter(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="todos">Todos os bares</option>
            <option value="3">Ordinário</option>
            <option value="4">Deboche</option>
          </select>
          <Button onClick={gerar} disabled={gerando} className="bg-pink-600 hover:bg-pink-700">
            {gerando ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Gerar agora
          </Button>
        </div>
      </div>

      {carregando && <Card className="p-8 text-center text-gray-500">Carregando...</Card>}

      {!carregando && rels.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Nenhum relatório ainda. Clique em &ldquo;Gerar agora&rdquo; pra criar o da última semana.</p>
        </Card>
      )}

      {rels.map(rel => {
        const aberto = expandido.has(rel.id);
        const dados = rel.dados_brutos ?? {};
        const desempenho = dados.desempenho_atual ?? {};
        return (
          <Card key={rel.id} className="overflow-hidden">
            <button
              onClick={() => toggle(rel.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-pink-600" />
                <div className="text-left">
                  <h3 className="font-semibold flex items-center gap-2">
                    {NOMES_BAR[rel.bar_id] ?? `Bar ${rel.bar_id}`}
                    <Badge variant="outline" className="text-xs">{rel.tipo}</Badge>
                  </h3>
                  <p className="text-xs text-gray-500">
                    {fmtData(rel.periodo_ini)} – {fmtData(rel.periodo_fim)}
                    {desempenho.faturamento_total ? ` · R$ ${Number(desempenho.faturamento_total).toLocaleString('pt-BR')}` : ''}
                    {desempenho.nps_geral ? ` · NPS ${desempenho.nps_geral}` : ''}
                  </p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
              <div className="px-6 pb-6 pt-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
                <ResumoMarkdown texto={rel.resumo_executivo} />
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-between text-xs text-gray-400">
                  <span>Modelo: {rel.modelo_usado}</span>
                  <span>
                    {rel.tokens_input} tok in · {rel.tokens_output} tok out · gerado em {new Date(rel.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </main>
  );
}
