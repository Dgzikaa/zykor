'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useBar } from '@/contexts/BarContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiCall } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import './sticky-columns.css';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CalculadoraDistribuicao } from './CalculadoraDistribuicao';
import { 
  Calendar, 
  Edit, 
  Save, 
  X, 
  TrendingUp, 
  Users,
  DollarSign,
  ChefHat,
  Target,
  AlertCircle,
  Eye,
  Filter,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pencil,
  Check,
  Music,
  Plus
} from 'lucide-react';
import { PlanejamentoData } from '../services/planejamento-service';

// Singleton no escopo do modulo (Intl.NumberFormat e' caro).
const FMT_PLAN_BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 1 linha de artista do evento (nome + janela de horário). artista_id liga ao cadastro bar_artistas.
interface ArtistaLinha {
  artista_id?: number | null;
  artista_nome: string;
  horario_inicio?: string;
  horario_fim?: string;
}

// Combobox leve de artista: lista o cadastro (bar_artistas) + permite digitar um nome novo (cria no save).
function ArtistaField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: number; nome: string; tipo: string }[];
  onChange: (nome: string, artistaId: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.nome.toLowerCase().includes(q)) : options).slice(0, 50);
  const exato = options.some((o) => o.nome.toLowerCase() === q);
  return (
    <div className="relative">
      <Input
        value={value}
        placeholder="Artista…"
        onChange={(e) => { onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (filtered.length > 0 || (!!q && !exato)) && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(o.nome, o.id); setOpen(false); }}
                className="block w-full truncate px-3 py-1.5 text-left hover:bg-[hsl(var(--muted))]"
              >
                {o.nome} <span className="text-xs text-[hsl(var(--muted-foreground))]">· {o.tipo}</span>
              </button>
            </li>
          ))}
          {!!q && !exato && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(value.trim(), null); setOpen(false); }}
                className="block w-full px-3 py-1.5 text-left text-emerald-600 dark:text-emerald-400 hover:bg-[hsl(var(--muted))]"
              >
                + criar &ldquo;{value.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Combobox digitável de LABEL do evento: sugere as labels que já existem no bar
// (operations.eventos_base.nome), evitando variantes ("Quarta de Bamba" vs "…bamba").
// Sempre permite digitar uma label nova.
function LabelField({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { nome: string; qtd: number }[];
  onChange: (nome: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.nome.toLowerCase().includes(q)) : options).slice(0, 60);
  const exato = options.some((o) => o.nome.toLowerCase() === q);
  return (
    <div className="relative">
      <Input
        value={value}
        placeholder="Ex: Quarta de Bamba"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (filtered.length > 0 || (!!q && !exato)) && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg text-sm">
          {filtered.map((o) => (
            <li key={o.nome}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(o.nome); setOpen(false); }}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-[hsl(var(--muted))]"
              >
                <span className="truncate">{o.nome}</span>
                <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{o.qtd}×</span>
              </button>
            </li>
          ))}
          {!!q && !exato && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(value.trim()); setOpen(false); }}
                className="block w-full px-3 py-1.5 text-left text-emerald-600 dark:text-emerald-400 hover:bg-[hsl(var(--muted))]"
              >
                + usar &ldquo;{value.trim()}&rdquo; (label nova)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface EventoEdicaoCompleta {
  id: number;
  nome: string;
  data_evento: string;
  dia_semana: string;
  m1_r: number;
  cl_plan: number;
  te_plan: number;
  tb_plan: number;
  c_artistico_plan: number;
  c_prod_plan: number;
  real_r: number;
  cl_real: number;
  te_real: number;
  tb_real: number;
  t_medio: number;
  res_tot: number;
  res_p: number;
  c_art: number;
  c_prod: number;
  c_art_is_projecao?: boolean;
  c_prod_is_projecao?: boolean;
  cmv_teorico_custo?: number;
  cmv_teorico_pct?: number | null;
  consumacao?: number;
  couvert_vr_contahub?: number | null;
  percent_b: number;
  percent_d: number;
  percent_c: number;
  percent_happy_hour: number;
  percent_stockout: number;
  t_coz: number;
  t_bar: number;
  atrasinho_cozinha: number;
  atrasinho_bar: number;
  atrasao_cozinha: number;
  atrasao_bar: number;
  sympla_liquido?: number;
  sympla_checkins?: number;
  yuzer_liquido?: number;
  yuzer_ingressos?: number;
  faturamento_couvert_manual?: number | null;
  faturamento_bar_manual?: number | null;
  atrasos_cozinha?: number;
  atrasos_bar?: number;
  observacoes: string;
  flag_urgente?: boolean;
  artistas?: ArtistaLinha[];
}

interface PlanejamentoClientProps {
  initialData: PlanejamentoData[];
  serverMes: number;
  serverAno: number;
  lucroLiquidoProjetado?: number | null;
  margemProjetada?: number | null;
}

