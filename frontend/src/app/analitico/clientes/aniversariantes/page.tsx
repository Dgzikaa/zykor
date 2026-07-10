'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Cake, Phone, Calendar, Download, Send, Loader2, AlertTriangle, CheckCircle2, X, FileText, MessageSquare } from 'lucide-react';
import { exportarCSV } from '@/lib/utils/export-csv';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(n);
const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
const fmtData = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

// Ordem/rank dos níveis (item 2: ouro primeiro, depois prata, depois bronze).
// Diamante fica acima de ouro (nível mais alto); sem_nivel por último.
const NIVEL_ORDER = ['diamante', 'ouro', 'prata', 'bronze', 'sem_nivel'] as const;
type Nivel = (typeof NIVEL_ORDER)[number];
const NIVEL_RANK: Record<string, number> = { diamante: 0, ouro: 1, prata: 2, bronze: 3, sem_nivel: 4 };

const nivelMeta: Record<Nivel, { label: string; icon: string; badge: string; card: string }> = {
  diamante: { label: 'Diamante', icon: '💎', badge: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300', card: 'border-cyan-400' },
  ouro: { label: 'Ouro', icon: '🥇', badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300', card: 'border-yellow-400' },
  prata: { label: 'Prata', icon: '🥈', badge: 'bg-gray-400/15 text-gray-700 dark:text-gray-300', card: 'border-gray-400' },
  bronze: { label: 'Bronze', icon: '🥉', badge: 'bg-orange-700/15 text-orange-700 dark:text-orange-300', card: 'border-orange-400' },
  sem_nivel: { label: 'Sem nível', icon: '○', badge: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400', card: 'border-gray-300' },
};

type SortBy = 'nivel' | 'aniversario' | 'visitas' | 'gasto';
const sortLabel: Record<SortBy, string> = {
  nivel: 'Nível (ouro → bronze)',
  aniversario: 'Data do aniversário',
  visitas: 'Mais visitas',
  gasto: 'Maior gasto',
};

export default function AniversariantesPage() {
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);

  // Filtros / ordenação (itens 1, 2, 4)
  const [niveisSel, setNiveisSel] = useState<string[]>([]);
  const [apenas7, setApenas7] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>('nivel');

  // Disparo (item 3)
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
    setPageTitle('🎂 Aniversariantes');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    if (!selectedBar?.id) return;
    setLoading(true);
    setSimulacao(null);
    setResultado(null);
    fetch(`/api/aniversariantes?bar_id=${selectedBar.id}&dias=${dias}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [selectedBar?.id, dias]);

  const list: any[] = useMemo(() => data?.aniversariantes || [], [data]);
  const s = data?.stats || {};
  const porNivel: Record<string, number> = s.por_nivel || {};

  const hoje7 = useMemo(() => new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], []);

  const toggleNivel = (n: string) =>
    setNiveisSel(prev => (prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]));

  const filtrada = useMemo(() => {
    let arr = list;
    if (niveisSel.length) arr = arr.filter(a => niveisSel.includes(a.nivel || 'sem_nivel'));
    if (apenas7) arr = arr.filter(a => a.proximo_aniver <= hoje7);
    const cmp: Record<SortBy, (a: any, b: any) => number> = {
      nivel: (a, b) => (NIVEL_RANK[a.nivel] ?? 9) - (NIVEL_RANK[b.nivel] ?? 9) || a.proximo_aniver.localeCompare(b.proximo_aniver),
      aniversario: (a, b) => a.proximo_aniver.localeCompare(b.proximo_aniver) || (NIVEL_RANK[a.nivel] ?? 9) - (NIVEL_RANK[b.nivel] ?? 9),
      visitas: (a, b) => Number(b.total_visitas || 0) - Number(a.total_visitas || 0),
      gasto: (a, b) => Number(b.valor_total_consumo || 0) - Number(a.valor_total_consumo || 0),
    };
    return [...arr].sort(cmp[sortBy]);
  }, [list, niveisSel, apenas7, sortBy, hoje7]);

  const comTelefone = filtrada.filter(a => a.cliente_fone_norm);
  const niveisEfetivos = niveisSel.length ? niveisSel : [...NIVEL_ORDER];

  const templateSel = useMemo(() => templates.find(t => t.id === templateId) || null, [templates, templateId]);

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
  // Se a variável parece ser nome, sugere o token {primeiro_nome}; senão usa o exemplo.
  const escolherTemplate = (id: string) => {
    setTemplateId(id);
    setSimulacao(null);
    setResultado(null);
    const t = templates.find(x => x.id === id);
    const vars: any[] = t?.variables || [];
    setTemplateVars(vars.map((v: any) => {
      const dica = `${v?.name || ''} ${v?.example || ''}`.toLowerCase();
      if (/nome|name|cliente|first/.test(dica)) return '{primeiro_nome}';
      return v?.example || '';
    }));
  };

  const proximos7 = filtrada.filter(a => a.proximo_aniver <= hoje7).slice(0, 30);

  const exportar = () => {
    exportarCSV('aniversariantes', filtrada as Record<string, unknown>[], [
      { key: 'proximo_aniver', label: 'Aniversário' },
      { key: 'cliente_nome', label: 'Cliente' },
      { key: 'cliente_fone_norm', label: 'Telefone' },
      { key: 'idade', label: 'Idade' },
      { key: 'nivel', label: 'Nível' },
      { key: 'total_visitas', label: 'Visitas' },
      { key: 'ultima_visita', label: 'Última visita' },
      { key: 'dias_inativo', label: 'Dias inativo' },
      { key: 'valor_total_consumo', label: 'Gasto histórico', format: v => Number(v ?? 0).toFixed(2) },
      { key: 'ticket_medio_consumo', label: 'Ticket médio', format: v => Number(v ?? 0).toFixed(2) },
    ]);
  };

  const payloadMensagem = () =>
    modo === 'template'
      ? { template_id: templateId, template_label: templateSel?.label, params: templateVars }
      : { message: mensagem };

  const podeDisparar =
    comTelefone.length > 0 &&
    (modo === 'template' ? !!templateId : mensagem.trim().length >= 5);

  const simular = async () => {
    if (!selectedBar?.id) return;
    setSimulando(true);
    setSimulacao(null);
    setResultado(null);
    try {
      const r = await api.post('/api/umbler/disparo-segmento', {
        bar_id: selectedBar.id, dias, niveis: niveisEfetivos, apenas_proximos7: apenas7,
        ...payloadMensagem(), dry_run: true,
      });
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
      const r = await api.post('/api/umbler/disparo-segmento', {
        bar_id: selectedBar.id, dias, niveis: niveisEfetivos, apenas_proximos7: apenas7,
        ...payloadMensagem(), dry_run: false,
      });
      setResultado(r);
    } catch (e: any) {
      setResultado({ error: e?.message || 'Erro ao disparar' });
    } finally {
      setDisparando(false);
    }
  };

  if (loading) return <main className="max-w-7xl mx-auto px-6 py-8"><Skeleton className="h-96" /></main>;

  const filtroAtivo = niveisSel.length > 0 || apenas7;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Cake className="w-6 h-6 text-pink-600" /> Aniversariantes</h1>
          <p className="text-sm text-gray-500">
            Clientes recorrentes (≥2 visitas) fazendo aniversário. Clique nos níveis pra filtrar e dispare por WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={exportar} disabled={filtrada.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-emerald-600 text-white disabled:opacity-40 hover:bg-emerald-700">
            <Download className="w-4 h-4" /> Exportar ({filtrada.length})
          </button>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value, 10))}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
            <option value={7}>Próximos 7d</option>
            <option value={30}>Próximos 30d</option>
            <option value={90}>Próximos 90d</option>
          </select>
        </div>
      </div>

      {/* Cards de resumo — clicáveis (item 1) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button type="button" onClick={() => { setNiveisSel([]); setApenas7(false); }}
          className={`text-left ${!filtroAtivo ? 'ring-2 ring-pink-500 rounded-xl' : ''}`}>
          <Card className="p-4 h-full hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
            <p className="text-xs text-gray-500">Total {filtroAtivo ? '(limpar filtro)' : ''}</p>
            <p className="text-2xl font-bold">{fmt(s.total ?? 0)}</p>
          </Card>
        </button>
        <button type="button" onClick={() => setApenas7(v => !v)}
          className={`text-left ${apenas7 ? 'ring-2 ring-pink-500 rounded-xl' : ''}`}>
          <Card className="p-4 h-full border-l-4 border-l-pink-500 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
            <p className="text-xs text-gray-500">Esta semana</p>
            <p className="text-2xl font-bold text-pink-600">{fmt(s.esta_semana ?? 0)}</p>
          </Card>
        </button>
        <button type="button" onClick={() => setNiveisSel(['ouro', 'diamante'])}
          className={`text-left ${niveisSel.length === 2 && niveisSel.includes('ouro') && niveisSel.includes('diamante') ? 'ring-2 ring-pink-500 rounded-xl' : ''}`}>
          <Card className="p-4 h-full hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
            <p className="text-xs text-gray-500">VIPs (Ouro + Diamante)</p>
            <p className="text-2xl font-bold text-yellow-600">{fmt(s.vips ?? 0)}</p>
          </Card>
        </button>
        <button type="button" onClick={() => setSortBy('gasto')}
          className={`text-left ${sortBy === 'gasto' ? 'ring-2 ring-pink-500 rounded-xl' : ''}`}>
          <Card className="p-4 h-full hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
            <p className="text-xs text-gray-500">Gasto histórico (ordenar)</p>
            <p className="text-2xl font-bold">{fmtBRL(s.gasto_total ?? 0)}</p>
          </Card>
        </button>
      </div>

      {/* Cards por nível — clicáveis multi (itens 1, 2, 4) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {NIVEL_ORDER.map(n => {
          const meta = nivelMeta[n];
          const ativo = niveisSel.includes(n);
          const qtd = porNivel[n] || 0;
          return (
            <button key={n} type="button" onClick={() => toggleNivel(n)}
              className={`p-4 rounded-lg border-2 text-left transition-all hover:scale-[1.02] ${meta.card} ${ativo ? 'ring-2 ring-pink-500 bg-pink-50/50 dark:bg-pink-900/10' : 'bg-white dark:bg-gray-900'}`}>
              <p className="text-sm font-medium flex items-center gap-1.5">{meta.icon} {meta.label}</p>
              <p className="text-2xl font-bold">{fmt(qtd)}</p>
            </button>
          );
        })}
      </div>

      {/* Barra de ordenação/filtro (item 4) */}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <span className="text-gray-500">Ordenar por:</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
          className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
          {(Object.keys(sortLabel) as SortBy[]).map(k => <option key={k} value={k}>{sortLabel[k]}</option>)}
        </select>
        {filtroAtivo && (
          <button type="button" onClick={() => { setNiveisSel([]); setApenas7(false); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
        <span className="text-gray-400">
          {fmt(filtrada.length)} clientes · {fmt(comTelefone.length)} com telefone
        </span>
        <button type="button" onClick={() => setDisparoAberto(v => !v)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-pink-600 text-white hover:bg-pink-700">
          <Send className="w-4 h-4" /> Disparar WhatsApp
        </button>
      </div>

      {/* Painel de disparo (item 3) */}
      {disparoAberto && (
        <Card className="p-5 border-2 border-pink-300 dark:border-pink-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Send className="w-4 h-4 text-pink-600" /> Disparo por WhatsApp (Umbler)</h2>
            <button type="button" onClick={() => setDisparoAberto(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400">
            Alvo: <strong>{niveisSel.length ? niveisSel.map(n => nivelMeta[n as Nivel]?.label).join(', ') : 'todos os níveis'}</strong>
            {apenas7 && <> · <strong>só próximos 7 dias</strong></>}
            {' '}· janela de <strong>{dias} dias</strong> · <strong>{fmt(comTelefone.length)}</strong> com telefone
          </div>

          {/* Toggle modo template x texto livre */}
          <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden text-sm">
            <button type="button" onClick={() => setModo('template')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${modo === 'template' ? 'bg-pink-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600'}`}>
              <FileText className="w-4 h-4" /> Template aprovado
            </button>
            <button type="button" onClick={() => setModo('texto')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${modo === 'texto' ? 'bg-pink-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-600'}`}>
              <MessageSquare className="w-4 h-4" /> Texto livre
            </button>
          </div>

          {modo === 'template' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="tpl-select" className="text-xs text-gray-500">Template do WhatsApp (aprovados na Umbler)</label>
                <div className="flex items-center gap-2 mt-1">
                  <select id="tpl-select" value={templateId} onChange={e => escolherTemplate(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <option value="">{templatesLoading ? 'Carregando…' : 'Selecione um template…'}</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.label}{t.category ? ` (${t.category})` : ''}</option>)}
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
                          <input value={val} onChange={e => setTemplateVars(prev => prev.map((v, idx) => idx === i ? e.target.value : v))}
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
              <textarea id="msg-disparo" value={mensagem} onChange={e => setMensagem(e.target.value)} rows={4}
                placeholder="Ex.: Oi {primeiro_nome}! Vimos que seu aniversário está chegando 🎉 ..."
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
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-40">
              {disparando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Disparar de verdade
            </button>
          </div>

          {simulacao && !simulacao.error && (
            <div className="text-sm bg-gray-50 dark:bg-gray-900/40 rounded-md p-3 space-y-2">
              <p className="font-medium">Prévia: {fmt(simulacao.total)} envios{simulacao.truncado ? ' (limitado a 500 — estreite o filtro)' : ''}</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(simulacao.por_nivel || {}).map(([n, q]: any) => (
                  <Badge key={n} className={nivelMeta[n as Nivel]?.badge || ''}>{nivelMeta[n as Nivel]?.label || n}: {fmt(q)}</Badge>
                ))}
              </div>
              {simulacao.amostra?.[0] && (
                <p className="text-xs text-gray-500 italic border-l-2 border-pink-400 pl-2">
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
                {Object.entries(resultado.enviados_por_nivel || {}).map(([n, q]: any) => (
                  <Badge key={n} className={nivelMeta[n as Nivel]?.badge || ''}>{nivelMeta[n as Nivel]?.label || n}: {fmt(q)}</Badge>
                ))}
              </div>
              {resultado.erros?.length > 0 && (
                <p className="text-xs text-red-500">Primeiras falhas: {resultado.erros.slice(0, 3).map((e: any) => e.erro).join(' · ')}</p>
              )}
              <p className="text-xs text-gray-500">Cada envio foi marcado por nível (campanha {String(resultado.campanha_id).slice(0, 8)}…) pra medir a ação depois.</p>
            </div>
          )}
          {resultado?.error && <p className="text-sm text-red-600">{resultado.error}</p>}
        </Card>
      )}

      {/* Próximos 7 dias */}
      {proximos7.length > 0 && (
        <Card className="p-4 border-l-4 border-l-pink-500">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-pink-600" /> 🎂 Próximos 7 dias — acionar agora</h2>
          <div className="space-y-2">
            {proximos7.map((a: any) => (
              <div key={a.cliente_fone_norm} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-800 rounded-md">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xs text-gray-500">{fmtData(a.proximo_aniver)}</p>
                    <p className="text-xs font-bold text-pink-600">{a.idade} anos</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</p>
                    <p className="text-[10px] text-gray-500 font-mono flex items-center gap-1"><Phone className="w-3 h-3" />{a.cliente_fone_norm}</p>
                  </div>
                  {a.nivel && <Badge className={nivelMeta[a.nivel as Nivel]?.badge || 'bg-gray-200'}>{nivelMeta[a.nivel as Nivel]?.label || a.nivel}</Badge>}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs text-gray-500">{a.total_visitas} visitas</p>
                  <p className="text-sm font-semibold">{fmtBRL(Number(a.valor_total_consumo))}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabela */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Lista ({fmt(filtrada.length)})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Data</th>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Telefone</th>
                <th className="text-right py-2">Idade</th>
                <th className="text-left py-2">Nível</th>
                <th className="text-right py-2">Visitas</th>
                <th className="text-left py-2">Última visita</th>
                <th className="text-right py-2">Gasto histórico</th>
                <th className="text-right py-2">Ticket méd.</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((a: any) => (
                <tr key={a.cliente_fone_norm} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-2 text-pink-600 font-medium">{fmtData(a.proximo_aniver)}</td>
                  <td className="py-2">{a.cliente_nome || <span className="italic text-gray-400">sem nome</span>}</td>
                  <td className="py-2 text-xs font-mono text-gray-500">{a.cliente_fone_norm}</td>
                  <td className="py-2 text-right">{a.idade}</td>
                  <td className="py-2">{a.nivel ? <Badge className={`${nivelMeta[a.nivel as Nivel]?.badge || ''} text-[10px]`}>{nivelMeta[a.nivel as Nivel]?.label || a.nivel}</Badge> : <span className="text-xs text-gray-400">—</span>}</td>
                  <td className="py-2 text-right tabular-nums">{a.total_visitas}</td>
                  <td className="py-2 text-xs text-gray-500">
                    {a.ultima_visita ? fmtData(a.ultima_visita) : '—'}
                    {a.dias_inativo != null && <span className="text-gray-400"> ({a.dias_inativo}d)</span>}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtBRL(Number(a.valor_total_consumo))}</td>
                  <td className="py-2 text-right tabular-nums text-xs">{fmtBRL(Number(a.ticket_medio_consumo))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de confirmação do disparo */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-pink-600"><AlertTriangle className="w-5 h-5" /> Confirmar disparo</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vai enviar WhatsApp de verdade para <strong>{fmt(comTelefone.length)}</strong> clientes
              ({niveisSel.length ? niveisSel.map(n => nivelMeta[n as Nivel]?.label).join(', ') : 'todos os níveis'}). Essa ação não tem volta.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmar(false)}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
              <button type="button" onClick={disparar}
                className="px-3 py-2 text-sm rounded-md bg-pink-600 text-white hover:bg-pink-700">Sim, disparar</button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}
