'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Users, Send } from 'lucide-react';
import { NovoFreelaDialog } from './NovoFreelaDialog';

type Freela = { id: string; nome: string; funcao: string | null; valor_padrao: number | null; chave_pix: string | null; contaazul_pessoa_id: string | null };

const hojeISO = () => new Date().toISOString().slice(0, 10);
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const parseValor = (v: string) => { const n = parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

export function FreelaTab({ barId, onLancado }: { barId: number | null; onLancado: () => void }) {
  const { showToast } = useToast();
  const [freelas, setFreelas] = useState<Freela[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);
  const [vencimento, setVencimento] = useState(hojeISO());
  const [sel, setSel] = useState<Record<string, { on: boolean; valor: string }>>({});
  const [lancando, setLancando] = useState(false);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const res = await api.get('/api/financeiro/beneficiarios?tipo=freela&ativos=1');
      setFreelas(res.beneficiarios || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar freelas', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [barId, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const toggle = (f: Freela) => setSel((p) => {
    const cur = p[f.id];
    if (cur?.on) return { ...p, [f.id]: { on: false, valor: cur.valor } };
    return { ...p, [f.id]: { on: true, valor: cur?.valor ?? (f.valor_padrao ? String(f.valor_padrao).replace('.', ',') : '') } };
  });
  const setValor = (id: string, valor: string) => setSel((p) => ({ ...p, [id]: { on: p[id]?.on ?? true, valor } }));

  const selecionados = useMemo(() => Object.entries(sel).filter(([, v]) => v.on), [sel]);
  const total = useMemo(() => selecionados.reduce((s, [, v]) => s + parseValor(v.valor), 0), [selecionados]);

  const lancar = async () => {
    const itens = selecionados.map(([freela_id, v]) => ({ freela_id, valor: parseValor(v.valor) })).filter(i => i.valor > 0);
    if (itens.length === 0) return showToast({ type: 'error', title: 'Selecione freelas e informe os valores' });
    setLancando(true);
    try {
      const res = await api.post('/api/financeiro/freelas/lancar', { data_vencimento: vencimento, itens });
      showToast({ type: 'success', title: `${res.criados} pagamento(s) lançado(s)`, message: `Total ${fmtBRL(res.total)} — vão pra aprovação.` });
      setSel({});
      onLancado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao lançar', message: e?.message });
    } finally {
      setLancando(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Vencimento do lote:</span>
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="h-8 w-40" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setNovoOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Novo freela</Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : freelas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <Users className="w-9 h-9 mx-auto mb-2 opacity-40" />
          Nenhum freela cadastrado. Clique em “Novo freela”.
        </CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {freelas.map((f) => {
            const s = sel[f.id];
            const semCA = !f.contaazul_pessoa_id;
            return (
              <div key={f.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${s?.on ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10' : 'border-[hsl(var(--border))]'}`}>
                <input type="checkbox" checked={!!s?.on} onChange={() => toggle(f)} className="accent-emerald-600 w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{f.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {f.funcao || '—'}{f.chave_pix ? ` · PIX ${f.chave_pix}` : ' · sem PIX'}
                    {semCA && <span className="text-amber-600"> · sem fornecedor no CA (financeiro vincula na aprovação)</span>}
                  </div>
                </div>
                <div className="w-28 shrink-0">
                  <Input value={s?.valor ?? ''} onChange={(e) => setValor(f.id, e.target.value)} placeholder={f.valor_padrao ? String(f.valor_padrao).replace('.', ',') : 'valor'} inputMode="decimal" className="h-8 text-right" disabled={!s?.on} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selecionados.length > 0 && (
        <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-lg border bg-card shadow-lg p-3">
          <div className="text-sm"><b>{selecionados.length}</b> freela(s) · total <b>{fmtBRL(total)}</b></div>
          <Button onClick={lancar} disabled={lancando}>
            {lancando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Lançando...</> : <><Send className="w-4 h-4 mr-2" />Lançar pra aprovação</>}
          </Button>
        </div>
      )}

      <NovoFreelaDialog open={novoOpen} onOpenChange={setNovoOpen} onCriado={carregar} />
    </div>
  );
}
