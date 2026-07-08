'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, Check, Archive, ExternalLink } from 'lucide-react';

interface Feedback {
  id: string;
  usuario_nome: string | null;
  email: string | null;
  bar_id: number | null;
  rota: string | null;
  mensagem: string;
  status: string;
  criada_em: string;
}

const FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'novo', label: 'Novos' },
  { key: 'lido', label: 'Lidos' },
  { key: 'resolvido', label: 'Resolvidos' },
  { key: 'descartado', label: 'Descartados' },
];

function badgeClass(s: string): string {
  return (
    {
      novo: 'text-blue-600 dark:text-blue-400',
      lido: 'text-gray-600 dark:text-gray-400',
      resolvido: 'text-green-600 dark:text-green-400',
      descartado: 'text-gray-400',
    }[s] || ''
  );
}

export default function FeedbacksPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('💬 Feedbacks da equipe');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const carregar = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await api.get('/api/feedback' + (status ? `?status=${status}` : ''));
      if (res?.success) setItems(res.data.feedbacks ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(filtro);
  }, [filtro, carregar]);

  const mudarStatus = async (id: string, status: string) => {
    await api.patch(`/api/feedback?id=${id}`, { status });
    carregar(filtro);
  };

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5" />
          <h1 className="text-xl font-bold">Feedbacks da equipe</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          O que a galera está mandando pelo widget — com a tela e o autor, pra você avaliar e tirar
          dúvida.
        </p>

        <div className="flex gap-1.5 mb-4 flex-wrap">
          {FILTROS.map((s) => (
            <button
              key={s.key}
              onClick={() => setFiltro(s.key)}
              className={`px-3 py-1 rounded-full text-xs border ${
                filtro === s.key ? 'bg-foreground text-background' : 'bg-background'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum feedback aqui.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((f) => (
              <Card key={f.id}>
                <CardContent className="py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <Badge variant="outline" className={badgeClass(f.status)}>
                      {f.status}
                    </Badge>
                    <span className="font-medium">{f.usuario_nome || f.email || 'Anônimo'}</span>
                    {f.rota && (
                      <a
                        href={f.rota}
                        className="text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5 font-mono"
                      >
                        {f.rota}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span className="text-muted-foreground ml-auto">
                      {new Date(f.criada_em).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{f.mensagem}</p>
                  <div className="flex gap-1.5 justify-end">
                    {f.status === 'novo' && (
                      <Button size="sm" variant="ghost" onClick={() => mudarStatus(f.id, 'lido')}>
                        Marcar lido
                      </Button>
                    )}
                    {f.status !== 'resolvido' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => mudarStatus(f.id, 'resolvido')}
                      >
                        <Check className="w-3 h-3 mr-1" /> Resolver
                      </Button>
                    )}
                    {f.status !== 'descartado' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => mudarStatus(f.id, 'descartado')}
                      >
                        <Archive className="w-3 h-3 mr-1" /> Descartar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
