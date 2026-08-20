'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { getSelectedBarId } from '@/lib/selected-bar';
import { getSupabaseClient } from '@/lib/supabase';
import { AVISO_DOC_PESADO_BYTES, MAX_DOC_BYTES, formataMb, validaDocumento } from '@/lib/rh/documentos';
import { cn } from '@/lib/utils';

// Header do bar selecionado — os fetch crus deste dossiê PRECISAM enviar, senão o servidor cai
// no bar padrão do usuário e não acha o funcionário quando ele é de outro bar (ex.: RH no Ordinário
// abrindo alguém do Deboche → "funcionário não encontrado"). O api-client injeta isso sozinho.
const barHdr = (): Record<string, string> => { const b = getSelectedBarId(); return b ? { 'x-selected-bar-id': b } : {}; };

// Resposta de erro nem sempre é JSON (413 da borda da Vercel vem em HTML) — sem isso o motivo
// real do erro sumia e o usuário só via "Falha no upload".
const lerJson = async (r: Response): Promise<any> => {
  try { return await r.json(); }
  catch { return { success: false, error: r.status === 413 ? `Arquivo grande demais para o envio (máx. ${formataMb(MAX_DOC_BYTES)}).` : `Erro ${r.status} no servidor.` }; }
};
import {
  Loader2, Pencil, Upload, Download, FileText, Trash2, ExternalLink,
  CalendarDays, Cake, Phone, Mail, CreditCard,
  Banknote, Clock, Fingerprint, CalendarX, AlertTriangle, Plus, ScrollText, Target, GraduationCap, Check, Link as LinkIcon, UserMinus, ArrowRightLeft,
} from 'lucide-react';
import type { Funcionario } from '../page';
import { CartaoIcon } from './CartoesBadge';
import { EspelhoPontoTab } from './EspelhoPontoTab';
import { LABEL_DOC } from '@/lib/rh/documentos';
import { DemissaoDialog } from './DemissaoDialog';
import { TransferenciaDialog } from './TransferenciaDialog';
import { CalibracaoTab } from './CalibracaoTab';

// Catálogo único (mesma lista que gera os alertas de documento faltando) — antes esta tela
// conhecia 7 tipos e os alertas conheciam 5, avisando a falta de só 2.
const TIPO_DOC: Record<string, string> = LABEL_DOC;
const TIPO_OCORR: Record<string, string> = {
  advertencia: 'Advertência', falta: 'Falta', atestado: 'Atestado', ferias: 'Férias', observacao: 'Observação',
};
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
type Ocorr = { id: string; tipo: string; data_inicio: string; data_fim: string | null; descricao: string | null; cartao?: string | null; aplicado_por?: string | null };
type Alerta = { tipo: string; label: string; nivel: string };
type Treino = { id: string; nome: string; instituicao: string | null; data_conclusao: string | null; validade: string | null; observacao: string | null };
type Onb = { id: string; item: string; concluido: boolean; ordem: number };
type Calibracao = { id: string; ano: number; trimestre: number; comportamento: string | null; performance: string | null; observacao: string | null; registrado_por: string | null };


