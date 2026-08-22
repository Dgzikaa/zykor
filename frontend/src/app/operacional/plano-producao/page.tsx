'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageShell } from '@/components/layout/PageShell';
import { FiltroBarra, BuscaInput, SegFiltro, ChipFiltro, OrdemFiltro, cmpNome } from '@/components/filtros/FiltroBarra';
import { useModuloPermissao } from '@/hooks/useModuloPermissao';
import { BadgeSomenteLeitura } from '@/components/permissions/BadgeSomenteLeitura';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useBar } from '@/contexts/BarContext';
import { useApiSWR } from '@/hooks/useApiSWR';
import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, CalendarDays, Sparkles, RefreshCw, Play, Lock, Unlock, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Beer, X, HelpCircle } from 'lucide-react';

const fmtN = (v: any) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const comUni = (v: any, un?: string) => v == null ? '—' : `${fmtN(v)}${un ? ` ${un}` : ''}`; // número com unidade de medida
const fmtDM = (s: string) => s ? s.split('-').reverse().slice(0, 2).join('/') : '';
const secaoDe = (it: any) => (it.codigo || '').toLowerCase().startsWith('pd') ? 'Bar' : 'Cozinha';

// De/para Nível de Serviço → Fator de Serviço (z-score da normal), igual à planilha.
const NIVEIS = [50, 60, 70, 80, 85, 90, 95, 96, 97, 98, 99, 99.9];
const NIVEL_Z: Record<number, number> = { 50: 0, 60: 0.254, 70: 0.525, 80: 0.842, 85: 1.037, 90: 1.282, 95: 1.645, 96: 1.751, 97: 1.88, 98: 2.055, 99: 2.325, 99.9: 3.1 };
const zDe = (n: number) => NIVEL_Z[n] ?? 1.645;
const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// Ponto de Ressuprimento + Sugestão (fórmulas exatas da planilha do sócio).
// Devolve também as PARCELAS (margem/gap/extra/ae) — são elas que a explicação
// "por que essa quantidade" mostra linha a linha p/ a cozinha.
function calcular(it: any) {
  // Fator de perda: a demanda do plano é TEÓRICA (vendas × ficha). Preparo com perda sistemática
  // (over-pour, batch refeito, sobra descartada) consome mais que isso e o PR fica curto TODA
  // semana. `k` escala a demanda inteira — média e margem — mantendo o Nível de Serviço fazendo
  // só o papel dele, que é cobrir a VARIAÇÃO entre semanas. Tem que bater com o `calcular` da
  // rota: os dois números aparecem na mesma tela.
  const k = 1 + (Number(it.fator_perda_pct) || 0) / 100;
  // Lead: o estoque é a contagem de SEGUNDA, mas a produção acontece dias depois. Sem cobrir essa
  // defasagem, os dias entre contagem e produção comem o estoque que o plano contou como
  // disponível — foi o que zerou o xarope de gengibre em 17/08 mesmo seguindo a sugestão.
  const janela = (7 + Math.max(0, Number(it.dias_ate_produzir) || 0)) / 7;
  const mediaAj = it.media6 * janela * k;
  const margem = it.desvpad * zDe(it.nivel_servico) * k; // folga de segurança do PR
  const pr = mediaAj + margem; // média já vem ponderada do servidor
  const gap = pr - it.estoque;
  const extra = gap < 0 ? 0 : mediaAj * ((it.semanas_receita || 1) - 1); // cada semana extra repõe a Média6s (não o PR cheio)
  const ae = gap + extra;
  const naoProduzir = ae <= 0;
  const receitas = !naoProduzir && it.rend_contagem > 0 ? Math.ceil(ae / it.rend_contagem) : 0;
  const sugestaoQtd = receitas * it.rend_contagem;
  const diasEstoque = it.media6 > 0 ? it.estoque / (it.media6 / 6) : null; // ÷6, igual à planilha
  return { pr, mediaAj, margem, gap, extra, ae, naoProduzir, receitas, sugestaoQtd, diasEstoque };
}
// Mesmas parcelas p/ a semana ENCERRADA (snapshot): não recalcula nada, só reabre
// os números congelados na conta que os gerou.
function parcelasFrozen(it: any) {
  const k = 1 + (Number(it.fator_perda_pct) || 0) / 100;
  const mediaAj = it.media6 * ((7 + Math.max(0, Number(it.dias_ate_produzir) || 0)) / 7) * k;
  const margem = it.pr - mediaAj;
  const gap = it.pr - it.estoque;
  const extra = gap < 0 ? 0 : mediaAj * ((it.semanas_receita || 1) - 1);
  return { mediaAj, margem, gap, extra, ae: gap + extra };
}

