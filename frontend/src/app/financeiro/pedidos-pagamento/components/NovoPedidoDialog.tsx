'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInputBR } from '@/components/ui/date-input-br';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useToast } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api-client';
import { getSelectedBarId } from '@/lib/selected-bar';
import { Loader2, Paperclip, HelpCircle, Plus, Trash2, UserPlus } from 'lucide-react';
import { type PedidoTipo, formatBRL } from '../types';
import { parsePixCopiaCola } from '../pixEmv';

interface Opcao { value: string; label: string; searchHint?: string }

// No pedido manual só existem 2 destinos: reembolso a funcionário ou fornecedor externo.
// (freela/cartão/avulso são lançados por fluxos próprios.)
const TIPOS: PedidoTipo[] = ['reembolso', 'fornecedor'];
const TIPO_LABEL_FORM: Record<'reembolso' | 'fornecedor', string> = {
  reembolso: 'Reembolso Funcionário',
  fornecedor: 'Fornecedor Externo',
};

function CampoInfo({ texto }: { texto: string }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="text-muted-foreground/70 hover:text-muted-foreground" aria-label={texto}>
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const parseValor = (v: string): number => {
  const s = v.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// Máscara de moeda: formata enquanto digita (últimos dígitos = centavos) → "1.234,56".
const formatValorInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function NovoPedidoDialog({
  open, onOpenChange, onCriado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCriado: () => void;
}) {
  const { showToast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  const [tipo, setTipo] = useState<PedidoTipo>('fornecedor');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [observacao, setObservacao] = useState('');
  const [precisaComprovante, setPrecisaComprovante] = useState(false);

  // Classificação (obrigatória na solicitação): categoria + fornecedor do Conta Azul.
  // O financeiro passa a só CONFERIR e aprovar — as opções vêm do CA (mesmas do painel de aprovação).
  const [categorias, setCategorias] = useState<Opcao[]>([]);
  const [fornecedores, setFornecedores] = useState<Opcao[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  // Cadastro rápido de fornecedor no CA (quando não existe ainda).
  const [showNovoForn, setShowNovoForn] = useState(false);
  const [novoFornNome, setNovoFornNome] = useState('');
  const [novoFornDoc, setNovoFornDoc] = useState('');
  const [cadastrando, setCadastrando] = useState(false);

  // Forma de pagamento: chave PIX (automático no Inter) ou copia e cola / QR (manual).
  const [formaPagamento, setFormaPagamento] = useState<'chave' | 'copia_cola'>('chave');
  const [copiaCola, setCopiaCola] = useState('');

  // Competências múltiplas: 1 PIX cheio → N lançamentos no CA (um por competência/valor).
  const [multiComp, setMultiComp] = useState(false);
  const [competencias, setCompetencias] = useState<Array<{ data: string; valor: string; descricao: string }>>([
    { data: '', valor: '', descricao: '' },
  ]);

  const pixObrigatorio = tipo === 'reembolso' || tipo === 'fornecedor';
  // Hoje no fuso local (YYYY-MM-DD) — trava o calendário do vencimento (não paga pra trás).
  const hoje = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const totalComp = competencias.reduce((s, c) => s + parseValor(c.valor), 0);
  const copiaInfo = formaPagamento === 'copia_cola' && copiaCola.trim() ? parsePixCopiaCola(copiaCola) : null;

  const setComp = (i: number, patch: Partial<{ data: string; valor: string; descricao: string }>) =>
    setCompetencias(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addComp = () => setCompetencias(prev => [...prev, { data: '', valor: '', descricao: '' }]);
  const removeComp = (i: number) => setCompetencias(prev => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Ao colar o código, pré-preenche beneficiário (e valor, se o QR for estático).
  const onCopiaColaChange = (v: string) => {
    setCopiaCola(v);
    const info = parsePixCopiaCola(v);
    if (info.valido) {
      if (info.nomeRecebedor && !beneficiario.trim()) setBeneficiario(info.nomeRecebedor);
      if (info.valor && !multiComp && !parseValor(valor)) setValor(String(info.valor).replace('.', ','));
    }
  };

  // Carrega categorias (DESPESA) e fornecedores do Conta Azul ao abrir o diálogo.
  // As APIs só pedem bar_id (sem trava de aprovação), então o solicitante já consegue listar.
  useEffect(() => {
    if (!open) return;
    const barId = getSelectedBarId();
    if (!barId) return;
    let cancelado = false;
    (async () => {
      setCarregandoOpcoes(true);
      try {
        const j = (p: Promise<Response>) => p.then(r => r.json()).catch(() => ({}));
        const [cat, fo] = await Promise.all([
          j(fetch(`/api/financeiro/contaazul/categorias?bar_id=${barId}&tipo=DESPESA`)),
          j(fetch(`/api/financeiro/contaazul/stakeholders?bar_id=${barId}&perfil=FORNECEDOR`)),
        ]);
        if (cancelado) return;
        setCategorias((cat.categorias || [])
          .filter((c: any) => c.ativo !== false)
          .map((c: any) => ({ value: c.contaazul_id, label: c.nome || c.categoria_nome })));
        setFornecedores((fo.pessoas || []).map((p: any) => ({
          value: p.contaazul_id, label: p.nome, searchHint: p.documento || '',
        })));
      } finally {
        if (!cancelado) setCarregandoOpcoes(false);
      }
    })();
    return () => { cancelado = true; };
  }, [open]);

  // Cadastro rápido de fornecedor no CA — mesma rota do painel de aprovação.
  const cadastrarFornecedor = async () => {
    if (!novoFornNome.trim()) return showToast({ type: 'error', title: 'Informe o nome do fornecedor' });
    const barId = getSelectedBarId();
    setCadastrando(true);
    try {
      const res = await api.post('/api/financeiro/contaazul/pessoas/cadastrar', {
        bar_id: barId ? Number(barId) : undefined,
        nome: novoFornNome.trim(),
        documento: novoFornDoc.replace(/\D/g, '') || undefined,
      });
      const novo = { value: res.contaazul_id, label: res.nome } as Opcao;
      setFornecedores(prev => [novo, ...prev]);
      setFornecedorId(res.contaazul_id);
      if (!beneficiario.trim()) setBeneficiario(res.nome);
      setShowNovoForn(false); setNovoFornNome(''); setNovoFornDoc('');
      showToast({ type: 'success', title: 'Fornecedor cadastrado no Conta Azul' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao cadastrar fornecedor', message: e?.message });
    } finally {
      setCadastrando(false);
    }
  };

  const reset = () => {
    setTipo('fornecedor'); setDescricao(''); setValor(''); setVencimento('');
    setCompetencia(''); setChavePix(''); setBeneficiario(''); setCpfCnpj(''); setObservacao('');
    setPrecisaComprovante(false); setArquivo(null);
    setFormaPagamento('chave'); setCopiaCola('');
    setMultiComp(false); setCompetencias([{ data: '', valor: '', descricao: '' }]);
    setCategoriaId(''); setFornecedorId('');
    setShowNovoForn(false); setNovoFornNome(''); setNovoFornDoc('');
  };

  const submit = async () => {
    const valorNum = multiComp ? Math.round(totalComp * 100) / 100 : parseValor(valor);
    if (!descricao.trim()) return showToast({ type: 'error', title: 'Descrição é obrigatória' });
    if (valorNum <= 0) return showToast({ type: 'error', title: 'Valor inválido' });
    if (!vencimento) return showToast({ type: 'error', title: 'Informe o vencimento' });
    if (vencimento < hoje) return showToast({ type: 'error', title: 'Vencimento no passado', message: 'A data de vencimento não pode ser anterior a hoje.' });
    if (!categoriaId) return showToast({ type: 'error', title: 'Escolha a categoria' });
    if (!fornecedorId) return showToast({ type: 'error', title: 'Escolha o fornecedor', message: 'Selecione na lista ou cadastre um novo.' });

    // Competência(s)
    let competenciasPayload: Array<{ data_competencia: string; valor: number; descricao: string | null }> | undefined;
    if (multiComp) {
      const linhas = competencias.map(c => ({
        data_competencia: c.data,
        valor: parseValor(c.valor),
        descricao: c.descricao.trim() || null,
      }));
      if (linhas.some(l => !l.data_competencia)) return showToast({ type: 'error', title: 'Informe a data de todas as competências' });
      if (linhas.some(l => l.valor <= 0)) return showToast({ type: 'error', title: 'Informe o valor de todas as competências' });
      competenciasPayload = linhas;
    } else if (!competencia) {
      return showToast({ type: 'error', title: 'Informe a data de competência' });
    }

    // Destino do pagamento
    const usaCopiaCola = formaPagamento === 'copia_cola';
    if (usaCopiaCola) {
      if (!copiaCola.trim()) return showToast({ type: 'error', title: 'Cole o código PIX copia e cola' });
    } else if (pixObrigatorio && !chavePix.trim()) {
      return showToast({ type: 'error', title: 'Chave PIX é obrigatória' });
    }

    setSalvando(true);
    try {
      const res = await api.post('/api/financeiro/pedidos-pagamento', {
        tipo,
        descricao: descricao.trim(),
        valor: valorNum,
        data_vencimento: vencimento,
        data_competencia: multiComp ? undefined : competencia,
        competencias: competenciasPayload,
        chave_pix: usaCopiaCola ? null : (chavePix.trim() || null),
        pix_copia_cola: usaCopiaCola ? copiaCola.trim() : null,
        beneficiario_nome: beneficiario.trim() || fornecedores.find(f => f.value === fornecedorId)?.label || null,
        cpf_cnpj: cpfCnpj.replace(/\D/g, '') || null,
        observacao: observacao.trim() || null,
        precisa_comprovante: precisaComprovante,
        // Classificação preenchida na solicitação (financeiro só confere/aprova).
        categoria_id: categoriaId,
        categoria_nome: categorias.find(c => c.value === categoriaId)?.label || null,
        contaazul_pessoa_id: fornecedorId,
      });

      // Anexo (opcional) — sobe depois que o pedido existe
      if (arquivo && res?.pedido?.id) {
        const fd = new FormData();
        fd.append('file', arquivo);
        const selectedBarId = getSelectedBarId();
        await fetch(`/api/financeiro/pedidos-pagamento/${res.pedido.id}/anexos`, {
          method: 'POST',
          headers: selectedBarId ? { 'x-selected-bar-id': selectedBarId } : {},
          body: fd,
        });
      }

      showToast({ type: 'success', title: 'Pedido enviado', message: 'O financeiro vai analisar.' });
      reset();
      onOpenChange(false);
      onCriado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao enviar', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!salvando) onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo pedido de pagamento</DialogTitle>
          <DialogDescription>Informe categoria e fornecedor. O financeiro confere e aprova.</DialogDescription>
        </DialogHeader>

        <div className="px-6 overflow-y-auto space-y-4">
          <div>
            <Label className="mb-1.5 block">Tipo</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    tipo === t
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-medium'
                      : 'border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {TIPO_LABEL_FORM[t as 'reembolso' | 'fornecedor']}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="desc" className="mb-1.5 block">Descrição</Label>
            <Input id="desc" value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reembolso compra de insumos / Pagamento fornecedor X" />
          </div>

          {/* Classificação (obrigatória): categoria + fornecedor do Conta Azul. O financeiro só confere. */}
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 flex items-center gap-1">
                Categoria <span className="text-red-500">*</span>
                <CampoInfo texto="Categoria de despesa no Conta Azul. O financeiro confere na aprovação." />
              </Label>
              <SearchableSelect
                value={categoriaId}
                onValueChange={(v) => setCategoriaId(v || '')}
                placeholder={carregandoOpcoes ? 'Carregando…' : 'Selecione a categoria'}
                searchPlaceholder="Filtrar categoria..."
                emptyMessage="Nenhuma categoria"
                options={categorias}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="flex items-center gap-1">
                  {tipo === 'reembolso' ? 'Funcionário / Beneficiário' : 'Fornecedor'} <span className="text-red-500">*</span>
                  <CampoInfo texto="Cadastro do Conta Azul de quem recebe. Não achou? Cadastre um novo." />
                </Label>
                <button type="button" onClick={() => setShowNovoForn(v => !v)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                  <UserPlus className="w-3.5 h-3.5" />{showNovoForn ? 'Cancelar' : 'Cadastrar novo'}
                </button>
              </div>
              {showNovoForn ? (
                <div className="rounded-md border border-blue-500/25 bg-blue-500/[0.04] p-3 space-y-2">
                  <Input value={novoFornNome} onChange={(e) => setNovoFornNome(e.target.value)}
                    placeholder="Nome do fornecedor / funcionário" />
                  <Input value={novoFornDoc} onChange={(e) => setNovoFornDoc(e.target.value)}
                    placeholder="CPF/CNPJ (opcional) — só números" inputMode="numeric" />
                  <Button type="button" size="sm" onClick={cadastrarFornecedor} disabled={cadastrando}>
                    {cadastrando ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Cadastrando...</> : 'Cadastrar no Conta Azul'}
                  </Button>
                </div>
              ) : (
                <SearchableSelect
                  value={fornecedorId}
                  onValueChange={(v) => {
                    setFornecedorId(v || '');
                    const f = fornecedores.find(x => x.value === v);
                    if (f && !beneficiario.trim()) setBeneficiario(f.label);
                  }}
                  placeholder={carregandoOpcoes ? 'Carregando…' : 'Selecione o fornecedor'}
                  searchPlaceholder="Filtrar por nome ou documento..."
                  emptyMessage="Nenhum fornecedor"
                  options={fornecedores}
                />
              )}
            </div>
          </div>

          {/* Destaque financeiro: Valor, Vencimento e Competência — o que mais importa pro financeiro */}
          <div className="rounded-lg border-2 border-blue-500/25 bg-blue-500/[0.04] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">Dados financeiros</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                <input type="checkbox" checked={multiComp} onChange={(e) => setMultiComp(e.target.checked)} className="h-3.5 w-3.5 accent-blue-600 cursor-pointer" />
                Várias competências?
              </label>
            </div>
            {/* Valor em linha própria e largura total — valores grandes (ex.: R$ 223.579,00) não cortam. */}
            <div>
              <Label className="mb-1 block text-xs font-medium">Valor {multiComp ? 'total' : ''} <span className="text-red-500">*</span></Label>
              {multiComp ? (
                <div className="h-12 flex items-center rounded-md border border-[hsl(var(--border))] bg-muted/40 px-3 text-xl font-bold">
                  {formatBRL(totalComp)}
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold pointer-events-none">R$</span>
                  <Input id="valor" value={valor} onChange={(e) => setValor(formatValorInput(e.target.value))}
                    placeholder="0,00" inputMode="decimal" className="h-12 pl-10 text-xl font-bold" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="venc" className="mb-1 flex items-center gap-1 text-xs font-medium">
                  Vencimento <span className="text-red-500">*</span>
                  <CampoInfo texto="Data em que deve ser pago" />
                </Label>
                <DateInputBR id="venc" value={vencimento} onChange={setVencimento} min={hoje} calendar className="h-12 text-base font-semibold" />
              </div>
              <div>
                <Label htmlFor="comp" className="mb-1 flex items-center gap-1 text-xs font-medium">
                  Competência {!multiComp && <span className="text-red-500">*</span>}
                  <CampoInfo texto="Data em que o produto chegou na loja ou em que o serviço foi prestado" />
                </Label>
                {multiComp ? (
                  <div className="h-12 flex items-center rounded-md border border-dashed border-[hsl(var(--border))] px-3 text-xs text-muted-foreground">definida por linha ↓</div>
                ) : (
                  <DateInputBR id="comp" value={competencia} onChange={setCompetencia} calendar className="h-12 text-base font-semibold" />
                )}
              </div>
            </div>
          </div>

          {/* Forma de pagamento: chave PIX (Inter automático) ou copia e cola / QR (manual) */}
          <div>
            <Label className="mb-1.5 block">Forma de pagamento</Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {(['chave', 'copia_cola'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormaPagamento(f)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    formaPagamento === f
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 font-medium'
                      : 'border-[hsl(var(--border))] text-muted-foreground hover:bg-muted/40'
                  }`}
                >
                  {f === 'chave' ? 'Chave PIX' : 'Copia e cola / QR'}
                </button>
              ))}
            </div>
            {formaPagamento === 'chave' ? (
              <Input id="pix" value={chavePix} onChange={(e) => setChavePix(e.target.value)}
                placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
            ) : (
              <>
                <Textarea value={copiaCola} onChange={(e) => onCopiaColaChange(e.target.value)} rows={3}
                  className="font-mono text-xs" placeholder="Cole o código PIX copia e cola (começa com 00020101...)" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {copiaInfo?.nomeRecebedor ? `Recebedor: ${copiaInfo.nomeRecebedor}. ` : ''}
                  {copiaInfo?.dinamico ? 'QR dinâmico — informe o valor manualmente. ' : ''}
                  Pagamento é manual: o sócio cola o código no app do Inter e marca como pago.
                </p>
              </>
            )}
          </div>

          {/* Linhas de competência (só no modo "várias competências") — 1 PIX, N lançamentos no CA */}
          {multiComp && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Cada competência vira um lançamento no Conta Azul; o PIX sai 1x pelo total.</p>
                {competencias.map((c, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="w-36 shrink-0">
                      {i === 0 && <Label className="mb-1 block text-[11px]">Competência</Label>}
                      <DateInputBR value={c.data} onChange={(iso) => setComp(i, { data: iso })} calendar />
                    </div>
                    <div className="w-28 shrink-0">
                      {i === 0 && <Label className="mb-1 block text-[11px]">Valor</Label>}
                      <Input value={c.valor} onChange={(e) => setComp(i, { valor: formatValorInput(e.target.value) })} placeholder="0,00" inputMode="decimal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {i === 0 && <Label className="mb-1 block text-[11px]">Descrição (opcional)</Label>}
                      <Input value={c.descricao} onChange={(e) => setComp(i, { descricao: e.target.value })} placeholder="ex: 130 gelo 29/06" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-9 shrink-0 text-muted-foreground hover:text-red-600"
                      onClick={() => removeComp(i)} disabled={competencias.length <= 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={addComp}>
                    <Plus className="w-3.5 h-3.5 mr-1" />Adicionar competência
                  </Button>
                  <span className="text-sm font-medium">Total: {formatBRL(totalComp)}</span>
                </div>
              </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="benef" className="mb-1.5 block">Beneficiário <span className="text-muted-foreground text-xs">(nome no comprovante)</span></Label>
              <Input id="benef" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} placeholder="Preenchido pelo fornecedor; ajuste se precisar" />
            </div>
            <div>
              <Label htmlFor="doc" className="mb-1.5 block">CPF/CNPJ <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input id="doc" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="só números" inputMode="numeric" />
            </div>
          </div>

          <div>
            <Label htmlFor="obs" className="mb-1.5 block">Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Textarea id="obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>

          <label htmlFor="precisa-comprovante" className="flex items-start gap-2.5 cursor-pointer rounded-md border border-[hsl(var(--border))] px-3 py-2.5 hover:bg-muted/40">
            <input
              id="precisa-comprovante"
              type="checkbox"
              checked={precisaComprovante}
              onChange={(e) => setPrecisaComprovante(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600 cursor-pointer"
            />
            <span className="text-sm">
              Precisa de comprovante?
              <span className="block text-xs text-muted-foreground">
                Marque quando este pagamento vai exigir comprovante anexado depois. O banco não devolve o comprovante automaticamente.
              </span>
            </span>
          </label>

          <div>
            <Label className="mb-1.5 block">
              Anexo (nota/cupom/boleto){tipo === 'reembolso' && <span className="text-muted-foreground text-xs"> — recomendado</span>}
            </Label>
            <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-[hsl(var(--border))] px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
              <Paperclip className="w-4 h-4" />
              {arquivo ? arquivo.name : 'Imagem ou PDF (máx 10MB)'}
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={submit} disabled={salvando}>
            {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : 'Enviar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
