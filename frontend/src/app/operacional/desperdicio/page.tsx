'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PageShell } from '@/components/layout/PageShell';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api-client';
import { Trash2, Plus, ChevronLeft, ChevronRight, Loader2, Upload, X, Camera, Pencil, ImageIcon, Check, Search } from 'lucide-react';

type Area = 'CozinhaFin' | 'CozinhaProd' | 'BarFin' | 'BarProd' | 'Salao';
const AREAS: { v: Area; l: string; hint: string }[] = [
  { v: 'CozinhaFin', l: 'Cozinha · Finalização', hint: 'Prato pronto que caiu/perdeu na cozinha' },
  { v: 'CozinhaProd', l: 'Cozinha · Produção', hint: 'Errou receita/desperdiçou no preparo (recheio, molho…)' },
  { v: 'BarFin', l: 'Bar · Finalização', hint: 'Drink pronto que caiu/perdeu' },
  { v: 'BarProd', l: 'Bar · Produção', hint: 'Errou drink/perdeu insumo no preparo do bar' },
  { v: 'Salao', l: 'Salão', hint: 'Perda no salão (garrafa quebrada, taça, etc.)' },
];
const areaLabel = (a: Area | null | undefined) => AREAS.find((x) => x.v === a)?.l ?? '—';
const areaBadgeCor = (a: Area | null | undefined): string => {
  switch (a) {
    case 'CozinhaFin': return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    case 'CozinhaProd': return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
    case 'BarFin': return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
    case 'BarProd': return 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300';
    case 'Salao': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    default: return 'bg-gray-500/15 text-gray-600 dark:text-gray-400';
  }
};

type Insumo = { codigo: string; nome: string; categoria: string | null; unidade_medida: string | null };
type Foto = { storage_path: string; url: string; size_bytes?: number; mime?: string };
type Item = {
  insumo_codigo: string; insumo_nome?: string; unidade?: string;
  qtd: number; motivo?: string; observacao?: string;
  area?: Area | null;
  preco?: number | null; valor_rs?: number | null;
};
type Registro = {
  id: number; bar_id: number; data: string; observacao: string | null;
  criado_por: string | null; criado_em: string; atualizado_em: string;
  itens: Item[]; fotos: Foto[];
};

const fmtBRL = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const fmtDateFull = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
function mondayOf(d: Date) { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }
const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const parseQtd = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };

