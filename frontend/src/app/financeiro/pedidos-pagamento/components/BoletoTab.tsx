'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DateInputBR } from '@/components/ui/date-input-br';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, FileScan, Sparkles, Send, AlertTriangle, PencilLine } from 'lucide-react';

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

export function BoletoTab({ onCriado }: { onCriado: () => void }) {
  const { showToast } = useToast();
  const [lendo, setLendo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [arquivoNome, setArquivoNome] = useState('');
  const [d, setD] = useState<DadosBoleto | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  // Competência e observação NÃO vêm do boleto — quem sobe preenche.
  const [competencia, setCompetencia] = useState('');
  const [observacao, setObservacao] = useState('');

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

  const upd = (campo: keyof DadosBoleto, valor: string) =>
    setD((p) => (p ? { ...p, [campo]: campo === 'valor' ? Number(valor.replace(/[R$\s.]/g, '').replace(',', '.')) || null : valor } : p));

  const reset = () => {
    setD(null); setArquivoNome(''); setAvisos([]); setCompetencia(''); setObservacao('');
  };

  const criar = async () => {
    if (!d) return;
    if (!d.valor || d.valor <= 0) return showToast({ type: 'error', title: 'Informe o valor' });
    if (!d.vencimento) return showToast({ type: 'error', title: 'Informe o vencimento' });
    if (!competencia) return showToast({ type: 'error', title: 'Informe a competência', message: 'A data de competência é preenchida por quem sobe o boleto.' });
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
        observacao: [observacao.trim(), d.banco ? `Banco ${d.banco}` : ''].filter(Boolean).join(' · ') || null,
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
        <Button variant="outline" className="sm:h-auto" onClick={preencherManual} disabled={lendo}>
          <PencilLine className="w-4 h-4 mr-2" /> Preencher manual
        </Button>
      </div>

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
                <Input value={d.valor != null ? String(d.valor).replace('.', ',') : ''} onChange={(e) => upd('valor', e.target.value)} placeholder="0,00" inputMode="decimal"
                  className={d.valor == null ? 'border-amber-400' : ''} />
              </div>
              <div>
                <Label className="mb-1.5 block">Vencimento <span className="text-red-500">*</span></Label>
                <DateInputBR value={d.vencimento || ''} onChange={(iso) => upd('vencimento', iso)}
                  className={!d.vencimento ? 'border-amber-400' : ''} />
              </div>
              <div>
                <Label className="mb-1.5 block">Competência <span className="text-red-500">*</span> <span className="text-muted-foreground text-xs">(você preenche)</span></Label>
                <DateInputBR value={competencia} onChange={setCompetencia}
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
            <div>
              <Label className="mb-1.5 block">Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} placeholder="Ex.: entrega Ambev, conta de água da unidade…" />
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
