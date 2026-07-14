'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateInputBR } from '@/components/ui/date-input-br';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, FileScan, Sparkles, Send, AlertTriangle, PencilLine, ScanLine, Receipt, X, Plus } from 'lucide-react';
import { BoletoScanner } from './BoletoScanner';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PedidoCard, type Opcao } from './PedidoCard';
import { type Pedido } from '../types';
import { type TabKey, TAB_STATUS } from '../statusTabs';
import { type BoletoDecodificado } from '../boletoBarcode';

type DadosBoleto = {
  valor: number | null;
  vencimento: string | null;
  beneficiario: string | null;
  cpf_cnpj: string | null;
  linha_digitavel: string | null;
  banco: string | null;
};

const VAZIO: DadosBoleto = { valor: null, vencimento: null, beneficiario: null, cpf_cnpj: null, linha_digitavel: null, banco: null };
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function BoletoTab({
  onCriado, pedidos, podeAprovar, categorias, contas, contaPadrao, fornecedores, onOpenDetalhe, onSelecao,
}: {
  onCriado: () => void;
  pedidos: Pedido[];              // já filtrado p/ boletos (page.tsx)
  podeAprovar: boolean;
  categorias: Opcao[];
  contas: Opcao[];
  contaPadrao?: string;
  fornecedores: Opcao[];
  onOpenDetalhe: (id: string) => void;
  onSelecao?: (id: string, sel: { catId: string; contaId: string; fornId: string }) => void;
}) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('solicitado');
  const [lendo, setLendo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [arquivoNome, setArquivoNome] = useState('');
  const [d, setD] = useState<DadosBoleto | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Competência e observação NÃO vêm do boleto — quem sobe preenche.
  const [competencia, setCompetencia] = useState('');
  const [observacao, setObservacao] = useState('');
  // #20 — conta de pagamento (pré-preenchida com a padrão do bar). '' = usa a padrão.
  const [contaId, setContaId] = useState('');
  const contaEfetiva = contaId || contaPadrao || '';
  // #21 — dividir o boleto em 2+ categorias (rateio). Cada linha vira 1 lançamento no CA.
  const [usarRateio, setUsarRateio] = useState(false);
  const [rateio, setRateio] = useState<Array<{ catId: string; valor: string }>>([{ catId: '', valor: '' }, { catId: '', valor: '' }]);
  const numBR = (v: string) => Number(String(v).replace(/\./g, '').replace(',', '.')) || 0;
  const rateioSoma = usarRateio ? rateio.reduce((s, r) => s + numBR(r.valor), 0) : 0;

  const ler = async (file: File) => {
    setArquivoNome(file.name);
    setLendo(true);
    setD(null);
    setAvisos([]);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const barId = localStorage.getItem('sgb_selected_bar_id');
      const res = await fetch('/api/financeiro/boleto/ler', {
        method: 'POST',
        headers: barId ? { 'x-selected-bar-id': barId } : {},
        body: fd,
      });
      const json = await res.json();
      // A rota agora sempre devolve uma estrutura (mesmo sem ler) → seguimos pro preenchimento.
      const dados: DadosBoleto = json?.dados || { ...VAZIO };
      setD(dados);
      setAvisos(json?.avisos || []);
      if (json?.leu === false) {
        showToast({ type: 'warning', title: 'Não consegui ler o boleto', message: 'Preencha os campos manualmente abaixo.' });
      } else if ((json?.avisos || []).length) {
        showToast({ type: 'warning', title: 'Confira o boleto', message: `Não achei: ${json.avisos.join(', ')}. Complete manualmente.` });
      } else {
        showToast({ type: 'success', title: 'Boleto lido', message: 'Confira os dados e informe a competência.' });
      }
    } catch (e: any) {
      // Falha de rede: ainda assim abre o form vazio pra não travar o operador.
      setD({ ...VAZIO });
      setAvisos(['valor', 'vencimento', 'linha digitável', 'beneficiário']);
      showToast({ type: 'error', title: 'Erro ao ler boleto', message: `${e?.message || ''} — preencha manualmente.` });
    } finally {
      setLendo(false);
    }
  };

  const preencherManual = () => {
    setArquivoNome('');
    setAvisos([]);
    setD({ ...VAZIO });
  };

  // Câmera: leu o código de barras → preenche valor/vencimento/linha digitável (determinístico).
  const onScan = (dados: BoletoDecodificado) => {
    setScannerOpen(false);
    setArquivoNome('');
    if (dados.concessionaria) {
      setD({ ...VAZIO, linha_digitavel: dados.linha_digitavel });
      setAvisos(['valor', 'vencimento', 'beneficiário']);
      showToast({ type: 'warning', title: 'Boleto de concessionária', message: 'Li o código; valor e vencimento você confere/preenche.' });
      return;
    }
    setD({ ...VAZIO, valor: dados.valor, vencimento: dados.vencimento, linha_digitavel: dados.linha_digitavel });
    setAvisos([!dados.valor && 'valor', !dados.vencimento && 'vencimento'].filter(Boolean) as string[]);
    showToast({ type: 'success', title: 'Boleto lido pela câmera', message: 'Confira e informe a competência.' });
  };

  const upd = (campo: keyof DadosBoleto, valor: string) =>
    setD((p) => (p ? { ...p, [campo]: campo === 'valor' ? Number(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || null : valor } : p));

  const reset = () => {
    setD(null); setArquivoNome(''); setAvisos([]); setCompetencia(''); setObservacao(''); setContaId('');
    setUsarRateio(false); setRateio([{ catId: '', valor: '' }, { catId: '', valor: '' }]);
  };

  const criar = async () => {
    if (!d) return;
    if (!d.valor || d.valor <= 0) return showToast({ type: 'error', title: 'Informe o valor' });
    if (!d.vencimento) return showToast({ type: 'error', title: 'Informe o vencimento' });
    if (!competencia) return showToast({ type: 'error', title: 'Informe a competência', message: 'A data de competência é preenchida por quem sobe o boleto.' });
    // #21 — se dividir em categorias, valida linhas + soma antes de criar.
    const rateioLinhas = usarRateio ? rateio.filter(r => r.catId && numBR(r.valor) > 0) : [];
    if (usarRateio) {
      if (rateioLinhas.length < 2) return showToast({ type: 'error', title: 'Rateio incompleto', message: 'Preencha ao menos 2 categorias com valor.' });
      if (Math.abs(rateioSoma - (d.valor || 0)) > 0.01) return showToast({ type: 'error', title: 'Soma não bate', message: `As categorias somam ${fmtBRL(rateioSoma)}, mas o boleto é ${fmtBRL(d.valor || 0)}.` });
    }
    if (!d.linha_digitavel) {
      // Sem linha digitável não dá pra pagar via Inter na aprovação — avisa mas deixa seguir.
      const ok = window.confirm('Sem a linha digitável o boleto não será pago automaticamente pelo Inter na aprovação. Criar mesmo assim?');
      if (!ok) return;
    }
    setCriando(true);
    try {
      await api.post('/api/financeiro/pedidos-pagamento', {
        tipo: 'fornecedor',
        descricao: `Boleto ${d.beneficiario || ''}`.trim(),
        valor: d.valor,
        data_vencimento: d.vencimento,
        data_competencia: competencia,
        beneficiario_nome: d.beneficiario || null,
        cpf_cnpj: d.cpf_cnpj || null,
        linha_digitavel: d.linha_digitavel || null,
        conta_financeira_id: contaEfetiva || undefined,
        observacao: [observacao.trim(), d.banco ? `Banco ${d.banco}` : ''].filter(Boolean).join(' · ') || null,
        // #21: rateio por categoria → cada linha vira 1 lançamento no CA (mesma competência).
        competencias: usarRateio ? rateioLinhas.map(r => ({
          data_competencia: competencia, valor: numBR(r.valor),
          categoria_id: r.catId, categoria_nome: categorias.find(c => c.value === r.catId)?.label || null,
        })) : undefined,
      });
      showToast({ type: 'success', title: 'Pedido de boleto criado', message: 'Foi pra aprovação.' });
      reset();
      onCriado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao criar pedido', message: e?.message });
    } finally {
      setCriando(false);
    }
  };

  // Lista de boletos (mesmo esquema da aba PIX): 4 filtros por status.
  const boletosFiltrados = useMemo(() => pedidos.filter(p => TAB_STATUS[tab](p.status)), [pedidos, tab]);
  const countSolicitado = useMemo(() => pedidos.filter(p => TAB_STATUS.solicitado(p.status)).length, [pedidos]);

  return (
    <div className="space-y-3">
      {/* Upload + manual */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-6 hover:bg-muted/40 transition">
          {lendo ? (
            <><Loader2 className="w-7 h-7 animate-spin text-blue-500" /><span className="text-sm text-muted-foreground">Lendo o boleto com IA…</span></>
          ) : (
            <>
              <FileScan className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-blue-500" /> Enviar foto ou PDF do boleto</span>
              <span className="text-xs text-muted-foreground">{arquivoNome || 'A IA extrai valor, vencimento, beneficiário e linha digitável'}</span>
            </>
          )}
          <input type="file" accept="image/*,application/pdf" className="hidden" disabled={lendo}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) ler(f); e.currentTarget.value = ''; }} />
        </label>
        <div className="flex sm:flex-col gap-2">
          <Button className="flex-1 sm:h-auto" onClick={() => setScannerOpen(true)} disabled={lendo}>
            <ScanLine className="w-4 h-4 mr-2" /> Escanear c/ câmera
          </Button>
          <Button variant="outline" className="flex-1 sm:h-auto" onClick={preencherManual} disabled={lendo}>
            <PencilLine className="w-4 h-4 mr-2" /> Preencher manual
          </Button>
        </div>
      </div>

      {scannerOpen && <BoletoScanner onDetect={onScan} onFoto={(f) => { setScannerOpen(false); ler(f); }} onClose={() => setScannerOpen(false)} />}

      {/* Revisão dos dados */}
      {d && (
        <Card>
          <CardContent className="py-4 space-y-3">
            {avisos.length > 0 && (
              <div className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-500 p-2.5 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Não consegui ler: <b>{avisos.join(', ')}</b>. Confira e complete os campos abaixo antes de criar.</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Valor <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">R$</span>
                  <Input
                    value={d.valor != null ? d.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                    onChange={(e) => { const dig = e.target.value.replace(/\D/g, ''); setD(p => p ? { ...p, valor: dig ? parseInt(dig, 10) / 100 : null } : p); }}
                    placeholder="0,00" inputMode="decimal" className={`pl-9 ${d.valor == null ? 'border-amber-400' : ''}`} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block">Vencimento <span className="text-red-500">*</span></Label>
                <DateInputBR value={d.vencimento || ''} onChange={(iso) => upd('vencimento', iso)} calendar
                  className={!d.vencimento ? 'border-amber-400' : ''} />
              </div>
              <div>
                <Label className="mb-1.5 block">Competência <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(você preenche)</span></Label>
                <DateInputBR value={competencia} onChange={setCompetencia} calendar
                  className={!competencia ? 'border-amber-400' : ''} />
              </div>
              <div>
                <Label className="mb-1.5 block">Beneficiário</Label>
                <Input value={d.beneficiario || ''} onChange={(e) => upd('beneficiario', e.target.value)} placeholder="quem recebe" />
              </div>
              <div>
                <Label className="mb-1.5 block">CPF/CNPJ</Label>
                <Input value={d.cpf_cnpj || ''} onChange={(e) => upd('cpf_cnpj', e.target.value)} placeholder="só números" inputMode="numeric" />
              </div>
              <div>
                <Label className="mb-1.5 block">Banco</Label>
                <Input value={d.banco || ''} onChange={(e) => upd('banco', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Linha digitável {!d.linha_digitavel && <span className="text-amber-600 text-xs">— não lida, digite p/ pagar via Inter</span>}</Label>
              <Input value={d.linha_digitavel || ''} onChange={(e) => upd('linha_digitavel', e.target.value)} placeholder="código de barras do boleto (47/48 dígitos)" inputMode="numeric"
                className={!d.linha_digitavel ? 'border-amber-400' : ''} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Conta de Pagamento <span className="text-muted-foreground text-xs">(padrão do bar)</span></Label>
                <SearchableSelect value={contaEfetiva} onValueChange={(v) => setContaId(v || '')}
                  placeholder={contaPadrao ? 'Padrão do bar' : 'Selecione a conta'} searchPlaceholder="Filtrar…" emptyMessage="Nenhuma" options={contas} />
              </div>
              <div>
                <Label className="mb-1.5 block">Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Ex.: entrega Ambev, conta de água da unidade…" />
              </div>
            </div>
            {/* #21 — dividir o boleto em 2+ categorias (rateio). Cada linha vira 1 lançamento no CA. */}
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={usarRateio} onChange={(e) => setUsarRateio(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" />
                Dividir em categorias (rateio)
              </label>
              {usarRateio && (
                <div className="mt-2 space-y-2 rounded-lg border border-[hsl(var(--border))] p-3">
                  {rateio.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1">
                        <SearchableSelect value={r.catId} onValueChange={(v) => setRateio((prev) => prev.map((x, ix) => (ix === i ? { ...x, catId: v || '' } : x)))}
                          placeholder="Categoria" searchPlaceholder="Filtrar…" emptyMessage="Nenhuma" options={categorias} />
                      </div>
                      <Input value={r.valor} onChange={(e) => setRateio((prev) => prev.map((x, ix) => (ix === i ? { ...x, valor: e.target.value } : x)))}
                        placeholder="0,00" inputMode="decimal" className="w-28" />
                      {rateio.length > 2 && (
                        <button onClick={() => setRateio((prev) => prev.filter((_, ix) => ix !== i))} className="text-muted-foreground hover:text-red-600" title="Remover linha"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setRateio((prev) => [...prev, { catId: '', valor: '' }])} className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" />adicionar categoria</button>
                    <span className={`text-xs font-medium ${Math.abs(rateioSoma - (d.valor || 0)) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>Soma {fmtBRL(rateioSoma)} / {fmtBRL(d.valor || 0)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">{d.valor ? `Total ${fmtBRL(d.valor)}` : ''}</span>
              <Button onClick={criar} disabled={criando}>
                {criando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando…</> : <><Send className="w-4 h-4 mr-2" />Criar pedido</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de boletos — mesmo esquema da aba PIX (Solicitado/Aprovado/Recusado/Todos) */}
      <div className="border-t border-[hsl(var(--border))] pt-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-3">
          <TabsList>
            <TabsTrigger value="solicitado">
              Solicitado {countSolicitado > 0 && <Badge variant="secondary" className="ml-1.5">{countSolicitado}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="aprovado">Aprovado</TabsTrigger>
            <TabsTrigger value="recusado">Recusado</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {boletosFiltrados.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Receipt className="w-9 h-9 mx-auto mb-2 opacity-40" />
            Nenhum boleto nesta aba.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {boletosFiltrados.map((p) => (
              <PedidoCard
                key={p.id}
                pedido={p}
                podeAprovar={podeAprovar}
                categorias={categorias}
                contas={contas}
                contaPadrao={contaPadrao}
                fornecedores={fornecedores}
                onOpen={onOpenDetalhe}
                onChange={onCriado}
                onSelecao={onSelecao}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
