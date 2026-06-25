'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  Loader2, Pencil, Upload, FileText, Trash2, ExternalLink, X,
  Briefcase, Building2, CalendarDays, Cake, Phone, Mail, CreditCard,
  Banknote, Clock, Fingerprint, CalendarX, AlertTriangle, Plus, ScrollText, Smile, ClipboardCheck, GraduationCap, Check, Link as LinkIcon,
} from 'lucide-react';
import type { Funcionario } from '../page';
import { EspelhoPontoTab } from './EspelhoPontoTab';

const TIPO_DOC: Record<string, string> = {
  carteira_trabalho: 'Carteira de Trabalho', exame_admissional: 'Exame Admissional',
  contrato: 'Contrato', rg_cpf: 'RG / CPF', outro: 'Outro',
};
const TIPO_OCORR: Record<string, string> = {
  advertencia: 'Advertência', falta: 'Falta', atestado: 'Atestado', ferias: 'Férias', observacao: 'Observação',
};
const FELIZ_DIMS: [string, string][] = [
  ['eu_comigo_engajamento', 'Engajamento'], ['eu_com_empresa_pertencimento', 'Pertencimento'],
  ['eu_com_colega_relacionamento', 'Relacionamento'], ['eu_com_gestor_lideranca', 'Liderança'],
  ['justica_reconhecimento', 'Reconhecimento'],
];
const AVATAR_CORES = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
];

const fmtBRL = (v: number | null) => v == null ? null : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtData = (d: string | null) => { if (!d) return null; try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; } };
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const corAvatar = (nome: string) => { let h = 0; for (const c of nome) h = (h + c.charCodeAt(0)) % AVATAR_CORES.length; return AVATAR_CORES[h]; };
const tempoDeCasa = (a: string | null) => {
  if (!a) return null; const d = new Date(a); const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--; if (m < 0) return null;
  const anos = Math.floor(m / 12); const meses = m % 12;
  return anos > 0 ? `${anos}a ${meses}m` : `${meses} meses`;
};
const tipoTag = (t: string | null) =>
  t === 'Freela' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  : t === 'PJ' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
const corOcorr = (t: string) =>
  t === 'advertencia' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  : t === 'atestado' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  : t === 'ferias' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  : t === 'falta' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
  : 'bg-muted text-muted-foreground';

type Doc = { id: string; tipo: string; descricao: string | null; nome_arquivo: string | null; validade: string | null; criado_em: string; url: string | null };
type Ocorr = { id: string; tipo: string; data_inicio: string; data_fim: string | null; descricao: string | null };
type Alerta = { tipo: string; label: string; nivel: string };
type Avaliacao = { id: string; periodo: string; avaliador: string | null; criterios: { criterio: string; nota: number }[]; nota_geral: number | null; pontos_fortes: string | null; pontos_desenvolver: string | null; criado_em: string };
type Treino = { id: string; nome: string; instituicao: string | null; data_conclusao: string | null; validade: string | null; observacao: string | null };
type Onb = { id: string; item: string; concluido: boolean; ordem: number };

const CRITERIOS_PADRAO = ['Pontualidade', 'Postura e atitude', 'Trabalho em equipe', 'Qualidade do trabalho', 'Proatividade', 'Atendimento ao cliente'];
const notaCls = (n: number) => n >= 4 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : n >= 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';

