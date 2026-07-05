'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { emojiSeveridade, formatarTempo, type Severidade } from '@/hooks/useNotifications';
import { CATEGORIAS, type CategoriaEvento } from '@/lib/notifications/catalog';
import { Loader2, History } from 'lucide-react';

interface HistRow {
  id: string;
  usuario_id: string;
  event_key: string;
  categoria: string;
  severidade: Severidade;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criada_em: string;
}
interface UsuarioBar {
  auth_id: string;
  nome: string | null;
  email: string;
}

const CATEGORIA_KEYS = Object.keys(CATEGORIAS) as CategoriaEvento[];

export default function HistoricoTab() {
  const [rows, setRows] = useState<HistRow[]>([]);
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const [categoria, setCategoria] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/api/configuracoes/notifications/usuarios').then((u) => {
      if (u?.success) {
        const map: Record<string, string> = {};
        (u.data.usuarios as UsuarioBar[]).forEach((x) => {
          map[x.auth_id] = x.nome || x.email;
        });
        setUsuarios(map);
      }
    });
  }, []);

  const carregar = useCallback(
    async (p: number, cat: string | undefined, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('limit', '30');
        if (cat) params.set('categoria', cat);
        const res = await api.get(`/api/configuracoes/notifications/historico?${params.toString()}`);
        if (res?.success) {
          setRows((prev) => (append ? [...prev, ...res.data.notificacoes] : res.data.notificacoes));
          setTotal(res.data.paginacao?.total ?? 0);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    carregar(1, categoria, false);
  }, [categoria, carregar]);

  const temMais = useMemo(() => rows.length < total, [rows.length, total]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tudo que o sistema disparou neste bar — uma linha por destinatário.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCategoria(undefined)} className={chip(!categoria)}>
          Todas
        </button>
        {CATEGORIA_KEYS.map((k) => (
          <button key={k} onClick={() => setCategoria(k)} className={chip(categoria === k)}>
            {CATEGORIAS[k].emoji} {CATEGORIAS[k].label}
          </button>
        ))}
      </div>

      {rows.length === 0 && !loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <History className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-muted-foreground">Nada disparado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-gray-100 dark:border-gray-700/50 divide-y divide-gray-100 dark:divide-gray-700/50">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span>{emojiSeveridade(r.severidade)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900 dark:text-white">
                  {r.titulo}
                </div>
                <div className="truncate text-xs text-muted-foreground">{r.mensagem}</div>
              </div>
              <div className="text-xs text-muted-foreground text-right shrink-0">
                <div className="truncate max-w-[8rem]">
                  {usuarios[r.usuario_id] ?? 'usuário'}
                </div>
                <div>{formatarTempo(r.criada_em)}</div>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  r.lida
                    ? 'bg-gray-100 dark:bg-gray-700 text-muted-foreground'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300'
                }`}
              >
                {r.lida ? 'lida' : 'nova'}
              </span>
            </div>
          ))}
        </div>
      )}

      {temMais && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              carregar(next, categoria, true);
            }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Carregar mais'}
          </Button>
        </div>
      )}
    </div>
  );
}

function chip(active: boolean): string {
  return `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active
      ? 'bg-blue-500 text-white border-blue-500'
      : 'bg-transparent text-muted-foreground border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;
}
