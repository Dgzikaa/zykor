'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, RefreshCw, Check, X, AlertTriangle, Eye } from 'lucide-react';

type Alerta = {
  id: number; bar_id: number; data_referencia: string;
  tipo: string; severidade: string; titulo: string; descricao: string;
  entidade: string; valor_envolvido: number; detalhes: any;
  status: string; notas: string; criado_em: string;
};

const NOMES_BAR: Record<number, string> = { 3: 'Ordinário', 4: 'Deboche' };
const COR_SEVER: Record<string, string> = {
  critica: 'bg-red-600 text-white',
  alta: 'bg-orange-500 text-white',
  media: 'bg-yellow-500 text-white',
  baixa: 'bg-gray-400 text-white',
};
const NOMES_TIPO: Record<string, string> = {
  desconto_alto: 'Desconto alto em item',
  desconto_funcionario: 'Taxa de desconto anormal',
  item_negativo: 'Itens removidos',
  comanda_anulada: 'Comanda anulada',
  mesa_longa: 'Mesa aberta tempo excessivo',
};

export default function IntegridadePage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [barFilter, setBarFilter] = useState<number | 'todos'>('todos');
  const [statusFilter, setStatusFilter] = useState('aberto');
  const [diasFilter, setDiasFilter] = useState(30);
  const [expandido, setExpandido] = useState<Set<number>>(new Set());

  const carregar = async () => {
    setCarregando(true);
    const params = new URLSearchParams({
      status: statusFilter,
      dias: String(diasFilter),
    });
    if (barFilter !== 'todos') params.set('bar_id', String(barFilter));
    const r = await fetch(`/api/integridade?${params}`);
    const j = await r.json();
    setAlertas(j?.alertas ?? []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); }, [barFilter, statusFilter, diasFilter]);

  const detectar = async () => {
    if (!confirm('Rodar detector pra D-1 em todos os bares?')) return;
    setExecutando(true);
    try {
      const r = await fetch('/api/integridade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'detectar' }),
      });
      const j = await r.json();
      if (j?.success) {
        const total = j.resultados.reduce((s: number, x: any) => s + (x.alertas_total || 0), 0);
        alert(`${total} alertas inseridos.`);
        await carregar();
      } else alert('Erro: ' + (j?.erro || JSON.stringify(j)));
    } finally { setExecutando(false); }
  };

  const marcar = async (alertaId: number, status: string) => {
    let notas: string | null = null;
    if (status === 'falso_positivo') notas = prompt('Por que é falso positivo?') || null;
    if (status === 'confirmado_acao') notas = prompt('Que ação foi tomada?') || null;
    const r = await fetch('/api/integridade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alerta_id: alertaId, status, notas }),
    });
    if (r.ok) carregar();
  };

  const toggle = (id: number) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const stats = {
    critica: alertas.filter(a => a.severidade === 'critica').length,
    alta: alertas.filter(a => a.severidade === 'alta').length,
    media: alertas.filter(a => a.severidade === 'media').length,
    valor_total: alertas.reduce((s, a) => s + (Number(a.valor_envolvido) || 0), 0),
  };

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-red-600" /> Integridade Operacional
          </h1>
          <p className="text-sm text-gray-500">
            Detector de anomalias em vendas: descontos suspeitos, itens removidos, padrões fora da curva.
          </p>
        </div>
        <Button onClick={detectar} disabled={executando} className="bg-red-600 hover:bg-red-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${executando ? 'animate-spin' : ''}`} />
          Detectar agora
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Críticos</p>
          <p className="text-2xl font-bold text-red-600">{stats.critica}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Alta</p>
          <p className="text-2xl font-bold text-orange-500">{stats.alta}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Média</p>
          <p className="text-2xl font-bold text-yellow-500">{stats.media}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Valor envolvido</p>
          <p className="text-2xl font-bold">R$ {stats.valor_total.toFixed(0)}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={String(barFilter)}
            onChange={e => setBarFilter(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value, 10))}
            className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="todos">Todos os bares</option>
            <option value="3">Ordinário</option>
            <option value="4">Deboche</option>
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="aberto">Abertos</option>
            <option value="revisado">Revisados</option>
            <option value="falso_positivo">Falso positivo</option>
            <option value="confirmado_acao">Confirmado</option>
            <option value="todos">Todos</option>
          </select>
          <select
            value={diasFilter}
            onChange={e => setDiasFilter(parseInt(e.target.value, 10))}
            className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
      </Card>

      {carregando && <Card className="p-8 text-center text-gray-500">Carregando...</Card>}
      {!carregando && alertas.length === 0 && (
        <Card className="p-12 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Sem alertas — operação tranquila.</p>
        </Card>
      )}

      <div className="space-y-2">
        {alertas.map(a => {
          const aberto = expandido.has(a.id);
          return (
            <Card key={a.id} className="overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className={COR_SEVER[a.severidade] || 'bg-gray-400'}>{a.severidade}</Badge>
                    <Badge variant="outline">{NOMES_BAR[a.bar_id]}</Badge>
                    <span className="text-xs text-gray-500">{NOMES_TIPO[a.tipo] || a.tipo}</span>
                    <span className="text-xs text-gray-500">· {a.data_referencia}</span>
                  </div>
                  <h3 className="font-semibold text-sm">{a.titulo}</h3>
                  <p className="text-xs text-gray-500 mt-1">{a.descricao}</p>
                  {a.valor_envolvido > 0 && (
                    <p className="text-xs text-red-600 mt-1 font-semibold">R$ {Number(a.valor_envolvido).toFixed(2)}</p>
                  )}
                  {aberto && a.detalhes && (
                    <pre className="text-[10px] mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                      {JSON.stringify(a.detalhes, null, 2)}
                    </pre>
                  )}
                  {a.notas && <p className="text-xs text-gray-500 mt-2"><strong>Nota:</strong> {a.notas}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => toggle(a.id)}>
                    <Eye className="w-3 h-3 mr-1" /> {aberto ? 'Fechar' : 'Detalhes'}
                  </Button>
                  {a.status === 'aberto' && (
                    <>
                      <Button size="sm" variant="default" onClick={() => marcar(a.id, 'confirmado_acao')}>
                        <Check className="w-3 h-3 mr-1" /> Tratei
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => marcar(a.id, 'falso_positivo')}>
                        <X className="w-3 h-3 mr-1" /> Ignorar
                      </Button>
                    </>
                  )}
                  {a.status === 'confirmado_acao' && <Badge className="bg-green-600">Tratado</Badge>}
                  {a.status === 'falso_positivo' && <Badge variant="outline">Ignorado</Badge>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
