'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  CATEGORIAS, STATUS, PRIORIDADES, CATEGORIA_KEYS, STATUS_KEYS, PRIORIDADE_KEYS,
  catLabel, statusLabel, type ChamadoStatus, type ChamadoCategoria, type ChamadoPrioridade,
} from '@/lib/chamados';
import {
  Plus, Search, Send, Loader2, X, ArrowLeft, MessageSquare, Inbox, LifeBuoy, Building2,
  Mic, Square, Paperclip,
} from 'lucide-react';

type Anexo = { url: string; nome?: string; tipo?: string };

// classes estáticas por cor (Tailwind não monta classe por interpolação)
const COR: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800',
};

type Chamado = {
  id: number; aberto_por: string; aberto_por_nome: string | null; email: string | null;
  bar_id: number | null; categoria: string; assunto: string; rota: string | null;
  status: string; prioridade: string; ultima_msg_previa: string | null; ultima_msg_em: string;
  criado_em: string; nao_lido: boolean;
};
type Mensagem = { id: number; autor_id: string; autor_nome: string | null; autor_tipo: string; mensagem: string; anexos?: Anexo[]; criado_em: string };

const fmtTempo = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const fmtHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function Badge({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${COR[cor] || COR.gray}`}>{children}</span>;
}

export default function ChamadosPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>}>
      <ChamadosInner />
    </Suspense>
  );
}

function ChamadosInner() {
  const { setPageTitle } = usePageTitle();
  const searchParams = useSearchParams();
  const { availableBars } = useBar();
  const nomeBar = (id: number | null) => (id ? (availableBars.find((b) => b.id === id)?.nome || `Bar ${id}`) : '—');

  const [suporte, setSuporte] = useState(false);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<{ chamado: Chamado; mensagens: Mensagem[] } | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);

  const [fStatus, setFStatus] = useState<'todos' | 'abertos' | ChamadoStatus>('abertos');
  const [fBar, setFBar] = useState<number | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [novoOpen, setNovoOpen] = useState(false);
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setPageTitle('🎫 Central de Chamados'); return () => setPageTitle(''); }, [setPageTitle]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/chamados');
      if (r?.success) { setChamados(r.data?.chamados || []); setSuporte(!!r.data?.suporte); }
    } catch { toast.error('Erro ao carregar chamados'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhe = useCallback(async (id: number) => {
    if (!Number.isFinite(id)) return;
    setSelId((prev) => { if (prev !== id) { setResposta(''); setAnexos([]); } return id; });
    setLoadingDet(true);
    try {
      const r = await api.get(`/api/chamados/${id}`);
      if (r?.success) {
        setDetalhe({ chamado: { ...r.data.chamado }, mensagens: r.data.mensagens || [] });
        setChamados((prev) => prev.map((c) => (c.id === id ? { ...c, nao_lido: false } : c)));
      } else toast.error(r?.error || 'Erro ao abrir chamado');
    } catch { toast.error('Erro ao abrir chamado'); }
    finally { setLoadingDet(false); }
  }, []);

  // deep-link ?id= (vem das notificações)
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && Number(id) !== selId) abrirDetalhe(Number(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [detalhe?.mensagens.length, loadingDet]);

  const enviar = async () => {
    if (!detalhe || (resposta.trim().length < 1 && anexos.length === 0)) return;
    setEnviando(true);
    try {
      const r = await api.post(`/api/chamados/${detalhe.chamado.id}/mensagens`, { mensagem: resposta.trim(), anexos });
      if (r?.success) { setResposta(''); setAnexos([]); await abrirDetalhe(detalhe.chamado.id); carregar(); }
      else toast.error(r?.error || 'Erro ao enviar');
    } catch { toast.error('Erro ao enviar'); }
    finally { setEnviando(false); }
  };

  // anexar imagem (colar print ou escolher arquivo) → sobe pro storage e vira chip no composer
  const subirImagem = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (anexos.length >= 10) { toast.error('Máximo de 10 imagens'); return; }
    setSubindo(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/chamados/upload', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (j?.success && j.data?.url) setAnexos((a) => [...a, { url: j.data.url, nome: j.data.nome, tipo: j.data.tipo }]);
      else toast.error(j?.error || 'Falha ao anexar imagem');
    } catch { toast.error('Erro ao anexar imagem'); }
    finally { setSubindo(false); }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData?.items || []).filter((i) => i.type.startsWith('image/'));
    if (!imgs.length) return;
    e.preventDefault();
    imgs.forEach((i) => { const f = i.getAsFile(); if (f) subirImagem(f); });
  };

  // gravar áudio → transcreve (Whisper) → joga o texto no campo pra revisar antes de enviar
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (!blob.size) return;
        setTranscrevendo(true);
        try {
          const fd = new FormData(); fd.append('audio', blob, 'audio.webm');
          const res = await fetch('/api/chamados/transcrever', { method: 'POST', body: fd });
          const j = await res.json().catch(() => ({}));
          if (j?.success && j.data?.texto) setResposta((r) => (r.trim() ? r.trim() + ' ' : '') + j.data.texto);
          else toast.error(j?.error || 'Não consegui transcrever o áudio');
        } catch { toast.error('Erro ao transcrever'); }
        finally { setTranscrevendo(false); }
      };
      mr.start();
      mediaRef.current = mr;
      setGravando(true);
    } catch { toast.error('Não consegui acessar o microfone'); }
  };
  const pararGravacao = () => { mediaRef.current?.stop(); setGravando(false); };

  const mudarStatus = async (status: ChamadoStatus) => {
    if (!detalhe) return;
    try {
      const r = await api.patch(`/api/chamados/${detalhe.chamado.id}`, { status });
      if (r?.success) { setDetalhe((d) => (d ? { ...d, chamado: { ...d.chamado, status } } : d)); carregar(); toast.success(`Marcado como ${statusLabel(status)}`); }
      else toast.error(r?.error || 'Erro ao alterar');
    } catch { toast.error('Erro ao alterar'); }
  };
  const mudarPrioridade = async (prioridade: ChamadoPrioridade) => {
    if (!detalhe) return;
    try {
      const r = await api.patch(`/api/chamados/${detalhe.chamado.id}`, { prioridade });
      if (r?.success) { setDetalhe((d) => (d ? { ...d, chamado: { ...d.chamado, prioridade } } : d)); carregar(); }
    } catch { toast.error('Erro ao alterar'); }
  };

  const passaStatus = useCallback((c: Chamado) => {
    if (fStatus === 'todos') return true;
    if (fStatus === 'abertos') return !!STATUS[c.status as ChamadoStatus]?.aberto;
    return c.status === fStatus;
  }, [fStatus]);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return chamados.filter((c) => {
      if (!passaStatus(c)) return false;
      if (fBar !== 'todos' && c.bar_id !== fBar) return false;
      if (s && !(`${c.assunto} ${c.aberto_por_nome ?? ''} ${c.ultima_msg_previa ?? ''}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [chamados, passaStatus, fBar, busca]);

  const naoLidosCount = chamados.filter((c) => c.nao_lido).length;

  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-[1600px] px-2 sm:px-4 py-3">
        {/* barra de ações / filtros */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <LifeBuoy className="w-4 h-4 text-indigo-500" />
            {suporte ? 'Fila de chamados' : 'Meus chamados'}
            {naoLidosCount > 0 && <Badge cor="red">{naoLidosCount} novo(s)</Badge>}
          </div>
          <div className="relative ml-auto">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="pl-8 h-9 w-40 sm:w-56" />
          </div>
          <Button onClick={() => setNovoOpen(true)} className="h-9 bg-indigo-600 hover:bg-indigo-700"><Plus className="w-4 h-4 mr-1" />Abrir chamado</Button>
        </div>

        {/* pills de status */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(['abertos', ...STATUS_KEYS, 'todos'] as const).map((k) => {
            const n = k === 'todos' ? chamados.length
              : k === 'abertos' ? chamados.filter((c) => STATUS[c.status as ChamadoStatus]?.aberto).length
              : chamados.filter((c) => c.status === k).length;
            const label = k === 'abertos' ? 'Pendentes' : k === 'todos' ? 'Todos' : statusLabel(k);
            const active = fStatus === k;
            return (
              <button key={k} onClick={() => setFStatus(k)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {label} <span className={active ? 'opacity-80' : 'text-gray-400'}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* pills de bar (suporte) — ver fácil Ordinário × Deboche */}
        {suporte && availableBars.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-[11px] text-gray-400 flex items-center gap-1 mr-0.5"><Building2 className="w-3.5 h-3.5" />Bar</span>
            {(['todos', ...availableBars.map((b) => b.id)] as const).map((k) => {
              const n = k === 'todos' ? chamados.filter(passaStatus).length : chamados.filter((c) => passaStatus(c) && c.bar_id === k).length;
              const label = k === 'todos' ? 'Todos' : nomeBar(k as number);
              const active = fBar === k;
              return (
                <button key={String(k)} onClick={() => setFBar(k as number | 'todos')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {label} <span className={active ? 'opacity-70' : 'text-gray-400'}>{n}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* grid: lista + detalhe */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-3">
          {/* LISTA */}
          <div className={`${selId ? 'hidden lg:block' : ''}`}>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              {loading ? (
                <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              ) : filtrados.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-sm"><Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />Nenhum chamado por aqui.</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  {filtrados.map((c) => {
                    const cat = CATEGORIAS[c.categoria as ChamadoCategoria];
                    const st = STATUS[c.status as ChamadoStatus];
                    const pr = PRIORIDADES[c.prioridade as ChamadoPrioridade];
                    return (
                      <button key={c.id} onClick={() => abrirDetalhe(c.id)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selId === c.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                        <div className="flex items-start gap-2">
                          {c.nao_lido && <span className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" title="Novidade" />}
                          <span className="text-base leading-none mt-0.5">{cat?.emoji || '💬'}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`truncate text-sm ${c.nao_lido ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'}`}>{c.assunto}</span>
                              <span className="ml-auto text-[10px] text-gray-400 shrink-0">{fmtTempo(c.ultima_msg_em)}</span>
                            </div>
                            <div className="text-xs text-gray-500 truncate">{c.ultima_msg_previa || '—'}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge cor={st?.cor || 'gray'}>{statusLabel(c.status)}</Badge>
                              {pr && pr.peso >= 2 && <Badge cor={pr.cor}>{pr.label}</Badge>}
                              {suporte && <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400"><Building2 className="w-3 h-3" />{nomeBar(c.bar_id)}</span>}
                              {suporte && c.aberto_por_nome && <span className="text-[10px] text-gray-400 truncate">· {c.aberto_por_nome}</span>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* DETALHE */}
          <div className={`${selId ? '' : 'hidden lg:block'}`}>
            {!detalhe && !loadingDet ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-24 text-center text-gray-400">
                <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Selecione um chamado para ver a conversa.
              </div>
            ) : loadingDet && !detalhe ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 py-24 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
            ) : detalhe && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-[calc(100vh-12rem)]">
                {/* header do chamado */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-start gap-2">
                    <button onClick={() => { setSelId(null); setDetalhe(null); }} className="lg:hidden p-1 -ml-1 text-gray-400"><ArrowLeft className="w-5 h-5" /></button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{CATEGORIAS[detalhe.chamado.categoria as ChamadoCategoria]?.emoji}</span>
                        <h2 className="font-semibold text-gray-900 dark:text-white truncate">{detalhe.chamado.assunto}</h2>
                        <Badge cor={STATUS[detalhe.chamado.status as ChamadoStatus]?.cor || 'gray'}>{statusLabel(detalhe.chamado.status)}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{catLabel(detalhe.chamado.categoria)}</span>
                        <span>· {detalhe.chamado.aberto_por_nome || detalhe.chamado.email || 'Solicitante'}</span>
                        <span className="inline-flex items-center gap-0.5"><Building2 className="w-3 h-3" />{nomeBar(detalhe.chamado.bar_id)}</span>
                        {detalhe.chamado.rota && <span className="font-mono text-[10px]">· {detalhe.chamado.rota}</span>}
                        <span>· aberto {fmtHora(detalhe.chamado.criado_em)}</span>
                      </div>
                    </div>
                  </div>
                  {/* controles do suporte */}
                  {suporte && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] text-gray-400">Status:</span>
                      {(['em_andamento', 'aguardando', 'resolvido'] as ChamadoStatus[]).map((s) => (
                        <button key={s} onClick={() => mudarStatus(s)}
                          className={`px-2 py-0.5 rounded-full border text-[11px] ${detalhe.chamado.status === s ? COR[STATUS[s].cor] : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                          {statusLabel(s)}
                        </button>
                      ))}
                      <span className="text-[11px] text-gray-400 ml-2">Prioridade:</span>
                      <select value={detalhe.chamado.prioridade} onChange={(e) => mudarPrioridade(e.target.value as ChamadoPrioridade)}
                        className="h-7 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-1.5 text-[11px]">
                        {PRIORIDADE_KEYS.map((p) => <option key={p} value={p}>{PRIORIDADES[p].label}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* thread */}
                <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {detalhe.mensagens.map((m) => {
                    const meu = suporte ? m.autor_tipo === 'suporte' : m.autor_tipo === 'solicitante';
                    return (
                      <div key={m.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${meu ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-sm'}`}>
                          <div className={`text-[10px] mb-0.5 ${meu ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {m.autor_tipo === 'suporte' ? '🛟 Suporte' : (m.autor_nome || 'Solicitante')} · {fmtHora(m.criado_em)}
                          </div>
                          {m.mensagem && <div className="whitespace-pre-wrap break-words">{m.mensagem}</div>}
                          {!!m.anexos?.length && (
                            <div className="grid grid-cols-2 gap-1.5 mt-1">
                              {m.anexos.map((a, i) => (
                                <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={a.url} alt={a.nome || 'anexo'} className="rounded-lg max-h-44 w-full object-cover border border-black/10" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* composer */}
                <div className="border-t border-gray-100 dark:border-gray-800 p-2.5 space-y-2">
                  {/* preview dos anexos */}
                  {(anexos.length > 0 || subindo) && (
                    <div className="flex flex-wrap gap-2">
                      {anexos.map((a, i) => (
                        <div key={i} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.nome || ''} className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                          <button onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}
                            className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600" aria-label="Remover">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {subindo && <div className="h-16 w-16 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => { Array.from(e.target.files || []).forEach(subirImagem); e.currentTarget.value = ''; }} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} title="Anexar imagem"
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={gravando ? pararGravacao : iniciarGravacao} disabled={transcrevendo}
                      title={gravando ? 'Parar e transcrever' : 'Gravar áudio (vira texto)'}
                      className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border ${gravando ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      {transcrevendo ? <Loader2 className="w-4 h-4 animate-spin" /> : gravando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} onPaste={onPaste}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar(); } }}
                      rows={2}
                      placeholder={gravando ? 'Gravando… clique no quadrado pra parar' : transcrevendo ? 'Transcrevendo áudio…' : 'Escreva, cole um print (Ctrl+V) ou grave um áudio… (Ctrl+Enter envia)'}
                      className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm" />
                    <Button onClick={enviar} disabled={enviando || (resposta.trim().length < 1 && anexos.length === 0)} className="h-10 bg-indigo-600 hover:bg-indigo-700">
                      {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {novoOpen && <NovoChamadoModal onClose={() => setNovoOpen(false)} onCriado={(id) => { setNovoOpen(false); carregar(); abrirDetalhe(id); }} />}
    </div>
  );
}

function NovoChamadoModal({ onClose, onCriado }: { onClose: () => void; onCriado: (id: number) => void }) {
  const [categoria, setCategoria] = useState<ChamadoCategoria>('acesso');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<ChamadoPrioridade>('normal');
  const [rota, setRota] = useState('');
  const [salvando, setSalvando] = useState(false);

  const enviar = async () => {
    if (assunto.trim().length < 3 || descricao.trim().length < 3) { toast.error('Preencha assunto e descrição'); return; }
    setSalvando(true);
    try {
      const r = await api.post('/api/chamados', { categoria, assunto: assunto.trim(), descricao: descricao.trim(), prioridade, rota: rota.trim() || undefined });
      if (r?.success) { toast.success('Chamado aberto! 🎫'); onCriado(Number(r.data?.id)); }
      else toast.error(r?.error || 'Erro ao abrir chamado');
    } catch { toast.error('Erro ao abrir chamado'); }
    finally { setSalvando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><LifeBuoy className="w-5 h-5 text-indigo-500" />Abrir chamado</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as ChamadoCategoria)}
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm mt-1">
                {CATEGORIA_KEYS.map((c) => <option key={c} value={c}>{CATEGORIAS[c].emoji} {CATEGORIAS[c].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Prioridade</label>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as ChamadoPrioridade)}
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm mt-1">
                {PRIORIDADE_KEYS.map((p) => <option key={p} value={p}>{PRIORIDADES[p].label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Assunto</label>
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Resumo em uma linha" className="mt-1" maxLength={160} />
          </div>
          <div>
            <label className="text-xs text-gray-500">O que está acontecendo?</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={5}
              placeholder="Explique o problema, o que esperava, e onde acontece. Quanto mais detalhe, mais rápido resolvo."
              className="w-full mt-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500">Tela / onde (opcional)</label>
            <Input value={rota} onChange={(e) => setRota(e.target.value)} placeholder="ex.: /operacional/producoes" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
            <Button onClick={enviar} disabled={salvando} className="bg-indigo-600 hover:bg-indigo-700">
              {salvando ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}Abrir chamado
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
