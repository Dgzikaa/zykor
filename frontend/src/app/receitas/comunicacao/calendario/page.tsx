'use client';

/**
 * Calendário de Comunicação — visão mensal (full width) dos posts programados do Instagram.
 * Cada dia lista os posts (título + formato), coloridos por categoria (com legenda). Clica no
 * dia pra adicionar, clica no post pra editar/excluir. Fonte: marketing_calendario_posts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Plus, Loader2, X, Trash2, CalendarDays } from 'lucide-react';
import { CATEGORIAS, CATEGORIA_KEYS, COR_CHIP, COR_DOT, catCor, type CategoriaPost } from '@/lib/comunicacao/calendario';

type Post = { id: number; data: string; titulo: string; formato: string | null; categoria: string; observacao: string | null };

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export default function CalendarioComunicacaoPage() {
  const { setPageTitle } = usePageTitle();
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;

  const hoje = new Date();
  const [mesRef, setMesRef] = useState<string>(`${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Post> | null>(null); // {data} = novo; {id,...} = editar

  useEffect(() => { setPageTitle('🗓️ Calendário de Conteúdo'); return () => setPageTitle(''); }, [setPageTitle]);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const r = await api.get(`/api/receitas/comunicacao/calendario?bar_id=${barId}&mes=${mesRef}`);
      if (r?.success) setPosts(r.posts || []); else setPosts([]);
    } catch { setPosts([]); }
    finally { setLoading(false); }
  }, [barId, mesRef]);
  useEffect(() => { carregar(); }, [carregar]);

  const [ano, mes] = mesRef.split('-').map(Number);

  // grade: começa na segunda da 1ª semana, cobre o mês inteiro
  const semanas = useMemo(() => {
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
    const offset = (primeiro.getUTCDay() + 6) % 7; // Seg=0
    const inicioGrade = addDays(primeiro, -offset);
    const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const nSemanas = Math.ceil((offset + diasNoMes) / 7);
    const out: Date[][] = [];
    for (let s = 0; s < nSemanas; s++) out.push(Array.from({ length: 7 }, (_, d) => addDays(inicioGrade, s * 7 + d)));
    return out;
  }, [ano, mes]);

  const postsPorDia = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of posts) { const arr = m.get(p.data) || []; arr.push(p); m.set(p.data, arr); }
    return m;
  }, [posts]);

  const mudarMes = (delta: number) => {
    const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
    setMesRef(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };
  const hojeYmd = ymd(new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())));

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* cabeçalho: navegação + legenda + adicionar */}
      <div className="shrink-0 px-3 sm:px-5 pt-3 pb-2 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => mudarMes(-1)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white min-w-[160px] text-center">{MESES[mes - 1]} <span className="text-gray-400 font-normal">{ano}</span></h2>
            <button onClick={() => mudarMes(1)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ChevronRight className="w-5 h-5" /></button>
            <button onClick={() => setMesRef(`${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}`)} className="ml-1 text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Hoje</button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <button onClick={() => setEditing({ data: hojeYmd, categoria: 'programacao' })} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium"><Plus className="w-4 h-4" />Adicionar post</button>
          </div>
        </div>
        {/* legenda */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {CATEGORIA_KEYS.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className={`w-2.5 h-2.5 rounded-full ${COR_DOT[CATEGORIAS[k].cor]}`} />{CATEGORIAS[k].label}
            </span>
          ))}
        </div>
      </div>

      {/* grade do calendário */}
      <div className="flex-1 min-h-0 px-3 sm:px-5 pb-3">
        <div className="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
          {/* header dos dias */}
          <div className="grid grid-cols-7 shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            {DIAS.map((d) => <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{d}</div>)}
          </div>
          {/* semanas */}
          <div className="flex-1 min-h-0 grid" style={{ gridTemplateRows: `repeat(${semanas.length}, minmax(0, 1fr))` }}>
            {semanas.map((semana, si) => (
              <div key={si} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
                {semana.map((dia) => {
                  const key = ymd(dia);
                  const doMes = dia.getUTCMonth() === mes - 1;
                  const eHoje = key === hojeYmd;
                  const lista = postsPorDia.get(key) || [];
                  return (
                    <div key={key} className={`group relative border-r border-gray-100 dark:border-gray-800 last:border-r-0 p-1 overflow-hidden ${doMes ? '' : 'bg-gray-50/60 dark:bg-gray-950/40'}`}>
                      <div className="flex items-center justify-between px-0.5">
                        <span className={`text-xs font-medium ${eHoje ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-pink-600 text-white' : doMes ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}`}>{dia.getUTCDate()}</span>
                        <button onClick={() => setEditing({ data: key, categoria: 'programacao' })}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-pink-600" title="Adicionar post"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="mt-0.5 space-y-1 overflow-y-auto max-h-[calc(100%-1.25rem)]">
                        {lista.map((p) => (
                          <button key={p.id} onClick={() => setEditing(p)}
                            className={`w-full text-left rounded-md border px-1.5 py-1 text-[11px] leading-tight hover:brightness-95 ${COR_CHIP[catCor(p.categoria)]}`}>
                            <div className="font-semibold truncate">{p.titulo}</div>
                            {p.formato && <div className="opacity-80 truncate">({p.formato})</div>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && <PostModal post={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); carregar(); }} barId={barId} />}
    </div>
  );
}

function PostModal({ post, barId, onClose, onSaved }: { post: Partial<Post>; barId?: number; onClose: () => void; onSaved: () => void }) {
  const ehEdicao = !!post.id;
  const [data, setData] = useState(post.data || '');
  const [titulo, setTitulo] = useState(post.titulo || '');
  const [formato, setFormato] = useState(post.formato || '');
  const [categoria, setCategoria] = useState<CategoriaPost>((post.categoria as CategoriaPost) || 'programacao');
  const [observacao, setObservacao] = useState(post.observacao || '');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const salvar = async () => {
    if (titulo.trim().length < 1) { toast.error('Escreva o título do post'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { toast.error('Informe a data'); return; }
    setSalvando(true);
    try {
      const body = { titulo: titulo.trim(), formato: formato.trim() || null, categoria, observacao: observacao.trim() || null, data };
      const r = ehEdicao
        ? await api.patch(`/api/receitas/comunicacao/calendario?id=${post.id}`, body)
        : await api.post('/api/receitas/comunicacao/calendario', { ...body, bar_id: barId });
      if (r?.success) { toast.success(ehEdicao ? 'Post atualizado' : 'Post adicionado'); onSaved(); }
      else toast.error(r?.error || 'Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSalvando(false); }
  };
  const excluir = async () => {
    if (!post.id) return;
    setExcluindo(true);
    try {
      const r = await api.delete(`/api/receitas/comunicacao/calendario?id=${post.id}`);
      if (r?.success) { toast.success('Post excluído'); onSaved(); } else toast.error(r?.error || 'Erro ao excluir');
    } catch { toast.error('Erro ao excluir'); }
    finally { setExcluindo(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><CalendarDays className="w-5 h-5 text-pink-600" />{ehEdicao ? 'Editar post' : 'Novo post'}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Categoria (cor)</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPost)} className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm mt-1">
                {CATEGORIA_KEYS.map((k) => <option key={k} value={k}>{CATEGORIAS[k].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Hoje tem Copa" className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm mt-1" maxLength={120} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Formato <span className="text-gray-400">(rótulo)</span></label>
            <input value={formato} onChange={(e) => setFormato(e.target.value)} placeholder="Ex.: Reels, Carrossel, Meme, Story…" className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm mt-1" maxLength={40} />
          </div>
          <div>
            <label className="text-xs text-gray-500">Observação <span className="text-gray-400">(opcional)</span></label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Referência, briefing, link…" className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm resize-none" />
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            {ehEdicao ? (
              <button onClick={excluir} disabled={excluindo} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-50">
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Excluir
              </button>
            ) : <span />}
            <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium disabled:opacity-50">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{ehEdicao ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