export default function PlanoProducaoPage() {
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const { soLeitura } = useModuloPermissao('/operacional/plano-producao');
  const { setPageTitle } = usePageTitle();
  useEffect(() => { setPageTitle('👨‍🍳 Planejamento da Produção'); return () => setPageTitle(''); }, [setPageTitle]);
  const barId = selectedBar?.id;
  const [res, setRes] = useState<any | null>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState<'Cozinha' | 'Bar'>('Cozinha'); // planejamento separado Cozinha × Bar
  const [filtroProd, setFiltroProd] = useState<'todos' | 'produzir' | 'nao'>('todos');
  const [soSemDia, setSoSemDia] = useState(false); // toggle independente: só itens sem dia cadastrado (combina com Produzir)
  const [soCurvaA, setSoCurvaA] = useState(false); // curva A = o que se conta todo dia
  // Ordem: padrão continua "maior sugestão" (o que a reunião ataca primeiro); A–Z pra PROCURAR
  // uma produção específica na lista (pedido do Isaías, 04/08).
  const [ordem, setOrdem] = useState<'sugestao' | 'az'>('sugestao');
  const [aberto, setAberto] = useState<number | null>(null); // linha expandida (6 semanas)
  const [semanaSel, setSemanaSel] = useState<string | null>(null); // semana escolhida (null = mais recente)
  const [salvando, setSalvando] = useState(false);
  const [diaModal, setDiaModal] = useState<any | null>(null); // produção com o modal de dias aberto
  const [modalDias, setModalDias] = useState<Record<string, string>>({}); // iso → receitas (digitado)

  // Cache via SWR: a chave inclui bar + semana selecionada; trocar re-busca. mutate() = refetch pós-edição.
  const { data: swrRes, isValidating: loading, mutate } = useApiSWR<any>(
    barId ? `/api/operacional/plano-producao${semanaSel ? `?semana=${encodeURIComponent(semanaSel)}` : ''}` : null
  );
  // itens é uma cópia local editável (patchItem faz UI otimista); semeia do servidor só em success, igual ao carregar antigo.
  useEffect(() => {
    if (swrRes?.success) { setRes(swrRes); setItens(swrRes.itens || []); }
  }, [swrRes]);
  // "Atualizar estoque" = PUXAR A PLANILHA de contagem e só então re-buscar o plano.
  // Antes o botão só fazia `mutate()` (re-fetch da própria API): quem acabava de contar no
  // Sheets clicava e nada mudava — o estoque só entrava na hora do cron. Agora roda o mesmo
  // sync da tela de Estoque/Desvios (últimos 14 dias, aba INSUMOS) antes do refetch.
  const [sincronizando, setSincronizando] = useState(false);
  const carregar = useCallback(async () => {
    if (!barId) { mutate(); return; }
    setSincronizando(true);
    try {
      const r = await api.post('/api/operacional/estoque-historico', { action: 'sync' });
      if (!r.success) throw new Error(r.error);
      toast({ title: 'Estoque atualizado', description: `${r.upserted ?? 0} linhas da planilha de contagem` });
    } catch (e: any) {
      toast({ title: 'Erro ao atualizar estoque', description: e?.message, variant: 'destructive' });
    } finally {
      setSincronizando(false);
      await mutate(); // refaz as sugestões com o estoque novo (mesmo se o sync falhar)
    }
  }, [barId, mutate, toast]);

  const semanaAtual = semanaSel ?? res?.semana_sel ?? null; // semana em foco

  const plano = res?.planos?.[aba] || null; // sessão da aba atual (Cozinha × Bar são independentes)
  const emRascunho = plano?.status === 'rascunho';
  const encerrado = plano?.status === 'encerrado';

  // dias da próxima semana p/ a calendarização (value = ISO, label = "Ter 01/07")
  const diasOpcoes = useMemo(() => {
    if (!res?.semana?.ini) return [];
    const [y, m, d] = res.semana.ini.split('-').map(Number);
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(Date.UTC(y, m - 1, d + i));
      const iso = dt.toISOString().slice(0, 10);
      return { iso, label: `${DIAS_SEMANA[i]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}` };
    });
  }, [res]);

  // iso → abreviação do dia (Seg, Ter…) da semana em foco, p/ exibir a distribuição
  const diaAbrev = useMemo(() => new Map(diasOpcoes.map((d, i) => [d.iso, DIAS_SEMANA[i]])), [diasOpcoes]);
  // distribuição por dia de um item (multi-dia); cai no dia_producao legado se não houver
  const diasDoItem = (it: any): { dia: string; receitas: number }[] => {
    if (it.dias && it.dias.length) return it.dias.map((d: any) => ({ dia: d.dia, receitas: Number(d.decidido_receitas) || 0 }));
    if (it.decisao?.dia_producao) return [{ dia: it.decisao.dia_producao, receitas: Number(it.decisao?.decidido_receitas ?? it.receitas) || 0 }];
    return [];
  };

  const patchItem = (id: number, patch: any) => setItens((prev) => prev.map((i) => i.producao_id === id ? { ...i, ...patch } : i));

  // ---- salvamentos ----
  const salvarConfig = async (it: any, campo: 'nivel_servico' | 'semanas_receita' | 'fator_perda_pct' | 'dias_ate_produzir', valor: number) => {
    patchItem(it.producao_id, { [campo]: valor });
    await api.post('/api/operacional/plano-producao', { action: 'config', producao_id: it.producao_id, producao_cod: it.codigo, [campo]: valor });
  };
  const toggleFlag = async (it: any) => {
    const novo = !it.controle_producao;
    patchItem(it.producao_id, { controle_producao: novo });
    await api.post('/api/operacional/plano-producao', { action: 'flag', producao_id: it.producao_id, controle_producao: novo });
  };
  const salvarDecisao = async (it: any, patch: any) => {
    const novaDec = { ...(it.decisao || {}), ...patch };
    patchItem(it.producao_id, { decisao: novaDec });
    if (!plano?.id) return;
    const c = calcular(it);
    const decididoReceitas = novaDec.decidido_receitas != null ? Number(novaDec.decidido_receitas) : c.receitas;
    await api.post('/api/operacional/plano-producao', {
      action: 'decidir', plano_id: plano.id, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
      media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, ponto_ressupr: c.pr, estoque: it.estoque,
      sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas,
      decidido_receitas: decididoReceitas, decidido_qtd: decididoReceitas * it.rend_contagem,
      seguiu_sugestao: decididoReceitas === c.receitas, motivo_override: novaDec.motivo_override ?? null,
      dia_producao: novaDec.dia_producao ?? null,
    });
  };
  // abre o modal de dias com a distribuição atual pré-preenchida
  const abrirDias = (it: any) => {
    const atual: Record<string, string> = {};
    for (const d of diasDoItem(it)) if (d.receitas > 0) atual[d.dia] = String(d.receitas);
    setModalDias(atual);
    setDiaModal(it);
  };
  const toggleDiaModal = (iso: string, on: boolean) =>
    setModalDias(prev => { const n = { ...prev }; if (on) n[iso] = n[iso] ?? '1'; else delete n[iso]; return n; });
  const totalModal = useMemo(() => Object.values(modalDias).reduce((s, v) => s + (Number(v) || 0), 0), [modalDias]);
  // grava a distribuição por dia (action decidir_dias) — o item-pai vira o total
  const salvarDias = async () => {
    const it = diaModal;
    if (!it || !plano?.id) return;
    const c = calcular(it);
    const dias = Object.entries(modalDias).map(([dia, v]) => ({ dia, receitas: Number(v) || 0 })).filter(d => d.receitas > 0);
    setSalvando(true);
    try {
      const r = await api.post('/api/operacional/plano-producao', {
        action: 'decidir_dias', plano_id: plano.id, producao_id: it.producao_id, producao_cod: it.codigo, producao_nome: it.nome,
        media6: it.media6, desvpad: it.desvpad, nivel_servico: it.nivel_servico, ponto_ressupr: c.pr, estoque: it.estoque,
        sugestao_qtd: c.sugestaoQtd, sugestao_receitas: c.receitas, rend_contagem: it.rend_contagem, dias,
      });
      if (!r.success) { if (r.error) alert(r.error); return; }
      setDiaModal(null);
      await carregar();
    } catch (e: any) {
      alert(e?.message || 'Não foi possível salvar. Tente novamente.');
    } finally { setSalvando(false); }
  };

  const acao = async (action: string, extra: any = {}) => {
    setSalvando(true);
    try {
      const r = await api.post('/api/operacional/plano-producao', { action, ...extra });
      if (!r.success && r.error) alert(r.error);
      await carregar();
    } catch (e: any) {
      // api.post LANÇA em qualquer erro (403/409/500 ou 401 "Sessão expirada"). Sem este catch,
      // o clique falhava calado ("clico e não vai, sem erro") — agora mostra o motivo.
      alert(e?.message || 'Não foi possível concluir a ação. Tente novamente.');
    } finally { setSalvando(false); }
  };

  // Cascata de demanda dependente ("massa baseada na sugestão da porção"):
  // consumo planejado de cada preparo = Σ (receitas planejadas do pai × qtd do filho por receita).
  // Receitas do pai = o que foi decidido (senão a sugestão). Um nível por vez — recalcula
  // ao vivo conforme as decisões mudam, então a cadeia croquete→massa→carne converge na reunião.
  // Guarda também o DETALHE (quais produções-pai puxam este preparo, e quanto cada uma),
  // que é o que permite achar ficha técnica errada olhando a explicação da sugestão.
  const consumoMap = useMemo(() => {
    const m = new Map<number, number>();
    const det = new Map<number, { pai: string; receitas: number; qtd_receita: number; total: number }[]>();
    const nomeById = new Map<number, string>(itens.map((it) => [it.producao_id, it.nome]));
    const recById = new Map<number, number>(itens.map((it) => {
      const dec = it.decisao?.decidido_receitas;
      const base = it.frozen ? it.sugestao_receitas : calcular(it).receitas;
      return [it.producao_id, dec != null ? Number(dec) : base];
    }));
    (res?.bom || []).forEach((b: any) => {
      const rec = recById.get(b.pai) || 0;
      if (rec <= 0) return;
      const total = rec * b.qtd_receita;
      m.set(b.filho, (m.get(b.filho) || 0) + total);
      const arr = det.get(b.filho) || [];
      arr.push({ pai: nomeById.get(b.pai) || `#${b.pai}`, receitas: rec, qtd_receita: b.qtd_receita, total });
      det.set(b.filho, arr);
    });
    return { total: m, detalhe: det };
  }, [itens, res]);

  // recalcula derivados + aplica filtros/ordenação
  const linhas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return itens
      .map((it) => {
        // semana congelada (encerrada): usa os valores do snapshot, não recalcula
        const calc = it.frozen
          ? { pr: it.pr, ...parcelasFrozen(it), naoProduzir: it.nao_produzir, receitas: it.sugestao_receitas, sugestaoQtd: it.sugestao_qtd, diasEstoque: it.media6 > 0 ? it.estoque / (it.media6 / 6) : null }
          : calcular(it);
        const consumo = it.frozen ? (it.consumo || 0) : (consumoMap.total.get(it.producao_id) || 0);
        const consumoDet = consumoMap.detalhe.get(it.producao_id) || [];
        const planejadoQtd = it.decisao?.decidido_receitas != null ? Number(it.decisao.decidido_receitas) * it.rend_contagem : calc.sugestaoQtd;
        const falta = consumo > 0 ? Math.max(0, consumo - (it.estoque + planejadoQtd)) : 0; // não cobre a produção dos pais
        return { ...it, ...calc, consumo, consumoDet, falta };
      })
      .filter((i) => i.controle_producao                                  // a tela só mostra o que está no Controle de Produção
        && secaoDe(i) === aba                                             // aba Cozinha × Bar
        && (filtroProd === 'todos'
          || (filtroProd === 'produzir' && !i.naoProduzir)
          || (filtroProd === 'nao' && i.naoProduzir))
        && (!soSemDia || !(i.dias?.length || i.decisao?.dia_producao))       // sem dia cadastrado (multi-dia ou legado)
        && (!soCurvaA || i.curva_a)
        && (!s || (i.nome || '').toLowerCase().includes(s) || (i.codigo || '').toLowerCase().includes(s)))
      .sort((a, b) => ordem === 'az' ? cmpNome(a.nome, b.nome) : b.sugestaoQtd - a.sugestaoQtd);
  }, [itens, busca, aba, filtroProd, soSemDia, soCurvaA, ordem, consumoMap]);

  const totProduzir = useMemo(() => linhas.filter((i) => !i.naoProduzir).length, [linhas]);
  const totReceitas = useMemo(() => linhas.reduce((s, i) => s + (emRascunho || encerrado ? Number(i.decisao?.decidido_receitas ?? i.receitas) : i.receitas), 0), [linhas, emRascunho, encerrado]);

  const contagemOk = !!res?.contagem?.data;
  const planejando = emRascunho || encerrado;
  const nCols = planejando ? 13 : 11; // colunas da tabela (com/sem Decidido+Dia)
  const semanaEhAtiva = !!semanaAtual && semanaAtual === res?.semana_ativa; // só a semana ativa é planejável; anteriores = consulta

  const cancelar = async () => {
    if (!plano?.id) return;
    if (!window.confirm(`Cancelar o planejamento de ${aba} desta semana? Tudo que foi decidido será apagado.`)) return;
    await acao('cancelar', { plano_id: plano.id });
  };

  return (
    <PageShell width="wide">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/30 rounded-xl"><ChefHat className="w-6 h-6 text-violet-600 dark:text-violet-400" /></div>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">{soLeitura && <BadgeSomenteLeitura />}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ponto de Ressuprimento = média 6 semanas + desvio padrão × fator de serviço · {selectedBar?.nome || ''}</p>
          </div>
          <button onClick={carregar} disabled={sincronizando}
            title="Puxa a contagem da planilha (últimos 14 dias) e refaz as sugestões"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${sincronizando || loading ? 'animate-spin' : ''}`} />{sincronizando ? 'Atualizando…' : 'Atualizar estoque'}</button>
        </div>

        {/* Status da sessão + ações */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {res?.semanas_disponiveis && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-3 py-1"><CalendarDays className="w-4 h-4" />Semana:
            <select value={semanaAtual ?? ''} onChange={e => { setSemanaSel(e.target.value); setAberto(null); }} className="bg-transparent font-semibold outline-none cursor-pointer">
              {res.semanas_disponiveis.map((s: any) => <option key={s.ini} value={s.ini} disabled={!s.tem_contagem} className="text-gray-900">{fmtDM(s.ini)} – {fmtDM(s.fim)}{s.tem_contagem ? '' : ' (aguardando contagem)'}</option>)}
            </select>
          </span>}
          {(res?.eventos || []).length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-1"><Sparkles className="w-4 h-4" />{res.eventos.map((e: any) => e.nome).join(', ')}</span>}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${contagemOk ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>{contagemOk ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}Contagem: {contagemOk ? fmtDM(res.contagem.data) : 'pendente'}</span>

          <div className="flex-1" />

          {!plano && (semanaEhAtiva
            ? <button disabled={!contagemOk || salvando} onClick={() => acao('iniciar', { area: aba, semana: semanaAtual })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"><Play className="w-4 h-4" />Iniciar planejamento ({aba})</button>
            : <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 px-3 py-1">Semana anterior — só consulta</span>)}
          {emRascunho && <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1">{aba} em planejamento (rascunho){!semanaEhAtiva && ' — semana anterior'}</span>
            {semanaEhAtiva && <button disabled={salvando} onClick={() => acao('encerrar', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"><Lock className="w-4 h-4" />Encerrar e calendarizar</button>}
            <button disabled={salvando} onClick={cancelar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"><X className="w-4 h-4" />Cancelar planejamento</button>
          </>}
          {encerrado && <><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1"><CheckCircle2 className="w-4 h-4" />Encerrado — foi pro Controle de Produção</span>{semanaEhAtiva && <button disabled={salvando} onClick={() => acao('reabrir', { plano_id: plano.id })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"><Unlock className="w-4 h-4" />Reabrir</button>}</>}
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Produções a fazer</div><div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{totProduzir}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">{planejando ? 'Receitas decididas' : 'Receitas sugeridas'}</div><div className="text-2xl font-bold">{totReceitas}</div></CardContent></Card>
          <Card className="card-dark"><CardContent className="py-3"><div className="text-xs text-muted-foreground uppercase">Itens no plano</div><div className="text-2xl font-bold">{linhas.length}</div></CardContent></Card>
        </div>

        {/* Abas Cozinha × Bar */}
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
          {(['Cozinha', 'Bar'] as const).map(a => (
            <button key={a} onClick={() => setAba(a)} className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px ${aba === a ? 'border-violet-600 text-violet-700 dark:text-violet-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {a === 'Cozinha' ? <ChefHat className="w-4 h-4" /> : <Beer className="w-4 h-4" />}{a}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <FiltroBarra>
          <BuscaInput value={busca} onChange={setBusca} placeholder="Buscar produção…" />
          <SegFiltro value={filtroProd} onChange={setFiltroProd} cor="violet" options={[['todos', 'Todos'], ['produzir', 'Produzir'], ['nao', 'Não produzir']] as const} />
          <ChipFiltro ativo={soCurvaA} onClick={() => setSoCurvaA(v => !v)}>Só Curva A</ChipFiltro>
          <ChipFiltro ativo={soSemDia} onClick={() => setSoSemDia(v => !v)} cor="violet" title="Combina com o filtro ao lado (ex.: Produzir + Sem dia)">Sem dia</ChipFiltro>
          <OrdemFiltro value={ordem} onChange={setOrdem} cor="violet" options={[['sugestao', 'Maior sugestão'], ['az', 'A–Z']] as const} />
        </FiltroBarra>

        {/* Tabela */}
        <Card className="card-dark overflow-hidden"><CardContent className="p-0"><div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase"><tr>
              <th className="text-left font-medium px-2 py-2">Produção</th>
              <th className="text-right font-medium px-2 py-2" title="Tudo que a VENDA da semana puxou deste preparo — o que vai direto na ficha do drink/prato E o que passa por dentro de outro preparo (espuma, refrigerante, pré-batch). O número menor embaixo é só a parte DIRETA. Clique p/ abrir as 6 semanas.">Uso Indireto</th>
              <th className="text-right font-medium px-2 py-2" title="Média ponderada do uso indireto das últimas 6 semanas — peso maior para a semana mais recente; semana em branco fica fora. Já inclui o que foi para dentro de outros preparos. Clique no valor para ver as semanas.">Média 6s</th>
              <th className="text-right font-medium px-2 py-2" title="Desvio padrão amostral das 6 semanas">Desv. padrão</th>
              <th className="text-center font-medium px-2 py-2" title="Define o fator de segurança do Ponto de Ressuprimento">Nível de Serviço</th>
              {/* Perda sistemática ≠ Nível de Serviço. O NS cobre a VARIAÇÃO entre semanas; a perda é
                  um VIÉS (o bar gasta mais do que a ficha diz, toda semana). Enfiar a perda no NS
                  faz o número certo pelo motivo errado e esconde a perda do Desvio. */}
              <th className="text-center font-medium px-2 py-2" title="% que o bar consome ACIMA da ficha, toda semana (over-pour, batch refeito, sobra descartada). Multiplica a demanda: PR = (média + margem) × (1 + perda). Deixe 0 quando o consumo real bate com a ficha. O número medido no histórico aparece embaixo — clique nele para aplicar.">Perda %</th>
              {/* Mafê (22/08/2026): "a planilha calcula de segunda a domingo, mas o cronograma de
                  produção do bar inicia na quarta". O estoque é a contagem de SEGUNDA; se a produção
                  só acontece na quinta, 3 dias de consumo somem antes de produzir. */}
              <th className="text-center font-medium px-2 py-2" title="Dias entre a contagem de segunda e o dia em que a produção acontece de fato. O PR passa a cobrir a defasagem + a semana, senão esses dias comem o estoque que o plano contou como disponível. 0 = produz no dia da contagem. O medido no histórico aparece embaixo — clique para aplicar.">Dias p/ produzir</th>
              <th className="text-center font-medium px-2 py-2" title="Quantas semanas de receita produzir de uma vez">Qtde x Semanas</th>
              <th className="text-right font-medium px-2 py-2" title="Ponto de Ressuprimento = média + desvio × fator de serviço">PR</th>
              <th className="text-right font-medium px-2 py-2" title="Última contagem (início da semana planejada)">Estoque Atual</th>
              <th className="text-right font-medium px-2 py-2" title="Estoque ÷ ritmo diário (÷6)">Dias de Estoque</th>
              {/* Isaías/Mafê (21/08/2026) somaram esta coluna EM CIMA do Uso Indireto e concluíram que
                  a sugestão estava 10 L curta. Não está: o valor daqui é um RECORTE de dentro do Uso
                  Indireto, não uma demanda a mais. Por isso o rótulo diz "dentro disso" e o título
                  abre com a frase que evita a soma. */}
              <th className="text-right font-medium px-2 py-2" title="JÁ ESTÁ DENTRO do Uso Indireto — não somar. É só o recorte de quanto deste preparo vai virar outro preparo (espuma, refrigerante, pré-batch) na produção planejada da semana. Serve de aviso: fica vermelho com ⚠ quando estoque + plano não cobrem.">Dentro disso: p/ outras produções</th>
              <th className="text-right font-medium px-2 py-2">Sugestão</th>
              {planejando && <th className="text-right font-medium px-2 py-2" title="O que foi decidido na reunião (receitas)">Decidido</th>}
              {planejando && <th className="text-center font-medium px-2 py-2">Dia</th>}
            </tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? <tr><td colSpan={nCols} className="px-3 py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              : linhas.length === 0 ? <tr><td colSpan={nCols} className="px-3 py-12 text-center text-gray-400">Sem produções no filtro.</td></tr>
              : linhas.map((it) => {
                const decidido = it.decisao?.decidido_receitas;
                const override = decidido != null && Number(decidido) !== it.receitas;
                const ultima = it.saidas?.length ? it.saidas[it.saidas.length - 1] : null;
                const ultimaDireta = it.saidas_diretas?.length ? it.saidas_diretas[it.saidas_diretas.length - 1] : null;
                const expandido = aberto === it.producao_id;
                return (
                <Fragment key={it.producao_id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-100 max-w-[180px]">
                    <span className="inline-flex items-start gap-1.5 leading-tight">
                      <button onClick={() => toggleFlag(it)} title={it.controle_producao ? 'Sai do controle de produção' : 'Entra no controle de produção'} className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${it.controle_producao ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                      {it.nome}{it.curva_a && <Badge variant="outline" className="text-[10px] text-indigo-600 border-indigo-300">A</Badge>}
                    </span>
                    {it.codigo && <span className="block text-[11px] text-gray-500 dark:text-gray-400 font-mono pl-4">{it.codigo}</span>}
                    <span className="block text-[11px] text-gray-400 pl-4">rende {comUni(it.rend_contagem, it.unidade)}/receita</span>
                  </td>
                  {/* Gonza (22/08): "preciso saber separadamente o quanto eu preciso para a saída
                      DIRETA". O de cima é o total (é ele que dimensiona); o de baixo é só a parte
                      escrita na ficha do produto vendido. Só aparece quando as duas divergem. */}
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {comUni(ultima, it.unidade)}
                    {ultimaDireta != null && ultima != null && Math.abs(ultima - ultimaDireta) > 0.005 && (
                      <span className="block text-[10px] text-gray-400" title="Parte que vai DIRETO na ficha do produto vendido — o resto atravessa outro preparo">
                        direta {comUni(ultimaDireta, it.unidade)}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    <button onClick={() => setAberto(expandido ? null : it.producao_id)} className="inline-flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-400" title="Ver as 6 semanas que formam a média">
                      {expandido ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}{comUni(it.media6, it.unidade)}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500">{fmtN(it.desvpad)}</td>
                  <td className="px-2 py-2 text-center">
                    <select disabled={encerrado} value={it.nivel_servico} onChange={e => salvarConfig(it, 'nivel_servico', Number(e.target.value))} className="bg-transparent text-xs outline-none cursor-pointer disabled:cursor-default rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 px-1">
                      {NIVEIS.map(n => <option key={n} value={n} className="text-gray-900">{n}%</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <input disabled={encerrado} type="number" min={0} max={300} step={1}
                      value={it.fator_perda_pct ?? 0}
                      onChange={e => patchItem(it.producao_id, { fator_perda_pct: Number(e.target.value) })}
                      onBlur={e => salvarConfig(it, 'fator_perda_pct', Number(e.target.value))}
                      className="w-12 bg-transparent text-xs text-center outline-none rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 disabled:cursor-default px-1" />
                    {/* A sugestão só aparece quando diverge do que está aplicado — senão vira ruído
                        em ~80 linhas que já estão certas. */}
                    {it.perda_medida_pct != null && Math.abs(it.perda_medida_pct - (it.fator_perda_pct ?? 0)) >= 5 && (
                      <button disabled={encerrado || soLeitura}
                        onClick={() => { patchItem(it.producao_id, { fator_perda_pct: it.perda_medida_pct }); salvarConfig(it, 'fator_perda_pct', it.perda_medida_pct); }}
                        title={`Nas últimas 8 semanas o consumo real do estoque ficou ${it.perda_medida_pct}% acima do teórico. Clique para aplicar.`}
                        className="block mx-auto text-[10px] text-amber-600 dark:text-amber-400 hover:underline disabled:no-underline disabled:text-gray-400">
                        medido {it.perda_medida_pct}%
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <input disabled={encerrado} type="number" min={0} max={14} step={1}
                      value={it.dias_ate_produzir ?? 0}
                      onChange={e => patchItem(it.producao_id, { dias_ate_produzir: Number(e.target.value) })}
                      onBlur={e => salvarConfig(it, 'dias_ate_produzir', Number(e.target.value))}
                      className="w-10 bg-transparent text-xs text-center outline-none rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 disabled:cursor-default px-1" />
                    {it.lead_medido != null && it.lead_medido !== (it.dias_ate_produzir ?? 0) && (
                      <button disabled={encerrado || soLeitura}
                        onClick={() => { patchItem(it.producao_id, { dias_ate_produzir: it.lead_medido }); salvarConfig(it, 'dias_ate_produzir', it.lead_medido); }}
                        title={`No histórico, a primeira produção da semana cai em média ${it.lead_medido} dia(s) depois da contagem de segunda. Clique para aplicar.`}
                        className="block mx-auto text-[10px] text-amber-600 dark:text-amber-400 hover:underline disabled:no-underline disabled:text-gray-400">
                        medido {it.lead_medido}d
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input disabled={encerrado} type="number" min={0} step={0.5} value={it.semanas_receita}
                      onChange={e => patchItem(it.producao_id, { semanas_receita: Number(e.target.value) })}
                      onBlur={e => salvarConfig(it, 'semanas_receita', Number(e.target.value))}
                      className="w-12 bg-transparent text-xs text-center outline-none rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 disabled:hover:border-transparent" />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">{comUni(it.pr, it.unidade)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-gray-500 whitespace-nowrap">{comUni(it.estoque, it.unidade)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${(it.diasEstoque ?? 99) < 3 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'}`}>{it.diasEstoque == null ? '—' : `${fmtN(it.diasEstoque)}d`}</td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {it.consumo > 0
                      ? <span className={it.falta > 0 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500'} title={it.falta > 0 ? `Já incluso no Uso Indireto (não somar). Faltam ${comUni(it.falta, it.unidade)} p/ cobrir a produção planejada dos pais.` : 'Já incluso no Uso Indireto (não somar). Coberto pelo estoque + plano.'}>{comUni(it.consumo, it.unidade)}{it.falta > 0 ? ' ⚠' : ''}</span>
                      : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  {/* A dúvida nasce OLHANDO a sugestão ("por que produzir 4 receitas?"), então é ela
                      que abre a explicação — mesmo padrão do Planejamento de Compras. Pedido do
                      Isaías: mostrar pras meninas por que está pedindo aquela quantidade. */}
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => setAberto(expandido ? null : it.producao_id)}
                      title={expandido ? 'Fechar explicação' : 'Entender por que essa quantidade'}
                      className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                      {it.naoProduzir
                        ? <span className="text-emerald-600 dark:text-emerald-400 text-xs">Não produzir</span>
                        : <span className="inline-flex flex-col items-end"><span className="font-bold text-violet-700 dark:text-violet-300 tabular-nums">{it.receitas} rec.</span><span className="text-[10px] text-gray-400 whitespace-nowrap">≈ {comUni(it.sugestaoQtd, it.unidade)}</span></span>}
                      <HelpCircle className={`w-3.5 h-3.5 shrink-0 ${expandido ? 'text-violet-600' : 'text-gray-400'}`} />
                    </button>
                  </td>
                  {planejando && <td className="px-2 py-2 text-right">
                    <input disabled={encerrado || (it.dias?.length > 0)} type="number" min={0} step={1}
                      value={decidido ?? (it.naoProduzir ? 0 : it.receitas)}
                      onChange={e => patchItem(it.producao_id, { decisao: { ...(it.decisao || {}), decidido_receitas: e.target.value === '' ? null : Number(e.target.value) } })}
                      onBlur={e => salvarDecisao(it, { decidido_receitas: e.target.value === '' ? null : Number(e.target.value) })}
                      title={it.dias?.length > 0 ? 'Total definido pela distribuição por dia (edite nos Dias)' : (override ? 'Diferente da sugestão (override registrado)' : '')}
                      className={`w-16 bg-transparent text-right tabular-nums outline-none rounded border px-1 disabled:opacity-60 disabled:cursor-default ${override ? 'border-amber-400 text-amber-600 dark:text-amber-400 font-medium' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'}`} />
                    {override && <input disabled={encerrado} type="text" placeholder="motivo do override…"
                      value={it.decisao?.motivo_override ?? ''}
                      onChange={e => patchItem(it.producao_id, { decisao: { ...(it.decisao || {}), motivo_override: e.target.value } })}
                      onBlur={e => salvarDecisao(it, { motivo_override: e.target.value || null })}
                      className="block mt-1 w-32 ml-auto bg-transparent text-[11px] text-right outline-none rounded border border-amber-300 dark:border-amber-700/60 px-1 py-0.5 placeholder:text-amber-400/60" />}
                  </td>}
                  {planejando && <td className="px-2 py-2 text-center">
                    {(() => {
                      const dd = diasDoItem(it);
                      const resumo = dd.map(d => `${diaAbrev.get(d.dia) || fmtDM(d.dia)} ${d.receitas}`).join(' · ');
                      return (
                        <button disabled={encerrado} onClick={() => abrirDias(it)} title={resumo ? `Dias de produção: ${resumo} · clique p/ editar` : 'Marcar em quais dias produzir (pode ser vários, com qtd por dia)'}
                          className={`text-xs rounded border px-2 py-1 whitespace-nowrap disabled:cursor-default ${dd.length ? 'border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 bg-violet-50/60 dark:bg-violet-900/15' : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-violet-400 hover:text-violet-500'}`}>
                          {dd.length === 0 ? '+ dias' : dd.length === 1 ? resumo : <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{dd.length} dias</span>}
                        </button>
                      );
                    })()}
                  </td>}
                </tr>
                {expandido && <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                  <td colSpan={nCols} className="px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 pl-4">
                      <span className="font-medium text-gray-600 dark:text-gray-300">Semanas que formam a média (ponderada por recência):</span>
                      {(it.semanas || []).map((wk: string, i: number) => {
                        const v = it.saidas?.[i] ?? 0;
                        return <span key={wk} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${v > 0 ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'}`} title={v > 0 ? `peso ${i + 1}` : 'Semana em branco — desconsiderada na média'}>{fmtDM(wk)}: <b>{comUni(v, it.unidade)}</b> <span className="opacity-60">×{i + 1}</span></span>;
                      })}
                      <span className="text-gray-600 dark:text-gray-300">= média <b>{comUni(it.media6, it.unidade)}</b></span>
                    </div>

                    {/* A quebra direto × via preparo, semana a semana. */}
                    {it.media6_direta != null && Math.abs(it.media6 - it.media6_direta) > 0.005 && (
                      <div className="mt-1.5 ml-4 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          Desse uso, <b className="text-gray-700 dark:text-gray-200">{comUni(it.media6_direta, it.unidade)}</b> por
                          semana vai <b>direto</b> na ficha do produto vendido
                        </span>
                        <span>
                          e <b className="text-gray-700 dark:text-gray-200">{comUni(it.media6 - it.media6_direta, it.unidade)}</b> atravessa
                          outro preparo (espuma, refrigerante, pré-batch)
                        </span>
                      </div>
                    )}

                    {/* POR QUE ESSA SUGESTÃO — espelho do Planejamento de Compras. Os números já
                        existiam espalhados nas colunas; aqui viram a CONTA, com o nome de cada
                        parcela em português, pra explicar pra quem produz. */}
                    <div className="mt-2.5 ml-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3 max-w-3xl">
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        Por que {it.naoProduzir ? 'não precisa produzir' : `produzir ${it.receitas} ${it.receitas === 1 ? 'receita' : 'receitas'}`}?
                      </div>

                      <table className="w-full text-[11px]">
                        <tbody className="text-gray-600 dark:text-gray-300">
                          <tr>
                            <td className="py-0.5 w-4 text-gray-400"></td>
                            <td className="py-0.5">Sai por semana, na média</td>
                            <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap">{comUni(it.media6, it.unidade)}</td>
                            <td className="py-0.5 pl-2 text-gray-400">média das 6 últimas semanas (as mais recentes pesam mais)</td>
                          </tr>
                          {(it.dias_ate_produzir ?? 0) > 0 && (
                            <tr>
                              <td className="py-0.5 text-gray-400">+</td>
                              <td className="py-0.5">Some antes de você produzir</td>
                              <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap text-sky-600 dark:text-sky-400">{comUni(it.media6 * ((it.dias_ate_produzir || 0) / 7), it.unidade)}</td>
                              <td className="py-0.5 pl-2 text-gray-400">a contagem é de segunda e você produz {it.dias_ate_produzir} dia(s) depois</td>
                            </tr>
                          )}
                          {/* A linha da perda só existe quando há perda — o caso normal é 0 e a
                              conta continua a de sempre, com uma linha a menos pra ler. */}
                          {(it.fator_perda_pct ?? 0) > 0 && (
                            <tr>
                              <td className="py-0.5 text-gray-400">+</td>
                              <td className="py-0.5">Perda que a ficha não vê</td>
                              <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap text-amber-600 dark:text-amber-400">{comUni(it.media6 * ((7 + (it.dias_ate_produzir || 0)) / 7) * ((it.fator_perda_pct || 0) / 100), it.unidade)}</td>
                              <td className="py-0.5 pl-2 text-gray-400">o bar consome {it.fator_perda_pct}% acima da ficha (over-pour, batch refeito, sobra)</td>
                            </tr>
                          )}
                          <tr>
                            <td className="py-0.5 text-gray-400">+</td>
                            <td className="py-0.5">Folga de segurança</td>
                            <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap">{comUni(it.margem ?? 0, it.unidade)}</td>
                            <td className="py-0.5 pl-2 text-gray-400">porque tem semana que sai bem mais — cobre {it.nivel_servico}% das semanas</td>
                          </tr>
                          <tr className="border-t border-gray-200 dark:border-gray-700">
                            <td className="py-0.5 text-gray-400">=</td>
                            <td className="py-0.5 font-medium text-gray-800 dark:text-gray-100">Quanto precisa ter pra semana</td>
                            <td className="py-0.5 text-right tabular-nums font-semibold whitespace-nowrap">{comUni(it.pr, it.unidade)}</td>
                            <td className="py-0.5 pl-2 text-gray-400">é o &ldquo;PR&rdquo; da tabela (ponto de reposição)</td>
                          </tr>
                          <tr>
                            <td className="py-0.5 text-gray-400">−</td>
                            <td className="py-0.5">Já tem pronto em estoque</td>
                            <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap">{comUni(it.estoque, it.unidade)}</td>
                            <td className="py-0.5 pl-2 text-gray-400">{res?.contagem?.data ? `contagem de ${fmtDM(res.contagem.data)}` : 'última contagem'}</td>
                          </tr>
                          {/* "Qtde x Semanas": produzir de uma vez pra mais de uma semana. Só aparece
                              quando está configurado > 1 — senão vira linha de zero sem sentido. */}
                          {(it.extra ?? 0) > 0 && <tr>
                            <td className="py-0.5 text-gray-400">+</td>
                            <td className="py-0.5">Pra durar {fmtN(it.semanas_receita)} semanas</td>
                            <td className="py-0.5 text-right tabular-nums font-medium whitespace-nowrap">{comUni(it.extra, it.unidade)}</td>
                            <td className="py-0.5 pl-2 text-gray-400">cada semana a mais repõe uma média de saída (campo &ldquo;Qtde x Semanas&rdquo;)</td>
                          </tr>}
                          <tr className="border-t border-gray-200 dark:border-gray-700">
                            <td className="py-1 text-gray-400">=</td>
                            <td className="py-1 font-semibold text-gray-800 dark:text-gray-100">Falta produzir</td>
                            <td className="py-1 text-right tabular-nums font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap">{comUni(it.ae, it.unidade)}</td>
                            <td className="py-1 pl-2 text-violet-700 dark:text-violet-300">
                              {it.naoProduzir
                                ? 'já tem o suficiente — não precisa produzir'
                                : it.rend_contagem > 0
                                  ? <>÷ {comUni(it.rend_contagem, it.unidade)} que rende cada receita, arredondando pra cima = <b>{it.receitas} rec.</b> (≈ {comUni(it.sugestaoQtd, it.unidade)})</>
                                  : 'sem rendimento cadastrado na receita — não dá pra converter em nº de receitas'}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Consumo dos pais: NÃO entra na conta acima (é aviso), então fica separado —
                          senão parece parcela e a soma não fecha. */}
                      {it.consumo > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
                          <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200 mb-1">
                            Dentro do uso acima, {comUni(it.consumo, it.unidade)} deste preparo não vai pro
                            drink/prato direto — vira outro preparo na produção planejada da semana
                          </div>
                          {it.consumoDet.length > 0 && <table className="w-full text-[11px]">
                            <tbody className="text-gray-600 dark:text-gray-300">
                              {it.consumoDet.map((d: any, i: number) => (
                                <tr key={`${d.pai}-${i}`}>
                                  <td className="py-0.5 pr-2">{d.pai}</td>
                                  <td className="py-0.5 text-right tabular-nums whitespace-nowrap text-gray-500">
                                    {fmtN(d.receitas)} {d.receitas === 1 ? 'receita' : 'receitas'} × {comUni(d.qtd_receita, it.unidade)}
                                  </td>
                                  <td className="py-0.5 pl-2 text-right tabular-nums font-medium whitespace-nowrap">{comUni(d.total, it.unidade)}</td>
                                </tr>
                              ))}
                              <tr className="border-t border-gray-200 dark:border-gray-700">
                                <td className="py-0.5 font-medium text-gray-800 dark:text-gray-100" colSpan={2}>Total p/ outras produções</td>
                                <td className="py-0.5 pl-2 text-right tabular-nums font-semibold whitespace-nowrap">{comUni(it.consumo, it.unidade)}</td>
                              </tr>
                            </tbody>
                          </table>}
                          <p className={`mt-1.5 text-[10px] ${it.falta > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                            {it.falta > 0
                              ? <>Isso <b>não cabe</b> no estoque + o que está planejado: faltam <b>{comUni(it.falta, it.unidade)}</b>. Aumente as receitas no &ldquo;Decidido&rdquo;.</>
                              : <>Está coberto pelo estoque + o que já foi planejado. Este aviso <b>não muda</b> a sugestão acima. Quantidade estranha em alguma linha costuma ser <b>ficha técnica errada</b>.</>}
                          </p>
                        </div>
                      )}

                      {decidido != null && Number(decidido) !== it.receitas && (
                        <p className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 text-[11px] text-amber-600 dark:text-amber-400">
                          A reunião decidiu <b>{fmtN(decidido)} rec.</b> em vez de {it.receitas}{it.decisao?.motivo_override ? ` — ${it.decisao.motivo_override}` : ''}.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>}
                </Fragment>
              );})}
            </tbody>
          </table>
        </div></CardContent></Card>
        <p className="text-[11px] text-gray-400"><b className="text-gray-500 dark:text-gray-300">Uso Indireto já é o total:</b> as vendas explodidas pela ficha técnica, <b>incluindo</b> o que passa por dentro de outro preparo (espuma, refrigerante, pré-batch). A coluna <b>&ldquo;Dentro disso: p/ outras produções&rdquo;</b> é um recorte desse mesmo total — <b>não somar as duas</b>, senão a quantidade sai inflada. Recalcula com a ficha atual nas 6 semanas. O ponto azul liga/desliga a produção no Controle de Produção. Ao <b>encerrar</b>, os itens com dia definido viram a calendarização que aparece na tela Executar do dia.</p>

        {/* Modal: distribuir a produção em vários dias (qtd por dia) */}
        {diaModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setDiaModal(null); }}>
            <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-violet-500" />Dias de produção</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{diaModal.nome} · sugestão <b className="text-violet-600 dark:text-violet-300">{diaModal.receitas} rec.</b></p>
                </div>
                <button onClick={() => setDiaModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-4 space-y-1.5 max-h-[50vh] overflow-y-auto">
                <p className="text-[11px] text-gray-400 mb-2">Marque os dias e informe quantas <b>receitas</b> em cada um (ex.: pastel Seg 2 · Ter 3). O total da semana é a soma dos dias.</p>
                {diasOpcoes.map(d => {
                  const on = d.iso in modalDias;
                  return (
                    <div key={d.iso} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${on ? 'border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-900/15' : 'border-gray-200 dark:border-gray-700'}`}>
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input type="checkbox" checked={on} onChange={e => toggleDiaModal(d.iso, e.target.checked)} className="w-4 h-4 accent-violet-600" />
                        <span className={`text-sm ${on ? 'text-gray-900 dark:text-gray-100 font-medium' : 'text-gray-500'}`}>{d.label}</span>
                      </label>
                      <input type="number" min={0} step={1} inputMode="numeric" disabled={!on}
                        value={modalDias[d.iso] ?? ''} onChange={e => setModalDias(prev => ({ ...prev, [d.iso]: e.target.value }))}
                        placeholder="0" className="w-20 h-8 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-right tabular-nums text-sm text-gray-900 dark:text-gray-100 disabled:opacity-40" />
                      <span className="text-[11px] text-gray-400 w-8">rec</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between p-4 border-t border-gray-100 dark:border-gray-800">
                <div className="text-sm">
                  <span className="text-gray-500">Total: </span>
                  <b className={`tabular-nums ${totalModal === diaModal.receitas ? 'text-emerald-600 dark:text-emerald-400' : 'text-violet-700 dark:text-violet-300'}`}>{totalModal} rec.</b>
                  {diaModal.rend_contagem > 0 && <span className="text-gray-400"> ≈ {comUni(totalModal * diaModal.rend_contagem, diaModal.unidade)}</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDiaModal(null)} className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Cancelar</button>
                  <button onClick={salvarDias} disabled={salvando} className="text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 disabled:opacity-50 inline-flex items-center gap-1.5">{salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Salvar</button>
                </div>
              </div>
            </div>
          </div>
        )}
    </PageShell>
  );
}
