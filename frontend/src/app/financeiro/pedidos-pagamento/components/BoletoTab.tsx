'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, FileScan, Sparkles, Send } from 'lucide-react';

type DadosBoleto = {
  valor: number | null;
  vencimento: string | null;
  beneficiario: string | null;
  cpf_cnpj: string | null;
  linha_digitavel: string | null;
  banco: string | null;
};

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function BoletoTab({ onCriado }: { onCriado: () => void }) {
  const { showToast } = useToast();
  const [lendo, setLendo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [arquivoNome, setArquivoNome] = useState('');
  const [d, setD] = useState<DadosBoleto | null>(null);

  const ler = async (file: File) => {
    setArquivoNome(file.name);
    setLendo(true);
    setD(null);
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
      if (!json.success) throw new Error(json.error || 'falha na leitura');
      setD(json.dados);
      showToast({ type: 'success', title: 'Boleto lido', message: 'Confira os dados antes de criar o pedido.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao ler boleto', message: e?.message });
    } finally {
      setLendo(false);
    }
  };

  const upd = (campo: keyof DadosBoleto, valor: string) =>
    setD((p) => (p ? { ...p, [campo]: campo === 'valor' ? Number(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || null : valor } : p));

  const criar = async () => {
    if (!d) return;
    if (!d.valor || d.valor <= 0) return showToast({ type: 'error', title: 'Valor inválido' });
    if (!d.vencimento) return showToast({ type: 'error', title: 'Informe o vencimento' });
    setCriando(true);
    try {
      await api.post('/api/financeiro/pedidos-pagamento', {
        tipo: 'fornecedor',
        descricao: `Boleto ${d.beneficiario || ''}`.trim(),
        valor: d.valor,
        data_vencimento: d.vencimento,
        beneficiario_nome: d.beneficiario || null,
        cpf_cnpj: d.cpf_cnpj || null,
        linha_digitavel: d.linha_digitavel || null,
        observacao: d.banco ? `Boleto — banco ${d.banco}` : 'Boleto',
      });
      showToast({ type: 'success', title: 'Pedido de boleto criado', message: 'Foi pra aprovação.' });
      setD(null);
      setArquivoNome('');
      onCriado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao criar pedido', message: e?.message });
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Upload */}
      <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-8 hover:bg-muted/40 transition">
        {lendo ? (
          <><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="text-sm text-muted-foreground">Lendo o boleto com IA…</span></>
        ) : (
          <>
            <FileScan className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-blue-500" /> Enviar foto ou PDF do boleto</span>
            <span className="text-xs text-muted-foreground">{arquivoNome || 'A IA extrai valor, vencimento e beneficiário'}</span>
          </>
        )}
        <input type="file" accept="image/*,application/pdf" className="hidden" disabled={lendo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ler(f); }} />
      </label>

      {/* Revisão dos dados extraídos */}
      {d && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Dados lidos pela IA — confira e ajuste se precisar.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Valor</Label>
                <Input value={d.valor != null ? String(d.valor).replace('.', ',') : ''} onChange={(e) => upd('valor', e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <Label className="mb-1.5 block">Vencimento</Label>
                <Input type="date" value={d.vencimento || ''} onChange={(e) => upd('vencimento', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Beneficiário</Label>
              <Input value={d.beneficiario || ''} onChange={(e) => upd('beneficiario', e.target.value)} placeholder="quem recebe" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label className="mb-1.5 block">Linha digitável</Label>
              <Input value={d.linha_digitavel || ''} onChange={(e) => upd('linha_digitavel', e.target.value)} placeholder="código de barras do boleto" inputMode="numeric" />
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
    </div>
  );
}
