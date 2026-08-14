'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { useToast } from '@/components/ui/toast';
import { getSelectedBarId } from '@/lib/selected-bar';
import { cn } from '@/lib/utils';
import { Loader2, Smile, Target, Award, Plus, Trash2, ClipboardList } from 'lucide-react';
import PesquisaFelicidadePage from '../pesquisa-felicidade/page';

/**
 * Hub de Pesquisas (ata de 13/08/2026).
 *
 * "PESQUISAS TEM BEM MAIS DO QUE FELICIDADE, MUDARIA PRA PESQUISAS COM TODAS AS PESQUISAS, ABA PRA
 * A PRÓPRIA AVALIAÇÃO, ABA DE RECONHECIMENTOS."
 *
 * A Felicidade é reaproveitada inteira — ela já tem as próprias abas internas. A rota antiga
 * /rh/pesquisa-felicidade continua de pé (links salvos não quebram), mas saiu do menu.
 */

const NIVEIS = [
  { id: 'insatisfatorio', label: 'Insatisfatório', cor: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
  { id: 'abaixo', label: 'Abaixo', cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
  { id: 'atende', label: 'Atende', cor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
  { id: 'acima', label: 'Acima', cor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { id: 'destaque', label: 'Destaque', cor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' },
];
const rotuloNivel = (id: string | null) => NIVEIS.find((n) => n.id === id)?.label || '—';
const corNivel = (id: string | null) => NIVEIS.find((n) => n.id === id)?.cor || 'text-muted-foreground';

export default function PesquisasPage() {
  const { setPageTitle } = usePageTitle();
  const [aba, setAba] = useState('felicidade');
  // Depende de `aba` de propósito: a tela da Felicidade escreve o próprio título ao montar e
  // apaga ao desmontar. Como efeito de filho roda antes do do pai, reafirmar aqui a cada troca
  // de aba mantém "Pesquisas" no header.
  useEffect(() => {
    setPageTitle('📋 Pesquisas');
    return () => setPageTitle('');
  }, [setPageTitle, aba]);

  return (
    <ProtectedRoute>
      <div className="mx-auto px-3 py-5">
        <Tabs value={aba} onValueChange={setAba} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="felicidade"><Smile className="w-4 h-4 mr-1.5" />Felicidade</TabsTrigger>
            <TabsTrigger value="calibracao"><Target className="w-4 h-4 mr-1.5" />Calibração</TabsTrigger>
            <TabsTrigger value="reconhecimentos"><Award className="w-4 h-4 mr-1.5" />Reconhecimentos</TabsTrigger>
          </TabsList>

          {/* a tela da felicidade inteira, com as abas internas dela */}
          <TabsContent value="felicidade"><PesquisaFelicidadePage /></TabsContent>
          <TabsContent value="calibracao"><PainelCalibracao /></TabsContent>
          <TabsContent value="reconhecimentos"><PainelReconhecimentos /></TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  );
}

/** Panorama do trimestre: quem já foi calibrado e — o que faltava — quem ainda não. */
function PainelCalibracao() {
  const { selectedBar } = useBar();
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [tri, setTri] = useState(Math.floor(hoje.getMonth() / 3) + 1);

  const { data, isLoading } = useApiSWR<any>(
    selectedBar ? `/api/rh/calibracoes?ano=${ano}&trimestre=${tri}` : null,
  );
  const linhas = data?.linhas || [];
  const r = data?.resumo;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={tri} onChange={(e) => setTri(Number(e.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {[1, 2, 3, 4].map((t) => <option key={t} value={t}>{t}º trimestre</option>)}
        </select>
        <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-9 w-[100px]" />
      </div>

      {isLoading ? <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Elegíveis</div><div className="text-xl font-bold">{r?.elegiveis ?? 0}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Calibrados</div><div className="text-xl font-bold text-emerald-600">{r?.calibrados ?? 0}</div></CardContent></Card>
            <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-xl font-bold text-amber-600">{r?.pendentes ?? 0}</div></CardContent></Card>
            <Card><CardContent className="py-3">
              <div className="text-xs text-muted-foreground">Entraram no trimestre</div>
              <div className="text-xl font-bold">{r?.novos_no_periodo ?? 0}</div>
            </CardContent></Card>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Quem foi admitido dentro do trimestre <strong>não</strong> entra em pendentes — pela regra da casa,
            é avaliado no período seguinte.
          </p>

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground border-b bg-muted/40"><tr>
                <th className="text-left px-3 py-2 min-w-[200px]">Pessoa</th>
                <th className="text-left px-3 py-2">Cargo</th>
                <th className="text-left px-3 py-2">Comportamento</th>
                <th className="text-left px-3 py-2">Performance</th>
              </tr></thead>
              <tbody>
                {linhas.map((l: any) => (
                  <tr key={l.funcionario_id} className={cn('border-b last:border-0', !l.calibrado && !l.novo_no_periodo && 'bg-amber-50/40 dark:bg-amber-900/10')}>
                    <td className="px-3 py-1.5">
                      <div className="font-medium truncate">{l.nome}</div>
                      {l.novo_no_periodo && <span className="text-[10px] text-muted-foreground">entrou neste trimestre — avalia no próximo</span>}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{l.cargo_nome || '—'}</td>
                    <td className="px-3 py-1.5"><span className={cn('text-[10px] rounded px-1.5 py-0.5 uppercase', corNivel(l.comportamento))}>{rotuloNivel(l.comportamento)}</span></td>
                    <td className="px-3 py-1.5"><span className={cn('text-[10px] rounded px-1.5 py-0.5 uppercase', corNivel(l.performance))}>{rotuloNivel(l.performance)}</span></td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />Ninguém ativo neste bar.
                  </td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function PainelReconhecimentos() {
  const { selectedBar } = useBar();
  const { showToast } = useToast();
  const { data, isLoading, mutate } = useApiSWR<any>(selectedBar ? '/api/rh/reconhecimentos?meses=12' : null);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState({ funcionario_id: '', titulo: '', descricao: '', reconhecido_por: '' });

  const lista = data?.reconhecimentos || [];
  const ranking = data?.ranking || [];
  const funcionarios = useMemo(() => data?.funcionarios || [], [data]);

  const salvar = async () => {
    if (!f.funcionario_id || !f.titulo.trim()) {
      return showToast({ type: 'error', title: 'Escolha a pessoa e escreva o reconhecimento' });
    }
    setSalvando(true);
    try {
      const barId = getSelectedBarId();
      const r = await fetch('/api/rh/reconhecimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(barId ? { 'x-selected-bar-id': barId } : {}) },
        credentials: 'include',
        body: JSON.stringify({ ...f, funcionario_id: Number(f.funcionario_id) }),
      });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error || 'Falha ao salvar');
      setF({ funcionario_id: '', titulo: '', descricao: '', reconhecido_por: '' });
      setAberto(false);
      mutate();
    } catch (e: any) {
      showToast({ type: 'error', title: 'Erro', message: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id: string) => {
    if (!window.confirm('Remover este reconhecimento?')) return;
    const barId = getSelectedBarId();
    await fetch(`/api/rh/reconhecimentos?id=${id}`, {
      method: 'DELETE', headers: { ...(barId ? { 'x-selected-bar-id': barId } : {}) }, credentials: 'include',
    });
    mutate();
  };

  if (isLoading) return <div className="py-16 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setAberto((v) => !v)}><Plus className="w-4 h-4 mr-1.5" />Novo reconhecimento</Button>
        <span className="text-xs text-muted-foreground">{lista.length} nos últimos 12 meses</span>
      </div>

      {aberto && (
        <Card><CardContent className="py-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={f.funcionario_id} onChange={(e) => setF({ ...f, funcionario_id: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[200px]">
              <option value="">— quem está sendo reconhecido —</option>
              {funcionarios.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <Input value={f.reconhecido_por} onChange={(e) => setF({ ...f, reconhecido_por: e.target.value })}
              placeholder="reconhecido por (opcional)" className="h-9 flex-1 min-w-[160px]" />
          </div>
          <Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })}
            placeholder="O reconhecimento em uma linha" className="h-9" />
          <Textarea rows={3} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })}
            placeholder="Detalhe o que aconteceu (opcional)" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar'}</Button>
          </div>
        </CardContent></Card>
      )}

      {ranking.length > 0 && (
        <Card><CardContent className="py-3">
          <div className="text-xs font-semibold mb-2">Mais reconhecidos no período</div>
          <div className="flex flex-wrap gap-1.5">
            {ranking.map((p: any) => (
              <span key={p.funcionario_id} className="text-xs rounded-full border px-2 py-1">
                {p.nome} <strong className="tabular-nums">{p.n}</strong>
              </span>
            ))}
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {lista.map((r: any) => (
          <Card key={r.id}><CardContent className="py-2.5 flex items-start gap-3">
            <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{r.funcionario_nome}</div>
              <div className="text-sm">{r.titulo}</div>
              {r.descricao && <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">{r.descricao}</div>}
              <div className="text-[10px] text-muted-foreground/70 mt-1">
                {String(r.data).slice(0, 10).split('-').reverse().join('/')}
                {r.reconhecido_por && ` · por ${r.reconhecido_por}`}
              </div>
            </div>
            <button onClick={() => excluir(r.id)} className="p-1.5 rounded-md hover:bg-muted text-red-500 shrink-0"><Trash2 className="w-4 h-4" /></button>
          </CardContent></Card>
        ))}
        {lista.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-10 border border-dashed rounded-lg flex flex-col items-center">
            <Award className="w-8 h-8 mb-1.5 opacity-40" />Nenhum reconhecimento registrado ainda.
          </div>
        )}
      </div>
    </div>
  );
}
