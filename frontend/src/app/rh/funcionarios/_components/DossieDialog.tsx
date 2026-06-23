'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Pencil, Upload, FileText, Trash2, ExternalLink } from 'lucide-react';
import type { Funcionario } from '../page';

const TIPO_DOC: Record<string, string> = {
  carteira_trabalho: 'Carteira de Trabalho', exame_admissional: 'Exame Admissional',
  contrato: 'Contrato', rg_cpf: 'RG / CPF', outro: 'Outro',
};
const fmtBRL = (v: number | null) => v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtData = (d: string | null) => { if (!d) return '—'; try { const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; } catch { return d; } };
const tempoDeCasa = (a: string | null) => {
  if (!a) return '—'; const d = new Date(a); const now = new Date();
  let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) m--; if (m < 0) return '—';
  const anos = Math.floor(m / 12); const meses = m % 12;
  return anos > 0 ? `${anos} ano(s) ${meses} mês(es)` : `${meses} mês(es)`;
};

type Doc = { id: string; tipo: string; descricao: string | null; nome_arquivo: string | null; validade: string | null; criado_em: string; url: string | null };

export function DossieDialog({ funcionarioId, onClose, onEditar }: {
  funcionarioId: number | null; onClose: () => void; onEditar: (f: Funcionario) => void;
}) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [func, setFunc] = useState<Funcionario | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tipoUp, setTipoUp] = useState('carteira_trabalho');
  const [validadeUp, setValidadeUp] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (!funcionarioId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/rh/funcionarios/${funcionarioId}`);
      setFunc(res.funcionario); setDocs(res.documentos || []);
      // assina as URLs dos documentos
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

  return (
    <Dialog open={funcionarioId != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        {loading || !func ? (
          <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-2 pr-6">
                <span>{func.nome}{!func.ativo && <span className="text-xs text-muted-foreground ml-2">(inativo)</span>}</span>
                <Button variant="outline" size="sm" onClick={() => onEditar(func)}><Pencil className="w-3.5 h-3.5 mr-1.5" />Editar</Button>
              </DialogTitle>
            </DialogHeader>

            {/* Dados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <Campo l="Cargo" v={func.cargo_nome} /><Campo l="Área" v={func.area_nome} />
              <Campo l="Tipo" v={func.tipo_contratacao} />
              <Campo l="Tempo de casa" v={tempoDeCasa(func.data_admissao)} />
              <Campo l="Admissão" v={fmtData(func.data_admissao)} />
              {func.data_demissao && <Campo l="Demissão" v={fmtData(func.data_demissao)} />}
              <Campo l={func.tipo_contratacao === 'Freela' ? 'Diária' : 'Salário'} v={fmtBRL(func.tipo_contratacao === 'Freela' ? func.valor_diaria : func.salario_base)} />
              <Campo l="Nascimento" v={fmtData(func.data_nascimento)} />
              <Campo l="CPF" v={func.cpf} /><Campo l="Telefone" v={func.telefone} />
              <Campo l="Email" v={func.email} />
              <Campo l="PIX" v={func.chave_pix ? `${func.chave_pix}${func.tipo_chave_pix ? ` (${func.tipo_chave_pix})` : ''}` : null} />
            </div>
            {func.observacoes && <p className="text-xs text-muted-foreground mt-2 border-l-2 pl-2">{func.observacoes}</p>}

            {/* Documentos */}
            <div className="mt-4 border-t pt-3">
              <div className="text-sm font-medium mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" />Documentos ({docs.length})</div>
              {docs.length > 0 && (
                <div className="space-y-1 mb-3">
                  {docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 text-xs rounded border px-2 py-1.5">
                      <div className="min-w-0">
                        <span className="font-medium">{TIPO_DOC[d.tipo] || d.tipo}</span>
                        <span className="text-muted-foreground truncate"> · {d.nome_arquivo}</span>
                        {d.validade && <span className="text-amber-600 ml-1">· vence {fmtData(d.validade)}</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center"><ExternalLink className="w-3.5 h-3.5" /></a>}
                        <button onClick={() => excluirDoc(d.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2 flex-wrap bg-muted/30 rounded p-2">
                <div>
                  <Label className="text-[10px] mb-1 block">Tipo</Label>
                  <select value={tipoUp} onChange={(e) => setTipoUp(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    {Object.entries(TIPO_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] mb-1 block">Validade (opcional)</Label>
                  <Input type="date" value={validadeUp} onChange={(e) => setValidadeUp(e.target.value)} className="h-8 text-xs w-[140px]" />
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="text-xs max-w-[160px]" />
                <Button size="sm" onClick={enviarDoc} disabled={enviando}>
                  {enviando ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}Anexar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Campo({ l, v }: { l: string; v: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase">{l}</div>
      <div className="truncate">{v || '—'}</div>
    </div>
  );
}