export function DossieDialog({ funcionarioId, onClose, onEditar }: {
  funcionarioId: number | null; onClose: () => void; onEditar: (f: Funcionario) => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorr[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [felicidade, setFelicidade] = useState<any>(null);
  const [tipoUp, setTipoUp] = useState('carteira_trabalho');
  const [validadeUp, setValidadeUp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [novoOc, setNovoOc] = useState({ tipo: 'advertencia', data_inicio: '', data_fim: '', descricao: '' });
  const [salvandoOc, setSalvandoOc] = useState(false);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [novaAval, setNovaAval] = useState<{ periodo: string; avaliador: string; notas: Record<string, number>; pontos_fortes: string; pontos_desenvolver: string }>({ periodo: '', avaliador: '', notas: {}, pontos_fortes: '', pontos_desenvolver: '' });
  const [salvandoAval, setSalvandoAval] = useState(false);
  const [formAvalAberto, setFormAvalAberto] = useState(false);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [novoTreino, setNovoTreino] = useState({ nome: '', instituicao: '', data_conclusao: '', validade: '' });
  const [salvandoTreino, setSalvandoTreino] = useState(false);
  const [onbItens, setOnbItens] = useState<Onb[]>([]);
  const [novoOnb, setNovoOnb] = useState('');

  const carregar = useCallback(async () => {
    if (!funcionarioId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rh/funcionarios/${funcionarioId}`);
      setFunc(res.funcionario); setOcorrencias(res.ocorrencias || []); setAlertas(res.alertas || []); setFelicidade(res.felicidade || null);
      const dres = await api.get(`/api/rh/funcionarios/${funcionarioId}/documentos`);
      setDocs(dres.documentos || []);
      const ares = await api.get(`/api/rh/funcionarios/${funcionarioId}/avaliacoes`);
      setAvaliacoes(ares.avaliacoes || []);
      const tres = await api.get(`/api/rh/funcionarios/${funcionarioId}/treinamentos`);
      setTreinos(tres.treinamentos || []);
      const ores = await api.get(`/api/rh/funcionarios/${funcionarioId}/onboarding`);
      setOnbItens(ores.itens || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao abrir dossiê', message: e?.message }); }
    finally { setLoading(false); }
  }, [funcionarioId, showToast]);

  useEffect(() => { if (funcionarioId) carregar(); }, [funcionarioId, carregar]);

  const enviarDoc = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { showToast({ type: 'error', title: 'Escolha um arquivo' }); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('tipo', tipoUp);
      if (validadeUp) fd.append('validade', validadeUp);
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/documentos`, { method: 'POST', body: fd, credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha no upload');
      showToast({ type: 'success', title: 'Documento anexado' });
      if (fileRef.current) fileRef.current.value = ''; setValidadeUp('');
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro no upload', message: e?.message }); }
    finally { setEnviando(false); }
  };
  const excluirDoc = async (docId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/documentos?doc_id=${docId}`, { method: 'DELETE', credentials: 'include' });
      setDocs((p) => p.filter((d) => d.id !== docId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const addOcorrencia = async () => {
    if (!novoOc.data_inicio) { showToast({ type: 'error', title: 'Informe a data' }); return; }
    setSalvandoOc(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/ocorrencias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(novoOc),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setNovoOc({ tipo: 'advertencia', data_inicio: '', data_fim: '', descricao: '' });
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoOc(false); }
  };
  const excluirOcorrencia = async (ocId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/ocorrencias?ocorrencia_id=${ocId}`, { method: 'DELETE', credentials: 'include' });
      setOcorrencias((p) => p.filter((o) => o.id !== ocId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const salvarAval = async () => {
    if (!novaAval.periodo.trim()) { showToast({ type: 'error', title: 'Informe o período' }); return; }
    setSalvandoAval(true);
    try {
      const criterios = CRITERIOS_PADRAO.map((c) => ({ criterio: c, nota: novaAval.notas[c] || 0 })).filter((c) => c.nota > 0);
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/avaliacoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ periodo: novaAval.periodo, avaliador: novaAval.avaliador, criterios, pontos_fortes: novaAval.pontos_fortes, pontos_desenvolver: novaAval.pontos_desenvolver }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setNovaAval({ periodo: '', avaliador: '', notas: {}, pontos_fortes: '', pontos_desenvolver: '' });
      setFormAvalAberto(false); carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoAval(false); }
  };
  const excluirAval = async (avId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/avaliacoes?avaliacao_id=${avId}`, { method: 'DELETE', credentials: 'include' });
      setAvaliacoes((p) => p.filter((a) => a.id !== avId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const salvarTreino = async () => {
    if (!novoTreino.nome.trim()) { showToast({ type: 'error', title: 'Informe o treinamento' }); return; }
    setSalvandoTreino(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/treinamentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(novoTreino),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setNovoTreino({ nome: '', instituicao: '', data_conclusao: '', validade: '' });
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoTreino(false); }
  };
  const excluirTreino = async (tId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/treinamentos?treinamento_id=${tId}`, { method: 'DELETE', credentials: 'include' });
      setTreinos((p) => p.filter((t) => t.id !== tId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const toggleOnb = async (it: Onb) => {
    const novo = !it.concluido;
    setOnbItens((p) => p.map((x) => x.id === it.id ? { ...x, concluido: novo } : x));
    try { await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ id: it.id, concluido: novo }) }); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); carregar(); }
  };
  const addOnb = async () => {
    if (!novoOnb.trim()) return;
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ item: novoOnb }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha');
      setNovoOnb(''); carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
  };
  const removeOnb = async (itemId: string) => {
    try { await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding?item_id=${itemId}`, { method: 'DELETE', credentials: 'include' }); setOnbItens((p) => p.filter((x) => x.id !== itemId)); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };

  const freela = func?.tipo_contratacao === 'Freela';
  const venceu = (d: string | null) => { if (!d) return false; try { return new Date(d) < new Date(); } catch { return false; } };

  return (
    <Dialog open={funcionarioId != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {loading || !func ? (
          <div className="py-24 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <>
            {/* ── Cabeçalho ── */}
            <div className="relative bg-gradient-to-br from-muted/60 to-muted/20 px-6 pt-6 pb-5 border-b">
              <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              <div className="flex items-start gap-4">
                {func.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={func.foto_url} alt={func.nome} className="w-16 h-16 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${corAvatar(func.nome)}`}>{iniciais(func.nome)}</div>
                )}
                <div className="min-w-0 flex-1 pr-8">
                  <h2 className="text-xl font-bold leading-tight truncate">{func.nome}</h2>
                  <p className="text-sm text-muted-foreground truncate">{[func.cargo_nome, func.area_nome].filter(Boolean).join(' · ') || 'Sem cargo/área'}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${func.ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{func.ativo ? '● Ativo' : '○ Inativo'}</span>
                    <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${tipoTag(func.tipo_contratacao)}`}>{func.tipo_contratacao || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {(func as any).portal_token && (
                    <Button variant="outline" size="sm" title="Copiar link do portal do funcionário" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/portal/${(func as any).portal_token}`); showToast({ type: 'success', title: 'Link do portal copiado', message: 'Envie pro funcionário (WhatsApp/QR).' }); }}><LinkIcon className="w-3.5 h-3.5 mr-1.5" />Portal</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => { const d = new Date(); window.open(`/recibo?id=${func.id}&mes=${d.getMonth() + 1}&ano=${d.getFullYear()}`, '_blank'); }}><ScrollText className="w-3.5 h-3.5 mr-1.5" />Recibo</Button>
                  <Button variant="outline" size="sm" onClick={() => onEditar(func)}><Pencil className="w-3.5 h-3.5 mr-1.5" />Editar</Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                <Destaque icon={Clock} label="Tempo de casa" value={tempoDeCasa(func.data_admissao) || '—'} />
                <Destaque icon={CalendarDays} label="Admissão" value={fmtData(func.data_admissao) || '—'} />
                <Destaque icon={Banknote} label={freela ? 'Diária' : 'Salário'} value={fmtBRL(freela ? func.valor_diaria : func.salario_base) || '—'} accent="text-emerald-600 dark:text-emerald-400" />
              </div>
              {alertas.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {alertas.map((a, i) => (
                    <span key={i} className={`text-[11px] rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${a.nivel === 'alerta' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}><AlertTriangle className="w-3 h-3" />{a.label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Abas ── */}
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="mx-6 mt-3 flex-wrap h-auto">
                <TabsTrigger value="geral">Visão geral</TabsTrigger>
                <TabsTrigger value="onboarding">Onboarding{onbItens.length > 0 && ` (${onbItens.filter((i) => i.concluido).length}/${onbItens.length})`}</TabsTrigger>
                <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger>
                <TabsTrigger value="ocorr">Ocorrências ({ocorrencias.length})</TabsTrigger>
                <TabsTrigger value="ponto"><Clock className="w-3.5 h-3.5 mr-1" />Ponto</TabsTrigger>
                <TabsTrigger value="avaliacoes">Avaliações ({avaliacoes.length})</TabsTrigger>
                <TabsTrigger value="treinos">Treinamentos ({treinos.length})</TabsTrigger>
                <TabsTrigger value="felicidade">Felicidade</TabsTrigger>
              </TabsList>

              {/* Visão geral */}
              <TabsContent value="geral" className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                <Secao titulo="Dados pessoais">
                  <Info icon={Cake} label="Nascimento" value={fmtData(func.data_nascimento)} />
                  <Info icon={Fingerprint} label="CPF" value={func.cpf} />
                  <Info icon={Phone} label="Telefone" value={func.telefone} />
                  <Info icon={Mail} label="Email" value={func.email} />
                </Secao>
                <Secao titulo="Contratação & pagamento">
                  <Info icon={Briefcase} label="Cargo" value={func.cargo_nome} />
                  <Info icon={Building2} label="Área" value={func.area_nome} />
                  {func.dias_trabalho_semana != null && <Info icon={CalendarDays} label="Dias/semana" value={String(func.dias_trabalho_semana)} />}
                  {func.data_demissao && <Info icon={CalendarX} label="Demissão" value={fmtData(func.data_demissao)} alerta />}
                  <Info icon={CreditCard} label="PIX" value={func.chave_pix ? `${func.chave_pix}${func.tipo_chave_pix ? ` (${func.tipo_chave_pix})` : ''}` : null} />
                </Secao>
                {func.observacoes && <p className="sm:col-span-2 text-xs text-muted-foreground bg-muted/40 rounded-md border-l-2 border-muted-foreground/30 px-3 py-2 mt-2">{func.observacoes}</p>}
              </TabsContent>

              {/* Ponto (espelho de ponto × escala) */}
              <TabsContent value="ponto" className="p-0">
                <EspelhoPontoTab funcionarioId={func.id} />
              </TabsContent>

              {/* Onboarding */}
              <TabsContent value="onboarding" className="px-6 py-4">
                {(() => { const done = onbItens.filter((i) => i.concluido).length; const tot = onbItens.length; const pct = tot ? Math.round((done / tot) * 100) : 0; return (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className={cn('h-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} /></div>
                      <span className="text-xs font-semibold tabular-nums">{done}/{tot}</span>
                    </div>
                    <div className="space-y-1 mb-3">
                      {onbItens.map((it) => (
                        <div key={it.id} className="group flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2">
                          <button onClick={() => toggleOnb(it)} className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0 border', it.concluido ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-input hover:border-emerald-400')}>{it.concluido && <Check className="w-3.5 h-3.5" />}</button>
                          <span className={cn('text-sm flex-1', it.concluido && 'line-through text-muted-foreground')}>{it.item}</span>
                          <button onClick={() => removeOnb(it.id)} className="p-1 rounded text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input value={novoOnb} onChange={(e) => setNovoOnb(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addOnb(); }} placeholder="Adicionar item ao checklist…" className="h-9 text-sm" />
                      <Button size="sm" variant="outline" className="h-9" onClick={addOnb}><Plus className="w-4 h-4" /></Button>
                    </div>
                  </>
                ); })()}
              </TabsContent>

              {/* Documentos */}
              <TabsContent value="docs" className="px-6 py-4">
                {docs.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-muted-foreground" /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-tight">{TIPO_DOC[d.tipo] || d.tipo}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{d.nome_arquivo}{d.validade && <span className={venceu(d.validade) ? 'text-red-500' : 'text-amber-600'}> · {venceu(d.validade) ? 'venceu' : 'vence'} {fmtData(d.validade)}</span>}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-muted text-blue-600" title="Abrir"><ExternalLink className="w-4 h-4" /></a>}
                          <button onClick={() => excluirDoc(d.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-muted-foreground text-center py-6 mb-3 border border-dashed rounded-lg">Nenhum documento anexado ainda.</div>}
                <div className="flex items-end gap-2 flex-wrap rounded-lg border bg-muted/20 p-3">
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</span>
                    <select value={tipoUp} onChange={(e) => setTipoUp(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{Object.entries(TIPO_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Validade (opcional)</span><Input type="date" value={validadeUp} onChange={(e) => setValidadeUp(e.target.value)} className="h-9 text-sm w-[150px]" /></label>
                  <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Arquivo</span><input ref={fileRef} type="file" accept="application/pdf,image/*" className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1.5 file:text-xs h-9 leading-9" /></label>
                  <Button size="sm" onClick={enviarDoc} disabled={enviando} className="h-9">{enviando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}Anexar</Button>
                </div>
              </TabsContent>

              {/* Ocorrências */}
              <TabsContent value="ocorr" className="px-6 py-4">
                {ocorrencias.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {ocorrencias.map((o) => (
                      <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] rounded px-1.5 py-0.5 ${corOcorr(o.tipo)}`}>{TIPO_OCORR[o.tipo] || o.tipo}</span>
                            <span className="text-xs text-muted-foreground">{fmtData(o.data_inicio)}{o.data_fim ? ` → ${fmtData(o.data_fim)}` : ''}</span>
                          </div>
                          {o.descricao && <div className="text-sm mt-0.5">{o.descricao}</div>}
                        </div>
                        <button onClick={() => excluirOcorrencia(o.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500 shrink-0" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-muted-foreground text-center py-6 mb-3 border border-dashed rounded-lg">Sem advertências, atestados, férias ou faltas registradas.</div>}
                <div className="flex items-end gap-2 flex-wrap rounded-lg border bg-muted/20 p-3">
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</span>
                    <select value={novoOc.tipo} onChange={(e) => setNovoOc({ ...novoOc, tipo: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{Object.entries(TIPO_OCORR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</span><Input type="date" value={novoOc.data_inicio} onChange={(e) => setNovoOc({ ...novoOc, data_inicio: e.target.value })} className="h-9 text-sm w-[140px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Até (opcional)</span><Input type="date" value={novoOc.data_fim} onChange={(e) => setNovoOc({ ...novoOc, data_fim: e.target.value })} className="h-9 text-sm w-[140px]" /></label>
                  <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Descrição</span><Input value={novoOc.descricao} onChange={(e) => setNovoOc({ ...novoOc, descricao: e.target.value })} placeholder="ex: atraso recorrente" className="h-9 text-sm" /></label>
                  <Button size="sm" onClick={addOcorrencia} disabled={salvandoOc} className="h-9">{salvandoOc ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Adicionar</Button>
                </div>
              </TabsContent>

              {/* Avaliações */}
              <TabsContent value="avaliacoes" className="px-6 py-4">
                {avaliacoes.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {avaliacoes.map((a) => (
                      <div key={a.id} className="rounded-lg border bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{a.periodo}</span>
                            {a.nota_geral != null && <span className={cn('text-[11px] rounded-full px-2 py-0.5 font-semibold', notaCls(a.nota_geral))}>{a.nota_geral.toFixed(1)}/5</span>}
                            {a.avaliador && <span className="text-[11px] text-muted-foreground">por {a.avaliador}</span>}
                          </div>
                          <button onClick={() => excluirAval(a.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        {a.criterios?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {a.criterios.map((c, i) => <span key={i} className="text-[10px] rounded bg-muted px-1.5 py-0.5">{c.criterio}: <b>{c.nota}</b></span>)}
                          </div>
                        )}
                        {(a.pontos_fortes || a.pontos_desenvolver) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                            {a.pontos_fortes && <div className="rounded bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1"><b className="text-emerald-700 dark:text-emerald-300">Fortes:</b> {a.pontos_fortes}</div>}
                            {a.pontos_desenvolver && <div className="rounded bg-amber-50 dark:bg-amber-900/20 px-2 py-1"><b className="text-amber-700 dark:text-amber-300">Desenvolver:</b> {a.pontos_desenvolver}</div>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-muted-foreground text-center py-6 mb-3 border border-dashed rounded-lg flex flex-col items-center"><ClipboardCheck className="w-8 h-8 mb-1.5 opacity-40" />Nenhuma avaliação registrada ainda.</div>}

                {!formAvalAberto ? (
                  <Button size="sm" variant="outline" onClick={() => setFormAvalAberto(true)}><Plus className="w-4 h-4 mr-1.5" />Nova avaliação</Button>
                ) : (
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Período</span><Input value={novaAval.periodo} onChange={(e) => setNovaAval({ ...novaAval, periodo: e.target.value })} placeholder="ex: 1º semestre 2026" className="h-9 text-sm" /></label>
                      <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Avaliador</span><Input value={novaAval.avaliador} onChange={(e) => setNovaAval({ ...novaAval, avaliador: e.target.value })} placeholder="opcional" className="h-9 text-sm" /></label>
                    </div>
                    <div className="space-y-1.5">
                      {CRITERIOS_PADRAO.map((c) => (
                        <div key={c} className="flex items-center justify-between gap-2">
                          <span className="text-xs">{c}</span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button key={n} type="button" onClick={() => setNovaAval((p) => ({ ...p, notas: { ...p.notas, [c]: n } }))}
                                className={cn('w-6 h-6 rounded text-[11px] font-medium transition-colors', (novaAval.notas[c] || 0) >= n ? 'bg-amber-400 text-white' : 'bg-muted text-muted-foreground hover:bg-muted-foreground/20')}>{n}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pontos fortes</span><Input value={novaAval.pontos_fortes} onChange={(e) => setNovaAval({ ...novaAval, pontos_fortes: e.target.value })} className="h-9 text-sm" /></label>
                      <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">A desenvolver</span><Input value={novaAval.pontos_desenvolver} onChange={(e) => setNovaAval({ ...novaAval, pontos_desenvolver: e.target.value })} className="h-9 text-sm" /></label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setFormAvalAberto(false)}>Cancelar</Button>
                      <Button size="sm" onClick={salvarAval} disabled={salvandoAval}>{salvandoAval ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar avaliação'}</Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Treinamentos */}
              <TabsContent value="treinos" className="px-6 py-4">
                {treinos.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {treinos.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0"><GraduationCap className="w-4 h-4 text-violet-600 dark:text-violet-300" /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium leading-tight truncate">{t.nome}{t.instituicao && <span className="text-muted-foreground font-normal"> · {t.instituicao}</span>}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {t.data_conclusao && <>concluído {fmtData(t.data_conclusao)}</>}
                              {t.validade && <span className={venceu(t.validade) ? 'text-red-500' : 'text-amber-600'}>{t.data_conclusao ? ' · ' : ''}{venceu(t.validade) ? 'venceu' : 'vence'} {fmtData(t.validade)}</span>}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => excluirTreino(t.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-muted-foreground text-center py-6 mb-3 border border-dashed rounded-lg flex flex-col items-center"><GraduationCap className="w-8 h-8 mb-1.5 opacity-40" />Nenhum treinamento/certificação registrado.</div>}
                <div className="flex items-end gap-2 flex-wrap rounded-lg border bg-muted/20 p-3">
                  <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Treinamento</span><Input value={novoTreino.nome} onChange={(e) => setNovoTreino({ ...novoTreino, nome: e.target.value })} placeholder="ex: Manipulação de Alimentos" className="h-9 text-sm" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Instituição</span><Input value={novoTreino.instituicao} onChange={(e) => setNovoTreino({ ...novoTreino, instituicao: e.target.value })} className="h-9 text-sm w-[140px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Conclusão</span><Input type="date" value={novoTreino.data_conclusao} onChange={(e) => setNovoTreino({ ...novoTreino, data_conclusao: e.target.value })} className="h-9 text-sm w-[140px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Validade</span><Input type="date" value={novoTreino.validade} onChange={(e) => setNovoTreino({ ...novoTreino, validade: e.target.value })} className="h-9 text-sm w-[140px]" /></label>
                  <Button size="sm" onClick={salvarTreino} disabled={salvandoTreino} className="h-9">{salvandoTreino ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Adicionar</Button>
                </div>
              </TabsContent>

              {/* Felicidade */}
              <TabsContent value="felicidade" className="px-6 py-4">
                {felicidade ? (
                  <div>
                    <div className="flex items-end gap-3 mb-3">
                      <div className="text-3xl font-bold text-emerald-600">{Math.round(Number(felicidade.resultado_percentual || 0))}%</div>
                      <div className="text-xs text-muted-foreground mb-1">satisfação · média {Number(felicidade.media_geral || 0).toFixed(2)} · pesquisa {fmtData(felicidade.data_pesquisa)}</div>
                    </div>
                    <div className="space-y-1.5">
                      {FELIZ_DIMS.map(([k, label]) => {
                        const v = Number(felicidade[k] || 0);
                        return (
                          <div key={k} className="flex items-center gap-2">
                            <span className="text-[11px] w-28 text-muted-foreground shrink-0">{label}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (v / 5) * 100)}%` }} /></div>
                            <span className="text-[11px] w-8 text-right">{v.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-6">
                    <Smile className="w-9 h-9 mx-auto mb-2 opacity-40" />
                    <div className="text-sm">Sem pesquisa de felicidade para esta pessoa ainda.</div>
                    <div className="text-xs mt-1">As respostas da pesquisa de clima aparecem aqui (match por nome).</div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Destaque({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border bg-background/70 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><Icon className="w-3 h-3" />{label}</div>
      <div className={`text-sm font-bold mt-0.5 truncate ${accent || ''}`}>{value}</div>
    </div>
  );
}
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="py-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{titulo}</div>
      {children}
    </div>
  );
}
function Info({ icon: Icon, label, value, alerta }: { icon: any; label: string; value: string | null | undefined; alerta?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        <div className={`text-sm truncate ${value ? (alerta ? 'text-red-600 dark:text-red-400 font-medium' : '') : 'text-muted-foreground/40'}`}>{value || '—'}</div>
      </div>
    </div>
  );
}
