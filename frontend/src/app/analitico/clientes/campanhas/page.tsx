'use client';

import { useEffect, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, RefreshCw, Check, X, MessageSquare, TrendingUp } from 'lucide-react';

type Campanha = {
  id: number; bar_id: number; nome: string; descricao: string; ativo: boolean;
  segmento_alvo: string; niveis_alvo: string[]; dias_inativo_min: number;
  canal: string; mensagem_template: string; voucher_pct: number;
  max_por_execucao: number; cooldown_dias: number;
};

type Execucao = {
  id: number; campanha_id: number; bar_id: number;
  cliente_fone_norm: string; cliente_nome: string; cliente_nivel: string;
  dias_inativo: number; valor_total_consumo: number;
  mensagem_renderizada: string; status: string; notas: string;
  criado_em: string;
};

const NOMES_BAR: Record<number, string> = { 3: 'Ordinário', 4: 'Deboche' };
const COR_NIVEL: Record<string, string> = {
  diamante: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  ouro: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
  prata: 'bg-gray-400/15 text-gray-700 dark:text-gray-300',
  bronze: 'bg-orange-700/15 text-orange-700 dark:text-orange-300',
};

export default function CampanhasClubePage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [barFilter, setBarFilter] = useState<number | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('sugerida');
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('📣 Campanhas');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = async () => {
    setCarregando(true);
    const url = barFilter === 'todos'
      ? '/api/campanhas-clube'
      : `/api/campanhas-clube?bar_id=${barFilter}`;
    const r = await fetch(url);
    const j = await r.json();
    setCampanhas(j?.campanhas ?? []);
    setExecucoes(j?.execucoes ?? []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [barFilter]);

  const executar = async (campanhaId?: number) => {
    setExecutando(true);
    try {
      const r = await fetch('/api/campanhas-clube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'executar', campanha_id: campanhaId }),
      });
      const j = await r.json();
      if (j?.success) {
        const total = (j.resultados ?? []).reduce((s: number, x: any) => s + (x.inseridos || 0), 0);
        alert(`${total} sugestoes inseridas.`);
        await carregar();
      } else alert('Erro: ' + (j?.erro || JSON.stringify(j)));
    } finally { setExecutando(false); }
  };

  const marcar = async (execId: number, novoStatus: string) => {
    let notas: string | null = null;
    if (novoStatus === 'concluida') notas = prompt('Notas (opcional):') || null;
    if (novoStatus === 'descartada') notas = prompt('Por que descartou?') || null;
    const r = await fetch('/api/campanhas-clube', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execucao_id: execId, status: novoStatus, notas }),
    });
    if (r.ok) carregar();
  };

  const execsFiltradas = execucoes.filter(e => statusFilter === 'todos' || e.status === statusFilter);
  const stats = {
    sugeridas: execucoes.filter(e => e.status === 'sugerida').length,
    concluidas: execucoes.filter(e => e.status === 'concluida').length,
    descartadas: execucoes.filter(e => e.status === 'descartada').length,
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-pink-600" /> Campanhas Clube Ordi
          </h1>
          <p className="text-sm text-gray-500">
            Engine de retargeting do Clube. Gera sugestões pra equipe contatar VIPs dormindo.
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
          <Button onClick={() => executar()} disabled={executando} className="bg-pink-600 hover:bg-pink-700">
            <RefreshCw className={`w-4 h-4 mr-2 ${executando ? 'animate-spin' : ''}`} />
            Rodar todas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Sugestões abertas</p>
          <p className="text-2xl font-bold text-pink-600">{stats.sugeridas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Concluídas</p>
          <p className="text-2xl font-bold text-green-600">{stats.concluidas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Descartadas</p>
          <p className="text-2xl font-bold text-gray-500">{stats.descartadas}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Regras configuradas
        </h2>
        <div className="space-y-2">
          {campanhas.map(c => (
            <div key={c.id} className="flex items-center justify-between border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{c.nome}</span>
                  <Badge variant="outline" className="text-xs">{NOMES_BAR[c.bar_id] ?? c.bar_id}</Badge>
                  <Badge variant={c.ativo ? 'default' : 'outline'} className="text-xs">{c.ativo ? 'ativa' : 'pausada'}</Badge>
                </div>
                <p className="text-xs text-gray-500">{c.descricao}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Alvo: {c.niveis_alvo?.join(', ')} {c.segmento_alvo} ≥ {c.dias_inativo_min}d · cooldown {c.cooldown_dias}d · max {c.max_por_execucao}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => executar(c.id)} disabled={executando}>
                Rodar só esta
              </Button>
            </div>
          ))}
          {campanhas.length === 0 && <p className="text-sm text-gray-500">Nenhuma campanha configurada.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Execuções
          </h2>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="sugerida">Abertas</option>
            <option value="concluida">Concluídas</option>
            <option value="descartada">Descartadas</option>
            <option value="todos">Todas</option>
          </select>
        </div>
        {carregando && <p className="text-sm text-gray-500">Carregando...</p>}
        {!carregando && execsFiltradas.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center">Nada por aqui.</p>
        )}
        <div className="space-y-2">
          {execsFiltradas.map(e => (
            <div key={e.id} className="border border-gray-200 dark:border-gray-800 rounded-md p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm">{e.cliente_nome || 'sem nome'}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${COR_NIVEL[e.cliente_nivel] || 'bg-gray-200'}`}>
                      {e.cliente_nivel}
                    </span>
                    <Badge variant="outline" className="text-xs">{NOMES_BAR[e.bar_id]}</Badge>
                    <span className="text-xs text-gray-500">{e.cliente_fone_norm}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {e.dias_inativo}d sem visita · R$ {Number(e.valor_total_consumo).toLocaleString('pt-BR')} histórico
                  </p>
                  <p className="text-sm bg-gray-100 dark:bg-gray-800 rounded p-2 italic">&ldquo;{e.mensagem_renderizada}&rdquo;</p>
                  {e.notas && <p className="text-xs text-gray-500 mt-2"><strong>Nota:</strong> {e.notas}</p>}
                </div>
                {e.status === 'sugerida' && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="default" onClick={() => marcar(e.id, 'concluida')}>
                      <Check className="w-3 h-3 mr-1" /> Feito
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => marcar(e.id, 'descartada')}>
                      <X className="w-3 h-3 mr-1" /> Descartar
                    </Button>
                  </div>
                )}
                {e.status === 'concluida' && <Badge className="bg-green-600">Concluída</Badge>}
                {e.status === 'descartada' && <Badge variant="outline">Descartada</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}
