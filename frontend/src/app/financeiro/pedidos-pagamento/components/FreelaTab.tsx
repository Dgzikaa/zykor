'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/api-client';
import { Loader2, Plus, Users, Send, ChevronLeft, ChevronRight, CheckCircle2, Check } from 'lucide-react';
import { NovoFreelaDialog } from './NovoFreelaDialog';
import { STATUS_LABEL, STATUS_COLOR, type PedidoStatus } from '../types';

type Freela = { id: string; nome: string; funcao: string | null; valor_padrao: number | null; chave_pix: string | null; contaazul_pessoa_id: string | null };
type FreelaPedido = {
  id: string; beneficiario_nome: string | null; valor: number; status: PedidoStatus;
  data_vencimento: string; data_competencia: string | null; categoria_id: string | null; contaazul_pessoa_id: string | null;
};

const norm = (s?: string | null) => (s || '').trim().toLowerCase();
const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const parseValor = (v: string) => { const n = parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}`; };
const hojeISO = () => toISO(new Date());

/** Segunda-feira da semana da data. Semana = seg→dom (padrão dos relatórios). */
function mondayOf(d: Date) {
  const x = new Date(d); const wd = (x.getDay() + 6) % 7; // seg=0 ... dom=6
  x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x;
}
/** Diárias da semana são pagas na TERÇA seguinte (domingo + 2 dias). */
function weekInfo(refISO: string) {
  const mon = mondayOf(parseISO(refISO));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const payTue = new Date(sun); payTue.setDate(sun.getDate() + 2);
  return { monISO: toISO(mon), sunISO: toISO(sun), payTueISO: toISO(payTue) };
}

const APROVAVEL: PedidoStatus[] = ['aguardando_aprovacao', 'erro_ca', 'erro_inter'];

export function FreelaTab({ barId, podeAprovar, onLancado }: { barId: number | null; podeAprovar: boolean; onLancado: () => void }) {
  const { showToast } = useToast();
  const [freelas, setFreelas] = useState<Freela[]>([]);
  const [pedidos, setPedidos] = useState<FreelaPedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  // `dia` = dia trabalhado (competência). Navega a semana em passos de 7 dias.
  const [dia, setDia] = useState(hojeISO());
  const [sel, setSel] = useState<Record<string, { on: boolean; valor: string }>>({});
  const [lancando, setLancando] = useState(false);
  const [aprovandoSemana, setAprovandoSemana] = useState(false);

  const semana = useMemo(() => weekInfo(dia), [dia]);

  const carregar = useCallback(async () => {
    if (!barId) return;
    setLoading(true);
    try {
      const [fre, ped] = await Promise.all([
        api.get('/api/financeiro/beneficiarios?tipo=freela&ativos=1'),
        api.get('/api/financeiro/pedidos-pagamento?tipo=freela&escopo=todos&limit=500'),
      ]);
      setFreelas(fre.beneficiarios || []);
      setPedidos(ped.pedidos || []);
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao carregar freelas', message: e?.message });
    } finally {
      setLoading(false);
    }
  }, [barId, showToast]);

  useEffect(() => { carregar(); }, [carregar]);

  // Diárias da semana = competência (dia trabalhado) dentro de seg→dom; na falta de
  // competência, usa o vencimento. São os "selecionados p/ pagamento" da semana.
  const loteSemana = useMemo(
    () => pedidos.filter(p => {
      const ref = p.data_competencia || p.data_vencimento;
      return ref >= semana.monISO && ref <= semana.sunISO;
    }),
    [pedidos, semana.monISO, semana.sunISO]
  );
  // Marca o roster como "já selecionado" por vínculo CA ou, na falta, pelo nome.
  const selPessoaIds = useMemo(
    () => new Set(loteSemana.map(p => p.contaazul_pessoa_id).filter(Boolean) as string[]),
    [loteSemana]
  );
  const selNomes = useMemo(
    () => new Set(loteSemana.map(p => norm(p.beneficiario_nome)).filter(Boolean)),
    [loteSemana]
  );
  const totalSemana = useMemo(() => loteSemana.reduce((s, p) => s + Number(p.valor || 0), 0), [loteSemana]);
  const aAprovar = useMemo(() => loteSemana.filter(p => APROVAVEL.includes(p.status)), [loteSemana]);

  // Condensa por pessoa: 1 linha por freela, com as diárias detalhadas e o total somado.
  const resumoSemana = useMemo(() => {
    const grupos = new Map<string, { nome: string; itens: FreelaPedido[]; total: number; statuses: Set<PedidoStatus> }>();
    for (const p of loteSemana) {
      const key = p.contaazul_pessoa_id || norm(p.beneficiario_nome) || p.id;
      const g = grupos.get(key) || { nome: p.beneficiario_nome || '—', itens: [], total: 0, statuses: new Set<PedidoStatus>() };
      g.itens.push(p); g.total += Number(p.valor || 0); g.statuses.add(p.status);
      grupos.set(key, g);
    }
    for (const g of grupos.values()) {
      g.itens.sort((a, b) => (a.data_competencia || a.data_vencimento).localeCompare(b.data_competencia || b.data_vencimento));
    }
    return Array.from(grupos.entries()).map(([key, g]) => ({ key, ...g }));
  }, [loteSemana]);

  const navSemana = (delta: number) => {
    const d = parseISO(dia); d.setDate(d.getDate() + delta * 7); setDia(toISO(d)); setSel({});
  };

  const toggle = (f: Freela) => setSel((p) => {
    const cur = p[f.id];
    if (cur?.on) return { ...p, [f.id]: { on: false, valor: cur.valor } };
    return { ...p, [f.id]: { on: true, valor: cur?.valor ?? (f.valor_padrao ? String(f.valor_padrao).replace('.', ',') : '') } };
  });
  const setValor = (id: string, valor: string) => setSel((p) => ({ ...p, [id]: { on: p[id]?.on ?? true, valor } }));

  const selecionados = useMemo(() => Object.entries(sel).filter(([, v]) => v.on), [sel]);
  const totalNovo = useMemo(() => selecionados.reduce((s, [, v]) => s + parseValor(v.valor), 0), [selecionados]);

  const lancar = async () => {
    const itens = selecionados.map(([freela_id, v]) => ({ freela_id, valor: parseValor(v.valor) })).filter(i => i.valor > 0);
    if (itens.length === 0) return showToast({ type: 'error', title: 'Selecione freelas e informe os valores' });
    setLancando(true);
    try {
      // competência = dia trabalhado; vencimento = terça seguinte (fechamento semanal).
      const res = await api.post('/api/financeiro/freelas/lancar', {
        data_vencimento: semana.payTueISO, data_competencia: dia, itens,
      });
      showToast({ type: 'success', title: `${res.criados} diária(s) na semana`, message: `Vence terça ${ddmm(semana.payTueISO)}.` });
      setSel({});
      await carregar();
      onLancado();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro ao lançar', message: e?.message });
    } finally {
      setLancando(false);
    }
  };

  const aprovarSemana = async () => {
    if (aAprovar.length === 0) return;
    if (!window.confirm(`Aprovar ${aAprovar.length} pagamento(s) de freela da semana? Cria no Conta Azul e agenda o PIX no Inter.`)) return;
    setAprovandoSemana(true);
    let ok = 0; const falhas: string[] = [];
    for (const p of aAprovar) {
      try {
        await api.post(`/api/financeiro/pedidos-pagamento/${p.id}/aprovar`, {});
        ok++;
      } catch (e: any) {
        falhas.push(`${p.beneficiario_nome || 'freela'}: ${e?.message || 'falhou'}`);
      }
    }
    if (ok) showToast({ type: 'success', title: `${ok} freela(s) aprovado(s)` });
    if (falhas.length) showToast({ type: 'error', title: `${falhas.length} não aprovado(s)`, message: falhas[0] + (falhas.length > 1 ? ` (+${falhas.length - 1})` : '') });
    await carregar();
    onLancado();
    setAprovandoSemana(false);
  };

  return (
    <div className="space-y-3">
      {/* Navegação de semana + vencimento (terça seguinte) */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(-1)}><ChevronLeft className="w-4 h-4" /></Button>
          <div className="text-sm px-1">
            <span className="font-medium">Semana {ddmm(semana.monISO)} a {ddmm(semana.sunISO)}</span>
            <span className="text-muted-foreground"> · vence terça {ddmm(semana.payTueISO)}</span>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navSemana(1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setNovoOpen(true)}><Plus className="w-4 h-4 mr-1.5" />Novo freela</Button>
      </div>

      {loading ? (
        <div className="py-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>
      ) : (
        <>
          {/* Resumo da semana: quem já foi selecionado p/ pagamento */}
          {loteSemana.length > 0 && (
            <Card className="border-emerald-400/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Selecionados p/ pagamento · {loteSemana.length} diária(s) · {fmtBRL(totalSemana)}
                  </div>
                  {podeAprovar && aAprovar.length > 0 && (
                    <Button size="sm" onClick={aprovarSemana} disabled={aprovandoSemana}>
                      {aprovandoSemana ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Aprovando...</> : <><Check className="w-4 h-4 mr-2" />Aprovar pagamento da semana ({aAprovar.length})</>}
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {resumoSemana.map((g) => (
                    <div key={g.key} className="flex items-start gap-2 text-sm">
                      <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px] shrink-0 mt-0.5">Selecionado p/ pagamento</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium truncate">{g.nome}</span>
                          {g.itens.length > 1 && <span className="text-muted-foreground text-xs">({g.itens.length} diárias)</span>}
                          {[...g.statuses].map((st) => (
                            <Badge key={st} className={`${STATUS_COLOR[st]} text-[10px]`}>{STATUS_LABEL[st]}</Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.itens.map(p => `${ddmm(p.data_competencia || p.data_vencimento)} · ${fmtBRL(p.valor)}`).join('   ·   ')}
                        </div>
                      </div>
                      <span className="font-semibold shrink-0 w-24 text-right">{fmtBRL(g.total)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Adicionar diárias: dia trabalhado (competência) + roster */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Dia trabalhado (competência):</span>
            <Input type="date" value={dia} min={semana.monISO} max={semana.sunISO} onChange={(e) => setDia(e.target.value)} className="h-8 w-40" />
          </div>

          {freelas.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              <Users className="w-9 h-9 mx-auto mb-2 opacity-40" />
              Nenhum freela cadastrado. Clique em “Novo freela”.
            </CardContent></Card>
          ) : (
            <div className="space-y-1.5">
              {freelas.map((f) => {
                const s = sel[f.id];
                const semCA = !f.contaazul_pessoa_id;
                const jaSelecionado = (f.contaazul_pessoa_id && selPessoaIds.has(f.contaazul_pessoa_id)) || selNomes.has(norm(f.nome));
                return (
                  <div key={f.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${s?.on ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10' : 'border-[hsl(var(--border))]'}`}>
                    <input type="checkbox" checked={!!s?.on} onChange={() => toggle(f)} className="accent-emerald-600 w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm flex items-center gap-1.5">
                        {f.nome}
                        {jaSelecionado && <Badge className="bg-emerald-500/15 text-emerald-600 text-[10px]">Selecionado p/ pagamento</Badge>}
                      </div>
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
              <div className="text-sm"><b>{selecionados.length}</b> freela(s) · total <b>{fmtBRL(totalNovo)}</b> · vence terça {ddmm(semana.payTueISO)}</div>
              <Button onClick={lancar} disabled={lancando}>
                {lancando ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Lançando...</> : <><Send className="w-4 h-4 mr-2" />Lançar na semana</>}
              </Button>
            </div>
          )}
        </>
      )}

      <NovoFreelaDialog open={novoOpen} onOpenChange={setNovoOpen} onCriado={carregar} />
    </div>
  );
}