export function DossieDialog({ funcionarioId, onClose, onEditar }: {
  funcionarioId: number | null; onClose: () => void; onEditar: (f: Funcionario) => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [imgErro, setImgErro] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorr[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [demissaoAberta, setDemissaoAberta] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [transferenciaAberta, setTransferenciaAberta] = useState(false);
  const [tipoUp, setTipoUp] = useState('carteira_trabalho');
  const [validadeUp, setValidadeUp] = useState('');
  const [avisoArq, setAvisoArq] = useState<{ texto: string; erro: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [novoOc, setNovoOc] = useState({ tipo: 'advertencia', data_inicio: '', data_fim: '', descricao: '', cartao: 'amarelo', aplicado_por: '' });
  const [novaObs, setNovaObs] = useState({ data_inicio: '', descricao: '' });
  const [salvandoObs, setSalvandoObs] = useState(false);
  // Números de documento digitados (CPF/RG/CTPS) — pra quem não tem o PDF/foto.
  const [nums, setNums] = useState({ cpf: '', rg: '', ctps: '' });
  const [salvandoNums, setSalvandoNums] = useState(false);
  const [salvandoOc, setSalvandoOc] = useState(false);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [novoTreino, setNovoTreino] = useState({ nome: '', instituicao: '', data_conclusao: '', validade: '' });
  const [salvandoTreino, setSalvandoTreino] = useState(false);
  const [onbItens, setOnbItens] = useState<Onb[]>([]);
  const [novoOnb, setNovoOnb] = useState('');
  // só a contagem para o rótulo da aba — o formulário e a leitura vivem em CalibracaoTab
  const [calibracoes, setCalibracoes] = useState<Calibracao[]>([]);

  const carregar = useCallback(async () => {
    if (!funcionarioId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rh/funcionarios/${funcionarioId}`);
      setFunc(res.funcionario); setOcorrencias(res.ocorrencias || []); setAlertas(res.alertas || []);
      const dres = await api.get(`/api/rh/funcionarios/${funcionarioId}/documentos`);
      setDocs(dres.documentos || []);
      const tres = await api.get(`/api/rh/funcionarios/${funcionarioId}/treinamentos`);
      setTreinos(tres.treinamentos || []);
      const ores = await api.get(`/api/rh/funcionarios/${funcionarioId}/onboarding`);
      setOnbItens(ores.itens || []);
      const cres = await api.get(`/api/rh/funcionarios/${funcionarioId}/calibracoes`);
      setCalibracoes(cres.calibracoes || []);
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao abrir dossiê', message: e?.message }); }
    finally { setLoading(false); }
  }, [funcionarioId, showToast]);

  useEffect(() => { if (funcionarioId) { setImgErro(false); carregar(); } }, [funcionarioId, carregar]);

  // Feedback na hora de escolher o arquivo — melhor do que descobrir que não serve depois de
  // esperar o upload inteiro no 4G.
  const conferirArquivo = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setAvisoArq(null); return; }
    const invalido = validaDocumento(file.name, file.type || null, file.size);
    if (invalido) { setAvisoArq({ texto: invalido, erro: true }); return; }
    setAvisoArq(file.size > AVISO_DOC_PESADO_BYTES
      ? { texto: `Arquivo de ${formataMb(file.size)} — pode demorar um pouco pra enviar no celular.`, erro: false }
      : null);
  };

  // Upload em 3 passos: pede URL assinada -> sobe DIRETO pro Storage -> confirma e grava a linha.
  // O arquivo não passa pela função da Vercel (o corpo de requisição lá tem teto de ~4,5 MB e PDF
  // escaneado de várias páginas estourava isso: a requisição morria na borda e a tela só dizia
  /**
   * Exporta TODOS os documentos do funcionário (pedido do Gonza, 19/08/2026).
   *
   * Baixa um a um pelas URLs assinadas com Content-Disposition: attachment (`url_download`,
   * montada na rota). Sem lib de zip de propósito: a alternativa era entrar com um empacotador
   * no bundle pra resolver um botão. O navegador pergunta uma vez se aceita vários downloads;
   * o intervalo entre os cliques é o que evita ele engolir os seguintes.
   */
  const [exportando, setExportando] = useState(false);
  const exportarDocs = async () => {
    if (!docs.length) return;
    setExportando(true);
    try {
      for (const d of docs) {
        const href = (d as any).url_download || d.url;
        if (!href) continue;
        const a = document.createElement('a');
        a.href = href;
        a.download = d.nome_arquivo || '';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally { setExportando(false); }
  };

  // "Falha no upload"). Ver comentários em lib/rh/documentos.ts.
  const enviarDoc = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { showToast({ type: 'error', title: 'Escolha um arquivo' }); return; }
    const invalido = validaDocumento(file.name, file.type || null, file.size);
    if (invalido) { showToast({ type: 'error', title: 'Arquivo não aceito', message: invalido }); return; }
    setEnviando(true);
    try {
      const r1 = await fetch(`/api/rh/funcionarios/${funcionarioId}/documentos/upload-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include',
        body: JSON.stringify({ nome_arquivo: file.name, mime: file.type || null, tamanho_bytes: file.size }),
      });
      const j1 = await lerJson(r1);
      if (!r1.ok || !j1.success) throw new Error(j1.error || 'Não foi possível preparar o envio');

      // Se o celular/scanner não informou o content-type, reembrulha com o tipo certo — senão o
      // bucket rejeita o arquivo por "octet-stream".
      const paraSubir = file.type === j1.mime ? file : new File([file], file.name, { type: j1.mime });
      const sb = await getSupabaseClient();
      if (!sb) throw new Error('Falha ao conectar no armazenamento. Recarregue a página e tente de novo.');
      const { error: upErr } = await sb.storage.from(j1.bucket).uploadToSignedUrl(j1.path, j1.token, paraSubir);
      if (upErr) throw new Error(`Falha ao enviar o arquivo (${formataMb(file.size)}): ${upErr.message}`);

      const r3 = await fetch(`/api/rh/funcionarios/${funcionarioId}/documentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include',
        body: JSON.stringify({ storage_path: j1.path, nome_arquivo: file.name, tipo: tipoUp, validade: validadeUp || null }),
      });
      const j3 = await lerJson(r3);
      if (!r3.ok || !j3.success) throw new Error(j3.error || 'Falha ao salvar o documento');

      showToast({ type: 'success', title: 'Documento anexado' });
      if (fileRef.current) fileRef.current.value = ''; setValidadeUp(''); setAvisoArq(null);
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro no upload', message: e?.message }); }
    finally { setEnviando(false); }
  };
  const excluirDoc = async (docId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/documentos?doc_id=${docId}`, { method: 'DELETE', headers: barHdr(), credentials: 'include' });
      setDocs((p) => p.filter((d) => d.id !== docId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const addOcorrencia = async () => {
    if (!novoOc.data_inicio) { showToast({ type: 'error', title: 'Informe a data' }); return; }
    setSalvandoOc(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/ocorrencias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include', body: JSON.stringify(novoOc),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setNovoOc({ tipo: 'advertencia', data_inicio: '', data_fim: '', descricao: '', cartao: 'amarelo', aplicado_por: '' });
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoOc(false); }
  };
  const addObservacao = async () => {
    if (!novaObs.descricao.trim()) { showToast({ type: 'error', title: 'Escreva o BO' }); return; }
    setSalvandoObs(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/ocorrencias`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include',
        body: JSON.stringify({ tipo: 'observacao', data_inicio: novaObs.data_inicio || new Date().toISOString().slice(0, 10), descricao: novaObs.descricao }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setNovaObs({ data_inicio: '', descricao: '' });
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoObs(false); }
  };
  // Espelha os números digitados quando o funcionário carrega.
  useEffect(() => {
    if (func) setNums({ cpf: func.cpf || '', rg: (func as any).rg || '', ctps: (func as any).ctps || '' });
  }, [func]);
  const salvarNums = async () => {
    setSalvandoNums(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include',
        body: JSON.stringify({ cpf: nums.cpf.trim() || null, rg: nums.rg.trim() || null, ctps: nums.ctps.trim() || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      showToast({ type: 'success', title: 'Números salvos' });
      carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
    finally { setSalvandoNums(false); }
  };
  const excluirOcorrencia = async (ocId: string) => {
    try {
      await fetch(`/api/rh/funcionarios/${funcionarioId}/ocorrencias?ocorrencia_id=${ocId}`, { method: 'DELETE', headers: barHdr(), credentials: 'include' });
      setOcorrencias((p) => p.filter((o) => o.id !== ocId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const salvarTreino = async () => {
    if (!novoTreino.nome.trim()) { showToast({ type: 'error', title: 'Informe o treinamento' }); return; }
    setSalvandoTreino(true);
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/treinamentos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include', body: JSON.stringify(novoTreino),
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
      await fetch(`/api/rh/funcionarios/${funcionarioId}/treinamentos?treinamento_id=${tId}`, { method: 'DELETE', headers: barHdr(), credentials: 'include' });
      setTreinos((p) => p.filter((t) => t.id !== tId));
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };
  const toggleOnb = async (it: Onb) => {
    const novo = !it.concluido;
    setOnbItens((p) => p.map((x) => x.id === it.id ? { ...x, concluido: novo } : x));
    try { await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include', body: JSON.stringify({ id: it.id, concluido: novo }) }); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); carregar(); }
  };
  const addOnb = async () => {
    if (!novoOnb.trim()) return;
    try {
      const r = await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...barHdr() }, credentials: 'include', body: JSON.stringify({ item: novoOnb }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha');
      setNovoOnb(''); carregar();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro', message: e?.message }); }
  };
  const removeOnb = async (itemId: string) => {
    try { await fetch(`/api/rh/funcionarios/${funcionarioId}/onboarding?item_id=${itemId}`, { method: 'DELETE', headers: barHdr(), credentials: 'include' }); setOnbItens((p) => p.filter((x) => x.id !== itemId)); }
    catch (e: any) { showToast({ type: 'error', title: 'Erro ao excluir', message: e?.message }); }
  };

  const freela = func?.tipo_contratacao === 'Freela';
  const venceu = (d: string | null) => { if (!d) return false; try { return new Date(d) < new Date(); } catch { return false; } };
  const idade = func?.data_nascimento ? Math.floor((Date.now() - new Date(func.data_nascimento).getTime()) / 31557600000) : null;
  const fotoPerfil = (func as any)?.foto_ponto_url || func?.foto_url || null;
  const salHist = (((func as any)?.salario_ca_historico) || []) as any[];
  const salarioMedia = salHist.length ? salHist.reduce((a, s) => a + Number(s.valor_pago || 0), 0) / salHist.length : null;
  const salarioVal = freela ? func?.valor_diaria : (func?.salario_base ?? salarioMedia);
  const salarioCA = !freela && func?.salario_base == null && salarioMedia != null;

  return (
    <Dialog open={funcionarioId != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-[1600px] w-[97vw] h-[90vh] p-0 gap-0 overflow-hidden">
        {loading || !func ? (
          <div className="py-24 text-center w-full"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <div className="flex h-full min-h-0">
            {/* ── Perfil (sidebar) ── */}
            <aside className="w-72 shrink-0 border-r bg-gradient-to-b from-muted/50 via-background to-background flex flex-col overflow-y-auto">
              <div className="p-5 flex flex-col items-center text-center border-b">
                {fotoPerfil && !imgErro ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotoPerfil} alt={func.nome} onError={() => setImgErro(true)} className="w-28 h-28 rounded-2xl object-cover ring-2 ring-background shadow-md" />
                ) : (
                  <div className={`w-28 h-28 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-md ${corAvatar(func.nome)}`}>{iniciais(func.nome)}</div>
                )}
                <h2 className="text-lg font-bold leading-tight mt-3">{func.nome}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{[func.cargo_nome, func.area_nome].filter(Boolean).join(' · ') || 'Sem cargo/área'}</p>
                <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${func.ativo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>{func.ativo ? '● Ativo' : '○ Inativo'}</span>
                  <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${tipoTag(func.tipo_contratacao)}`}>{func.tipo_contratacao || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3">
                <Destaque icon={Clock} label="Tempo de casa" value={tempoDeCasa(func.data_admissao) || '—'} />
                <Destaque icon={CalendarDays} label="Admissão" value={fmtData(func.data_admissao) || '—'} />
                <Destaque icon={Banknote} label={freela ? 'Diária' : salarioCA ? `Salário (CA · média ${salHist.length}m)` : 'Salário'} value={fmtBRL(salarioVal ?? null) || '—'} accent="text-emerald-600 dark:text-emerald-400" />
                <Destaque icon={Cake} label="Idade" value={idade != null ? `${idade} anos` : '—'} />
              </div>

              <div className="px-4 pb-1">
                <Info icon={Fingerprint} label="CPF" value={func.cpf} />
                <Info icon={Phone} label="Telefone" value={func.telefone} />
                <Info icon={Mail} label="Email" value={func.email} />
                <Info icon={CreditCard} label="PIX" value={func.chave_pix ? `${func.chave_pix}${func.tipo_chave_pix ? ` (${func.tipo_chave_pix})` : ''}` : null} />
                <Info icon={Cake} label="Nascimento" value={fmtData(func.data_nascimento)} />
                {func.data_demissao && <Info icon={CalendarX} label="Demissão" value={fmtData(func.data_demissao)} alerta />}
              </div>

              {(func as any).salario_ca_historico?.length > 0 && (
                <div className="px-4 pb-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1"><Banknote className="w-3 h-3" />Salário pago (Conta Azul)</div>
                  <div className="space-y-0.5">
                    {(func as any).salario_ca_historico.slice(0, 4).map((s: any, i: number) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground truncate pr-2">{fmtData(s.data_pagamento)}</span>
                        <span className="font-medium tabular-nums shrink-0">{fmtBRL(Number(s.valor_pago))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alertas.length > 0 && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {alertas.map((a, i) => (
                    <span key={i} className={`text-[11px] rounded-full px-2 py-0.5 inline-flex items-center gap-1 ${a.nivel === 'alerta' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}><AlertTriangle className="w-3 h-3" />{a.label}</span>
                  ))}
                </div>
              )}
              {func.observacoes && <p className="mx-4 mb-2 text-xs text-muted-foreground bg-muted/40 rounded-md border-l-2 border-muted-foreground/30 px-3 py-2">{func.observacoes}</p>}

              <div className="mt-auto p-3 border-t flex flex-col gap-1.5">
                <Button variant="outline" size="sm" className="justify-start" onClick={() => onEditar(func)}><Pencil className="w-3.5 h-3.5 mr-2" />Editar dados</Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => { const d = new Date(); window.open(`/recibo?id=${func.id}&mes=${d.getMonth() + 1}&ano=${d.getFullYear()}`, '_blank'); }}><ScrollText className="w-3.5 h-3.5 mr-2" />Gerar recibo</Button>
                {func.ativo && (
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => setTransferenciaAberta(true)}>
                    <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Transferir de empresa
                  </Button>
                )}
                {func.ativo && (
                  <Button variant="outline" size="sm" className="justify-start text-rose-600 hover:text-rose-700" onClick={() => setDemissaoAberta(true)}>
                    <UserMinus className="w-3.5 h-3.5 mr-2" />Registrar demissão
                  </Button>
                )}
                {/* Apagar é para a linha criada por ENGANO (duplicata), não para quem saiu — quem
                    saiu usa "Registrar demissão". O servidor recusa se houver histórico e diz o
                    que impede; aqui o texto da confirmação já avisa que não tem volta. */}
                <Button variant="outline" size="sm" className="justify-start text-rose-600 hover:text-rose-700"
                  disabled={apagando}
                  onClick={async () => {
                    if (!window.confirm(`Apagar o cadastro de ${func.nome}?\n\nUse isto só para duplicata criada por engano. Se a pessoa saiu da empresa, cancele e use "Registrar demissão".\n\nEsta ação não tem volta.`)) return;
                    setApagando(true);
                    try {
                      const r = await api.delete(`/api/rh/funcionarios/${func.id}/excluir`);
                      showToast({ type: 'success', title: 'Cadastro apagado', message: `${r.nome} saiu da base.` });
                      onClose();
                    } catch (e: any) {
                      showToast({ type: 'error', title: 'Não dá pra apagar', message: e?.message });
                    } finally { setApagando(false); }
                  }}>
                  {apagando ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-2" />}
                  Apagar funcionário
                </Button>
                {(func as any).portal_token && (
                  <Button variant="outline" size="sm" className="justify-start" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/portal/${(func as any).portal_token}`); showToast({ type: 'success', title: 'Link do portal copiado', message: 'Envie pro funcionário (WhatsApp/QR).' }); }}><LinkIcon className="w-3.5 h-3.5 mr-2" />Copiar link do portal</Button>
                )}
              </div>
            </aside>

            {/* ── Conteúdo (abas) ── */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
              <Tabs defaultValue="ponto" className="flex-1 flex flex-col min-h-0">
                <TabsList className="mx-4 mt-4 mb-0 flex-nowrap justify-start shrink-0 pr-8 overflow-x-auto max-w-full">
                  <TabsTrigger value="ponto"><Clock className="w-3.5 h-3.5 mr-1" />Ponto</TabsTrigger>
                  <TabsTrigger value="onboarding">Onboarding{onbItens.length > 0 && ` (${onbItens.filter((i) => i.concluido).length}/${onbItens.length})`}</TabsTrigger>
                  <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger>
                  <TabsTrigger value="ocorr">Ocorrências ({ocorrencias.filter((o) => o.tipo !== 'observacao').length})</TabsTrigger>
                  <TabsTrigger value="obs">Registro de BOs ({ocorrencias.filter((o) => o.tipo === 'observacao').length})</TabsTrigger>
                  <TabsTrigger value="treinos">Treinamentos ({treinos.length})</TabsTrigger>
                  <TabsTrigger value="calibracao"><Target className="w-3.5 h-3.5 mr-1" />Calibração ({calibracoes.length})</TabsTrigger>
                </TabsList>
                <div className="flex-1 overflow-y-auto">

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
                {/* Números digitados (CPF/RG/CTPS) — pra quem não tem o PDF/foto do documento */}
                <div className="rounded-lg border bg-muted/20 p-3 mb-3">
                  <div className="text-xs font-semibold mb-2">Números dos documentos <span className="font-normal text-muted-foreground">(digitados — quem não tem o arquivo)</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">CPF</span><Input value={nums.cpf} onChange={(e) => setNums({ ...nums, cpf: e.target.value })} placeholder="000.000.000-00" className="h-9 text-sm" /></label>
                    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">RG</span><Input value={nums.rg} onChange={(e) => setNums({ ...nums, rg: e.target.value })} placeholder="nº do RG" className="h-9 text-sm" /></label>
                    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Carteira de Trabalho</span><Input value={nums.ctps} onChange={(e) => setNums({ ...nums, ctps: e.target.value })} placeholder="nº / série" className="h-9 text-sm" /></label>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={salvarNums} disabled={salvandoNums} className="h-8">{salvandoNums ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}Salvar números</Button>
                  </div>
                </div>
                {docs.length > 0 && (
                  <div className="flex justify-end mb-2">
                    <Button variant="outline" size="sm" className="h-8" onClick={exportarDocs} disabled={exportando}>
                      {exportando ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
                      {exportando ? 'Baixando…' : `Exportar (${docs.length})`}
                    </Button>
                  </div>
                )}
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
                  <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Arquivo</span><input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={conferirArquivo} className="text-xs file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1.5 file:text-xs h-9 leading-9" /></label>
                  <Button size="sm" onClick={enviarDoc} disabled={enviando || avisoArq?.erro} className="h-9">{enviando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}{enviando ? 'Enviando…' : 'Anexar'}</Button>
                  <p className={cn('w-full text-[10px]', avisoArq?.erro ? 'text-red-500' : avisoArq ? 'text-amber-600' : 'text-muted-foreground')}>
                    {avisoArq?.texto || `PDF (inclusive de várias páginas) ou foto — até ${formataMb(MAX_DOC_BYTES)}.`}
                  </p>
                </div>
              </TabsContent>

              {/* Ocorrências */}
              <TabsContent value="ocorr" className="px-6 py-4">
                {ocorrencias.filter((o) => o.tipo !== 'observacao').length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {ocorrencias.filter((o) => o.tipo !== 'observacao').map((o) => (
                      <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {o.tipo === 'advertencia' && <CartaoIcon cor={o.cartao === 'vermelho' ? 'vermelho' : 'amarelo'} />}
                            <span className={`text-[10px] rounded px-1.5 py-0.5 ${corOcorr(o.tipo)}`}>
                              {TIPO_OCORR[o.tipo] || o.tipo}{o.tipo === 'advertencia' ? ` · cartão ${o.cartao === 'vermelho' ? 'vermelho' : 'amarelo'}` : ''}
                            </span>
                            <span className="text-xs text-muted-foreground">{fmtData(o.data_inicio)}{o.data_fim ? ` → ${fmtData(o.data_fim)}` : ''}{o.aplicado_por ? ` · por ${o.aplicado_por}` : ''}</span>
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
                    <select value={novoOc.tipo} onChange={(e) => setNovoOc({ ...novoOc, tipo: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">{Object.entries(TIPO_OCORR).filter(([k]) => k !== 'observacao').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                  {novoOc.tipo === 'advertencia' && (
                    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Cartão</span>
                      <select value={novoOc.cartao} onChange={(e) => setNovoOc({ ...novoOc, cartao: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                        <option value="amarelo">🟨 Amarelo (aviso)</option>
                        <option value="vermelho">🟥 Vermelho (grave)</option>
                      </select>
                    </label>
                  )}
                  {novoOc.tipo === 'advertencia' && (
                    <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Líder que aplicou</span>
                      <Input value={novoOc.aplicado_por} onChange={(e) => setNovoOc({ ...novoOc, aplicado_por: e.target.value })} placeholder="ex.: Renato" className="h-9 text-sm w-[140px]" />
                    </label>
                  )}
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</span><Input type="date" value={novoOc.data_inicio} onChange={(e) => setNovoOc({ ...novoOc, data_inicio: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Até (opcional)</span><Input type="date" value={novoOc.data_fim} onChange={(e) => setNovoOc({ ...novoOc, data_fim: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <label className="flex flex-col gap-1 flex-1 min-w-[160px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Descrição</span><Input value={novoOc.descricao} onChange={(e) => setNovoOc({ ...novoOc, descricao: e.target.value })} placeholder="ex: atraso recorrente" className="h-9 text-sm" /></label>
                  <Button size="sm" onClick={addOcorrencia} disabled={salvandoOc} className="h-9">{salvandoOc ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Adicionar</Button>
                </div>
              </TabsContent>

              {/* REGISTRO DE BOs — log de anotações datadas, separado das advertências.
                  Renomeado de "Observações" a pedido do Gonza (20/08/2026): é como o time chama.
                  O tipo gravado continua 'observacao' — mudar o valor no banco renomearia o
                  histórico já registrado e quebraria quem lê por esse tipo. Rótulo é tela. */}
              <TabsContent value="obs" className="px-6 py-4">
                {ocorrencias.filter((o) => o.tipo === 'observacao').length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {ocorrencias.filter((o) => o.tipo === 'observacao').map((o) => (
                      <div key={o.id} className="flex items-start justify-between gap-2 rounded-lg border bg-background px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{fmtData(o.data_inicio)}</div>
                          {o.descricao && <div className="text-sm mt-0.5 whitespace-pre-wrap">{o.descricao}</div>}
                        </div>
                        <button onClick={() => excluirOcorrencia(o.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500 shrink-0" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-muted-foreground text-center py-6 mb-3 border border-dashed rounded-lg">Nenhum BO registrado.</div>}
                <div className="flex items-end gap-2 flex-wrap rounded-lg border bg-muted/20 p-3">
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</span><Input type="date" value={novaObs.data_inicio} onChange={(e) => setNovaObs({ ...novaObs, data_inicio: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <label className="flex flex-col gap-1 flex-1 min-w-[200px]"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">BO</span><Input value={novaObs.descricao} onChange={(e) => setNovaObs({ ...novaObs, descricao: e.target.value })} placeholder="ex: saiu no meio do turno; quebrou taça; pediu troca de dia…" className="h-9 text-sm" /></label>
                  <Button size="sm" onClick={addObservacao} disabled={salvandoObs} className="h-9">{salvandoObs ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Adicionar</Button>
                </div>
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
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Instituição</span><Input value={novoTreino.instituicao} onChange={(e) => setNovoTreino({ ...novoTreino, instituicao: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Conclusão</span><Input type="date" value={novoTreino.data_conclusao} onChange={(e) => setNovoTreino({ ...novoTreino, data_conclusao: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <label className="flex flex-col gap-1"><span className="text-[10px] uppercase tracking-wide text-muted-foreground">Validade</span><Input type="date" value={novoTreino.validade} onChange={(e) => setNovoTreino({ ...novoTreino, validade: e.target.value })} className="h-9 text-sm w-[160px]" /></label>
                  <Button size="sm" onClick={salvarTreino} disabled={salvandoTreino} className="h-9">{salvandoTreino ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}Adicionar</Button>
                </div>
              </TabsContent>

              {/* Calibração — Comportamento × Performance por trimestre */}
              <TabsContent value="calibracao" className="px-6 py-4">
                {/* O card real tem oito blocos (docs/avaliação.jpg) — vive em componente próprio */}
                <CalibracaoTab
                  funcionarioId={func.id}
                  cargoNome={func.cargo_nome || null}
                  cartoes={{
                    amarelo: ocorrencias.filter((o) => o.cartao === 'amarelo').length,
                    vermelho: ocorrencias.filter((o) => o.cartao === 'vermelho').length,
                  }}
                />
              </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
      {func && (
        <DemissaoDialog
          funcionarioId={func.id}
          nome={func.nome}
          docs={docs}
          aberto={demissaoAberta}
          onFechar={() => setDemissaoAberta(false)}
          onPronto={() => carregar()}
        />
      )}
      {/* Único caminho para mudar alguém de empresa. O "mover para o organograma
          administrativo" que existia dentro da cadeira movia gente sem registrar nada. */}
      <TransferenciaDialog
        funcionario={func ? { id: func.id, nome: func.nome, bar_id: (func as any).bar_id } : null}
        open={transferenciaAberta}
        onClose={() => setTransferenciaAberta(false)}
        onTransferido={() => onClose()}
      />
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
