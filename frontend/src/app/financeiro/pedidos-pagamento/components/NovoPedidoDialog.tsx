'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { api } from '@/lib/api-client';
import { Loader2, Paperclip, HelpCircle } from 'lucide-react';
import { type PedidoTipo } from '../types';

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

  const [tipo, setTipo] = useState<PedidoTipo>('reembolso');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [beneficiario, setBeneficiario] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [observacao, setObservacao] = useState('');

  const pixObrigatorio = tipo === 'reembolso' || tipo === 'fornecedor';

  const reset = () => {
    setTipo('reembolso'); setDescricao(''); setValor(''); setVencimento('');
    setCompetencia(''); setChavePix(''); setBeneficiario(''); setCpfCnpj(''); setObservacao('');
    setArquivo(null);
  };

  const submit = async () => {
    const valorNum = parseValor(valor);
    if (!descricao.trim()) return showToast({ type: 'error', title: 'Descrição é obrigatória' });
    if (valorNum <= 0) return showToast({ type: 'error', title: 'Valor inválido' });
    if (!vencimento) return showToast({ type: 'error', title: 'Informe o vencimento' });
    if (!competencia) return showToast({ type: 'error', title: 'Informe a data de competência' });
    if (pixObrigatorio && !chavePix.trim()) return showToast({ type: 'error', title: 'Chave PIX é obrigatória' });

    setSalvando(true);
    try {
      const res = await api.post('/api/financeiro/pedidos-pagamento', {
        tipo,
        descricao: descricao.trim(),
        valor: valorNum,
        data_vencimento: vencimento,
        data_competencia: competencia,
        chave_pix: chavePix.trim() || null,
        beneficiario_nome: beneficiario.trim() || null,
        cpf_cnpj: cpfCnpj.replace(/\D/g, '') || null,
        observacao: observacao.trim() || null,
      });

      // Anexo (opcional) — sobe depois que o pedido existe
      if (arquivo && res?.pedido?.id) {
        const fd = new FormData();
        fd.append('file', arquivo);
        const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
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
          <DialogDescription>Preencha os dados. O financeiro completa categoria/conta na aprovação.</DialogDescription>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="valor" className="mb-1.5 block">Valor (R$)</Label>
              <Input id="valor" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="venc" className="mb-1.5 flex items-center gap-1">
                Vencimento <span className="text-red-500">*</span>
                <CampoInfo texto="Data em que deve ser pago" />
              </Label>
              <Input id="venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pix" className="mb-1.5 block">
                Chave PIX {pixObrigatorio && <span className="text-red-500">*</span>}
              </Label>
              <Input id="pix" value={chavePix} onChange={(e) => setChavePix(e.target.value)}
                placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" />
            </div>
            <div>
              <Label htmlFor="comp" className="mb-1.5 flex items-center gap-1">
                Competência <span className="text-red-500">*</span>
                <CampoInfo texto="Data em que o produto chegou na loja ou em que o serviço foi prestado" />
              </Label>
              <Input id="comp" type="date" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="benef" className="mb-1.5 block">Beneficiário <span className="text-muted-foreground text-xs">(quem recebe)</span></Label>
              <Input id="benef" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} placeholder="Nome do fornecedor ou funcionário" />
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
