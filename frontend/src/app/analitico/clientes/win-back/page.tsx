'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HeartHandshake, Phone, Download, Send, Loader2, AlertTriangle, CheckCircle2, X, FileText, MessageSquare } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtBRL = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string | null) =>
  s ? new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';

// Ordem + cor + descrição de cada segmento (RFM). Os alvos primários de win-back
// (clientes valiosos que estão sumindo) vêm pré-selecionados.
const SEG: { nome: string; cor: string; badge: string; desc: string }[] = [
  { nome: 'Campeões', cor: 'border-emerald-500', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', desc: 'Vêm sempre e gastam muito' },
  { nome: 'Leais', cor: 'border-green-500', badge: 'bg-green-500/15 text-green-700 dark:text-green-300', desc: 'Frequentes e recentes' },
  { nome: 'Promissores', cor: 'border-teal-500', badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300', desc: 'Vieram 1-2x recente' },
  { nome: 'Novos', cor: 'border-blue-500', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', desc: 'Primeira visita recente' },
  { nome: 'Em risco', cor: 'border-amber-500', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', desc: 'Eram frequentes, sumindo — reativar JÁ' },
  { nome: 'Hibernando', cor: 'border-orange-500', badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', desc: '2-6 meses sem vir' },
  { nome: 'Perdidos', cor: 'border-red-500', badge: 'bg-red-500/15 text-red-700 dark:text-red-300', desc: '+6 meses sem vir' },
];
const SEG_META: Record<string, { badge: string; desc: string }> = Object.fromEntries(
  SEG.map((s) => [s.nome, { badge: s.badge, desc: s.desc }]),
);

// Alvos primários do win-back: valiosos e sumindo.
const ALVOS_PRIMARIOS = ['Em risco', 'Hibernando', 'Perdidos'];

interface ResumoRow { segmento: string; clientes: number; valor_total: number; recencia_media: number }
interface ClienteRow {
  cliente_nome: string | null; cliente_fone_norm: string; segmento: string;
  frequencia: number; monetario: number; ticket_medio: number; recencia_dias: number; ultima_visita: string;
}
interface WinbackResp { success: boolean; resumo: ResumoRow[]; clientes: ClienteRow[]; total: number }

export default function WinBackPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();

  // Filtros
  const [segSel, setSegSel] = useState<string[]>(ALVOS_PRIMARIOS);
  const [valorMin, setValorMin] = useState(0);
  const [recenciaMin, setRecenciaMin] = useState(0);
  const [recenciaMax, setRecenciaMax] = useState<number | ''>('');

  // Disparo
  const [disparoAberto, setDisparoAberto] = useState(false);
  const [modo, setModo] = useState<'template' | 'texto'>('template');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesErro, setTemplatesErro] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [templateVars, setTemplateVars] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState('');
  const [simulando, setSimulando] = useState(false);
  const [simulacao, setSimulacao] = useState<any>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [disparando, setDisparando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  useEffect(() => {
    setPageTitle('💸 Win-back de Clientes');
    return () => setPageTitle('');
  }, [setPageTitle]);

  // Lista/resumo via useApiSWR — a chave já isola por bar (multi-tenant).
  const endpoint = selectedBar?.id
    ? `/api/analitico/clientes/win-back?bar_id=${selectedBar.id}&valor_min=${valorMin}&recencia_min=${recenciaMin}${recenciaMax !== '' ? `&recencia_max=${recenciaMax}` : ''}&limit=200`
    : null;
  const { data, isLoading } = useApiSWR<WinbackResp>(endpoint);

  const resumo: ResumoRow[] = useMemo(() => data?.resumo || [], [data]);
  const clientes: ClienteRow[] = useMemo(() => data?.clientes || [], [data]);
  const resumoMap = useMemo(() => new Map(resumo.map((r) => [r.segmento, r])), [resumo]);

  const toggleSeg = (n: string) =>
    setSegSel((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  // Tabela filtrada pelos segmentos selecionados (client-side).
  const filtrada = useMemo(
    () => (segSel.length ? clientes.filter((c) => segSel.includes(c.segmento)) : clientes),
    [clientes, segSel],
  );
  const comTelefone = filtrada.filter((c) => c.cliente_fone_norm);

  const templateSel = useMemo(() => templates.find((t) => t.id === templateId) || null, [templates, templateId]);

  // Carrega os templates aprovados da Umbler quando o painel abre
  useEffect(() => {
    if (!disparoAberto || !selectedBar?.id || templates.length > 0 || templatesLoading) return;
    setTemplatesLoading(true);
    setTemplatesErro(null);
    api.get(`/api/umbler/templates?bar_id=${selectedBar.id}`)
      .then((r: any) => setTemplates(r.templates || []))
      .catch((e: any) => setTemplatesErro(e?.message || 'Erro ao buscar templates'))
      .finally(() => setTemplatesLoading(false));
  }, [disparoAberto, selectedBar?.id, templates.length, templatesLoading]);

  // Ao escolher um template, inicializa um valor por variável.
  const escolherTemplate = (id: string) => {
    setTemplateId(id);
    setSimulacao(null);
    setResultado(null);
    const t = templates.find((x) => x.id === id);
    const vars: any[] = t?.variables || [];
    setTemplateVars(vars.map((v: any) => {
      const dica = `${v?.name || ''} ${v?.example || ''}`.toLowerCase();
      if (/nome|name|cliente|first/.test(dica)) return '{primeiro_nome}';
      return v?.example || '';
    }));
  };

  const exportar = () => {
    exportarCSV('win-back', filtrada as unknown as Record<string, unknown>[], [
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'cliente_fone_norm', label: 'Telefone' },
      { key: 'segmento', label: 'Segmento' },
      { key: 'frequencia', label: 'Visitas' },
      { key: 'recencia_dias', label: 'Dias sem vir' },
      { key: 'ticket_medio', label: 'Ticket médio', format: (v) => Number(v ?? 0).toFixed(2) },
      { key: 'monetario', label: 'Total gasto', format: (v) => Number(v ?? 0).toFixed(2) },
      { key: 'ultima_visita', label: 'Última visita' },
    ]);
  };

  const payloadMensagem = () =>
    modo === 'template'
      ? { template_id: templateId, template_label: templateSel?.label, params: templateVars }
      : { message: mensagem };

  const podeDisparar =
    segSel.length > 0 &&
    comTelefone.length > 0 &&
    (modo === 'template' ? !!templateId : mensagem.trim().length >= 5);

  const corpoDisparo = () => ({
    bar_id: selectedBar!.id,
    segmentos: segSel,
    valor_min: valorMin,
    recencia_min: recenciaMin,
    ...(recenciaMax !== '' ? { recencia_max: recenciaMax } : {}),
    ...payloadMensagem(),
  });

  const simular = async () => {
    if (!selectedBar?.id) return;
    setSimulando(true);
    setSimulacao(null);
    setResultado(null);
    try {
      const r = await api.post('/api/umbler/disparo-winback', { ...corpoDisparo(), dry_run: true });
      setSimulacao(r);
    } catch (e: any) {
      setSimulacao({ error: e?.message || 'Erro ao simular' });
    } finally {
      setSimulando(false);
    }
  };

  const disparar = async () => {
    if (!selectedBar?.id) return;
    setConfirmar(false);
    setDisparando(true);
    setResultado(null);
    try {
      const r = await api.post('/api/umbler/disparo-winback', { ...corpoDisparo(), dry_run: false });
      setResultado(r);
    } catch (e: any) {
      setResultado({ error: e?.message || 'Erro ao disparar' });
    } finally {
      setDisparando(false);
    }
  };

  if (isLoading && !data) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HeartHandshake className="w-6 h-6 text-rose-600" /> Win-back de Clientes</h1>
          <p className="text-sm text-gray-500">
            Clientes valiosos que estão sumindo (RFM). Selecione os segmentos, ajuste os filtros e dispare uma campanha de reativação por WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportar} disabled={filtrada.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
            <Download className="w-4 h-4" /> Exportar ({filtrada.length})
          </button>
        </div>
      </div>

      {/* Cards por segmento — clicáveis multi (viram o alvo do disparo) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {SEG.map((s) => {
          const r = resumoMap.get(s.nome);
          const ativo = segSel.includes(s.nome);
          return (
            <button key={s.nome} type="button" onClick={() => toggleSeg(s.nome)} title={s.desc}
              className={`text-left rounded-lg border border-l-4 ${s.cor} bg-white dark:bg-gray-800 dark:border-gray-700 p-3 transition-all ${ativo ? 'ring-2 ring-rose-400' : 'hover:shadow-md'}`}>
              <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{s.nome}</p>
              <p className="text-xl font-bold">{fmt(Number(r?.clientes || 0))}</p>
              <p className="text-[10px] text-gray-500">{fmtBRL(Number(r?.valor_total || 0))}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros de valor / recência */}
      <div className="flex items-end gap-4 flex-wrap text-sm">
        <div>
          <label htmlFor="f-valor" className="text-xs text-gray-500 block mb-1">Valor mínimo (R$ gasto na vida)</label>
          <input id="f-valor" type="number" min={0} step={50} value={valorMin}
            onChange={(e) => setValorMin(Math.max(0, Number(e.target.value) || 0))}
            className="w-40 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label htmlFor="f-rec-min" className="text-xs text-gray-500 block mb-1">Dias sem vir (mín.)</label>
          <input id="f-rec-min" type="number" min={0} step={7} value={recenciaMin}
            onChange={(e) => setRecenciaMin(Math.max(0, Number(e.target.value) || 0))}
            className="w-36 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label htmlFor="f-rec-max" className="text-xs text-gray-500 block mb-1">Dias sem vir (máx.)</label>
          <input id="f-rec-max" type="number" min={0} step={7} value={recenciaMax}
            onChange={(e) => setRecenciaMax(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))}
            placeholder="sem limite"
            className="w-36 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <span className="text-gray-400 ml-auto">
          {fmt(filtrada.length)} clientes · {fmt(comTelefone.length)} com telefone
        </span>
        <button type="button" onClick={() => setDisparoAberto((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-rose-600 text-white hover:bg-rose-700">
          <Send className="w-4 h-4" /> Disparar WhatsApp
        </button>
      </div>

      {/* Painel de disparo */}
      {disparoAberto && (
        <Card className="p-5 border-2 border-rose-300 dark:border-rose-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4 text-rose-600" /> Disparo por WhatsApp (Umbler)</h2>
            <button type="button" onClick={() => setDisparoAberto(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Alvo: <strong>{segSel.length ? segSel.join(', ') : 'nenhum segmento selecionado'}</strong>
            {' '}· valor ≥ <strong>{fmtBRL(valorMin)}</strong>
            {' '}· recência ≥ <strong>{recenciaMin}d</strong>{recenciaMax !== '' && <> e ≤ <strong>{recenciaMax}d</strong></>}
            {' '}· <strong>{fmt(comTelefone.length)}</strong> com telefone
          </div>

          {/* Toggle modo template x texto livre */}
          <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
            <button type="button" onClick={() => setModo('template')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${modo === 'template' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600'}`}>
              <FileText className="w-4 h-4" /> Template aprovado
            </button>
            <button type="button" onClick={() => setModo('texto')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${modo === 'texto' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600'}`}>
              <MessageSquare className="w-4 h-4" /> Texto livre
            </button>
          </div>

          {modo === 'template' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="tpl-select" className="text-xs text-gray-500">Template do WhatsApp (aprovados na Umbler)</label>
                <div className="flex items-center gap-2 mt-1">
                  <select id="tpl-select" value={templateId} onChange={(e) => escolherTemplate(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <option value="">{templatesLoading ? 'Carregando…' : 'Selecione um template…'}</option>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.label}{t.category ? ` (${t.category})` : ''}</option>)}
                  </select>
                  {templatesLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>
                {templatesErro && <p className="text-xs text-red-600 mt-1">{templatesErro}</p>}
                {!templatesLoading && !templatesErro && templates.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Nenhum template aprovado encontrado. Aprove um na Umbler primeiro.</p>
                )}
              </div>

              {templateSel && (
                <div className="text-sm bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 space-y-2">
                  {templateSel.header && <p className="font-semibold">{templateSel.header}</p>}
                  <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{templateSel.content}</p>
                  {templateSel.footer && <p className="text-xs text-gray-400">{templateSel.footer}</p>}
                  {templateVars.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                      <p className="text-xs text-gray-500">Valores das variáveis (use <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded">{'{primeiro_nome}'}</code> pra personalizar por cliente):</p>
                      {templateVars.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono w-14 shrink-0">{`{{${i + 1}}}`}</span>
                          <input value={val} onChange={(e) => setTemplateVars((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                            placeholder={templateSel.variables?.[i]?.example || 'valor'}
                            className="flex-1 px-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="msg-disparo" className="text-xs text-gray-500">
                Mensagem livre. Use <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded">{'{primeiro_nome}'}</code> ou <code className="px-1 bg-gray-100 dark:bg-gray-800 rounded">{'{nome}'}</code> pra personalizar. (Só funciona pra quem tem conversa aberta nas últimas 24h — pra contato frio, use template.)
              </label>
              <textarea id="msg-disparo" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4}
                placeholder="Ex.: Oi {primeiro_nome}! Faz tempo que a gente não te vê 😢 Bora marcar sua volta? ..."
                className="mt-1 w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={simular} disabled={simulando}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40">
              {simulando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Simular (prévia)
            </button>
            <button type="button" onClick={() => setConfirmar(true)}
              disabled={disparando || !podeDisparar}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40">
              {disparando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Disparar de verdade
            </button>
          </div>

          {simulacao && !simulacao.error && (
            <div className="text-sm bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 space-y-2">
              <p className="font-medium">Prévia: {fmt(simulacao.total)} envios{simulacao.truncado ? ' (limitado a 500 — estreite o filtro)' : ''}</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(simulacao.por_segmento || {}).map(([n, q]: any) => (
                  <Badge key={n} className={SEG_META[n]?.badge || ''}>{n}: {fmt(q)}</Badge>
                ))}
              </div>
              {simulacao.amostra?.[0] && (
                <p className="text-xs text-gray-500 italic border-l-2 border-rose-400 pl-2">
                  Exemplo p/ {simulacao.amostra[0].nome || 'cliente'}: “{simulacao.amostra[0].preview}”
                </p>
              )}
            </div>
          )}
          {simulacao?.error && <p className="text-sm text-red-600">{simulacao.error}</p>}

          {resultado && !resultado.error && (
            <div className="text-sm bg-emerald-50 dark:bg-emerald-900/20 rounded-md p-3 space-y-2">
              <p className="font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Disparo concluído: {fmt(resultado.enviados)} enviados, {fmt(resultado.falhas)} falhas
              </p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(resultado.enviados_por_segmento || {}).map(([n, q]: any) => (
                  <Badge key={n} className={SEG_META[n]?.badge || ''}>{n}: {fmt(q)}</Badge>
                ))}
              </div>
              {resultado.erros?.length > 0 && (
                <p className="text-xs text-red-500">Primeiras falhas: {resultado.erros.slice(0, 3).map((e: any) => e.erro).join(' · ')}</p>
              )}
              <p className="text-xs text-gray-500">Cada envio foi marcado por segmento (campanha {String(resultado.campanha_id).slice(0, 8)}…) pra medir a ação depois.</p>
            </div>
          )}
          {resultado?.error && <p className="text-sm text-red-600">{resultado.error}</p>}
        </Card>
      )}

      {/* Tabela */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Top clientes por valor ({fmt(filtrada.length)})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Telefone</th>
                <th className="text-left py-2">Segmento</th>
                <th className="text-right py-2">Visitas</th>
                <th className="text-right py-2">Dias sem vir</th>
                <th className="text-left py-2">Última visita</th>
                <th className="text-right py-2">Ticket méd.</th>
                <th className="text-right py-2">Total gasto</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((c) => (
                <tr key={c.cliente_fone_norm} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2">{c.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</td>
                  <td className="py-2 text-xs font-mono text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.cliente_fone_norm}</td>
                  <td className="py-2"><Badge className={`${SEG_META[c.segmento]?.badge || ''} text-[10px]`}>{c.segmento}</Badge></td>
                  <td className="py-2 text-right tabular-nums">{c.frequencia}</td>
                  <td className="py-2 text-right tabular-nums text-amber-600">{c.recencia_dias}d</td>
                  <td className="py-2 text-xs text-gray-500">{fmtData(c.ultima_visita)}</td>
                  <td className="py-2 text-right tabular-nums text-xs">{fmtBRL(Number(c.ticket_medio))}</td>
                  <td className="py-2 text-right tabular-nums font-semibold text-emerald-600">{fmtBRL(Number(c.monetario))}</td>
                </tr>
              ))}
              {filtrada.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">Sem clientes neste filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de confirmação do disparo */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-rose-600"><AlertTriangle className="w-5 h-5" /> Confirmar disparo</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vai enviar WhatsApp de verdade para <strong>{fmt(comTelefone.length)}</strong> clientes
              ({segSel.join(', ') || 'nenhum segmento'}). Essa ação não tem volta.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(false)}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button type="button" onClick={disparar}
                className="px-3 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700">Sim, disparar</button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