// Compressão simples (canvas → jpeg 0.85). Reduz payload em ~10x pra fotos de câmera.
async function comprimirImagem(file: File, maxW = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(b => res(b), 'image/jpeg', quality));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export default function DesperdicioPage() {
  const { selectedBar } = useBar();
  const barId = selectedBar?.id;
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  const { soLeitura, podeInserir } = useModuloPermissao('/operacional/desperdicio');
  useEffect(() => { setPageTitle('🗑️ Desperdício'); return () => setPageTitle(''); }, [setPageTitle]);

  // Semana seg→dom padrão. Navega em passos de 7 dias.
  const [monISO, setMonISO] = useState(() => toISO(mondayOf(new Date())));
  const semana = useMemo(() => {
    const mon = parseISO(monISO); const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { ini: monISO, fim: toISO(sun) };
  }, [monISO]);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogAberto, setDialogAberto] = useState<false | { modo: 'novo' | 'editar'; registro?: Registro }>(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const [reg, ins] = await Promise.all([
        api.get(`/api/operacional/desperdicio?ini=${semana.ini}&fim=${semana.fim}`),
        api.get(`/api/operacional/insumos?bar_id=${barId}`),
      ]);
      if (reg.success) setRegistros(reg.registros || []);
      if (ins.success) setInsumos(ins.insumos || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }, [barId, semana.ini, semana.fim, toast]);
  useEffect(() => { carregar(); }, [carregar]);

  const navSemana = (d: number) => { const x = parseISO(monISO); x.setDate(x.getDate() + d * 7); setMonISO(toISO(x)); };

  const excluir = async (r: Registro) => {
    if (!window.confirm(`Apagar o registro de ${fmtDateFull(r.data)} (${r.itens.length} item(ns), ${r.fotos.length} foto(s))? A soma na coluna Desperdício em /desvios é atualizada.`)) return;
    try {
      await api.delete(`/api/operacional/desperdicio?id=${r.id}`);
      toast({ title: 'Registro apagado' });
      await carregar();
    } catch (e: any) {
      toast({ title: 'Erro ao apagar', description: e?.message, variant: 'destructive' });
    }
  };

  const totalRegistros = registros.length;
  const totalItens = registros.reduce((s, r) => s + r.itens.length, 0);
  const totalFotos = registros.reduce((s, r) => s + r.fotos.length, 0);
  // Total em R$ da semana (soma valor_rs de todos os itens; item sem preço = null → não soma).
  const totalRs = registros.reduce(
    (s, r) => s + r.itens.reduce((si, it) => si + (Number(it.valor_rs) || 0), 0),
    0,
  );
  // Rollup por dia × área — pra tabela resumo (o que o Diogo pediu: "valor por dia lançado").
  const rollupPorDia = useMemo(() => {
    const map = new Map<string, { data: string; total: number; porArea: Record<string, number> }>();
    for (const r of registros) {
      const dia = r.data;
      let row = map.get(dia);
      if (!row) { row = { data: dia, total: 0, porArea: {} }; map.set(dia, row); }
      for (const it of r.itens) {
        const v = Number(it.valor_rs) || 0;
        row.total += v;
        const k = it.area || 'SemArea';
        row.porArea[k] = (row.porArea[k] || 0) + v;
      }
    }
    return Array.from(map.values()).sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [registros]);
  // Rollup só por área (total da semana).
  const rollupPorArea = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const r of registros) for (const it of r.itens) {
      const k = it.area || 'SemArea';
      acc[k] = (acc[k] || 0) + (Number(it.valor_rs) || 0);
    }
    return acc;
  }, [registros]);

  return (
    <PageShell width="wide">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-red-100 dark:bg-red-900/30 rounded-xl"><Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" /></div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            Desperdício
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40">Beta</span>
            {soLeitura && <BadgeSomenteLeitura />}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registro visual do que foi jogado fora. Alimenta a coluna Desperdício em /operacional/desvios. · {selectedBar?.nome || `Bar ${barId ?? ''}`}</p>
        </div>
        {podeInserir && (
          <Button onClick={() => setDialogAberto({ modo: 'novo' })}>
            <Plus className="w-4 h-4 mr-1.5" />Novo registro
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <div className="text-sm px-1">
          <span className="font-medium">Semana {fmtDate(semana.ini)} a {fmtDate(semana.fim)}</span>
          {!loading && registros.length > 0 && <span className="text-muted-foreground"> · {totalRegistros} registro(s) · {totalItens} item(ns) · {totalFotos} foto(s)</span>}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(1)}><ChevronRight className="w-4 h-4" /></Button>
        {!loading && registros.length > 0 && (
          <span className="ml-auto text-sm font-semibold text-red-700 dark:text-red-400">
            Total da semana: {fmtBRL(totalRs)}
          </span>
        )}
      </div>

      {/* Resumo dia × área — o que Diogo pediu: valor por dia lançado + separação por área. */}
      {!loading && registros.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Desperdício por dia e por área</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-1.5 pr-3 font-normal">Dia</th>
                    {AREAS.map((a) => (
                      <th key={a.v} className="text-right py-1.5 px-2 font-normal whitespace-nowrap" title={a.hint}>{a.l}</th>
                    ))}
                    <th className="text-right py-1.5 pl-3 font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rollupPorDia.map((row) => (
                    <tr key={row.data}>
                      <td className="py-1.5 pr-3 font-medium tabular-nums">{fmtDateFull(row.data)}</td>
                      {AREAS.map((a) => {
                        const v = row.porArea[a.v] || 0;
                        return (
                          <td key={a.v} className={`py-1.5 px-2 text-right tabular-nums ${v > 0 ? '' : 'text-gray-300'}`}>
                            {v > 0 ? fmtBRL(v) : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-3 text-right tabular-nums font-semibold">{fmtBRL(row.total)}</td>
                    </tr>
                  ))}
                  {(rollupPorArea['SemArea'] || 0) > 0 && (
                    <tr>
                      <td colSpan={AREAS.length + 2} className="pt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        + {fmtBRL(rollupPorArea['SemArea'] || 0)} sem área definida — abra o registro e classifique.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="border-t">
                  <tr>
                    <td className="pt-1.5 pr-3 text-xs text-muted-foreground">Total semana</td>
                    {AREAS.map((a) => (
                      <td key={a.v} className={`pt-1.5 px-2 text-right tabular-nums text-xs font-medium ${(rollupPorArea[a.v] || 0) > 0 ? '' : 'text-gray-300'}`}>
                        {(rollupPorArea[a.v] || 0) > 0 ? fmtBRL(rollupPorArea[a.v]) : '—'}
                      </td>
                    ))}
                    <td className="pt-1.5 pl-3 text-right tabular-nums text-xs font-bold">{fmtBRL(totalRs)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : registros.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground text-sm">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          Nenhum registro na semana.{podeInserir && <> Clique em <b>Novo registro</b> pra lançar o desperdício da caixa.</>}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {registros.map(r => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="py-3 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium">{fmtDateFull(r.data)} · <span className="text-muted-foreground">{r.itens.length} item(ns)</span></div>
                    {r.criado_por && <div className="text-xs text-muted-foreground">Por {r.criado_por} · {new Date(r.criado_em).toLocaleString('pt-BR')}</div>}
                  </div>
                  {podeInserir && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDialogAberto({ modo: 'editar', registro: r })}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(r)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>

                {r.fotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.fotos.map(f => (
                      <a key={f.storage_path} href={f.url} target="_blank" rel="noreferrer" className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.url} alt="foto desperdício" className="h-24 w-24 rounded object-cover border" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="grid gap-1.5">
                  {r.itens.map(it => (
                    <div key={it.insumo_codigo + '-' + it.qtd + '-' + (it.motivo || '')} className="text-sm border rounded-md px-2.5 py-1.5 flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{it.insumo_nome || it.insumo_codigo}</span>
                      <span className="text-muted-foreground text-xs">{it.insumo_codigo}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${areaBadgeCor(it.area)}`}>{areaLabel(it.area)}</span>
                      <span className="ml-auto tabular-nums">{it.qtd} {it.unidade || ''}</span>
                      <span className="tabular-nums font-semibold text-red-700 dark:text-red-400 min-w-[80px] text-right">{fmtBRL(it.valor_rs)}</span>
                      {it.motivo && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 basis-full">{it.motivo}</span>}
                    </div>
                  ))}
                </div>

                {r.observacao && (
                  <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2">{r.observacao}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialogAberto && (
        <RegistroDialog
          modo={dialogAberto.modo}
          registroExistente={dialogAberto.registro}
          insumos={insumos}
          semana={semana}
          onFechar={() => setDialogAberto(false)}
          onSalvo={async () => { setDialogAberto(false); await carregar(); }}
        />
      )}
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de criação/edição — foto + itens dinâmicos + observação
// ─────────────────────────────────────────────────────────────────────────────

function RegistroDialog({
  modo, registroExistente, insumos, semana, onFechar, onSalvo,
}: {
  modo: 'novo' | 'editar';
  registroExistente?: Registro;
  insumos: Insumo[];
  semana: { ini: string; fim: string };
  onFechar: () => void;
  onSalvo: () => Promise<void>;
}) {
  const { toast } = useToast();
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const hoje = toISO(new Date());
  const dataPadrao = hoje >= semana.ini && hoje <= semana.fim ? hoje : semana.ini;

  const [data, setData] = useState(registroExistente?.data || dataPadrao);
  const [observacao, setObservacao] = useState(registroExistente?.observacao || '');
  const [fotos, setFotos] = useState<Foto[]>(registroExistente?.fotos || []);
  const [itens, setItens] = useState<Item[]>(
    registroExistente?.itens.length
      ? registroExistente.itens.map(i => ({ ...i }))
      : [{ insumo_codigo: '', qtd: 0, motivo: '', observacao: '' }],
  );
  const [subindoFoto, setSubindoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const onEscolherFotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubindoFoto(true);
    try {
      for (const f of Array.from(files)) {
        const comprimida = await comprimirImagem(f);
        const fd = new FormData(); fd.append('file', comprimida);
        const r = await fetch('/api/operacional/desperdicio/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (!j.success) { toast({ title: 'Falha no upload', description: j.error, variant: 'destructive' }); continue; }
        setFotos(prev => [...prev, { url: j.url, storage_path: j.storage_path, size_bytes: j.size_bytes, mime: j.mime }]);
      }
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e?.message, variant: 'destructive' });
    } finally {
      setSubindoFoto(false);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const removerFoto = async (path: string) => {
    setFotos(prev => prev.filter(f => f.storage_path !== path));
    try { await fetch(`/api/operacional/desperdicio/upload?storage_path=${encodeURIComponent(path)}`, { method: 'DELETE' }); }
    catch { /* Se falhar, fica arquivo órfão no bucket — melhor que não permitir remover. */ }
  };

  const addItem = () => setItens(prev => [...prev, { insumo_codigo: '', qtd: 0, motivo: '', observacao: '' }]);
  const removerItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));
  const setItem = (idx: number, patch: Partial<Item>) => setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const podeSalvar = fotos.length > 0
    && itens.length > 0
    && itens.every(it => it.insumo_codigo && it.qtd > 0 && !!it.area);

  const salvar = async () => {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const payload = {
        data,
        observacao: observacao.trim() || undefined,
        itens: itens.map(it => ({ insumo_codigo: it.insumo_codigo, qtd: it.qtd, motivo: it.motivo || undefined, observacao: it.observacao || undefined, area: it.area || undefined })),
        fotos,
      };
      if (modo === 'editar' && registroExistente) {
        await api.put('/api/operacional/desperdicio', { id: registroExistente.id, ...payload });
        toast({ title: 'Registro atualizado' });
      } else {
        await api.post('/api/operacional/desperdicio', payload);
        toast({ title: 'Registro salvo', description: `${itens.length} item(ns) · ${fotos.length} foto(s)` });
      }
      await onSalvo();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !salvando) onFechar(); }}>
      <DialogContent className="max-w-2xl max-h-[92vh]">
        <DialogHeader className="pb-3 border-b">
          <DialogTitle>{modo === 'editar' ? 'Editar registro' : 'Novo registro de desperdício'}</DialogTitle>
          <DialogDescription>Anexe pelo menos 1 foto e adicione os itens da caixa. A soma alimenta o /operacional/desvios.</DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          {/* Data */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Data:</span>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} className="h-8 w-40" />
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Camera className="w-4 h-4" />Fotos {fotos.length > 0 && <span className="text-muted-foreground">({fotos.length})</span>}
                <span className="text-red-500">*</span>
              </div>
              <input ref={fotoInputRef} type="file" accept="image/*" multiple capture="environment"
                className="hidden" onChange={e => onEscolherFotos(e.target.files)} />
              <Button size="sm" variant="outline" onClick={() => fotoInputRef.current?.click()} disabled={subindoFoto}>
                {subindoFoto ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Subindo...</> : <><Upload className="w-4 h-4 mr-1.5" />Adicionar fotos</>}
              </Button>
            </div>
            {fotos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {fotos.map(f => (
                  <div key={f.storage_path} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded border" />
                    <button onClick={() => removerFoto(f.storage_path)} className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-md py-6 text-center text-sm text-muted-foreground">
                Nenhuma foto ainda. Clique em <b>Adicionar fotos</b> pra tirar/anexar.
              </div>
            )}
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Itens desperdiçados <span className="text-red-500">*</span></div>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1.5" />Adicionar item
              </Button>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <ItemRow key={idx} insumos={insumos} item={it}
                  onChange={p => setItem(idx, p)}
                  onRemover={itens.length > 1 ? () => removerItem(idx) : undefined} />
              ))}
            </div>
          </div>

          {/* Observação geral */}
          <div className="space-y-1">
            <div className="text-sm font-medium">Observação geral</div>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Ex.: freezer descongelou de manhã, perdas por queda etc." rows={2}
              className="w-full text-sm border rounded-md px-3 py-2 bg-transparent" />
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-3">
          {!podeSalvar && (
            <span className="mr-auto text-[11px] text-amber-700 dark:text-amber-400 self-center">
              {fotos.length === 0 ? 'Anexe ao menos 1 foto' :
                itens.some(it => !it.insumo_codigo || !it.qtd) ? 'Preencha insumo e qtd de todos os itens' :
                itens.some(it => !it.area) ? 'Escolha a área de cada item' : ''}
            </span>
          )}
          <Button variant="ghost" onClick={onFechar} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={!podeSalvar || salvando || subindoFoto}>
            {salvando ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Salvando...</> : <><Check className="w-4 h-4 mr-1.5" />Salvar registro</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linha de item — autocomplete insumo, qtd, motivo, obs
// ─────────────────────────────────────────────────────────────────────────────

function ItemRow({
  insumos, item, onChange, onRemover,
}: {
  insumos: Insumo[]; item: Item; onChange: (p: Partial<Item>) => void; onRemover?: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [abertoBusca, setAbertoBusca] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const buscaWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (abertoBusca) buscaRef.current?.focus(); }, [abertoBusca]);
  // Fecha o dropdown ao clicar fora do input+lista (bug reportado 2026-07-18: abrir a
  // busca e clicar em outro lugar do modal não fechava).
  useEffect(() => {
    if (!abertoBusca) return;
    const h = (e: MouseEvent) => {
      if (!buscaWrapperRef.current) return;
      if (!buscaWrapperRef.current.contains(e.target as Node)) setAbertoBusca(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [abertoBusca]);
  const selecionado = useMemo(() => insumos.find(i => i.codigo === item.insumo_codigo), [insumos, item.insumo_codigo]);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    if (!q) return insumos.slice(0, 8);
    return insumos.filter(i => norm(i.nome).includes(q) || norm(i.codigo).includes(q) || norm(i.categoria).includes(q)).slice(0, 8);
  }, [insumos, busca]);

  return (
    <div className="rounded-md border p-2.5 space-y-2 bg-muted/20">
      <div className="flex items-start gap-2 flex-wrap">
        {/* Insumo */}
        <div className="flex-1 min-w-[180px] relative">
          {selecionado && !abertoBusca ? (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-9 border rounded-md px-2.5 flex items-center bg-background">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selecionado.nome}</div>
                  <div className="text-[11px] text-muted-foreground">{selecionado.codigo}{selecionado.unidade_medida ? ` · ${selecionado.unidade_medida}` : ''}</div>
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setAbertoBusca(true); setBusca(''); }}><Search className="w-4 h-4" /></Button>
            </div>
          ) : (
            <div className="relative" ref={buscaWrapperRef}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input ref={buscaRef} placeholder="Buscar insumo por nome ou código..." className="h-9 pl-8"
                value={busca} onChange={e => { setBusca(e.target.value); setAbertoBusca(true); }}
                onFocus={() => setAbertoBusca(true)} />
              {abertoBusca && filtrados.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 border rounded-md bg-popover shadow-lg max-h-56 overflow-y-auto">
                  {filtrados.map(i => (
                    <button key={i.codigo} onClick={() => { onChange({ insumo_codigo: i.codigo, insumo_nome: i.nome, unidade: i.unidade_medida || 'un' }); setAbertoBusca(false); setBusca(''); }}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-accent text-sm">
                      <div className="font-medium truncate">{i.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{i.codigo}{i.unidade_medida ? ` · ${i.unidade_medida}` : ''}{i.categoria ? ` · ${i.categoria}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Qtd */}
        <div className="w-28">
          <Input type="text" inputMode="decimal" placeholder="Qtd" className="h-9 text-right"
            value={item.qtd ? String(item.qtd).replace('.', ',') : ''}
            onChange={e => onChange({ qtd: parseQtd(e.target.value) })} />
        </div>

        {onRemover && (
          <Button size="sm" variant="ghost" onClick={onRemover} title="Remover item">
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        )}
      </div>

      {/* Área — onde ocorreu o desperdício (finalização vs produção, por setor). Obrigatório. */}
      <div>
        <div className={`text-[11px] font-medium mb-1 ${item.area ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
          Área do desperdício <span className="text-red-500">*</span>
          {!item.area && <span className="ml-1 text-[10px] font-normal">— escolha uma</span>}
        </div>
        <div className={`flex flex-wrap gap-1.5 ${!item.area ? 'p-1.5 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
          {AREAS.map((a) => (
            <button
              key={a.v}
              type="button"
              onClick={() => onChange({ area: item.area === a.v ? null : a.v })}
              title={a.hint}
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                item.area === a.v
                  ? `${areaBadgeCor(a.v)} border-current font-semibold`
                  : 'border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {a.l}
            </button>
          ))}
        </div>
      </div>

      {/* Motivo + observação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input value={item.motivo || ''} onChange={e => onChange({ motivo: e.target.value })}
          placeholder="Motivo (ex.: passou da validade, queimou...)" className="h-8 text-sm" />
        <Input value={item.observacao || ''} onChange={e => onChange({ observacao: e.target.value })}
          placeholder="Observação (opcional)" className="h-8 text-sm" />
      </div>
    </div>
  );
}
