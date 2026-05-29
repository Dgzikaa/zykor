'use client';

import { useEffect, useState, useCallback } from 'react';
import { useBar } from '@/contexts/BarContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, Calendar, Lightbulb, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fmtData = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const prioridadeCor: Record<string, string> = {
  alta: 'bg-red-100 text-red-800 border-red-200',
  media: 'bg-amber-100 text-amber-800 border-amber-200',
  baixa: 'bg-blue-100 text-blue-800 border-blue-200',
};

export default function AIInsightsPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const [tab, setTab] = useState<'semanal' | 'insights_periodo'>('insights_periodo');
  const [relatorio, setRelatorio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    if (!selectedBar?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/instagram/ai-relatorio?bar_id=${selectedBar.id}&tipo=${tab}`);
      const j = await r.json();
      setRelatorio(j.relatorio || null);
    } finally { setLoading(false); }
  }, [selectedBar?.id, tab]);

  useEffect(() => { carregar(); }, [carregar]);

  const gerarNovo = async () => {
    if (!selectedBar?.id) return;
    setGerando(true);
    try {
      const r = await fetch(`/api/instagram/ai-relatorio?bar_id=${selectedBar.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tab }),
      });
      const j = await r.json();
      if (j?.success) {
        toast({ title: 'Gerado!', description: 'Novo relatório criado pela IA.' });
        await carregar();
      } else {
        toast({ title: 'Erro', description: j?.erro || 'Falha ao gerar', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally { setGerando(false); }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="w-6 h-6 text-pink-600" /> Insights de IA</h1>
        <p className="text-sm text-gray-500">Análise automatizada via Claude com base em todos os dados coletados.</p>
      </div>

      <div className="flex items-center gap-1 border-b">
        <TabBtn ativo={tab === 'insights_periodo'} onClick={() => setTab('insights_periodo')} icone={<Lightbulb className="w-4 h-4" />}>Insights Acionáveis</TabBtn>
        <TabBtn ativo={tab === 'semanal'} onClick={() => setTab('semanal')} icone={<FileText className="w-4 h-4" />}>Resumo Semanal</TabBtn>
        <div className="ml-auto">
          <Button size="sm" onClick={gerarNovo} disabled={gerando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${gerando ? 'animate-spin' : ''}`} />
            {gerando ? 'Gerando…' : 'Gerar novo'}
          </Button>
        </div>
      </div>

      {loading ? <Skeleton className="h-96" /> : !relatorio ? (
        <Card className="p-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-4">Nenhum relatório {tab} ainda.</p>
          <Button onClick={gerarNovo} disabled={gerando}>
            <RefreshCw className={`w-4 h-4 mr-2 ${gerando ? 'animate-spin' : ''}`} />
            Gerar agora
          </Button>
        </Card>
      ) : tab === 'insights_periodo' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Período: {relatorio.periodo_ini} a {relatorio.periodo_fim} · Gerado em {fmtData(relatorio.criado_em)} · {relatorio.tokens_input + relatorio.tokens_output} tokens
          </p>
          {(relatorio.insights || []).map((i: any, idx: number) => (
            <Card key={idx} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-semibold flex-shrink-0">{idx + 1}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold">{i.titulo}</h3>
                    {i.prioridade && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${prioridadeCor[i.prioridade] ?? ''}`}>
                        {i.prioridade}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{i.explicacao}</p>
                  {i.acao_sugerida && (
                    <div className="text-sm bg-pink-50 dark:bg-pink-900/20 rounded p-2 border-l-2 border-pink-500">
                      <span className="font-semibold text-pink-700 dark:text-pink-400">Ação: </span>
                      {i.acao_sugerida}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-xs text-gray-500 mb-4 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Semana {relatorio.semana_ano} ({relatorio.periodo_ini} a {relatorio.periodo_fim}) · Gerado em {fmtData(relatorio.criado_em)}
          </p>
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line text-sm leading-relaxed">
            {relatorio.resumo}
          </div>
        </Card>
      )}
    </main>
  );
}

function TabBtn({ ativo, onClick, icone, children }: { ativo: boolean; onClick: () => void; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${ativo ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
      {icone}{children}
    </button>
  );
}
