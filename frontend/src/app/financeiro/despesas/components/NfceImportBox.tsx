'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { api } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import { FileUp, Loader2, CheckCircle2, AlertTriangle, Trash2, Beer, X } from 'lucide-react';
import { parseNfceXml, agregarNotas, type ParsedNfce, type NfceAgregado } from '@/lib/financeiro/nfce-xml';

const fmtBRL = (v: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
const fmtCnpj = (c: string) => { const d = String(c || '').replace(/\D/g, '').padStart(14, '0'); return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12,14)}`; };

type Importado = {
  importado: boolean;
  import?: { arquivo_nome: string | null; qtd_notas: number; qtd_canceladas: number; qtd_sem_cnpj: number; valor_total: number; valor_monofasico: number; created_at: string; criado_por: string | null };
  por_cnpj?: any[];
  por_ncm?: any[];
};

/** Bloco de importação do XML das NFC-e do mês → separa faturamento e bebida fria (monofásico) por CNPJ. */
export function NfceImportBox({ barId, ano, mes, onImported }: { barId: number; ano: number; mes: number; onImported?: () => void }) {
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number } | null>(null);
  const [preview, setPreview] = useState<NfceAgregado | null>(null);
  const [arquivoNome, setArquivoNome] = useState<string>('');
  const [enviando, setEnviando] = useState(false);
  const [jaImportado, setJaImportado] = useState<Importado | null>(null);
  const [drag, setDrag] = useState(false);

  const carregarImportado = useCallback(async () => {
    if (!barId || !ano || !mes) return;
    try {
      const r = await api.get(`/api/financeiro/impostos/nfce-import?bar_id=${barId}&ano=${ano}&mes=${mes}`);
      setJaImportado(r?.success ? r : { importado: false });
    } catch { setJaImportado({ importado: false }); }
  }, [barId, ano, mes]);
  useEffect(() => { setPreview(null); carregarImportado(); }, [carregarImportado]);

  // extrai todas as XML de uma lista de arquivos (aceita .xml soltos e .zip)
  const extrairXmls = async (files: File[]): Promise<string[]> => {
    const out: string[] = [];
    for (const f of files) {
      const nome = f.name.toLowerCase();
      if (nome.endsWith('.zip')) {
        const buf = new Uint8Array(await f.arrayBuffer());
        const entries = unzipSync(buf, { filter: (fi) => fi.name.toLowerCase().endsWith('.xml') });
        for (const k of Object.keys(entries)) out.push(strFromU8(entries[k]));
      } else if (nome.endsWith('.xml')) {
        out.push(await f.text());
      }
    }
    return out;
  };

  const processar = async (files: File[]) => {
    if (!files.length) return;
    setLendo(true); setPreview(null);
    setArquivoNome(files.length === 1 ? files[0].name : `${files.length} arquivos`);
    try {
      const xmls = await extrairXmls(files);
      if (!xmls.length) { showToast({ type: 'error', title: 'Nenhum XML encontrado', message: 'Selecione os .xml das NFC-e ou um .zip com eles.' }); return; }
      const parsed: ParsedNfce[] = [];
      setProgresso({ feitas: 0, total: xmls.length });
      for (let i = 0; i < xmls.length; i++) {
        parsed.push(parseNfceXml(xmls[i]));
        if (i % 300 === 0) { setProgresso({ feitas: i, total: xmls.length }); await new Promise((r) => setTimeout(r, 0)); } // cede a UI
      }
      setProgresso(null);
      const ag = agregarNotas(parsed);
      if (ag.qtd_notas === 0) { showToast({ type: 'error', title: 'Nenhuma nota válida', message: 'Os XML não parecem NFC-e autorizadas.' }); return; }
      setPreview(ag);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao ler os XML', message: e?.message || 'Falha' });
    } finally { setLendo(false); setProgresso(null); }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const fs = Array.from(e.target.files || []); processar(fs); e.target.value = ''; };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDrag(false); processar(Array.from(e.dataTransfer.files || [])); };

  // alerta se o lote misturar meses ou não for o mês selecionado
  const mesSel = `${ano}-${String(mes).padStart(2, '0')}`;
  const mistura = preview && preview.meses_encontrados.length > 1;
  const mesDivergente = preview && preview.ano && (preview.ano !== ano || preview.mes !== mes);

  const confirmar = async () => {
    if (!preview) return;
    setEnviando(true);
    try {
      const r = await api.post('/api/financeiro/impostos/nfce-import', { bar_id: barId, ano, mes, arquivo_nome: arquivoNome, agregado: preview });
      if (!r?.success) throw new Error(r?.error || 'Falha');
      const naoResolv = r.cnpjs_nao_resolvidos || [];
      showToast({
        type: naoResolv.length ? 'warning' : 'success',
        title: 'XML importado',
        message: naoResolv.length ? `${naoResolv.length} CNPJ não mapeado (cadastre em nf_cnpj_labels): ${naoResolv.map(fmtCnpj).join(', ')}` : 'Faturamento e bebida fria separados por CNPJ.',
      });
      setPreview(null); await carregarImportado(); onImported?.();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao importar', message: e?.message || 'Falha' });
    } finally { setEnviando(false); }
  };

  const remover = async () => {
    if (!window.confirm('Remover a importação de XML deste mês? A simulação volta a somar os CNPJs.')) return;
    try {
      const r = await api.delete(`/api/financeiro/impostos/nfce-import?bar_id=${barId}&ano=${ano}&mes=${mes}`);
      if (!r?.success) throw new Error(r?.error);
      showToast({ type: 'success', title: 'Importação removida' });
      await carregarImportado(); onImported?.();
    } catch (e: any) { showToast({ type: 'error', title: 'Erro ao remover', message: e?.message }); }
  };

  const ncmBebida = useMemo(() => (preview?.por_ncm || []).filter((n) => n.monofasico).slice(0, 12), [preview]);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-amber-500/10 p-2"><Beer className="h-4 w-4 text-amber-600" /></div>
        <div className="flex-1">
          <div className="text-sm font-semibold">XML das NFC-e do mês</div>
          <div className="text-xs text-muted-foreground">Sobe o XML (o mesmo que vai pra contabilidade) → separa faturamento e <b>bebida fria (monofásico, CST 04/05/06)</b> por CNPJ.</div>
        </div>
      </div>

      {/* Já importado */}
      {jaImportado?.importado && !preview && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> XML importado neste mês</div>
            <button onClick={remover} className="text-xs inline-flex items-center gap-1 text-red-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> remover</button>
          </div>
          <div className="text-xs text-muted-foreground">
            {jaImportado.import?.qtd_notas} notas · {jaImportado.import?.qtd_canceladas || 0} canceladas · total {fmtBRL(jaImportado.import?.valor_total)} · bebida fria {fmtBRL(jaImportado.import?.valor_monofasico)}
            {!!jaImportado.import?.qtd_sem_cnpj && <span className="text-amber-600"> · {jaImportado.import?.qtd_sem_cnpj} sem CNPJ mapeado</span>}
          </div>
          <div className="grid gap-1.5">
            {(jaImportado.por_cnpj || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between text-xs rounded border bg-background px-2 py-1.5">
                <span className="font-medium truncate">{c.cnpj_label || fmtCnpj(c.cnpj)}</span>
                <span className="tabular-nums text-muted-foreground">fat {fmtBRL(c.faturamento)} · <b className="text-amber-600">bebida fria {fmtBRL(c.valor_monofasico)}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dropzone */}
      {!preview && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => !lendo && inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-5 text-center transition-colors ${drag ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
        >
          <input ref={inputRef} type="file" accept=".xml,.zip" multiple className="hidden" onChange={onPick} />
          {lendo ? (
            <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {progresso ? `Lendo ${progresso.feitas}/${progresso.total} notas…` : 'Abrindo arquivos…'}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm font-medium">{jaImportado?.importado ? 'Reimportar' : 'Arraste os XML ou um .zip aqui'}</div>
              <div className="text-xs text-muted-foreground">ou clique pra escolher · aceita vários .xml ou um .zip · competência {mesSel}</div>
            </div>
          )}
        </div>
      )}

      {/* Preview antes de confirmar */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Confira antes de importar</div>
            <button onClick={() => setPreview(null)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="h-3.5 w-3.5" /> descartar</button>
          </div>

          {(mistura || mesDivergente) && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {mistura ? `O lote tem notas de ${preview.meses_encontrados.join(', ')}. ` : ''}
                {mesDivergente ? `As notas são de ${preview.ano}-${String(preview.mes).padStart(2,'0')}, mas a competência selecionada é ${mesSel}. ` : ''}
                Vai gravar tudo em <b>{mesSel}</b> — confira o mês selecionado.
              </span>
            </div>
          )}

          <div className="text-xs text-muted-foreground">{preview.qtd_notas} notas · {preview.qtd_canceladas} canceladas · total {fmtBRL(preview.valor_total)} · bebida fria {fmtBRL(preview.valor_monofasico)}</div>

          {/* por CNPJ */}
          <div className="grid gap-1.5">
            {preview.por_cnpj.map((c) => (
              <div key={c.cnpj} className="flex items-center justify-between text-sm rounded-lg border bg-background px-3 py-2">
                <span className="font-medium">{fmtCnpj(c.cnpj)}</span>
                <span className="tabular-nums text-muted-foreground">{c.qtd_notas} notas · fat {fmtBRL(c.faturamento)} · <b className="text-amber-600">bebida fria {fmtBRL(c.valor_monofasico)}</b></span>
              </div>
            ))}
          </div>

          {/* NCM classificados como bebida fria (auditoria) */}
          {ncmBebida.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">NCM classificados como bebida fria ({ncmBebida.length})</summary>
              <div className="mt-1.5 grid gap-1">
                {ncmBebida.map((n, i) => (
                  <div key={i} className="flex items-center justify-between rounded border px-2 py-1 bg-background">
                    <span className="font-mono">{n.ncm} <span className="text-muted-foreground">CST {n.cst_cofins}</span></span>
                    <span className="tabular-nums">{fmtBRL(n.valor)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setPreview(null)} disabled={enviando} className="rounded-md border px-3 h-9 text-sm hover:bg-muted/60">Cancelar</button>
            <button onClick={confirmar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 h-9 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Importar {mesSel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
