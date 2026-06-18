'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, CreditCard, Sparkles, Save } from 'lucide-react';

type Cat = { categoria_id: string | null; categoria_nome: string };
type Linha = { data: string | null; descricao: string; valor: number; categoria_id: string | null; categoria_nome: string | null; origem: string };

const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function CartaoTab() {
  const { showToast } = useToast();
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [categorias, setCategorias] = useState<Cat[]>([]);

  const ler = async (file: File) => {
    setNome(file.name); setLendo(true); setLinhas([]);
    try {
      const fd = new FormData(); fd.append('file', file);
      const barId = localStorage.getItem('sgb_selected_bar_id');
      const res = await fetch('/api/financeiro/cartao/ler', { method: 'POST', headers: barId ? { 'x-selected-bar-id': barId } : {}, body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'falha na leitura');
      setLinhas(json.linhas || []);
      setCategorias(json.categorias || []);
      const auto = (json.linhas || []).filter((l: Linha) => l.origem === 'aprendido').length;
      showToast({ type: 'success', title: `${json.linhas?.length || 0} linhas lidas`, message: `${auto} já categorizadas pelo histórico. Confira o resto.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao ler fatura', message: e?.message });
    } finally { setLendo(false); }
  };

  const setCat = (i: number, nomeCat: string) => setLinhas((p) => p.map((l, idx) => idx === i
    ? { ...l, categoria_nome: nomeCat || null, categoria_id: categorias.find((c) => c.categoria_nome === nomeCat)?.categoria_id || null, origem: 'manual' }
    : l));

  const salvar = async () => {
    setSalvando(true);
    try {
      const res = await api.post('/api/financeiro/cartao/aprender', {
        linhas: linhas.filter((l) => l.categoria_nome).map((l) => ({ descricao: l.descricao, categoria_id: l.categoria_id, categoria_nome: l.categoria_nome })),
      });
      showToast({ type: 'success', title: 'Categorização salva', message: `O sistema aprendeu ${res.aprendidos} estabelecimento(s) — próxima fatura vem melhor.` });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao salvar', message: e?.message });
    } finally { setSalvando(false); }
  };

  const total = linhas.reduce((s, l) => s + l.valor, 0);
  const semCat = linhas.filter((l) => !l.categoria_nome).length;

  return (
    <div className="space-y-3">
      <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-[hsl(var(--border))] py-8 hover:bg-muted/40 transition">
        {lendo ? (
          <><Loader2 className="w-8 h-8 animate-spin text-blue-500" /><span className="text-sm text-muted-foreground">Lendo a fatura com IA…</span></>
        ) : (
          <>
            <CreditCard className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-blue-500" /> Enviar fatura do cartão (PDF/imagem)</span>
            <span className="text-xs text-muted-foreground">{nome || 'A IA lê as linhas e sugere a categoria pelo seu histórico'}</span>
          </>
        )}
        <input type="file" accept="image/*,application/pdf" className="hidden" disabled={lendo}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) ler(f); }} />
      </label>

      {linhas.length > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-muted-foreground">{linhas.length} linhas · total <b>{fmtBRL(total)}</b>{semCat > 0 && <span className="text-amber-600"> · {semCat} sem categoria</span>}</span>
              <Button size="sm" onClick={salvar} disabled={salvando}>
                {salvando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando…</> : <><Save className="w-4 h-4 mr-2" />Salvar categorização</>}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr><th className="text-left py-1.5 pr-2">Data</th><th className="text-left pr-2">Descrição</th><th className="text-right pr-2">Valor</th><th className="text-left">Categoria</th></tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-2 whitespace-nowrap text-muted-foreground">{l.data || '—'}</td>
                      <td className="pr-2 truncate max-w-[220px]">{l.descricao}</td>
                      <td className="pr-2 text-right whitespace-nowrap">{fmtBRL(l.valor)}</td>
                      <td>
                        <select value={l.categoria_nome || ''} onChange={(e) => setCat(i, e.target.value)}
                          className={`h-8 w-full max-w-[220px] text-xs border rounded px-1.5 bg-background ${!l.categoria_nome ? 'border-amber-400' : l.origem === 'aprendido' ? 'border-emerald-400' : ''}`}>
                          <option value="">— escolher —</option>
                          {categorias.map((c) => <option key={c.categoria_nome} value={c.categoria_nome}>{c.categoria_nome}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Verde = veio do histórico. Ao salvar, o sistema aprende cada estabelecimento. <b>Gerar os lançamentos/pagamento da fatura é o próximo passo.</b>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