export function PlanejamentoClient({ initialData, serverMes, serverAno, lucroLiquidoProjetado = null, margemProjetada = null }: PlanejamentoClientProps) {
  const { user } = useUser();
  const { selectedBar } = useBar();
  const { setPageTitle } = usePageTitle();
  const router = useRouter();
  
  console.log('🔍 selectedBar:', selectedBar, 'id:', selectedBar?.id);
  
  const [dados, setDados] = useState<PlanejamentoData[]>(initialData);
  const [filtroMes, setFiltroMes] = useState(serverMes);
  const [filtroAno, setFiltroAno] = useState(serverAno);
  const [linhaHighlight, setLinhaHighlight] = useState<number | null>(null);
  const [colunaHighlight, setColunaHighlight] = useState<string | null>(null);
  const [editandoReservas, setEditandoReservas] = useState<{id: number, campo: 'res_tot' | 'res_p'} | null>(null);
  const [valorReservaTemp, setValorReservaTemp] = useState<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setDados(initialData);
    setFiltroMes(serverMes);
    setFiltroAno(serverAno);
  }, [initialData, serverMes, serverAno]);
  
  // Colunas congeladas: 100% CSS (position: sticky + left acumulado) em
  // sticky-columns.css. O hack anterior (listener de scroll + translateX em
  // position:relative) fazia as colunas fixas "comerem" as que passavam e
  // travava após expandir/recolher (translateX nunca resetava em scrollLeft=0).

  // Salvar reserva inline (Deboche)
  const salvarReservaInline = async (eventoId: number, campo: 'res_tot' | 'res_p', valor: number) => {
    try {
      const response = await apiCall(`/api/eventos/${eventoId}/update`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-selected-bar-id': String(selectedBar?.id || '')
        },
        body: JSON.stringify({ [campo]: valor }),
      });
      
      if (response.success) {
        setDados(prev => prev.map(e => 
          e.evento_id === eventoId ? { ...e, [campo]: valor } : e
        ));
        console.log(`✅ Reserva ${campo} atualizada para ${valor}`);
      } else {
        console.error('❌ Erro ao salvar reserva:', response.error);
        alert('Erro ao salvar reserva. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao salvar reserva:', error);
      alert('Erro ao salvar reserva. Tente novamente.');
    }
    setEditandoReservas(null);
    setValorReservaTemp('');
  };

  // Marcar/desmarcar bilheteria externa (Yuzer/Sympla). Quando marcado, o
  // calculate_evento_metrics puxa o faturamento dessa bilheteria pro evento.
  const toggleBilheteria = async (eventoId: number, campo: 'usa_yuzer' | 'usa_sympla', atual: boolean) => {
    const novo = !atual;
    setDados(prev => prev.map(e => e.evento_id === eventoId ? { ...e, [campo]: novo } : e));
    try {
      const response = await apiCall(`/api/eventos/${eventoId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({ [campo]: novo }),
      });
      if (!response.success) throw new Error(response.error || 'falha');
    } catch (error) {
      console.error('Erro ao marcar bilheteria:', error);
      setDados(prev => prev.map(e => e.evento_id === eventoId ? { ...e, [campo]: atual } : e)); // rollback
      alert('Erro ao salvar marcação. Tente novamente.');
    }
  };
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false); 
  const [eventoSelecionado, setEventoSelecionado] = useState<PlanejamentoData | null>(null);
  const [eventoEdicao, setEventoEdicao] = useState<EventoEdicaoCompleta | null>(null);
  // cadastro de artistas do bar (operations.bar_artistas) para o combobox do modal
  const [artistasCadastro, setArtistasCadastro] = useState<{ id: number; nome: string; tipo: string }[]>([]);
  // labels existentes (operations.eventos_base.nome) para o combobox digitável do Nome
  const [labelsCadastro, setLabelsCadastro] = useState<{ nome: string; qtd: number }[]>([]);
  useEffect(() => {
    if (!selectedBar?.id) return;
    const h = { 'x-selected-bar-id': String(selectedBar.id) };
    apiCall('/api/artistas', { headers: h })
      .then((r: any) => { if (r?.success) setArtistasCadastro(r.artistas || []); })
      .catch(() => {});
    apiCall('/api/eventos/labels', { headers: h })
      .then((r: any) => { if (r?.success) setLabelsCadastro(r.labels || []); })
      .catch(() => {});
  }, [selectedBar?.id]);
  const [salvando, setSalvando] = useState(false);

  // === Cadastro de eventos (quando o mês está vazio) ===
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [linhasCadastro, setLinhasCadastro] = useState<Array<{ data_evento: string; nome: string; m1_r: string }>>([]);

  const DIAS_SEMANA_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const diaSemanaDeData = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return DIAS_SEMANA_PT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] || '';
  };

  const abrirCadastro = () => {
    setLinhasCadastro([{ data_evento: '', nome: '', m1_r: '' }]);
    setCadastroOpen(true);
  };
  const addLinhaCadastro = () => setLinhasCadastro(p => [...p, { data_evento: '', nome: '', m1_r: '' }]);
  const removerLinhaCadastro = (i: number) => setLinhasCadastro(p => p.filter((_, idx) => idx !== i));
  const editarLinhaCadastro = (i: number, campo: 'data_evento' | 'nome' | 'm1_r', val: string) =>
    setLinhasCadastro(p => p.map((l, idx) => idx === i ? { ...l, [campo]: val } : l));
  const gerarDiasDoMes = () => {
    const diasNoMes = new Date(filtroAno, filtroMes, 0).getDate(); // dia 0 do mês seguinte = último dia
    const linhas = Array.from({ length: diasNoMes }, (_, i) => ({
      data_evento: `${filtroAno}-${String(filtroMes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
      nome: '',
      m1_r: ''
    }));
    setLinhasCadastro(linhas);
  };
  const salvarCadastro = async () => {
    const eventos = linhasCadastro
      .filter(l => l.data_evento && (l.nome.trim() !== '' || Number(l.m1_r) > 0))
      .map(l => ({
        data_evento: l.data_evento,
        nome: l.nome.trim() || 'A definir',
        dia_semana: diaSemanaDeData(l.data_evento),
        m1_r: Number(l.m1_r) || 0
      }));
    if (eventos.length === 0) {
      alert('Preencha pelo menos uma linha com data e (artista ou M1).');
      return;
    }
    try {
      setSalvandoCadastro(true);
      const resp = await apiCall('/api/eventos/bulk-insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({ eventos })
      });
      if (!resp.success) throw new Error(resp.error || 'falha ao cadastrar');
      setCadastroOpen(false);
      router.refresh();
    } catch (e) {
      console.error('Erro ao cadastrar eventos:', e);
      alert('Erro ao cadastrar eventos. Tente novamente.');
    } finally {
      setSalvandoCadastro(false);
    }
  };
  
  // Estados para controlar grupos colapsáveis
  const [gruposAbertos, setGruposAbertos] = useState({
    clientes: false,
    ticket: false,
    artistico: false,
    producao: false
  });
  
  const toggleGrupo = (grupo: 'clientes' | 'ticket' | 'artistico' | 'producao') => {
    setGruposAbertos(prev => ({ ...prev, [grupo]: !prev[grupo] }));
  };
  
  const expandirTodos = () => {
    setGruposAbertos({ clientes: true, ticket: true, artistico: true, producao: true });
  };
  
  const recolherTodos = () => {
    setGruposAbertos({ clientes: false, ticket: false, artistico: false, producao: false });
  };

  useEffect(() => {
    setPageTitle('📊 Planejamento Comercial');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const alterarPeriodo = useCallback((novoMes: number, novoAno: number) => {
    router.push(`?mes=${novoMes}&ano=${novoAno}`);
  }, [router]);

  const modalDataCacheRef = useRef<Record<string, any>>({});

  const abrirModal = useCallback(async (evento: PlanejamentoData, editMode: boolean = false) => {
    setEventoSelecionado(evento);
    setModoEdicao(editMode);
    
    const cacheKey = `${evento.evento_id}-${evento.data_evento}`;
    if (modalDataCacheRef.current[cacheKey]) {
      setEventoEdicao(modalDataCacheRef.current[cacheKey]);
      setModalOpen(true);
      return;
    }
    
    const isDomingo = evento.dia_semana === 'DOMINGO' || evento.dia_semana === 'Domingo';

    // Sempre buscar o evento bruto: precisamos das colunas separadas
    // (c_artistico_plan/c_prod_plan = previsão manual; c_art/c_prod = real do Conta
    // Azul; *_projecao = projeção automática) pra saber em qual campo gravar o edit.
    const [atrasosResponse, eventoRawResponse, artistasResponse] = await Promise.all([
      apiCall(`/api/estrategico/atrasos-evento?data=${evento.data_evento}`, {
        headers: { 'x-selected-bar-id': String(selectedBar?.id || '') }
      }).catch(() => ({ success: false, data: { atrasos_cozinha: 0, atrasos_bar: 0 } })),
      apiCall(`/api/eventos/${evento.evento_id}`, {
        headers: { 'x-selected-bar-id': String(selectedBar?.id || '') }
      }).catch(() => ({ data: null })),
      apiCall(`/api/eventos/artistas?data_evento=${evento.data_evento}`, {
        headers: { 'x-selected-bar-id': String(selectedBar?.id || '') }
      }).catch(() => ({ artistas: [] }))
    ]);

    const atrasosData = atrasosResponse?.data || { atrasos_cozinha: 0, atrasos_bar: 0 };
    const raw: any = eventoRawResponse?.data || {};
    const artistasEvento: ArtistaLinha[] = (((artistasResponse as any)?.artistas) || []).map((a: any) => ({
      artista_id: a.artista_id ?? null,
      artista_nome: a.artista_nome || '',
      horario_inicio: a.horario_inicio ? String(a.horario_inicio).slice(0, 5) : '',
      horario_fim: a.horario_fim ? String(a.horario_fim).slice(0, 5) : '',
    }));

    let dadosSymplaYuzer = {};
    if (isDomingo && eventoRawResponse?.data) {
      dadosSymplaYuzer = {
        sympla_liquido: raw.sympla_liquido || 0,
        sympla_checkins: raw.sympla_checkins || 0,
        yuzer_liquido: raw.yuzer_liquido || 0,
        yuzer_ingressos: raw.yuzer_ingressos || 0
      };
    }

    // Custo é projeção enquanto não há real do Conta Azul (c_art/c_prod = 0).
    const cArtReal = Number(raw.c_art) || 0;
    const cProdReal = Number(raw.c_prod) || 0;
    const cArtIsProjecao = !(cArtReal > 0);
    const cProdIsProjecao = !(cProdReal > 0);

    const dadosIniciais: EventoEdicaoCompleta = {
      id: evento.evento_id,
      nome: evento.evento_nome,
      data_evento: evento.data_evento,
      dia_semana: evento.dia_semana,
      m1_r: evento.m1_receita || 0,
      cl_plan: evento.clientes_plan || 0,
      te_plan: evento.te_plan || 0,
      tb_plan: evento.tb_plan || 0,
      // Previsão = override manual, com fallback pra projeção automática (o valor
      // efetivo que o usuário vê em amarelo). Editar aqui grava em c_artistico_plan.
      c_artistico_plan: (Number(raw.c_artistico_plan) || 0) || (Number(raw.c_art_projecao) || 0),
      c_prod_plan: (Number(raw.c_prod_plan) || 0) || (Number(raw.c_prod_projecao) || 0),
      c_art_is_projecao: cArtIsProjecao,
      c_prod_is_projecao: cProdIsProjecao,
      real_r: evento.real_receita || 0,
      cl_real: evento.clientes_real || 0,
      te_real: evento.te_real || 0,
      tb_real: evento.tb_real || 0,
      t_medio: evento.t_medio || 0,
      res_tot: evento.res_tot || 0,
      res_p: evento.res_p || 0,
      // Realizado = só o que veio do Conta Azul (0 enquanto não lança).
      c_art: cArtReal,
      c_prod: cProdReal,
      cmv_teorico_custo: evento.cmv_teorico_custo ?? 0,
      cmv_teorico_pct: evento.cmv_teorico_pct ?? null,
      percent_b: evento.percent_b || 0,
      percent_d: evento.percent_d || 0,
      percent_c: evento.percent_c || 0,
      percent_happy_hour: evento.percent_happy_hour || 0,
      percent_stockout: evento.percent_stockout || 0,
      t_coz: evento.t_coz || 0,
      t_bar: evento.t_bar || 0,
      atrasinho_cozinha: evento.atrasinho_cozinha || 0,
      atrasinho_bar: evento.atrasinho_bar || 0,
      atrasao_cozinha: evento.atrasao_cozinha || 0,
      atrasao_bar: evento.atrasao_bar || 0,
      ...dadosSymplaYuzer,
      atrasos_cozinha: atrasosData.atrasos_cozinha,
      atrasos_bar: atrasosData.atrasos_bar,
      observacoes: evento.observacoes || '',
      flag_urgente: evento.flag_urgente || false,
      faturamento_couvert_manual: evento.faturamento_couvert_manual,
      faturamento_bar_manual: evento.faturamento_bar_manual,
      artistas: artistasEvento
    };

    modalDataCacheRef.current[cacheKey] = dadosIniciais;
    setEventoEdicao(dadosIniciais);
    setModalOpen(true);
  }, [user, selectedBar]);

  const fecharModal = () => {
    setModalOpen(false);
    setEventoSelecionado(null);
    setEventoEdicao(null);
  };

  // ---- artistas do evento (lista dinâmica no modal) ----
  const addArtista = () =>
    setEventoEdicao((p) => (p ? { ...p, artistas: [...(p.artistas || []), { artista_nome: '', horario_inicio: '', horario_fim: '' }] } : null));
  const removerArtista = (i: number) =>
    setEventoEdicao((p) => (p ? { ...p, artistas: (p.artistas || []).filter((_, idx) => idx !== i) } : null));
  const setArtistaLinha = (i: number, patch: Partial<ArtistaLinha>) =>
    setEventoEdicao((p) => (p ? { ...p, artistas: (p.artistas || []).map((a, idx) => (idx === i ? { ...a, ...patch } : a)) } : null));

  const salvarEdicao = async () => {
    if (!eventoEdicao) return;
    try {
      setSalvando(true);
      // Custo é previsão enquanto o Conta Azul não lança (c_art/c_prod real = 0).
      // Nesse caso o edit grava nas colunas de previsão (c_artistico_plan/c_prod_plan):
      // fica amarelo/⚠️ e o real do CA substitui automaticamente quando chega.
      // Depois de lançado (já tem real), o edit é correção do realizado (c_art/c_prod).
      const artEhPrevisao = !!eventoEdicao.c_art_is_projecao;
      const prodEhPrevisao = !!eventoEdicao.c_prod_is_projecao;

      await apiCall(`/api/eventos/${eventoEdicao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({
          // data_evento p/ a API resolver/criar por (bar, data) quando o evento é só
          // projeção do gold (sem linha no eventos_base) — senão o M1 não salvava.
          data_evento: eventoEdicao.data_evento,
          nome: eventoEdicao.nome,
          m1_r: eventoEdicao.m1_r,
          cl_plan: eventoEdicao.cl_plan,
          te_plan: eventoEdicao.te_plan,
          tb_plan: eventoEdicao.tb_plan,
          c_artistico_plan: eventoEdicao.c_artistico_plan,
          c_prod_plan: eventoEdicao.c_prod_plan,
          observacoes: eventoEdicao.observacoes,
          flag_urgente: eventoEdicao.flag_urgente || false
        })
      });

      // Reais só existem pra evento que já aconteceu. Pra evento futuro/projeção, pular
      // o PUT de valores-reais: evita 404 (sem linha no eventos_base) e impede marcar
      // versao_calculo=999 (manual) com zeros, o que travaria o recálculo quando o real
      // do dia chegar. (O M1/planejado já foi salvo no PUT anterior.)
      const hojeStr = new Date().toISOString().slice(0, 10);
      const jaAconteceu = (eventoEdicao.data_evento || '') < hojeStr;
      if (jaAconteceu) await apiCall(`/api/eventos/${eventoEdicao.id}/valores-reais`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({
          real_r: eventoEdicao.real_r || 0,
          cl_real: eventoEdicao.cl_real || 0,
          te_real: eventoEdicao.te_real || 0,
          tb_real: eventoEdicao.tb_real || 0,
          t_medio: eventoEdicao.t_medio || 0,
          res_tot: eventoEdicao.res_tot || 0,
          res_p: eventoEdicao.res_p || 0,
          // Em previsão NÃO grava no real (mandaria 0, que é no-op e mantém amarelo).
          // Já lançado, grava a correção do realizado por cima do CA.
          c_art: artEhPrevisao ? 0 : (eventoEdicao.c_art || 0),
          c_prod: prodEhPrevisao ? 0 : (eventoEdicao.c_prod || 0),
          t_coz: eventoEdicao.t_coz || 0,
          t_bar: eventoEdicao.t_bar || 0,
          atrasinho_cozinha: eventoEdicao.atrasinho_cozinha || 0,
          atrasinho_bar: eventoEdicao.atrasinho_bar || 0,
          atrasao_cozinha: eventoEdicao.atrasao_cozinha || 0,
          atrasao_bar: eventoEdicao.atrasao_bar || 0,
          faturamento_couvert_manual: eventoEdicao.faturamento_couvert_manual || null,
          faturamento_bar_manual: eventoEdicao.faturamento_bar_manual || null,
          observacoes: eventoEdicao.observacoes || ''
        })
      });

      // Artistas do evento (replace-all) — o backend resolve o evento por (bar, data),
      // que o PUT de planejamento acima já materializou no eventos_base.
      await apiCall('/api/eventos/artistas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-selected-bar-id': String(selectedBar?.id || '') },
        body: JSON.stringify({ data_evento: eventoEdicao.data_evento, artistas: eventoEdicao.artistas || [] })
      });

      // Invalidar cache do modal
      const cacheKey = `${eventoEdicao.id}-${eventoEdicao.data_evento}`;
      delete modalDataCacheRef.current[cacheKey];

      fecharModal();
      router.refresh(); 
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  const formatarMoeda = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return 'R$ 0,00';
    return FMT_PLAN_BRL.format(valor);
  };

  const formatarPercentual = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0,0%';
    return `${valor.toFixed(1).replace('.', ',')}%`;
  };

  const formatarTempo = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0,00 min';
    return `${valor.toFixed(2).replace('.', ',')} min`;
  };

  const formatarContagem = (valor: number | null | undefined): string => {
    if (!valor && valor !== 0) return '0';
    return Math.round(valor).toString();
  };

  const temDetalheFinanceiro = (evento: PlanejamentoData) => {
    const contaHubLiquido = Number(evento.contahub_liquido || 0);
    const yuzerLiquido = Number(evento.yuzer_liquido || 0);
    const symplaLiquido = Number(evento.sympla_liquido || 0);
    return contaHubLiquido > 0 || yuzerLiquido > 0 || symplaLiquido > 0;
  };

  const meses = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' }
  ];

  const anos = [2025, 2026];

  const totaisAgregados = useMemo(() => {
    // Realizado = APENAS soma das receitas reais (não inclui planejado)
    const realizado = dados.reduce((sum, evento) => {
      return sum + (evento.real_receita || 0);
    }, 0);
    
    // Empilhamento = Realizado (eventos JÁ ocorridos) + Planejado M1 (de hoje em
    // diante). Usar o real só de dias anteriores a hoje: eventos futuros já têm
    // real_receita parcial (pré-venda Sympla) e usá-la subestimaria o M1.
    const hojeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const empilhamento = dados.reduce((sum, evento) => {
      const jaAconteceu = (evento.data_evento || '') < hojeStr;
      if (jaAconteceu && evento.real_receita && evento.real_receita > 0) return sum + evento.real_receita;
      return sum + (evento.m1_receita || 0);
    }, 0);
    
    const metaM1 = dados.reduce((sum, evento) => sum + (evento.m1_receita || 0), 0);
    const gap = empilhamento - metaM1;
    const gapPercent = metaM1 > 0 ? (gap / metaM1) * 100 : 0;
    const isPositive = gap >= 0;
    
    // Eventos realizados (com receita real > 0)
    const eventosRealizados = dados.filter(e => e.real_receita && e.real_receita > 0);
    
    // Contar dias únicos (não eventos) - agrupa por data
    const datasUnicas = new Set(dados.map(e => e.data_evento));
    const totalDiasComEvento = datasUnicas.size;
    
    // Contar dias únicos com eventos realizados
    const datasRealizadas = new Set(eventosRealizados.map(e => e.data_evento));
    const totalDiasRealizados = datasRealizadas.size;
    
    const totalEventosRealizados = eventosRealizados.length;
    const totalEventos = dados.length;
    
    // Total de clientes
    const totalClientes = eventosRealizados.reduce((sum, e) => sum + (e.clientes_real || 0), 0);
    
    // Ticket médio geral (baseado no realizado, não no empilhamento)
    const ticketMedioGeral = totalClientes > 0 ? realizado / totalClientes : 0;
    
    // Custos totais
    const custoArtistico = eventosRealizados.reduce((sum, e) => sum + (e.c_art || 0), 0);
    const custoProducao = eventosRealizados.reduce((sum, e) => sum + (e.c_prod || 0), 0);
    const custoTotal = custoArtistico + custoProducao;
    
    // % Custo sobre faturamento (baseado no realizado)
    const percentCustoFat = realizado > 0 ? (custoTotal / realizado) * 100 : 0;
    
    // Médias de tickets
    const eventosComTE = dados.filter(e => e.te_plan > 0);
    const mediaTEPlan = eventosComTE.length > 0 ? eventosComTE.reduce((sum, e) => sum + e.te_plan, 0) / eventosComTE.length : 0;
    const mediaTEReal = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.te_real || 0), 0) / eventosRealizados.length : 0;
    const mediaTBReal = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.tb_real || 0), 0) / eventosRealizados.length : 0;
    
    // Mix de vendas médio
    const mediaPercentB = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_b || 0), 0) / eventosRealizados.length : 0;
    const mediaPercentD = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_d || 0), 0) / eventosRealizados.length : 0;
    const mediaPercentC = eventosRealizados.length > 0 ? eventosRealizados.reduce((sum, e) => sum + (e.percent_c || 0), 0) / eventosRealizados.length : 0;

    // === Totais por coluna (rodapé) ===
    // SUM  → faturamento, clientes, reservas, custos, $couvert, consumação, atrasão
    // AVG  → tickets, %s e stockout (média só dos eventos com resultado > 0,
    //        para não diluir com dias sem dado).
    const somar = (fn: (e: PlanejamentoData) => number | null | undefined) =>
      dados.reduce((s, e) => s + (Number(fn(e)) || 0), 0);
    const mediar = (fn: (e: PlanejamentoData) => number | null | undefined) => {
      const vals = dados.map(e => Number(fn(e)) || 0).filter(v => v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    // CLIENTES (soma)
    const colClientesReais = somar(e => e.clientes_real);
    const colResTot = somar(e => e.res_tot);
    const colResP = somar(e => e.res_p);
    // TICKET (média)
    const colTeReal = mediar(e => e.te_real);
    const colTbReal = mediar(e => e.tb_real);
    const colTMedio = mediar(e => e.t_medio);
    // ARTÍSTICO
    const colCArt = somar(e => e.c_art);
    const colCProd = somar(e => e.c_prod);
    const colCouvert = somar(e => e.couvert_vr_contahub);
    const colPercentArtFat = mediar(e => e.percent_art_fat);
    const colCouvArt = mediar(e =>
      e.c_art > 0 && e.couvert_vr_contahub && e.couvert_vr_contahub > 0
        ? (e.couvert_vr_contahub / e.c_art) * 100
        : 0);
    const colConsumacao = somar(e => e.consumacao);
    // PRODUÇÃO
    const colPercentB = mediar(e => e.percent_b);
    const colPercentD = mediar(e => e.percent_d);
    const colPercentC = mediar(e => e.percent_c);
    const colAtrasaoCoz = somar(e => e.atrasao_cozinha);
    const colAtrasaoBar = somar(e => e.atrasao_bar);
    const colStockoutDrinks = mediar(e => e.stockout_drinks_perc);
    const colStockoutComidas = mediar(e => e.stockout_comidas_perc);
    // CMV teórico ponderado do período = Σ custo teórico ÷ Σ faturamento (dos dias com CMV)
    const cmvCusto = dados.reduce((s, e) => s + (e.cmv_teorico_pct != null ? (e.cmv_teorico_custo || 0) : 0), 0);
    const cmvFat = dados.reduce((s, e) => s + (e.cmv_teorico_pct != null ? (e.real_receita || 0) : 0), 0);
    const colCmvTeorico = cmvFat > 0 ? (cmvCusto / cmvFat) * 100 : null;

    return {
      colClientesReais, colResTot, colResP,
      colTeReal, colTbReal, colTMedio,
      colCArt, colCProd, colCouvert, colPercentArtFat, colCouvArt, colConsumacao,
      colPercentB, colPercentD, colPercentC, colAtrasaoCoz, colAtrasaoBar,
      colStockoutDrinks, colStockoutComidas, colCmvTeorico,
      realizado,
      empilhamento, 
      metaM1, 
      gap, 
      gapPercent, 
      isPositive, 
      mediaTEPlan,
      totalEventos,
      totalEventosRealizados,
      totalDiasComEvento,
      totalDiasRealizados,
      totalClientes,
      ticketMedioGeral,
      custoTotal,
      percentCustoFat,
      mediaTEReal,
      mediaTBReal,
      mediaPercentB,
      mediaPercentD,
      mediaPercentC
    };
  }, [dados]);

  // Classe base das células do rodapé de totais (sticky no fundo).
  const tfCls = 'sticky bottom-0 z-20 px-2 py-2 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600 whitespace-nowrap';

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        {dados.length === 0 ? (
          <div className="container mx-auto px-4 py-8">
            <Card className="card-dark p-8">
              <div className="text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
                {/* Seletor de mês/ano — permite navegar mesmo quando o mês está vazio */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Select value={filtroMes.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), filtroAno)}>
                    <SelectTrigger className="w-36 bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                    <SelectContent>{meses.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={filtroAno.toString()} onValueChange={(value) => alterarPeriodo(filtroMes, parseInt(value))}>
                    <SelectTrigger className="w-24 bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                    <SelectContent>{anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <h3 className="card-title-dark mb-2">Nenhum evento encontrado</h3>
                <p className="card-description-dark mb-4">
                  Não há eventos cadastrados para {meses.find(m => m.value === filtroMes)?.label} de {filtroAno}
                </p>
                <Button onClick={abrirCadastro} leftIcon={<Calendar className="h-4 w-4" />}>
                  Cadastrar Eventos de {meses.find(m => m.value === filtroMes)?.label}
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="container mx-auto px-2 py-4 max-w-[98vw]">
            <div className="flex gap-4">
              {/* min-w-0: sem isto o flex item cresce até a largura da tabela e o
                  scroll horizontal vaza pro <main>, fazendo o position:sticky das
                  colunas fixas (que gruda em .planejamento-container) nunca engatar.
                  NÃO usar `hidden md:block` aqui: escondia os cards mobile (filhos
                  md:hidden) e deixava o mobile em branco. Os filhos se auto-gateiam. */}
              <div className="flex-1 min-w-0">
                {/* Tabela Completa */}
                <div className="bg-[hsl(var(--background))] md:border md:border-[hsl(var(--border))] rounded-xl md:shadow-sm">
                  {/* MOBILE: calculadora (a sidebar de Controles é desktop-only) + lista de cards */}
                  <div className="md:hidden px-1 pt-2 pb-1">
                    <CalculadoraDistribuicao
                      barId={selectedBar?.id}
                      ano={filtroAno}
                      mes={filtroMes}
                      mesLabel={`${meses.find(m => m.value === filtroMes)?.label || ''} ${filtroAno}`}
                      diasManuais={dados.filter(e => e.m1_manual).length}
                      variant="card"
                      onAplicado={() => router.refresh()}
                    />
                  </div>
                  <div className="md:hidden space-y-2 px-1 pb-4">
                    {dados.map((evento) => (
                      <div key={evento.evento_id} className={`rounded-lg border p-3 ${evento.flag_urgente ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30' : 'border-[hsl(var(--border))] bg-white dark:bg-gray-800'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <Link href={`/analitico/eventos?data=${evento.data_evento}`} className="min-w-0">
                            <div className="text-[11px] text-[hsl(var(--muted-foreground))]">{evento.data_curta} · {evento.dia_semana?.substring(0, 3).toUpperCase()}</div>
                            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 truncate">{evento.flag_urgente && '🚩 '}{evento.evento_nome || 'Sem atração'}</div>
                            {(evento.artistas || []).length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">🎤 {(evento.artistas || []).join(', ')}</div>}
                          </Link>
                          <Button size="sm" variant="outline" className="shrink-0" onClick={() => abrirModal(evento, true)}>Editar</Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
                          <div className="flex justify-between"><span className="text-gray-500">Receita</span><span className={`font-medium ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.real_receita > 0 ? formatarMoeda(evento.real_receita) : '-'}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Meta M1</span><span className="font-medium">{formatarMoeda(evento.m1_receita)}{evento.m1_manual && <span title="Editada manualmente" className="ml-1 text-amber-500">🔔</span>}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Clientes</span><span className="font-medium">{(evento.clientes_real || 0).toLocaleString('pt-BR')}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">C. Art</span><span className="font-medium">{evento.c_art > 0 ? formatarMoeda(evento.c_art) : '-'}</span></div>
                        </div>
                      </div>
                    ))}
                    {dados.length === 0 && <div className="text-center text-sm text-gray-400 py-8">Nenhum evento no período.</div>}
                  </div>

                  <div ref={scrollContainerRef} className="planejamento-container overflow-auto max-h-[calc(100vh-120px)] hidden md:block">
                  <table className="planejamento-table text-[10px] w-full" style={{borderCollapse: 'separate', borderSpacing: 0}}>
                    <thead className="bg-[hsl(var(--muted))]">
                      {/* Primeira linha - Grupos colapsáveis */}
                      <tr className="sticky top-0 z-30 bg-[hsl(var(--muted))] border-b-2 border-[hsl(var(--border))]">
                        <th colSpan={6} className="sticky-corner border-r-2 border-[hsl(var(--border))] bg-[hsl(var(--muted))]"></th>

                        {/* Grupo CLIENTES */}
                        <th
                          colSpan={gruposAbertos.clientes ? 3 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('clientes')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.clientes ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <Users className="h-3.5 w-3.5" />
                            <span className="font-bold">CLIENTES</span>
                          </div>
                        </th>
                        
                        {/* Grupo TICKET */}
                        <th
                          colSpan={gruposAbertos.ticket ? 3 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('ticket')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.ticket ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <DollarSign className="h-3.5 w-3.5" />
                            <span className="font-bold">TICKET</span>
                          </div>
                        </th>
                        
                        {/* Grupo ARTÍSTICO */}
                        <th
                          colSpan={gruposAbertos.artistico ? 6 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('artistico')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.artistico ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <Target className="h-3.5 w-3.5" />
                            <span className="font-bold">ARTÍSTICO</span>
                          </div>
                        </th>

                        {/* Grupo PRODUÇÃO */}
                        <th
                          colSpan={gruposAbertos.producao ? 8 : 1}
                          className="px-3 py-2 text-center font-semibold text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer hover:bg-[hsl(var(--muted))] transition-colors"
                          onClick={() => toggleGrupo('producao')}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {gruposAbertos.producao ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <ChefHat className="h-3.5 w-3.5" />
                            <span className="font-bold">PRODUÇÃO</span>
                          </div>
                        </th>
                        
                        <th className="px-3 py-2 text-center font-medium text-[hsl(var(--foreground))]" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>Ações</th>
                      </tr>
                      
                      {/* Segunda linha - Headers principais e subcolunas */}
                      <tr className="sticky top-[32px] z-30 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))]">
                        {/* Colunas Fixas (5 primeiras: Data, Dia, Artista, Receita Real, Meta M1) */}
                        <th className="sticky-header-1 px-0.5 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))]" style={{width: '48px', minWidth: '48px'}}>Data</th>
                        <th className="sticky-header-2 px-0.5 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))]" style={{width: '38px', minWidth: '38px'}}>Dia</th>
                        <th className="sticky-header-3 px-2 py-2 text-left text-[11px] font-semibold border-r border-[hsl(var(--border))]" style={{width: '140px', minWidth: '140px'}}>Label</th>
                        <th className="sticky-header-4 px-2 py-2 text-left text-[11px] font-semibold border-r border-[hsl(var(--border))]" style={{width: '160px', minWidth: '160px'}}>Artistas</th>
                        <th className="sticky-header-5 px-2 py-2 text-center text-[11px] font-semibold border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px'}}>Receita Real</th>
                        <th className="sticky-header-6 px-2 py-2 text-center text-[11px] font-semibold border-r-2 border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px'}}>Meta M1</th>
                        
                        {/* Subcolunas CLIENTES */}
                        {gruposAbertos.clientes ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Clientes Reais</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Reservas Total</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>Reservas Presentes</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        {/* Subcolunas TICKET */}
                        {gruposAbertos.ticket ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Entrada Real</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Bar Real</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Ticket Médio</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        {/* Subcolunas ANÁLISES */}
                        {gruposAbertos.artistico ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Custo Artístico</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>Custo Produção</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>$ Couvert</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>% Art/Fat</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>Couv/Art</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Consumação</th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}

                        {gruposAbertos.producao ? (
                          <>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Bebidas</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Chopp</li>
                                      <li>Bar</li>
                                      <li>Pegue e Pague</li>
                                      <li>Venda Volante</li>
                                      <li>Baldes</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Drinks</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Preshh</li>
                                      <li>Montados</li>
                                      <li>Mexido</li>
                                      <li>Drinks</li>
                                      <li>Drinks Autorais</li>
                                      <li>Shot e Dose</li>
                                      <li>Batidos</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted">% Cozinha</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p className="font-semibold">Categorias incluídas:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                      <li>Cozinha</li>
                                      <li>Cozinha 1</li>
                                      <li>Cozinha 2</li>
                                    </ul>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}>Atrasão Coz</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}>Atrasão Drinks</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Stockout Drinks</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>Stockout Comidas</th>
                            <th className="px-2 py-2 text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '95px', minWidth: '95px', maxWidth: '95px'}}>
                              <Tooltip>
                                <TooltipTrigger asChild><span className="cursor-help underline decoration-dotted">CMV Teórico</span></TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs">CMV teórico do dia = custo da ficha técnica × vendas do ContaHub ÷ faturamento. Atualiza junto com as fichas.</div>
                                </TooltipContent>
                              </Tooltip>
                            </th>
                          </>
                        ) : (
                          <th className="border-r-2 border-[hsl(var(--border))]"></th>
                        )}
                        
                        <th style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {dados.map((evento, idx) => {
                          // Número da semana ISO 8601 (segunda a domingo; semana 1 = a que
                          // contém a 1ª quinta-feira do ano). Mesma fórmula usada no banco
                          // (EXTRACT(WEEK)) e no /desempenho — a versão anterior contava a
                          // partir da 1ª segunda e ignorava a semana ISO parcial, ficando 1 a menos
                          // (ex: 25/05–31/05 aparecia como S21 em vez de S22).
                          const getWeekNumber = (dateStr: string) => {
                            const [y, m, dd] = dateStr.split('-').map(Number);
                            const d = new Date(Date.UTC(y, m - 1, dd));
                            // Move para a quinta-feira da mesma semana ISO
                            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
                            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                          };
                          
                          const currentWeek = getWeekNumber(evento.data_evento);
                          const previousWeek = idx > 0 ? getWeekNumber(dados[idx - 1].data_evento) : null;
                          // Mostrar label da semana se for primeira linha OU se mudou de semana
                          const isNewWeek = idx === 0 || (previousWeek !== null && currentWeek !== previousWeek);

                          // Calcular total de colunas visíveis para o separador de semana
                          const totalColunas = 5
                            + (gruposAbertos.clientes ? 3 : 1)
                            + (gruposAbertos.ticket ? 3 : 1)
                            + (gruposAbertos.artistico ? 6 : 1)
                            + (gruposAbertos.producao ? 8 : 1)
                            + 1; // Ações

                          return (
                          <React.Fragment key={evento.evento_id}>
                          {isNewWeek && (
                            <tr className="bg-[hsl(var(--muted))]">
                              <td colSpan={totalColunas} className="py-1.5 px-3 text-[10px] font-bold text-[hsl(var(--muted-foreground))] uppercase tracking-wider border-y-2 border-[hsl(var(--primary))]/30 sticky left-0">
                                Semana {currentWeek}
                              </td>
                            </tr>
                          )}
                          <tr
                            onClick={() => { setLinhaHighlight(idx); setColunaHighlight(null); }}
                            className={`group cursor-pointer transition-colors ${
                              linhaHighlight === idx
                                ? 'bg-blue-200 dark:bg-blue-800/60 ring-2 ring-blue-500 ring-inset shadow-sm'
                                : evento.flag_urgente
                                  ? 'bg-red-100 dark:bg-red-950/40 hover:bg-red-200/70 dark:hover:bg-red-900/40'
                                  : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'
                            }`}
                          >
                            {/* Colunas Fixas (Data, Dia, Artista, Receita Real, Meta M1) */}
                            <td className="sticky-col-1 px-0.5 py-1.5 text-center text-[11px] font-medium border-r border-[hsl(var(--border))]" style={{width: '48px', minWidth: '48px', backgroundColor: linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white')}}>
                              <Link
                                href={`/analitico/eventos?data=${evento.data_evento}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                title="Ver análise completa deste evento"
                              >
                                {evento.data_curta}
                              </Link>
                            </td>
                            <td className="sticky-col-2 px-0.5 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))]" style={{width: '38px', minWidth: '38px', backgroundColor: linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white')}}>{evento.dia_semana?.substring(0, 3).toUpperCase()}</td>
                            <td className="sticky-col-3 px-2 py-1.5 text-left text-[11px] border-r border-[hsl(var(--border))]" style={{width: '140px', minWidth: '140px', backgroundColor: linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white')}} title={evento.observacoes ? `${evento.evento_nome || 'Sem atração'}\n📌 ${evento.observacoes}` : (evento.evento_nome || 'Sem atração')}>
                              <div className="flex items-center gap-1 min-w-0">
                                {evento.flag_urgente && (
                                  <span title="Urgente (ex.: artista ainda não definido)" className="shrink-0 text-[10px]">🚩</span>
                                )}
                                <Link
                                  href={`/analitico/eventos?data=${evento.data_evento}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="block truncate text-blue-700 dark:text-blue-300 hover:underline"
                                >
                                  {evento.evento_nome || '-'}
                                </Link>
                                {evento.observacoes && (
                                  <span title={evento.observacoes} onClick={(e) => e.stopPropagation()} className="shrink-0 text-amber-500 cursor-help text-[10px]">📌</span>
                                )}
                              </div>
                              {/* Bilheteria externa: marcar p/ o calculate_evento_metrics puxar Yuzer/Sympla */}
                              <div className="flex gap-1 mt-0.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleBilheteria(evento.evento_id, 'usa_yuzer', !!evento.usa_yuzer); }}
                                  title={evento.usa_yuzer ? 'Yuzer: marcado (clique p/ desmarcar)' : 'Yuzer: marcar bilheteria'}
                                  className={`px-1 rounded text-[8px] font-bold leading-tight border ${evento.usa_yuzer ? 'bg-pink-500 text-white border-pink-500' : 'bg-transparent text-gray-400 border-gray-300 dark:border-gray-600'}`}
                                >YZ</button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleBilheteria(evento.evento_id, 'usa_sympla', !!evento.usa_sympla); }}
                                  title={evento.usa_sympla ? 'Sympla: marcado (clique p/ desmarcar)' : 'Sympla: marcar bilheteria'}
                                  className={`px-1 rounded text-[8px] font-bold leading-tight border ${evento.usa_sympla ? 'bg-amber-500 text-white border-amber-500' : 'bg-transparent text-gray-400 border-gray-300 dark:border-gray-600'}`}
                                >SY</button>
                              </div>
                            </td>
                            <td className="sticky-col-4 px-2 py-1.5 text-left text-[11px] text-[hsl(var(--muted-foreground))] border-r border-[hsl(var(--border))] cursor-pointer" style={{width: '160px', minWidth: '160px', backgroundColor: linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white')}} title={(evento.artistas || []).join(', ') || 'Sem artista taggeado'} onClick={() => abrirModal(evento, true)}>
                              <div className="truncate">{(evento.artistas || []).length ? (evento.artistas || []).join(', ') : <span className="text-gray-300 dark:text-gray-600">—</span>}</div>
                            </td>
                            <td
                              onClick={(e) => {
                                e.stopPropagation();
                                setLinhaHighlight(idx);
                                setColunaHighlight(prev => prev === 'real_receita' ? null : 'real_receita');
                              }}
                              className="sticky-col-5 px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer"
                              style={{width: '110px', minWidth: '110px', backgroundColor: colunaHighlight === 'real_receita' ? 'rgb(239, 246, 255)' : (linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white'))}}>
                              {evento.real_receita > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={`font-semibold cursor-help underline decoration-dotted ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {formatarMoeda(evento.real_receita)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                    {temDetalheFinanceiro(evento) ? (
                                      <div className="text-xs space-y-1">
                                        <p><span className="font-semibold">Faturamento bruto ContaHub:</span> {formatarMoeda(evento.contahub_bruto || 0)}</p>
                                        <p><span className="font-semibold">Conta assinada:</span> {formatarMoeda(evento.conta_assinada || 0)}</p>
                                        <p><span className="font-semibold">Faturamento liquido ContaHub:</span> {formatarMoeda(evento.contahub_liquido || 0)}</p>
                                        {(Number(evento.yuzer_liquido || 0) > 0 || Number(evento.yuzer_entrada || 0) > 0 || Number(evento.yuzer_bar || 0) > 0) && (
                                          <>
                                            <p><span className="font-semibold">Faturamento Yuzer entrada:</span> {formatarMoeda(evento.yuzer_entrada || 0)}</p>
                                            <p><span className="font-semibold">Faturamento Yuzer bar:</span> {formatarMoeda(evento.yuzer_bar || 0)}</p>
                                            <p><span className="font-semibold">Descontos Yuzer:</span> {formatarMoeda(evento.yuzer_descontos || 0)}</p>
                                            <p><span className="font-semibold">Faturamento liquido Yuzer:</span> {formatarMoeda(evento.yuzer_liquido || 0)}</p>
                                          </>
                                        )}
                                        {Number(evento.sympla_liquido || 0) > 0 && (
                                          <p><span className="font-semibold">Faturamento liquido Sympla:</span> {formatarMoeda(evento.sympla_liquido || 0)}</p>
                                        )}
                                        <p className="pt-1 border-t border-[hsl(var(--border))]">
                                          <span className="font-semibold">Faturamento total:</span> {formatarMoeda(evento.faturamento_total_detalhado || evento.real_receita || 0)}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="text-xs">
                                        <p><span className="font-semibold">Faturamento bruto ContaHub:</span> {formatarMoeda(evento.contahub_bruto || 0)}</p>
                                        <p><span className="font-semibold">Conta assinada:</span> {formatarMoeda(evento.conta_assinada || 0)}</p>
                                        <p><span className="font-semibold">Faturamento liquido ContaHub:</span> {formatarMoeda(evento.contahub_liquido || 0)}</p>
                                      </div>
                                    )}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className={`font-semibold ${evento.real_vs_m1_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>-</span>
                              )}
                            </td>
                            <td 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setLinhaHighlight(idx); 
                                setColunaHighlight(prev => prev === 'm1_receita' ? null : 'm1_receita');
                              }}
                              className="sticky-col-6 px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))] cursor-pointer"
                              style={{width: '110px', minWidth: '110px', backgroundColor: colunaHighlight === 'm1_receita' ? 'rgb(239, 246, 255)' : (linhaHighlight === idx ? 'rgb(191, 219, 254)' : (evento.flag_urgente ? 'rgb(254, 226, 226)' : 'white'))}}>{evento.m1_receita > 0 ? formatarMoeda(evento.m1_receita) : '-'}{evento.m1_manual && evento.m1_receita > 0 && <span title="Meta M1 editada manualmente (não veio da calculadora)" className="ml-0.5 text-amber-500 cursor-help text-[9px] align-top">🔔</span>}</td>
                            
                            {/* Grupo CLIENTES */}
                            {gruposAbertos.clientes ? (
                              <>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'clientes_real' ? null : 'clientes_real');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'clientes_real' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.ci_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.clientes_real || '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'res_tot' ? null : 'res_tot');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'res_tot' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                                  {selectedBar?.id === 4 ? (
                                    editandoReservas?.id === evento.evento_id && editandoReservas?.campo === 'res_tot' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          className="w-14 px-1 py-0.5 text-center text-[11px] border border-blue-400 rounded bg-[hsl(var(--background))] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                          value={valorReservaTemp}
                                          onChange={(e) => setValorReservaTemp(e.target.value)}
                                          onBlur={() => salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0);
                                            if (e.key === 'Escape') { setEditandoReservas(null); setValorReservaTemp(''); }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); salvarReservaInline(evento.evento_id, 'res_tot', parseInt(valorReservaTemp) || 0); }}
                                          className="p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-center justify-center gap-1 cursor-pointer group/edit hover:bg-amber-50 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setEditandoReservas({id: evento.evento_id, campo: 'res_tot'}); setValorReservaTemp(String(evento.res_tot || 0)); }}
                                      >
                                        <span className="font-medium">{evento.res_tot || '0'}</span>
                                        <Pencil className="h-3 w-3 text-amber-500 opacity-50 group-hover/edit:opacity-100 transition-opacity" />
                                      </div>
                                    )
                                  ) : (
                                    evento.res_tot || '-'
                                  )}
                                </td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'res_p' ? null : 'res_p');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r-2 border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'res_p' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}>
                                  {selectedBar?.id === 4 ? (
                                    editandoReservas?.id === evento.evento_id && editandoReservas?.campo === 'res_p' ? (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          className="w-14 px-1 py-0.5 text-center text-[11px] border border-blue-400 rounded bg-[hsl(var(--background))] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                          value={valorReservaTemp}
                                          onChange={(e) => setValorReservaTemp(e.target.value)}
                                          onBlur={() => salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0);
                                            if (e.key === 'Escape') { setEditandoReservas(null); setValorReservaTemp(''); }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <button
                                          onClick={(e) => { e.stopPropagation(); salvarReservaInline(evento.evento_id, 'res_p', parseInt(valorReservaTemp) || 0); }}
                                          className="p-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600"
                                        >
                                          <Check className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-center justify-center gap-1 cursor-pointer group/edit hover:bg-amber-50 dark:hover:bg-amber-900/30 px-1 py-0.5 rounded transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setEditandoReservas({id: evento.evento_id, campo: 'res_p'}); setValorReservaTemp(String(evento.res_p || 0)); }}
                                      >
                                        <span className="font-medium">{evento.res_p || '0'}</span>
                                        <Pencil className="h-3 w-3 text-amber-500 opacity-50 group-hover/edit:opacity-100 transition-opacity" />
                                      </div>
                                    )
                                  ) : (
                                    evento.res_p || '-'
                                  )}
                                </td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            {/* Grupo TICKET */}
                            {gruposAbertos.ticket ? (
                              <>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'te_real' ? null : 'te_real');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'te_real' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.te_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.te_real > 0 ? formatarMoeda(evento.te_real) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'tb_real' ? null : 'tb_real');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'tb_real' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.tb_real_vs_plan_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.tb_real > 0 ? formatarMoeda(evento.tb_real) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 't_medio' ? null : 't_medio');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] border-r-2 border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 't_medio' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}><span className={`font-semibold ${evento.t_medio_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.t_medio > 0 ? formatarMoeda(evento.t_medio) : '-'}</span></td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            {/* Grupo ARTÍSTICO */}
                            {gruposAbertos.artistico ? (
                              <>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'c_art' ? null : 'c_art');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'c_art' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>{evento.c_art > 0 ? (
                                    <span className={evento.c_art_is_projecao ? 'text-amber-600 dark:text-amber-400' : ''} title={evento.c_art_is_projecao ? 'Projeção (manual via modal ou média 4 semanas) — o real do Conta Azul substitui quando chega' : undefined}>{evento.c_art_is_projecao ? '⚠️ ' : ''}{formatarMoeda(evento.c_art)}</span>
                                  ) : '-'}</td>

                                {/* Custo Produção (computa pros 2 bares; Deboche fica 0 até ter lançamento) */}
                                <td
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinhaHighlight(idx);
                                    setColunaHighlight(prev => prev === 'c_prod' ? null : 'c_prod');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'c_prod' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`}
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>{evento.c_prod > 0 ? (
                                    <span className={evento.c_prod_is_projecao ? 'text-amber-600 dark:text-amber-400' : ''} title={evento.c_prod_is_projecao ? 'Projeção pré-lançada (média 4 semanas) — substitui pelo real do Conta Azul' : undefined}>{evento.c_prod_is_projecao ? '⚠️ ' : ''}{formatarMoeda(evento.c_prod)}</span>
                                  ) : '-'}</td>

                                {/* $ Couvert */}
                                <td
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinhaHighlight(idx);
                                    setColunaHighlight(prev => prev === 'couvert_vr' ? null : 'couvert_vr');
                                  }}
                                  className={`px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'couvert_vr' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`}
                                  style={{width: '110px', minWidth: '110px', maxWidth: '110px'}}>
                                    {evento.couvert_vr_contahub !== null && evento.couvert_vr_contahub !== undefined && evento.couvert_vr_contahub > 0
                                      ? formatarMoeda(evento.couvert_vr_contahub)
                                      : '-'}
                                </td>

                                {/* % Art/Fat */}
                                <td
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinhaHighlight(idx);
                                    setColunaHighlight(prev => prev === 'percent_art_fat' ? null : 'percent_art_fat');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_art_fat' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`}
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                                    <span className={`font-semibold ${evento.percent_art_fat_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {evento.percent_art_fat > 0 ? formatarPercentual(evento.percent_art_fat) : '-'}
                                    </span>
                                  </td>

                                {/* Couv/Art */}
                                <td
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinhaHighlight(idx);
                                    setColunaHighlight(prev => prev === 'couv_art' ? null : 'couv_art');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'couv_art' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`}
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>
                                    <span className={`font-semibold ${
                                      evento.couvert_c_art_green
                                        ? 'text-green-600 dark:text-green-400'
                                        : evento.c_art > 0
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-[hsl(var(--muted-foreground))]'
                                    }`}>
                                      {evento.c_art > 0 && evento.couvert_vr_contahub && evento.couvert_vr_contahub > 0
                                        ? formatarPercentual((evento.couvert_vr_contahub / evento.c_art) * 100)
                                        : evento.c_art > 0 ? '0,0%' : '-'}
                                    </span>
                                  </td>
                                <td
                                  className="px-2 py-1.5 text-right text-[11px] text-[hsl(var(--foreground))] border-r-2 border-[hsl(var(--border))]"
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}
                                  title="Consumação Artistas (ContaHub: descontos com motivo 'Artistas')">
                                  {(evento.consumacao || 0) > 0 ? formatarMoeda(evento.consumacao || 0) : '-'}
                                </td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}

                            {/* Grupo PRODUÇÃO */}
                            {gruposAbertos.producao ? (
                              <>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'percent_b' ? null : 'percent_b');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_b' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_b > 0 ? formatarPercentual(evento.percent_b) : '-'}</td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'percent_d' ? null : 'percent_d');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_d' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_d > 0 ? formatarPercentual(evento.percent_d) : '-'}</td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'percent_c' ? null : 'percent_c');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] text-[hsl(var(--foreground))] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'percent_c' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '90px', minWidth: '90px', maxWidth: '90px'}}>{evento.percent_c > 0 ? formatarPercentual(evento.percent_c) : '-'}</td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'atrasao_cozinha' ? null : 'atrasao_cozinha');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'atrasao_cozinha' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}><span className={`font-semibold ${evento.atrasao_cozinha_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.atrasao_cozinha > 0 ? formatarContagem(evento.atrasao_cozinha) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'atrasao_bar' ? null : 'atrasao_bar');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'atrasao_bar' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '105px', minWidth: '105px', maxWidth: '105px'}}><span className={`font-semibold ${evento.atrasao_bar_green ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{evento.atrasao_bar > 0 ? formatarContagem(evento.atrasao_bar) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'stockout_drinks' ? null : 'stockout_drinks');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'stockout_drinks' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`} 
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.stockout_drinks_status === 'green' ? 'text-green-600 dark:text-green-400' : evento.stockout_drinks_status === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{evento.stockout_drinks_perc > 0 ? formatarPercentual(evento.stockout_drinks_perc) : '-'}</span></td>
                                <td 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setLinhaHighlight(idx); 
                                    setColunaHighlight(prev => prev === 'stockout_comidas' ? null : 'stockout_comidas');
                                  }}
                                  className={`px-2 py-1.5 text-center text-[11px] border-r border-[hsl(var(--border))] cursor-pointer transition-colors ${colunaHighlight === 'stockout_comidas' ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-300 dark:ring-blue-700' : 'hover:bg-blue-100/70 dark:hover:bg-blue-900/30'}`}
                                  style={{width: '100px', minWidth: '100px', maxWidth: '100px'}}><span className={`font-semibold ${evento.stockout_comidas_status === 'green' ? 'text-green-600 dark:text-green-400' : evento.stockout_comidas_status === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{evento.stockout_comidas_perc > 0 ? formatarPercentual(evento.stockout_comidas_perc) : '-'}</span></td>
                                <td className="px-2 py-1.5 text-center text-[11px] border-r-2 border-[hsl(var(--border))]" style={{width: '95px', minWidth: '95px', maxWidth: '95px'}}
                                  title={evento.cmv_teorico_custo ? `Custo teórico do dia: ${formatarMoeda(evento.cmv_teorico_custo)}` : undefined}>
                                  {evento.cmv_teorico_pct != null ? (
                                    <span className={`font-semibold ${Number(evento.cmv_teorico_pct) < 33 ? 'text-green-600 dark:text-green-400' : Number(evento.cmv_teorico_pct) < 45 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{formatarPercentual(evento.cmv_teorico_pct)}</span>
                                  ) : <span className="text-[hsl(var(--muted-foreground))]">-</span>}
                                </td>
                              </>
                            ) : (
                              <td className="px-2 py-1.5 text-center text-[11px] text-[hsl(var(--muted-foreground))] border-r-2 border-[hsl(var(--border))]" style={{width: '80px', minWidth: '80px', maxWidth: '80px'}}>•••</td>
                            )}
                            
                            <td className="px-2 py-2 text-center" style={{width: '120px', minWidth: '120px', maxWidth: '120px'}}>
                              <div className="flex gap-1.5 justify-center">
                                <Button onClick={(e) => { e.stopPropagation(); abrirModal(evento, false); }} size="sm" variant="outline" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5" /></Button>
                                <Button onClick={(e) => { e.stopPropagation(); abrirModal(evento, true); }} size="sm" variant="outline" className="h-7 w-7 p-0"><Edit className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                          </React.Fragment>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold text-[11px] text-gray-800 dark:text-gray-100">
                        {/* Fixos: sempre visíveis (item 1). Colspan=3 cobre Data+Dia+Artista. */}
                        <td colSpan={4} className={`${tfCls} text-left border-r`} style={{ position: 'sticky', left: 0, zIndex: 30 }}>TOTAIS · {totaisAgregados.totalEventos} ev</td>
                        <td className={`${tfCls} text-center text-green-700 dark:text-green-400 border-r`} style={{ position: 'sticky', left: 386, zIndex: 30 }} title="Soma da receita real">{formatarMoeda(totaisAgregados.realizado)}</td>
                        <td className={`${tfCls} text-center border-r-2`} style={{ position: 'sticky', left: 496, zIndex: 30 }} title="Soma da meta M1">{formatarMoeda(totaisAgregados.metaM1)}</td>

                        {/* CLIENTES (soma) */}
                        {gruposAbertos.clientes ? (
                          <>
                            <td className={`${tfCls} text-center border-r`} title="Total de clientes reais">{totaisAgregados.colClientesReais.toLocaleString('pt-BR')}</td>
                            <td className={`${tfCls} text-center border-r`} title="Total de reservas">{totaisAgregados.colResTot.toLocaleString('pt-BR')}</td>
                            <td className={`${tfCls} text-center border-r-2`} title="Total de reservas presentes">{totaisAgregados.colResP.toLocaleString('pt-BR')}</td>
                          </>
                        ) : (
                          <td className={`${tfCls} border-r-2`}></td>
                        )}

                        {/* TICKET (média) */}
                        {gruposAbertos.ticket ? (
                          <>
                            <td className={`${tfCls} text-center border-r`} title="Média da entrada real">{formatarMoeda(totaisAgregados.colTeReal)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média do bar real">{formatarMoeda(totaisAgregados.colTbReal)}</td>
                            <td className={`${tfCls} text-center border-r-2`} title="Ticket médio">{formatarMoeda(totaisAgregados.colTMedio)}</td>
                          </>
                        ) : (
                          <td className={`${tfCls} border-r-2`}></td>
                        )}

                        {/* ARTÍSTICO (somas + médias dos %) */}
                        {gruposAbertos.artistico ? (
                          <>
                            <td className={`${tfCls} text-center border-r`} title="Total custo artístico">{formatarMoeda(totaisAgregados.colCArt)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Total custo produção">{formatarMoeda(totaisAgregados.colCProd)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Total $ couvert">{formatarMoeda(totaisAgregados.colCouvert)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média % art/fat">{formatarPercentual(totaisAgregados.colPercentArtFat)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média couv/art">{formatarPercentual(totaisAgregados.colCouvArt)}</td>
                            <td className={`${tfCls} text-center border-r-2`} title="Total consumação">{formatarMoeda(totaisAgregados.colConsumacao)}</td>
                          </>
                        ) : (
                          <td className={`${tfCls} border-r-2`}></td>
                        )}

                        {/* PRODUÇÃO (médias dos %, somas dos atrasões) */}
                        {gruposAbertos.producao ? (
                          <>
                            <td className={`${tfCls} text-center border-r`} title="Média % bebidas">{formatarPercentual(totaisAgregados.colPercentB)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média % drinks">{formatarPercentual(totaisAgregados.colPercentD)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média % cozinha">{formatarPercentual(totaisAgregados.colPercentC)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Total atrasão cozinha">{formatarContagem(totaisAgregados.colAtrasaoCoz)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Total atrasão drinks">{formatarContagem(totaisAgregados.colAtrasaoBar)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média stockout drinks">{formatarPercentual(totaisAgregados.colStockoutDrinks)}</td>
                            <td className={`${tfCls} text-center border-r`} title="Média stockout comidas">{formatarPercentual(totaisAgregados.colStockoutComidas)}</td>
                            <td className={`${tfCls} text-center border-r-2`} title="CMV teórico ponderado do período">{totaisAgregados.colCmvTeorico != null ? formatarPercentual(totaisAgregados.colCmvTeorico) : '-'}</td>
                          </>
                        ) : (
                          <td className={`${tfCls} border-r-2`}></td>
                        )}

                        {/* Ações */}
                        <td className={tfCls}></td>
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="w-64 flex-shrink-0 hidden md:block">
                <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))] rounded-xl shadow-sm p-4 sticky top-4">
                  <div className="space-y-3">
                    <div className="border-b border-[hsl(var(--border))] pb-3">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Filter className="h-4 w-4" /> Controles
                      </h3>
                    </div>
                    
                    {/* Botões de Expandir/Recolher */}
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={expandirTodos} 
                        className="flex-1 h-8"
                        leftIcon={<Maximize2 className="h-3.5 w-3.5" />}
                      >
                        Expandir
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={recolherTodos} 
                        className="flex-1 h-8"
                        leftIcon={<Minimize2 className="h-3.5 w-3.5" />}
                      >
                        Recolher
                      </Button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-3">Período</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Select value={filtroMes.toString()} onValueChange={(value) => alterarPeriodo(parseInt(value), filtroAno)}>
                          <SelectTrigger className="bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                          <SelectContent>{meses.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={filtroAno.toString()} onValueChange={(value) => alterarPeriodo(filtroMes, parseInt(value))}>
                          <SelectTrigger className="bg-[hsl(var(--background))]"><SelectValue /></SelectTrigger>
                          <SelectContent>{anos.map(a => <SelectItem key={a} value={a.toString()}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[hsl(var(--border))]">
                      <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4" /> Estatísticas</h3>
                      <div className="space-y-3 text-xs">
                         <div className="space-y-1.5">
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Meta M1:</span> <span className="font-medium text-[hsl(var(--foreground))]">{formatarMoeda(totaisAgregados.metaM1)}</span></div>
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Realizado:</span><span className={`font-medium ${totaisAgregados.realizado >= totaisAgregados.metaM1 ? 'text-green-600' : 'text-red-600'}`}>{formatarMoeda(totaisAgregados.realizado)}</span></div>
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Atingido:</span><span className="font-medium">{totaisAgregados.metaM1 > 0 ? ((totaisAgregados.realizado / totaisAgregados.metaM1) * 100).toFixed(1) : '0.0'}%</span></div>
                            <div className="flex justify-between">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[hsl(var(--muted-foreground))] cursor-help underline decoration-dotted">Falta faturar:</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs">
                                    <p>Diferença entre a Meta M1 e o Realizado até o momento</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <span className={`font-medium ${totaisAgregados.metaM1 - totaisAgregados.realizado > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                {totaisAgregados.metaM1 - totaisAgregados.realizado < 0 ? '-' : ''}{formatarMoeda(Math.abs(totaisAgregados.metaM1 - totaisAgregados.realizado))}
                              </span>
                            </div>
                         </div>
                         
                         <div className="pt-3 border-t border-[hsl(var(--border))]">
                            <div className="flex justify-between items-center mb-1.5"><span className="font-medium">Empilhamento M1:</span><span className="font-bold">{formatarMoeda(totaisAgregados.empilhamento)}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">GAP:</span><span className={totaisAgregados.isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>{totaisAgregados.isPositive ? "+" : ""}{formatarMoeda(totaisAgregados.gap)} ({totaisAgregados.isPositive ? "+" : ""}{totaisAgregados.gapPercent.toFixed(1)}%)</span></div>
                         </div>
                         
                         <div className="pt-3 border-t border-[hsl(var(--border))] space-y-1.5">
                            <div className="flex justify-between"><span className="text-[hsl(var(--muted-foreground))]">Período:</span><span className="font-medium text-[hsl(var(--foreground))]">{meses.find(m => m.value === filtroMes)?.label} {filtroAno}</span></div>
                            <div className="flex justify-between">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[hsl(var(--muted-foreground))] cursor-help underline decoration-dotted">Dias (faturado / com evento):</span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                  <div className="text-xs space-y-1">
                                    <p><span className="font-semibold">Dias com faturamento (real &gt; 0):</span> {totaisAgregados.totalDiasRealizados}</p>
                                    <p><span className="font-semibold">Dias com pelo menos um evento na lista:</span> {totaisAgregados.totalDiasComEvento}</p>
                                    <p className="pt-1 border-t border-[hsl(var(--border))]"><span className="font-semibold">Linhas (incl. 2+ no mesmo dia):</span> {totaisAgregados.totalEventosRealizados} com faturamento / {totaisAgregados.totalEventos} no mês</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                              <span className="font-medium text-[hsl(var(--foreground))]">{totaisAgregados.totalDiasRealizados} / {totaisAgregados.totalDiasComEvento}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[hsl(var(--muted-foreground))]">Eventos (linhas):</span>
                              <span className="font-medium text-[hsl(var(--foreground))]">{totaisAgregados.totalEventosRealizados} / {totaisAgregados.totalEventos}</span>
                            </div>
                         </div>
                      </div>
                    </div>
                    {lucroLiquidoProjetado !== null && (
                      <div className="pt-4 border-t border-[hsl(var(--border))]">
                        <h3 className="font-semibold text-[hsl(var(--foreground))] flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4" /> Lucro Líquido Projetado</h3>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[hsl(var(--muted-foreground))] cursor-help underline decoration-dotted">Lucro Líquido (proj.):</span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs bg-[hsl(var(--popover))] border-[hsl(var(--border))] z-[9999]">
                                <div className="text-xs">
                                  <p>Projeção do mês vinda da Orçamentação (empilhamento da receita menos custos variáveis, CMV e fixos, somando não operacionais). Atualiza junto com o planejamento.</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                            <span className={`font-bold ${lucroLiquidoProjetado >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatarMoeda(lucroLiquidoProjetado)}</span>
                          </div>
                          {margemProjetada !== null && (
                            <div className="flex justify-between">
                              <span className="text-[hsl(var(--muted-foreground))]">Margem (proj.):</span>
                              <span className={`font-medium ${margemProjetada >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{margemProjetada.toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <CalculadoraDistribuicao
                      barId={selectedBar?.id}
                      ano={filtroAno}
                      mes={filtroMes}
                      mesLabel={`${meses.find(m => m.value === filtroMes)?.label || ''} ${filtroAno}`}
                      diasManuais={dados.filter(e => e.m1_manual).length}
                      onAplicado={() => router.refresh()}
                    />
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição/Visualização */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogContent className="max-w-[96vw] max-h-[92vh] sm:max-w-[88vw] lg:max-w-[70vw] p-0 overflow-hidden rounded-lg shadow-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
              <DialogHeader className="bg-[hsl(var(--muted))] p-4 border-b border-[hsl(var(--border))]"><DialogTitle className="flex items-center gap-3 text-xl font-semibold text-[hsl(var(--foreground))]"><BarChart3 className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />{modoEdicao ? 'Editar Evento' : 'Visualizar Evento'} - {eventoEdicao?.nome}</DialogTitle><DialogDescription>{modoEdicao ? 'Edite os dados planejados e reais' : 'Comparativo Planejado vs Realizado'}</DialogDescription></DialogHeader>
              <div className="flex-1 overflow-y-auto p-3">
                <div className="mb-3 p-3 bg-[hsl(var(--muted))] rounded border">
                  <Label>Nome / Label do Evento</Label>
                  {modoEdicao
                    ? <LabelField value={eventoEdicao?.nome || ''} options={labelsCadastro} onChange={(nome) => setEventoEdicao(p => p ? {...p, nome} : null)} />
                    : <div className="p-2 bg-[hsl(var(--background))] rounded border">{eventoEdicao?.nome || '-'}</div>}
                </div>
                <label className={`mb-3 flex items-center gap-2 p-3 rounded border cursor-pointer select-none ${eventoEdicao?.flag_urgente ? 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800' : 'bg-[hsl(var(--muted))] border-[hsl(var(--border))]'} ${modoEdicao ? '' : 'pointer-events-none opacity-80'}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-red-600"
                    checked={!!eventoEdicao?.flag_urgente}
                    disabled={!modoEdicao}
                    onChange={(e) => setEventoEdicao(p => p ? {...p, flag_urgente: e.target.checked} : null)}
                  />
                  <span className="text-sm font-medium">🚩 Marcar como urgente <span className="font-normal text-[hsl(var(--muted-foreground))]">(pinta a linha de vermelho — ex.: artista ainda não definido)</span></span>
                </label>
                <div className="mb-3 p-3 bg-[hsl(var(--muted))] rounded border">
                  <Label>Observação <span className="text-xs text-muted-foreground font-normal">(ex: Copa do Mundo - Brasil x Noruega 17h)</span></Label>
                  {modoEdicao
                    ? <Input value={eventoEdicao?.observacoes || ''} onChange={e => setEventoEdicao(p => p ? {...p, observacoes: e.target.value} : null)} placeholder="Contexto extra do dia (aparece no 📌 da tabela)" />
                    : <div className="p-2 bg-[hsl(var(--background))] rounded border">{eventoEdicao?.observacoes || '—'}</div>}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><h2 className="font-semibold">PLANEJADO</h2></div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Receita M1</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.m1_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, m1_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.m1_r)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Clientes</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_plan: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{(eventoEdicao?.cl_plan || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Ticket Entrada</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.te_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, te_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.te_plan)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Ticket Bar</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.tb_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, tb_plan: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.tb_plan)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border">
                        <Label className="flex items-center gap-1.5">Custo Artístico / Prod (Previsão){(eventoEdicao?.c_art_is_projecao || eventoEdicao?.c_prod_is_projecao) && <span className="text-amber-600 dark:text-amber-400">⚠️</span>}</Label>
                        {modoEdicao
                          ? <div className="flex gap-2">
                              <Input type="number" value={eventoEdicao?.c_artistico_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_artistico_plan: parseFloat(e.target.value) || 0} : null)} />
                              <Input type="number" value={eventoEdicao?.c_prod_plan || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_prod_plan: parseFloat(e.target.value) || 0} : null)} />
                            </div>
                          : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.c_artistico_plan)} / {formatarMoeda(eventoEdicao?.c_prod_plan)}</div>}
                        <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">Previsão (artístico / produção). Fica em amarelo até o Conta Azul lançar o valor real, que substitui automaticamente.</p>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-2 pb-2 border-b"><div className="w-3 h-3 bg-green-500 rounded-full"></div><h2 className="font-semibold">REALIZADO</h2></div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Receita Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.real_r || 0} onChange={e => setEventoEdicao(p => p ? {...p, real_r: parseFloat(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{formatarMoeda(eventoEdicao?.real_r)}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Clientes Real</Label>{modoEdicao ? <Input type="number" value={eventoEdicao?.cl_real || 0} onChange={e => setEventoEdicao(p => p ? {...p, cl_real: parseInt(e.target.value)} : null)} /> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{(eventoEdicao?.cl_real || 0).toLocaleString()}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border"><Label>Reservas (Total / Pagas)</Label>{modoEdicao ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.res_tot || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_tot: parseInt(e.target.value)} : null)} /><Input type="number" value={eventoEdicao?.res_p || 0} onChange={e => setEventoEdicao(p => p ? {...p, res_p: parseInt(e.target.value)} : null)} /></div> : <div className="p-2 bg-[hsl(var(--background))] rounded border">{eventoEdicao?.res_tot} / {eventoEdicao?.res_p}</div>}</div>
                      <div className="p-3 bg-[hsl(var(--muted))] rounded border">
                        <Label>Custo Artístico / Prod (Conta Azul)</Label>
                        {modoEdicao && !eventoEdicao?.c_art_is_projecao && !eventoEdicao?.c_prod_is_projecao
                          ? <div className="flex gap-2"><Input type="number" value={eventoEdicao?.c_art || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_art: parseFloat(e.target.value) || 0} : null)} /><Input type="number" value={eventoEdicao?.c_prod || 0} onChange={e => setEventoEdicao(p => p ? {...p, c_prod: parseFloat(e.target.value) || 0} : null)} /></div>
                          : <>
                              <div className="p-2 bg-[hsl(var(--background))] rounded border">{(eventoEdicao?.c_art || 0) > 0 ? formatarMoeda(eventoEdicao?.c_art) : '—'} / {(eventoEdicao?.c_prod || 0) > 0 ? formatarMoeda(eventoEdicao?.c_prod) : '—'}</div>
                              {modoEdicao && <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">Preenchido automaticamente pelo Conta Azul quando o evento for lançado. Até lá, edite a previsão ao lado.</p>}
                            </>}
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800"><h3 className="text-base font-medium mb-2 text-[hsl(var(--foreground))] flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" /> Atrasos de Entrega</h3><div className="grid grid-cols-2 gap-4"><div><Label>Cozinha</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_cozinha ?? 0}</div></div><div><Label>Bar</Label><div className="mt-1 font-medium">{eventoEdicao?.atrasos_bar ?? 0}</div></div></div></div>
                   </div>
                </div>

                {/* Artistas do evento (nome + janela de horário) — base das análises por artista */}
                <div className="mt-4 p-3 bg-[hsl(var(--muted))] rounded border">
                  <Label className="flex items-center gap-1.5"><Music className="h-4 w-4" /> Artistas (quem tocou)</Label>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 mb-2">
                    Separe os artistas do nome do dia, com horário de início e fim — assim dá pra puxar público, consumo e relatórios por artista.
                  </p>
                  {modoEdicao ? (
                    <div className="space-y-2">
                      {(eventoEdicao?.artistas || []).map((a, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <div className="flex-1 min-w-[180px]">
                            <ArtistaField
                              value={a.artista_nome}
                              options={artistasCadastro}
                              onChange={(nome, id) => setArtistaLinha(i, { artista_nome: nome, artista_id: id })}
                            />
                          </div>
                          <Input type="time" value={a.horario_inicio || ''} onChange={(e) => setArtistaLinha(i, { horario_inicio: e.target.value })} className="w-[7.5rem]" title="Início" />
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">até</span>
                          <Input type="time" value={a.horario_fim || ''} onChange={(e) => setArtistaLinha(i, { horario_fim: e.target.value })} className="w-[7.5rem]" title="Fim" />
                          <Button variant="ghost" size="icon" onClick={() => removerArtista(i)} title="Remover artista"><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={addArtista}><Plus className="h-4 w-4 mr-1" /> Adicionar artista</Button>
                    </div>
                  ) : (eventoEdicao?.artistas || []).length > 0 ? (
                    <ul className="space-y-1">
                      {(eventoEdicao?.artistas || []).map((a, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <span className="font-medium">{a.artista_nome}</span>
                          {(a.horario_inicio || a.horario_fim) && (
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">
                              {a.horario_inicio || '—'}{a.horario_fim ? `–${a.horario_fim}` : ''}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum artista cadastrado neste evento.</p>
                  )}
                </div>
              </div>
              <DialogFooter className="bg-[hsl(var(--muted))] p-4 border-t"><Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>{modoEdicao && <Button onClick={salvarEdicao} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Alterações'}</Button>}</DialogFooter>
            </DialogContent>
      </Dialog>

      {/* Modal de Cadastro de Eventos (mês vazio) */}
      <Dialog open={cadastroOpen} onOpenChange={setCadastroOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-[640px] max-h-[92vh] p-0 overflow-hidden rounded-lg bg-[hsl(var(--background))] border border-[hsl(var(--border))]">
          <DialogHeader className="bg-[hsl(var(--muted))] p-4 border-b border-[hsl(var(--border))]">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Calendar className="h-5 w-5" /> Cadastrar Eventos — {meses.find(m => m.value === filtroMes)?.label} {filtroAno}
            </DialogTitle>
            <DialogDescription>Informe a data, o artista/atração e a meta M1 de cada dia. Os custos e demais campos são preenchidos depois (projeção/Conta Azul).</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <div className="flex flex-wrap gap-2 mb-2">
              <Button size="sm" variant="outline" onClick={gerarDiasDoMes} leftIcon={<Calendar className="h-3.5 w-3.5" />}>Gerar todos os dias do mês</Button>
              <Button size="sm" variant="outline" onClick={addLinhaCadastro} leftIcon={<Check className="h-3.5 w-3.5" />}>+ Adicionar linha</Button>
            </div>

            <div className="grid grid-cols-[120px_1fr_110px_32px] gap-2 px-1 text-[11px] font-medium text-[hsl(var(--muted-foreground))]">
              <span>Data</span><span>Artista / Atração</span><span>Meta M1</span><span></span>
            </div>

            {linhasCadastro.length === 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">Nenhuma linha. Use os botões acima para começar.</p>
            )}

            {linhasCadastro.map((linha, i) => (
              <div key={i} className="grid grid-cols-[120px_1fr_110px_32px] gap-2 items-center">
                <Input type="date" value={linha.data_evento} onChange={e => editarLinhaCadastro(i, 'data_evento', e.target.value)} className="h-9 text-xs" />
                <Input value={linha.nome} onChange={e => editarLinhaCadastro(i, 'nome', e.target.value)} placeholder={linha.data_evento ? diaSemanaDeData(linha.data_evento) : 'Ex: Pagode Vira Lata'} className="h-9 text-xs" />
                <Input type="number" value={linha.m1_r} onChange={e => editarLinhaCadastro(i, 'm1_r', e.target.value)} placeholder="0" className="h-9 text-xs" />
                <Button size="sm" variant="ghost" className="h-9 w-8 p-0" onClick={() => removerLinhaCadastro(i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <DialogFooter className="bg-[hsl(var(--muted))] p-4 border-t">
            <Button variant="outline" onClick={() => setCadastroOpen(false)}>Cancelar</Button>
            <Button onClick={salvarCadastro} disabled={salvandoCadastro}>{salvandoCadastro ? 'Salvando...' : 'Salvar Eventos'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
