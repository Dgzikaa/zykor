'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { api } from '@/lib/api-client';
import { MessageSquare, Star, MessageCircle, Clock, XCircle, Loader2 } from 'lucide-react';

interface ItemAgg {
  chave: string;
  titulo: string;
  tipo: 'nota_1_10' | 'texto';
  media: number | null;
  respostas: number;
}
interface Comentario {
  texto: string;
  email: string | null;
  bar_id: number | null;
  respondida_em: string | null;
}
interface PesquisaResultado {
  id: number;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  ativa: boolean;
  total_respondidas: number;
  total_adiadas: number;
  total_dispensadas: number;
  itens: ItemAgg[];
  comentarios: Comentario[];
}

function corMedia(m: number): string {
  if (m <= 4) return 'bg-rose-500';
  if (m <= 7) return 'bg-amber-500';
  return 'bg-emerald-500';
}
function corMediaTexto(m: number): string {
  if (m <= 4) return 'text-rose-600 dark:text-rose-400';
  if (m <= 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function Conteudo() {
  const [pesquisas, setPesquisas] = useState<PesquisaResultado[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = (await api.get('/api/feedback/resultados')) as { pesquisas: PesquisaResultado[] };
        setPesquisas(r.pesquisas || []);
      } catch {
        setPesquisas([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-teal-100 dark:bg-teal-900/40">
          <MessageSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">Pesquisas</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Resultados do feedback dos usuários.</p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando resultados…
        </div>
      ) : !pesquisas?.length ? (
        <p className="text-neutral-500">Nenhuma pesquisa cadastrada ainda.</p>
      ) : (
        <div className="space-y-8">
          {pesquisas.map((p) => (
            <section key={p.id} className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white">{p.titulo}</h2>
                  {p.subtitulo && <p className="text-sm text-neutral-500 dark:text-neutral-400">{p.subtitulo}</p>}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    p.ativa
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
                  }`}
                >
                  {p.ativa ? 'Ativa' : 'Encerrada'}
                </span>
              </div>

              {/* Contadores */}
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500"><MessageCircle className="h-3.5 w-3.5" /> Respondidas</div>
                  <div className="text-2xl font-extrabold tabular-nums text-neutral-900 dark:text-white">{p.total_respondidas}</div>
                </div>
                <div className="rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500"><Clock className="h-3.5 w-3.5" /> Adiadas</div>
                  <div className="text-2xl font-extrabold tabular-nums text-neutral-500">{p.total_adiadas}</div>
                </div>
                <div className="rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500"><XCircle className="h-3.5 w-3.5" /> Dispensadas</div>
                  <div className="text-2xl font-extrabold tabular-nums text-neutral-500">{p.total_dispensadas}</div>
                </div>
              </div>

              {/* Notas por tópico */}
              <div className="space-y-3">
                {p.itens.filter((i) => i.tipo === 'nota_1_10').map((i) => (
                  <div key={i.chave}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-neutral-700 dark:text-neutral-200">{i.titulo}</span>
                      <span className={`font-bold tabular-nums ${i.media != null ? corMediaTexto(i.media) : 'text-neutral-400'}`}>
                        {i.media != null ? `${i.media.toFixed(1).replace('.', ',')}/10` : '—'}
                        <span className="ml-1 text-xs font-normal text-neutral-400">({i.respostas})</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className={`h-full rounded-full ${i.media != null ? corMedia(i.media) : ''}`}
                        style={{ width: i.media != null ? `${i.media * 10}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Comentários abertos */}
              {p.comentarios.length > 0 && (
                <div className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800">
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-neutral-900 dark:text-white">
                    <Star className="h-4 w-4 text-amber-500" /> Comentários ({p.comentarios.length})
                  </h3>
                  <ul className="space-y-3">
                    {p.comentarios.map((c, idx) => (
                      <li key={idx} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
                        <p className="whitespace-pre-wrap break-words text-sm text-neutral-800 dark:text-neutral-100">{c.texto}</p>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-400">
                          <span>{c.email || '—'}</span>
                          {c.bar_id && <span>· bar {c.bar_id}</span>}
                          {c.respondida_em && <span>· {new Date(c.respondida_em).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PesquisasPage() {
  return (
    <ProtectedRoute requiredModule="configuracoes">
      <Conteudo />
    </ProtectedRoute>
  );
}
