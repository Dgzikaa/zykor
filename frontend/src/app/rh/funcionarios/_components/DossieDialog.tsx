'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import {
  Loader2, Pencil, Upload, FileText, Trash2, ExternalLink, X,
  Briefcase, Building2, CalendarDays, Cake, Phone, Mail, CreditCard,
  Banknote, Clock, Fingerprint, CalendarX, AlertTriangle, Plus, ScrollText, Smile, ClipboardCheck,
} from 'lucide-react';
import type { Funcionario } from '../page';

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

  const carregar = useCallback(async () => {
    if (!funcionarioId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rh/funcionarios/${funcionarioId}`);
      setFunc(res.funcionario); setOcorrencias(res.ocorrencias || []); setAlertas(res.alertas || []); setFelicidade(res.felicidade || null);
      const dres = await api.get(`/api/rh/funcionarios/${funcionarioId}/documentos`);
      setDocs(dres.documentos || []);
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
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => onEditar(func)}><Pencil className="w-3.5 h-3.5 mr-1.5" />Editar</Button>
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
                <TabsTrigger value="docs">Documentos ({docs.length})</TabsTrigger>
                <TabsTrigger value="ocorr">Ocorrências ({ocorrencias.length})</TabsTrigger>
                <TabsTrigger value="avaliacoes">Avaliações</TabsTrigger>
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

              {/* Avaliações (pré-construído) */}
              <TabsContent value="avaliacoes" className="px-6 py-8">
                <div className="text-center text-muted-foreground">
                  <ClipboardCheck className="w-9 h-9 mx-auto mb-2 opacity-40" />
                  <div className="text-sm font-medium">Avaliações de desempenho</div>
                  <div className="text-xs mt-1">Auto-avaliação, avaliação do líder e calibração aparecem aqui<br />quando o módulo de Avaliação for ativado.</div>
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
