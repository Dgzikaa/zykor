'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useBar } from '@/contexts/BarContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Save,
  Plus,
  Trash2,
  Target,
  Settings,
  BarChart3,
  ListTodo,
  Users,
  TrendingUp,
  DollarSign,
  Percent,
  AlertTriangle,
  Star,
  Building2,
  Megaphone,
  Eye,
  Heart,
  Music
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { formatCurrency } from '@/lib/utils';

interface OKR {
  id?: number;
  epico: string;
  historia: string;
  responsavel: string;
  observacoes: string;
  /** Texto livre de progresso (coluna "Status" da planilha). */
  andamento: string;
  /** Semáforo — ver statusOptions. */
  status: string;
  /** 'GERAL' = OKRs gerais; demais = módulos por área (ver AREAS) */
  area: string;
  /**
   * North Star Metric: a métrica PRINCIPAL da área (Gonza, 18/08/2026). Uma por área — as outras
   * linhas são OKRs de apoio. O banco garante a unicidade com índice parcial.
   */
  is_nsm?: boolean;
}

/**
 * Grids das tabelas de OKR. Colunas fixas para header e linhas baterem.
 * Gerais: Épico | Big Bet | Resp. | OBS | Andamento | Status | ⌫
 * Área:   Tema  | Big Bet | OBS | Andamento | Status | ⌫
 */
const GRID_OKR_GERAL = 'lg:grid-cols-[1.5fr_2.2fr_0.8fr_2.4fr_2.4fr_1.1fr_0.5fr]';
const GRID_OKR_AREA = 'lg:grid-cols-[1.8fr_2.2fr_2.4fr_2.4fr_1.1fr_0.5fr]';

interface OrganizadorData {
  id?: number;
  bar_id: number;
  ano: number;
  /** Legado: organizadores criados antes do modelo semestral. */
  trimestre: number | null;
  semestre: number | null;
  tipo: string;
  // --- Metas DO SEMESTRE ---
  tema_semestre: string;
  meta_faturamento: number | null;
  meta_clientes_ativos: number | null;
  meta_cmv_limpo: number | null;
  meta_artistica: number | null;
  meta_cmo_fixo: number | null;
  // --- Imagem de 1 Ano ---
  faturamento_meta: number | null;
  lucro_liquido_meta: number | null;
  pessoas_meta: number | null;
  artistico_meta: number | null;
  reputacao_meta: number | null;
  // --- Legado (colunas mantidas, fora da planilha atual) ---
  meta_visitas: number | null;
  meta_cmo: number | null;
  // --- Base estratégica ---
  missao: string;
  nicho: string;
  valores_centrais: string[];
  mercado_alvo: string;
  posicionamento: string;
  singularidades: string[];
  /** detalhe de cada Bizu, ALINHADO POR ÍNDICE com valores_centrais */
  valores_centrais_detalhe: DetalheBizu[];
  /** detalhe de cada singularidade, alinhado por índice */
  singularidades_detalhe: DetalheSimples[];
  /** detalhe de cada problema, alinhado por índice */
  principais_problemas_detalhe: DetalheSimples[];
  principais_concorrentes: string;
  principais_problemas: string[];
  meta_10_anos: string;
  imagem_3_anos: string;
  imagem_1_ano: string;
}

/**
 * Detalhe de um Bizu. Os três campos são o que o Gonza pediu em 18/08/2026: o que aquilo quer
 * dizer, e — principalmente — os dois lados da fronteira. "O que NÃO é" costuma ser o que faz o
 * valor virar decisão de verdade em vez de frase de parede.
 */
type DetalheBizu = { detalhamento?: string; o_que_e?: string; o_que_nao_e?: string };
type DetalheSimples = { detalhamento?: string };

/** 7 BIZUS (valores centrais), 3 Singularidades e 5 Principais Problemas — conforme a planilha. */
const QTD_BIZUS = 7;
const QTD_SINGULARIDADES = 3;
const QTD_PROBLEMAS = 5;

const statusOptions = [
  { value: 'verde', label: '✓ Concluído', bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-400', text: 'text-green-700 dark:text-green-300' },
  { value: 'amarelo', label: '◐ Em Progresso', bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
  { value: 'vermelho', label: '✗ Bloqueado', bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-400', text: 'text-red-700 dark:text-red-300' },
  { value: 'cinza', label: '○ Pendente', bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-300', text: 'text-gray-600 dark:text-gray-300' },
];

// Defaults conforme a planilha "ORGANIZADOR VISÃO - TRAÇÃO - 2º SEM 2026".
const defaultOrganizador: OrganizadorData = {
  bar_id: 0,
  ano: new Date().getFullYear(),
  trimestre: null,
  semestre: 2,
  tipo: 'semestral',
  // Metas do semestre
  tema_semestre: 'Segurar Gastos e Ver Dinheiro',
  meta_faturamento: 10000000,
  meta_clientes_ativos: 6500,
  meta_cmv_limpo: 34,
  meta_artistica: 19, // (Atrações+Produção)/Fat
  meta_cmo_fixo: 160000,
  // Imagem de 1 Ano
  faturamento_meta: 18000000,
  lucro_liquido_meta: 1800000,
  pessoas_meta: 6500, // Média-ano Clientes Ativos
  artistico_meta: 19, // (Atrações+Produ)/Fat
  reputacao_meta: 4.9, // Avaliações Google
  // Legado
  meta_visitas: null,
  meta_cmo: null,
  // Base estratégica
  missao: 'Fazer momentos virarem memórias',
  nicho: 'Bares Musicais',
  principais_concorrentes: '',
  valores_centrais_detalhe: [],
  singularidades_detalhe: [],
  principais_problemas_detalhe: [],
  valores_centrais: [
    'Defendemos o nosso Barco, Sempre',
    'Não existe "não é comigo"',
    'Não Seja um Cuzão',
    'A Gente come Dado com Farofa todo dia',
    'Curte o Caminho e não pesa a Lombra',
    'Missão Dada é Missão Cumprida',
    'Errar faz parte, Não aprender, não',
  ],
  mercado_alvo: 'Adulto com Espírito Jovem de 28 a 48, Pagosambeiro',
  posicionamento: 'Para o Sambagodeiro, o Ordi é o Bar que não tem erro',
  singularidades: [
    'O melhor da Festa - (Melhores artistas da cidade, bom som, boa iluminação, melhor horário, grandes projetos)',
    'O melhor do Boteco - Atendimento Eficiente (Garçom cordial, entrega veloz), Bons drinks, poder sentar',
    'Abraça todos os pagosambeiros (coisa que nem Brazólia nem Tia Zélia fazem)',
  ],
  principais_problemas: [
    'Descontrole de Gastos',
    'Despesa Comercial vs Faturamento',
    'Artista Dependência',
    'CMO Fixo',
    'Risco de dar alguma merda reputacional',
  ],
  meta_10_anos: '',
  imagem_3_anos: '',
  imagem_1_ano: 'Se Consolidar como O Bar de Samba de Brasília',
};

const defaultOKRs: OKR[] = [
  // OKR Gerais — planilha "ORGANIZADOR VISÃO - TRAÇÃO - 2º SEM 2026" (O33:S41)
  { epico: 'Descontrole de Gastos', historia: 'Seguir novo BP-base', responsavel: 'Gonza', observacoes: '', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: 'Descontrole de Gastos', historia: 'Abrir custos e colocar Orçamentos em valores absolutos', responsavel: 'Gonza', observacoes: 'Operacional, Consumo Artista, Locações, CMO fixo, Alimentação, etc', andamento: 'Renegociação consumos artista. Ritual de levar os orçamentos prontos na quarta. Readequar estouros de budget e responsabilizar', status: 'cinza', area: 'GERAL' },
  { epico: 'Artista Dependência', historia: 'Repensar proposta de valor dos dias que não dependa do Artista', responsavel: 'Augusto', observacoes: 'Como faturar bem sexta sem o Benza?', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: 'Faturamento', historia: 'Faturamento de Sábado em 85k', responsavel: 'Diogo', observacoes: 'Como fazer Média de 85k com atração de 12,5k? Focalizar promoção, mídia, disparo? Desenhar propostas de investimento de marketing direcionado para sábado. Artistas promoverem os eventos do dia', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: 'Faturamento', historia: 'Dezembro 2.0 Turbo', responsavel: 'Diogo', observacoes: '', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: 'Clientes Ativos', historia: 'Manutenção do Programa de Pontos + Ações específicas de CRM', responsavel: 'Diogo', observacoes: '', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: '(Atração+Produção)/Fat', historia: 'Renegociações de Artistas + Contrato. Revisão dos Custos de Produção', responsavel: 'Corbal', observacoes: '', andamento: '', status: 'cinza', area: 'GERAL' },
  { epico: 'Merda Reputacional', historia: 'Cobrar a entrega de qualidade dos protocolos. Contratamos Assessoria de Imprensa e a assessoria de inclusão', responsavel: 'Corbal', observacoes: '', andamento: '', status: 'cinza', area: 'GERAL' },
];

// ==================== OKRs POR ÁREA ====================
// Cada área é um módulo próprio: Tema | Big Bet | OBS | Status.
interface AreaConfig {
  key: string;
  label: string;
  icon: typeof Target;
  header: string;
  border: string;
  text: string;
}

const AREAS: AreaConfig[] = [
  { key: 'FINANCEIRO', label: 'FINANCEIRO', icon: DollarSign, header: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-400 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'OPERACAO', label: 'OPERAÇÃO', icon: Settings, header: 'bg-sky-100 dark:bg-sky-900/40', border: 'border-sky-400 dark:border-sky-700', text: 'text-sky-700 dark:text-sky-300' },
  { key: 'RECEITA', label: 'RECEITA', icon: TrendingUp, header: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-violet-400 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300' },
  { key: 'ARTISTICO', label: 'ARTÍSTICO', icon: Music, header: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-400 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300' },
  { key: 'RH', label: 'RH', icon: Users, header: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-400 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300' },
  { key: 'PRODUCAO', label: 'PRODUÇÃO', icon: Building2, header: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-400 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300' },
];

// Esqueleto padrão de cada área (usado quando a área ainda não tem linhas salvas).
const defaultOkrsPorArea: Record<string, Array<{ epico: string; historia?: string; observacoes?: string }>> = {
  FINANCEIRO: [
    { epico: '% Proj = Real' },
    { epico: 'Lançamentos Atrasados' },
    { epico: 'Metas dos Discricionários' },
    { epico: 'Meta Custo Art: R$ não %', observacoes: 'Sempre atualizado; cobrar responsáveis; realocar estouros' },
  ],
  OPERACAO: [
    { epico: 'NPS' },
    { epico: 'CMO' },
    { epico: 'Treinamentos por Área' },
  ],
  RECEITA: [
    { epico: 'Reservas' },
    { epico: 'Ativos no Clube' },
    { epico: 'Reservas Sábado' },
    { epico: 'Investimento em Mídia' },
  ],
  ARTISTICO: [
    { epico: 'R$ Produção', historia: 'Renegociação para valor fixo' },
    { epico: 'Consumação', historia: 'Ajuste para rider fixo + renegociação' },
    { epico: 'Revisão de Programação', historia: 'Menos bandas sex e sáb' },
    { epico: 'Meta Custo Art: R$ não %' },
  ],
  RH: [
    { epico: '100% Gestão no Zykor', historia: 'Gonza neles' },
    { epico: 'Dossiê do Funcionário', historia: 'Ajuste para rider fixo + renegociação' },
    { epico: 'Gestão dos Planos de Ação - Marca Empregadora', historia: 'Menos bandas sex e sáb' },
    { epico: 'Processos de Registros de "BOs"', observacoes: 'Exemplo: acidente de trabalho; rescisão homologada no Sindicato' },
  ],
  PRODUCAO: [
    { epico: 'CMV Limpo' },
    { epico: 'Desvio Insumos' },
    { epico: 'Desvio Produções' },
    { epico: 'Desvio Proteínas' },
  ],
};

const okrsPadraoDaArea = (areaKey: string): OKR[] =>
  (defaultOkrsPorArea[areaKey] || []).map(item => ({
    epico: item.epico,
    historia: item.historia || '',
    responsavel: '',
    observacoes: item.observacoes || '',
    andamento: '',
    status: 'cinza',
    area: areaKey,
  }));

/**
 * OVT NOVO nasce em BRANCO.
 *
 * `defaultOrganizador` / `defaultOKRs` são o OVT do ORDINÁRIO escrito no código (missão,
 * Bizus, posicionamento, metas, épicos). Até 19/08/2026 QUALQUER OVT novo nascia com esse
 * conteúdo — o Gonza criou o do Deboche e veio "igual do Ordi". Estes helpers mantêm só a
 * ESTRUTURA (7 Bizus, 3 Singularidades, 5 Problemas, as áreas) e zeram o conteúdo.
 */
const emBranco = (): OrganizadorData => {
  const base: any = { ...defaultOrganizador };
  for (const k of Object.keys(base)) {
    const v = base[k];
    if (typeof v === 'string') base[k] = '';
    else if (typeof v === 'number') base[k] = null;
    else if (Array.isArray(v)) base[k] = v.map((x: unknown) => (typeof x === 'string' ? '' : x));
  }
  // identificação/período não são conteúdo: seguem do default
  base.bar_id = defaultOrganizador.bar_id;
  base.ano = defaultOrganizador.ano;
  base.semestre = defaultOrganizador.semestre;
  base.trimestre = null;
  base.tipo = defaultOrganizador.tipo;
  base.valores_centrais_detalhe = [];
  base.singularidades_detalhe = [];
  base.principais_problemas_detalhe = [];
  return base as OrganizadorData;
};

const semConteudo = (linhas: OKR[]): OKR[] =>
  linhas.map(o => ({ ...o, epico: '', historia: '', responsavel: '', observacoes: '', andamento: '', status: 'cinza' }));

/**
 * Junta o que veio do banco com os esqueletos padrão: mantém a ordem
 * (Gerais primeiro, depois cada área) e semeia áreas ainda vazias.
 * `vazio` = OVT novo: semeia as LINHAS (pra ter onde escrever) sem o texto do Ordinário.
 */
const construirOkrs = (salvos?: OKR[] | null, vazio = false): OKR[] => {
  const normalizados = (salvos || []).map(o => ({ ...o, area: o.area || 'GERAL', andamento: o.andamento || '' }));
  const gerais = normalizados.filter(o => o.area === 'GERAL');
  const modeloGeral = vazio ? semConteudo(defaultOKRs) : [...defaultOKRs];
  const resultado: OKR[] = gerais.length > 0 ? gerais : modeloGeral;

  AREAS.forEach(area => {
    const daArea = normalizados.filter(o => o.area === area.key);
    const modeloArea = vazio ? semConteudo(okrsPadraoDaArea(area.key)) : okrsPadraoDaArea(area.key);
    resultado.push(...(daArea.length > 0 ? daArea : modeloArea));
  });

  return resultado;
};

export default function OrganizadorEditPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { selectedBar } = useBar();
  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('🎯 OVT — Organizador de Visão e Tração');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const isNovo = params.id === 'novo';
  const [loading, setLoading] = useState(!isNovo);
  const [saving, setSaving] = useState(false);
  
  // Seções colapsáveis
  const [secaoBaseAberta, setSecaoBaseAberta] = useState(false);
  const [secaoSemestreAberta, setSecaoSemestreAberta] = useState(true);
  const [secaoOkrsAberta, setSecaoOkrsAberta] = useState(true);
  const [secaoAreasAberta, setSecaoAreasAberta] = useState(true);
  const [areasFechadas, setAreasFechadas] = useState<Record<string, boolean>>({});

  const [organizador, setOrganizador] = useState<OrganizadorData>({
    // OVT novo nasce em branco; a edição sobrescreve tudo com o que veio do banco.
    ...emBranco(),
    ano: parseInt(searchParams.get('ano') || String(new Date().getFullYear())),
    semestre: parseInt(searchParams.get('semestre') || String(new Date().getMonth() < 6 ? 1 : 2)),
  });
  const [okrs, setOkrs] = useState<OKR[]>(() => construirOkrs(null, true));

  // Flag para evitar múltiplas chamadas
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    // Quando é novo, apenas atualiza o bar_id uma vez
    if (selectedBar && isNovo && !dataLoaded) {
      setOrganizador(prev => ({ ...prev, bar_id: selectedBar.id }));
      setDataLoaded(true);
      return;
    }

    // Quando é edição, carrega os dados uma vez
    if (selectedBar && !isNovo && !dataLoaded) {
      const carregarDados = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/organizador?bar_id=${selectedBar.id}&id=${params.id}`);
          const data = await response.json();
          
          if (data.organizador) {
            const salvo = data.organizador;
            setOrganizador({
              // fallback em BRANCO: campo que o registro não tem não pode vir preenchido
              // com o texto do Ordinário (era o que acontecia com o OVT do Deboche).
              ...emBranco(),
              ...salvo,
              // Registros legados (trimestrais/anuais) passam a ser lidos como semestrais.
              tipo: 'semestral',
              trimestre: null,
              semestre: salvo.semestre ?? (salvo.trimestre ? Math.ceil(salvo.trimestre / 2) : defaultOrganizador.semestre),
              valores_centrais: salvo.valores_centrais?.length ? salvo.valores_centrais : Array(QTD_BIZUS).fill(''),
              singularidades: salvo.singularidades?.length ? salvo.singularidades : Array(QTD_SINGULARIDADES).fill(''),
              principais_problemas: salvo.principais_problemas?.length ? salvo.principais_problemas : Array(QTD_PROBLEMAS).fill(''),
              // colunas novas: registro antigo vem sem elas (ou null) e o spread deixaria undefined
              valores_centrais_detalhe: salvo.valores_centrais_detalhe || [],
              singularidades_detalhe: salvo.singularidades_detalhe || [],
              principais_problemas_detalhe: salvo.principais_problemas_detalhe || [],
              principais_concorrentes: salvo.principais_concorrentes || '',
            });
            setOkrs(construirOkrs(data.okrs));
          }
        } catch (error) {
          console.error('Erro ao carregar:', error);
          toast({ title: 'Erro', description: 'Não foi possível carregar', variant: 'destructive' });
        } finally {
          setLoading(false);
          setDataLoaded(true);
        }
      };
      carregarDados();
    }
  }, [selectedBar?.id, isNovo, dataLoaded, params.id, toast]);

  const handleSalvar = async () => {
    if (!selectedBar) return;
    
    setSaving(true);
    try {
      const method = isNovo ? 'POST' : 'PUT';
      const body = {
        ...organizador,
        bar_id: selectedBar.id,
        // Descarta só a linha 100% vazia. Antes o filtro era `epico.trim() !== ''`, e quem
        // preenchia Big Bet / OBS / Andamento sem preencher o Tema perdia a linha no save --
        // no reload o esqueleto padrão voltava e parecia que "apagou tudo" (Gonza, 19/08/2026).
        okrs: okrs.filter(o =>
          [o.epico, o.historia, o.responsavel, o.observacoes, o.andamento]
            .some(v => (v || '').trim() !== ''))
      };

      const response = await fetch('/api/organizador', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        toast({ title: 'Sucesso!', description: isNovo ? 'Organizador criado' : 'Alterações salvas' });
        router.push('/estrategico/organizador');
      } else {
        throw new Error('Erro ao salvar');
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateOrganizador = (field: keyof OrganizadorData, value: any) => {
    setOrganizador(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Detalhe alinhado por índice. Preenche os buracos com {} até o índice pedido, senão editar o
   * detalhe do Bizu 5 antes dos anteriores gravaria um array esparso (com vazios) que o JSON não
   * representa direito.
   */
  /** qual detalhe esta aberto: os Bizus abrem os 3 campos; a singularidade, so o detalhamento */
  /**
   * Realizado dos indicadores. Vem de /acompanhamento, que só agrega gold.desempenho e o serviço da
   * Orçamentação — nada é recalculado aqui, pra não virar uma terceira fonte dos mesmos números.
   */
  const [acomp, setAcomp] = useState<any>(null);
  useEffect(() => {
    if (!organizador.bar_id || !organizador.ano) return;
    let vivo = true;
    (async () => {
      try {
        // fetch direto, igual ao resto desta tela (ela não usa o api-client)
        const resp = await fetch(
          `/api/estrategico/organizador/acompanhamento?bar_id=${organizador.bar_id}&ano=${organizador.ano}&semestre=${organizador.semestre || 2}`,
        );
        const r = await resp.json();
        if (vivo && r?.success) setAcomp(r);
      } catch { /* acompanhamento é complemento: falhou, a tela de metas continua funcionando */ }
    })();
    return () => { vivo = false; };
  }, [organizador.bar_id, organizador.ano, organizador.semestre]);

  /**
   * Linha de acompanhamento embaixo da meta.
   *
   * `inverso` = quanto MENOR melhor (CMV, artístico, CMO). Sem isso o CMV abaixo da meta ficaria
   * vermelho, que é o contrário do que ele significa.
   * `unidade` explica o que está sendo comparado ("acumulado" x "média/mês") — sem esse rótulo o
   * leitor não sabe se o número é a soma do semestre ou a média, e compara errado.
   */
  const Realizado = ({ valor, meta, formato, inverso, unidade }: {
    valor: number | null | undefined; meta: number | null | undefined;
    formato: 'moeda' | 'numero' | 'pct' | 'nota'; inverso?: boolean; unidade?: string;
  }) => {
    if (valor == null) return null;
    const txt = formato === 'moeda' ? formatCurrency(valor)
      : formato === 'pct' ? `${valor.toFixed(1)}%`
      : formato === 'nota' ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : formatarNumero(Math.round(valor));
    const pct = meta ? (valor / meta) * 100 : null;
    const bom = pct == null ? null : inverso ? pct <= 100 : pct >= 100;
    return (
      <div className="flex items-center justify-end gap-1.5 text-[10px] mt-0.5">
        <span className="text-gray-500 dark:text-gray-400">
          {unidade ? `${unidade}: ` : 'realizado: '}<b className="text-gray-700 dark:text-gray-200">{txt}</b>
        </span>
        {pct != null && (
          <span className={`px-1 rounded font-bold ${
            bom ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          }`}>
            {pct.toFixed(0)}% da meta
          </span>
        )}
      </div>
    );
  };

  const [detalheAberto, setDetalheAberto] = useState<
    { tipo: 'bizu' | 'singularidade' | 'problema'; index: number } | null
  >(null);

  const updateDetalhe = (
    field: 'valores_centrais_detalhe' | 'singularidades_detalhe' | 'principais_problemas_detalhe',
    index: number, chave: string, value: string,
  ) => {
    setOrganizador(prev => {
      const arr = [...((prev[field] as any[]) || [])];
      while (arr.length <= index) arr.push({});
      arr[index] = { ...(arr[index] || {}), [chave]: value };
      return { ...prev, [field]: arr };
    });
  };

  const updateArrayField = (field: 'valores_centrais' | 'singularidades' | 'principais_problemas', index: number, value: string) => {
    setOrganizador(prev => {
      const arr = [...(prev[field] || [])];
      arr[index] = value;
      return { ...prev, [field]: arr };
    });
  };

  /**
   * Marca/desmarca a NSM. Marcar uma DESMARCA as outras da mesma área no mesmo passo: é o que faz o
   * "North Star" significar alguma coisa, e evita o save bater no índice único do banco em vez de
   * na regra da tela.
   */
  const marcarNSM = (index: number) => {
    setOkrs(prev => {
      const area = prev[index]?.area;
      const virandoNSM = !prev[index]?.is_nsm;
      return prev.map((o, i) => {
        if (o.area !== area) return o;
        return { ...o, is_nsm: virandoNSM && i === index };
      });
    });
  };

  const updateOKR = (index: number, field: keyof OKR, value: string) => {
    setOkrs(prev => {
      const newOkrs = [...prev];
      newOkrs[index] = { ...newOkrs[index], [field]: value };
      return newOkrs;
    });
  };

  // Insere a nova linha logo depois da última da mesma área, para a `ordem`
  // gravada no banco continuar agrupada.
  const addOKR = (area: string = 'GERAL') => {
    setOkrs(prev => {
      const novo: OKR = { epico: '', historia: '', responsavel: '', observacoes: '', andamento: '', status: 'cinza', area };
      let ultimoDaArea = -1;
      prev.forEach((o, i) => {
        if ((o.area || 'GERAL') === area) ultimoDaArea = i;
      });
      if (ultimoDaArea === -1) return [...prev, novo];
      const copia = [...prev];
      copia.splice(ultimoDaArea + 1, 0, novo);
      return copia;
    });
  };

  const removeOKR = (index: number) => {
    setOkrs(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusStyle = (status: string) => statusOptions.find(s => s.value === status) || statusOptions[3];

  // Índice global preservado para os handlers continuarem operando sobre `okrs`.
  const okrsIndexados = okrs.map((okr, index) => ({ okr, index }));
  const okrsGerais = okrsIndexados.filter(({ okr }) => (okr.area || 'GERAL') === 'GERAL');
  const okrsDaArea = (areaKey: string) => okrsIndexados.filter(({ okr }) => okr.area === areaKey);

  const getNomePeriodo = () => `${organizador.semestre || 2}º SEM ${organizador.ano}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e1] dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Função para formatar números (12000 -> 12.000)
  const formatarNumero = (valor: number | null | undefined): string => {
    if (!valor) return '';
    return valor.toLocaleString('pt-BR');
  };

  /**
   * Campo numérico das METAS. NÃO reformata enquanto se digita.
   *
   * Bug que isto corrige (Gonza, 19/08/2026 — "só fica R$ 1,00", em Faturamento e CMO Fixo):
   * o input era controlado pelo valor JÁ FORMATADO (`formatCurrency(1)` = "R$ 1,00") e o
   * onChange reparseava o texto a cada tecla. Digitando 1500000, o "1" virava "R$ 1,00" na
   * tela e todo dígito seguinte caía DEPOIS da vírgula decimal — o parse jogava fora e a meta
   * ficava presa em 1. Enquanto o campo está em foco vale o texto CRU digitado; o formatado só
   * volta no blur.
   */
  const CampoNumero = ({ value, formato, onChange, className, placeholder }: {
    value: number | null | undefined;
    formato: 'moeda' | 'numero' | 'texto';
    onChange: (v: number | null) => void;
    className?: string;
    placeholder?: string;
  }) => {
    const [texto, setTexto] = useState<string | null>(null); // != null → editando
    const formatado = value == null ? ''
      : formato === 'moeda' ? formatCurrency(value)
      : formato === 'numero' ? formatarNumero(value)
      : String(value).replace('.', ',');
    // pt-BR: ponto é separador de milhar, vírgula é decimal.
    const parse = (txt: string): number | null => {
      const limpo = txt.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
      if (!limpo || limpo === '-') return null;
      const n = parseFloat(limpo);
      return Number.isFinite(n) ? n : null;
    };
    return (
      <Input
        type="text"
        className={className}
        placeholder={placeholder}
        value={texto ?? formatado}
        // ao focar mostra o número cru (1500000), que é o que se quer reescrever
        onFocus={() => setTexto(value == null ? '' : String(value).replace('.', ','))}
        onChange={(e) => { setTexto(e.target.value); onChange(parse(e.target.value)); }}
        onBlur={() => setTexto(null)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f0e1] dark:bg-gray-900">
      <div className="w-full px-4 py-3">
        
        {/* Header Compacto */}
        <div className="flex items-center justify-between mb-3 bg-white dark:bg-gray-800 rounded-lg shadow px-3 py-2">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/estrategico/organizador')} 
              className="h-8 px-2"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
            />
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{selectedBar?.nome}</span>
          </div>
          <Button 
            onClick={handleSalvar} 
            disabled={saving} 
            loading={saving}
            className="bg-green-600 hover:bg-green-700 h-8 px-4"
            leftIcon={<Save className="w-4 h-4" />}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>

        {/* Título Principal com Seletor de Semestre/Ano */}
        <div className="bg-gradient-to-r from-[#d4e8d1] via-[#e8f0e5] to-[#d4e8d1] dark:from-green-900/40 dark:to-green-900/40 border-2 border-[#8fbc8f] rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg px-2 py-1 border border-[#8fbc8f]">
              <button
                onClick={() => {
                  // Voltar um semestre: 1º Sem volta para o 2º Sem do ano anterior.
                  const sem = organizador.semestre || 2;
                  if (sem === 2) return updateOrganizador('semestre', 1);
                  setOrganizador(prev => ({ ...prev, semestre: 2, ano: prev.ano - 1 }));
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                aria-label="Semestre anterior"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <select
                value={organizador.semestre || 2}
                onChange={(e) => updateOrganizador('semestre', parseInt(e.target.value))}
                className="bg-transparent text-center font-bold text-gray-800 dark:text-white cursor-pointer focus:outline-none"
              >
                <option value={1}>1º SEM</option>
                <option value={2}>2º SEM</option>
              </select>
              <Input
                type="number"
                value={organizador.ano}
                onChange={(e) => updateOrganizador('ano', parseInt(e.target.value) || new Date().getFullYear())}
                className="w-20 h-7 text-center font-bold bg-transparent border-0 focus-visible:ring-0 text-gray-800 dark:text-white"
              />
              <button
                onClick={() => {
                  // Avançar um semestre: 2º Sem vai para o 1º Sem do ano seguinte.
                  const sem = organizador.semestre || 2;
                  if (sem === 1) return updateOrganizador('semestre', 2);
                  setOrganizador(prev => ({ ...prev, semestre: 1, ano: prev.ano + 1 }));
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                aria-label="Próximo semestre"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>

        {/* ==================== SEÇÃO 1: BASE ESTRATÉGICA (Minimizada) ==================== */}
        <div className="mb-3">
          <button
            onClick={() => setSecaoBaseAberta(!secaoBaseAberta)}
            className="w-full flex items-center justify-between bg-[#f5deb3] dark:bg-amber-900/50 border-2 border-[#daa520] dark:border-amber-700 rounded-lg px-3 py-2 hover:bg-[#f0d8a8] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span className="font-bold text-sm text-gray-800 dark:text-white">BASE ESTRATÉGICA</span>
              <span className="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline">(Missão, Valores, Marketing)</span>
            </div>
            {secaoBaseAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {secaoBaseAberta && (
            <div className="mt-1.5 bg-white dark:bg-gray-800 border-2 border-[#daa520] dark:border-amber-700 rounded-lg overflow-hidden">
              {/* Grid Estilo Planilha */}
              <table className="w-full border-collapse text-xs">
                <tbody>
                  {/* 7 BIZUS (valores centrais) */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="bg-[#f5deb3] dark:bg-amber-900/30 p-3 font-bold text-gray-800 dark:text-white w-40 align-top border-r border-gray-300 dark:border-gray-600">
                      7 BIZUS
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        {Array.from({ length: QTD_BIZUS }, (_, i) => {
                          const d = organizador.valores_centrais_detalhe?.[i];
                          const temDetalhe = !!(d?.detalhamento || d?.o_que_e || d?.o_que_nao_e);
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-4 flex-shrink-0">{i + 1}.</span>
                              <Input
                                value={organizador.valores_centrais?.[i] || ''}
                                onChange={(e) => updateArrayField('valores_centrais', i, e.target.value)}
                                placeholder={`Bizu ${i + 1}`}
                                className="h-8 text-sm bg-gray-50 dark:bg-gray-700"
                              />
                              {/* o detalhe fica atras de um botao, nao inline: sao 7 Bizus x 3 textos
                                  longos, e abrir tudo na tabela enterraria o resto da base estrategica */}
                              <button
                                type="button"
                                onClick={() => setDetalheAberto({ tipo: 'bizu', index: i })}
                                disabled={!organizador.valores_centrais?.[i]}
                                title={organizador.valores_centrais?.[i]
                                  ? 'Abrir o detalhamento deste Bizu'
                                  : 'Escreva o Bizu antes de detalhar'}
                                className={`h-8 px-2 rounded-md border text-xs flex-shrink-0 disabled:opacity-30 ${
                                  temDetalhe
                                    ? 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                    : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                }`}
                              >
                                {temDetalhe ? 'ver' : 'detalhar'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                  {/* FOCO CENTRAL */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td rowSpan={3} className="bg-[#f5deb3] dark:bg-amber-900/30 p-3 font-bold text-gray-800 dark:text-white align-top border-r border-gray-300 dark:border-gray-600">
                      FOCO CENTRAL
                    </td>
                    <td className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16">Missão:</span>
                        <Input
                          value={organizador.missao || ''}
                          onChange={(e) => updateOrganizador('missao', e.target.value)}
                          className="h-8 text-sm flex-1 bg-gray-50 dark:bg-gray-700"
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 pt-1">Nicho:</span>
                        <Textarea
                          value={organizador.nicho || ''}
                          onChange={(e) => updateOrganizador('nicho', e.target.value)}
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                    </td>
                  </tr>
                  {/* Concorrentes: campo proprio do Foco Central (pedido do Gonza, 18/08/2026) */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 pt-1">Concorrentes:</span>
                        <Textarea
                          value={organizador.principais_concorrentes || ''}
                          onChange={(e) => updateOrganizador('principais_concorrentes', e.target.value)}
                          placeholder="Principais concorrentes"
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                    </td>
                  </tr>
                  {/* ESTRATÉGIA DE MARKETING */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td rowSpan={3} className="bg-[#f5deb3] dark:bg-amber-900/30 p-3 font-bold text-gray-800 dark:text-white align-top border-r border-gray-300 dark:border-gray-600">
                      ESTRATÉGIA DE<br/>MARKETING
                    </td>
                    <td className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-28 pt-1">Mercado Alvo:</span>
                        <Textarea
                          value={organizador.mercado_alvo || ''}
                          onChange={(e) => updateOrganizador('mercado_alvo', e.target.value)}
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-28 pt-1">Posicionamento:</span>
                        <Textarea
                          value={organizador.posicionamento || ''}
                          onChange={(e) => updateOrganizador('posicionamento', e.target.value)}
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="p-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-28 pt-1">3 Singularidades:</span>
                        <div className="flex-1 space-y-1">
                          {[0, 1, 2].map(i => {
                            const temDetalhe = !!organizador.singularidades_detalhe?.[i]?.detalhamento;
                            return (
                              <div key={i} className="flex items-start gap-2">
                                <Textarea
                                  value={organizador.singularidades?.[i] || ''}
                                  onChange={(e) => updateArrayField('singularidades', i, e.target.value)}
                                  className="text-sm bg-gray-50 dark:bg-gray-700 flex-1 h-8 min-h-0 resize-none"
                                  rows={1}
                                />
                                <button
                                  type="button"
                                  onClick={() => setDetalheAberto({ tipo: 'singularidade', index: i })}
                                  disabled={!organizador.singularidades?.[i]}
                                  title={organizador.singularidades?.[i]
                                    ? 'Abrir o detalhamento desta singularidade'
                                    : 'Escreva a singularidade antes de detalhar'}
                                  className={`h-8 px-2 rounded-md border text-xs flex-shrink-0 disabled:opacity-30 ${
                                    temDetalhe
                                      ? 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                                      : 'border-gray-300 dark:border-gray-600 text-gray-400'
                                  }`}
                                >
                                  {temDetalhe ? 'ver' : 'detalhar'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {/* VISÕES */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="bg-[#d4e8d1] dark:bg-green-900/30 p-3 font-bold text-gray-800 dark:text-white align-middle border-r border-gray-300 dark:border-gray-600">
                      Meta de 10 anos
                    </td>
                    <td className="p-2">
                      <Textarea
                        value={organizador.meta_10_anos || ''}
                        onChange={(e) => updateOrganizador('meta_10_anos', e.target.value)}
                        className="text-sm bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                        rows={1}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="bg-[#d4e8d1] dark:bg-green-900/30 p-3 font-bold text-gray-800 dark:text-white align-middle border-r border-gray-300 dark:border-gray-600">
                      Imagem de 3 anos
                    </td>
                    <td className="p-2">
                      <Textarea
                        value={organizador.imagem_3_anos || ''}
                        onChange={(e) => updateOrganizador('imagem_3_anos', e.target.value)}
                        className="text-sm bg-gray-50 dark:bg-gray-700 h-8 min-h-0 resize-none"
                        rows={1}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ==================== SEÇÃO 2: METAS DO SEMESTRE ==================== */}
        <div className="mb-3">
          <button
            onClick={() => setSecaoSemestreAberta(!secaoSemestreAberta)}
            className="w-full flex items-center justify-between bg-[#d4e8d1] dark:bg-green-900/50 border-2 border-[#8fbc8f] dark:border-green-700 rounded-lg px-3 py-2 hover:bg-[#c8e0c5] transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-700 dark:text-green-400" />
              <span className="font-bold text-sm text-gray-800 dark:text-white">{getNomePeriodo()} • METAS E INDICADORES</span>
            </div>
            {secaoSemestreAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {secaoSemestreAberta && (
            <div className="mt-1.5 grid grid-cols-1 lg:grid-cols-3 gap-2">
              {/* Metas do Semestre */}
              <div className="bg-white dark:bg-gray-800 border-2 border-[#8fbc8f] dark:border-green-700 rounded-lg overflow-hidden">
                <div className="bg-[#d4e8d1] dark:bg-green-900/50 px-3 py-2 border-b border-[#8fbc8f]">
                  <div className="flex items-center justify-center gap-2 font-bold text-gray-800 dark:text-white">
                    <Target className="w-4 h-4" />
                    {organizador.semestre || 2}º Sem
                  </div>
                  <Input
                    value={organizador.tema_semestre || ''}
                    onChange={(e) => updateOrganizador('tema_semestre', e.target.value)}
                    placeholder="Tema do semestre"
                    className="h-7 mt-1 text-xs font-semibold text-center bg-white/70 dark:bg-gray-700"
                  />
                </div>
                <div className="p-3 space-y-3">
                  {[
                    { label: 'Faturamento', field: 'meta_faturamento', icon: DollarSign, tag: 'BP', isCurrency: true, fmt: 'moeda', unidade: 'acumulado' },
                    { label: 'Clientes Ativos', field: 'meta_clientes_ativos', icon: Users, tag: 'NSM', isNumber: true, fmt: 'numero', unidade: 'média/mês' },
                    { label: 'CMV Limpo', field: 'meta_cmv_limpo', icon: Percent, tag: 'BP', suffix: '%', fmt: 'pct', inverso: true },
                    { label: '(Atrações+Produção)/Fat', field: 'meta_artistica', icon: Music, tag: 'BP', suffix: '%', fmt: 'pct', inverso: true },
                    { label: 'CMO Fixo', field: 'meta_cmo_fixo', icon: DollarSign, tag: 'BP', isCurrency: true, fmt: 'moeda', inverso: true, unidade: 'média/mês' },
                  ].map((item) => {
                    const IconComponent = item.icon;
                    const value = (organizador as any)[item.field];
                    return (
                      <div key={item.field}>
                        <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-bold flex-shrink-0">{item.tag}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end flex-shrink-0">
                          <CampoNumero
                            value={value}
                            formato={(item as any).isCurrency ? 'moeda' : (item as any).isNumber ? 'numero' : 'texto'}
                            onChange={(v) => updateOrganizador(item.field as keyof OrganizadorData, v)}
                            className={`${(item as any).isCurrency ? 'w-32 text-right' : 'w-20 text-center'} h-8 text-sm font-bold bg-gray-50 dark:bg-gray-700`}
                            placeholder={(item as any).isCurrency ? 'R$ 0,00' : '0'}
                          />
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-4 text-left">{item.suffix || ''}</span>
                        </div>
                        </div>
                        <Realizado
                          valor={acomp?.semestre?.[item.field]}
                          meta={value}
                          formato={(item as any).fmt}
                          inverso={(item as any).inverso}
                          unidade={(item as any).unidade}
                        />
                      </div>
                    );
                  })}
                  {acomp?.semestre?.meses > 0 && (
                    <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                      Acumulado de {acomp.semestre.meses} {acomp.semestre.meses === 1 ? 'mês' : 'meses'} do semestre.
                      As médias usam só os {acomp.semestre.meses_fechados} meses fechados — o mês em curso
                      distorceria.
                    </p>
                  )}
                </div>
              </div>

              {/* Principais Problemas */}
              <div className="bg-white dark:bg-gray-800 border-2 border-[#daa520] dark:border-amber-700 rounded-lg overflow-hidden">
                <div className="bg-[#f5deb3] dark:bg-amber-900/50 px-3 py-2 font-bold text-center text-gray-800 dark:text-white border-b border-[#daa520] flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Principais Problemas
                </div>
                <div className="p-3 space-y-2">
                  {Array.from({ length: QTD_PROBLEMAS }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-4">{i + 1}.</span>
                      <Input
                        value={organizador.principais_problemas?.[i] || ''}
                        onChange={(e) => updateArrayField('principais_problemas', i, e.target.value)}
                        placeholder={`Problema ${i + 1}`}
                        className="h-8 text-sm bg-gray-50 dark:bg-gray-700 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setDetalheAberto({ tipo: 'problema', index: i })}
                        disabled={!organizador.principais_problemas?.[i]}
                        title={organizador.principais_problemas?.[i]
                          ? 'Abrir o detalhamento deste problema'
                          : 'Escreva o problema antes de detalhar'}
                        className={`h-8 px-2 rounded-md border text-xs flex-shrink-0 disabled:opacity-30 ${
                          organizador.principais_problemas_detalhe?.[i]?.detalhamento
                            ? 'border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20'
                            : 'border-gray-300 dark:border-gray-600 text-gray-400'
                        }`}
                      >
                        {organizador.principais_problemas_detalhe?.[i]?.detalhamento ? 'ver' : 'detalhar'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Imagem de 1 Ano */}
              <div className="bg-white dark:bg-gray-800 border-2 border-[#8fbc8f] dark:border-green-700 rounded-lg overflow-hidden">
                <div className="bg-[#d4e8d1] dark:bg-green-900/50 px-3 py-2 font-bold text-center text-gray-800 dark:text-white border-b border-[#8fbc8f] flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" />
                  Imagem de 1 Ano
                </div>
                <div className="p-3">
                  <Input
                    value={organizador.imagem_1_ano || ''}
                    onChange={(e) => updateOrganizador('imagem_1_ano', e.target.value)}
                    placeholder="Ser um dos Principais Bares da Cidade"
                    className="h-8 text-sm font-semibold text-center bg-gray-50 dark:bg-gray-700 mb-3"
                  />
                  <div className="space-y-3 text-xs">
                    {[
                      { label: 'Faturamento', field: 'faturamento_meta', icon: DollarSign, isCurrency: true, fmt: 'moeda', unidade: 'acumulado' },
                      { label: 'Lucro Líquido', field: 'lucro_liquido_meta', icon: TrendingUp, isCurrency: true, fmt: 'moeda', unidade: 'acumulado' },
                      { label: 'Média-ano Clientes Ativos', field: 'pessoas_meta', icon: Users, isNumber: true, fmt: 'numero', unidade: 'média/mês' },
                      { label: '(Atrações+Produ)/Fat', field: 'artistico_meta', icon: Music, suffix: '%', fmt: 'pct', inverso: true },
                      { label: 'Avaliações Google', field: 'reputacao_meta', icon: Star, prefix: '⭐', isDecimal: true, fmt: 'nota', unidade: 'média' },
                    ].map(item => {
                      const IconComponent = item.icon;
                      const value = (organizador as any)[item.field];
                      return (
                        <div key={item.field}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.prefix && <span className="text-gray-500 text-[10px]">{item.prefix}</span>}
                            <CampoNumero
                              value={value}
                              formato={(item as any).isCurrency ? 'moeda' : (item as any).isNumber ? 'numero' : 'texto'}
                              onChange={(v) => updateOrganizador(item.field as keyof OrganizadorData, v)}
                              className={`${(item as any).isCurrency ? 'w-32' : 'w-20'} h-8 text-right text-xs font-semibold bg-gray-50 dark:bg-gray-700`}
                              placeholder={(item as any).isCurrency ? 'R$ 0,00' : '0'}
                            />
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 w-3 text-left">{item.suffix || ''}</span>
                          </div>
                        </div>
                        <Realizado
                          valor={acomp?.ano?.[item.field]}
                          meta={value}
                          formato={(item as any).fmt}
                          inverso={(item as any).inverso}
                          unidade={(item as any).unidade}
                        />
                        </div>
                      );
                    })}
                    {acomp?.ano?.meses > 0 && (
                      <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
                        Acumulado de {acomp.ano.meses} {acomp.ano.meses === 1 ? 'mês' : 'meses'} do ano
                        (médias com os {acomp.ano.meses_fechados} fechados). A meta é do ANO inteiro:
                        no meio do ano, o acumulado ainda está a caminho.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================== SEÇÃO 3: OKRs ==================== */}
        <div className="mb-3">
          <button
            onClick={() => setSecaoOkrsAberta(!secaoOkrsAberta)}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="font-bold text-sm text-gray-800 dark:text-white">OKRs GERAIS • BIG BETS</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">{okrsGerais.length}</span>
            </div>
            {secaoOkrsAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {secaoOkrsAberta && (
            <div className="mt-1.5 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-lg overflow-hidden">
              {/* Header da Tabela */}
              <div className={`hidden lg:grid ${GRID_OKR_GERAL} bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600 text-[11px] font-bold text-gray-700 dark:text-gray-300`}>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 flex items-center gap-1">
                  <Target className="w-3 h-3" />Épico
                </div>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Big Bet</div>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 text-center">Resp.</div>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Observações</div>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Andamento</div>
                <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 text-center">Status</div>
                <div className="px-1 py-1 flex justify-center">
                  <Button size="sm" onClick={() => addOKR('GERAL')} className="h-5 px-1.5 bg-green-600 hover:bg-green-700 text-[10px]">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Linhas */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {okrsGerais.map(({ okr, index }) => {
                  const statusStyle = getStatusStyle(okr.status);
                  return (
                    <div
                      key={index}
                      className={`grid grid-cols-1 ${GRID_OKR_GERAL} ${statusStyle.bg} ${index % 2 === 0 ? '' : 'bg-opacity-50'}`}
                    >
                      <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Épico</label>
                        <Input
                          value={okr.epico}
                          onChange={(e) => updateOKR(index, 'epico', e.target.value)}
                          className="h-7 text-xs font-semibold bg-white/80 dark:bg-gray-700"
                        />
                      </div>
                      <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Big Bet</label>
                        <Textarea
                          value={okr.historia}
                          onChange={(e) => updateOKR(index, 'historia', e.target.value)}
                          className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                      <div className="px-1 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Responsável</label>
                        <Input
                          value={okr.responsavel}
                          onChange={(e) => updateOKR(index, 'responsavel', e.target.value)}
                          className="h-7 text-[11px] text-center font-semibold bg-white/80 dark:bg-gray-700"
                        />
                      </div>
                      <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Observações</label>
                        <Textarea
                          value={okr.observacoes}
                          onChange={(e) => updateOKR(index, 'observacoes', e.target.value)}
                          className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                      <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Andamento</label>
                        <Textarea
                          value={okr.andamento}
                          onChange={(e) => updateOKR(index, 'andamento', e.target.value)}
                          placeholder="Onde está hoje..."
                          className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                          rows={1}
                        />
                      </div>
                      <div className="px-1 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Status</label>
                        <select
                          value={okr.status}
                          onChange={(e) => updateOKR(index, 'status', e.target.value)}
                          className={`w-full h-7 px-1 rounded text-[10px] font-bold cursor-pointer border-2 ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {statusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="px-1 py-1 flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOKR(index)}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Botão Add Mobile */}
              <div className="lg:hidden p-2 border-t border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => addOKR('GERAL')}
                  className="w-full h-8 bg-green-600 hover:bg-green-700 text-sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Adicionar OKR
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ==================== SEÇÃO 4: OKRs POR ÁREA ==================== */}
        <div className="mb-3">
          <button
            onClick={() => setSecaoAreasAberta(!secaoAreasAberta)}
            className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <span className="font-bold text-sm text-gray-800 dark:text-white">OKRs POR ÁREA</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">
                {okrs.length - okrsGerais.length}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400 hidden sm:inline">
                (Financeiro, Operação, Receita, Artístico, RH, Produção)
              </span>
            </div>
            {secaoAreasAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Uma área por linha: com a coluna Andamento, 2 colunas ficam apertadas demais. */}
          {secaoAreasAberta && (
            <div className="mt-1.5 space-y-2">
              {AREAS.map(area => {
                const AreaIcon = area.icon;
                const linhas = okrsDaArea(area.key);
                const aberta = !areasFechadas[area.key];
                return (
                  <div
                    key={area.key}
                    className={`bg-white dark:bg-gray-800 border-2 ${area.border} rounded-lg overflow-hidden`}
                  >
                    <div className={`${area.header} px-3 py-2 flex items-center justify-between border-b ${area.border}`}>
                      <button
                        onClick={() => setAreasFechadas(prev => ({ ...prev, [area.key]: !prev[area.key] }))}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <AreaIcon className={`w-4 h-4 ${area.text}`} />
                        <span className="font-bold text-sm text-gray-800 dark:text-white">{area.label}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-gray-900/40 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          {linhas.length}
                        </span>
                        {aberta ? <ChevronUp className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />}
                      </button>
                      <Button
                        size="sm"
                        onClick={() => addOKR(area.key)}
                        className="h-6 px-2 bg-green-600 hover:bg-green-700 text-[10px]"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    {aberta && (
                      <>
                        {/* Header da Tabela */}
                        <div className={`hidden lg:grid ${GRID_OKR_AREA} bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600 text-[11px] font-bold text-gray-700 dark:text-gray-300`}>
                          <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Tema</div>
                          <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Big Bet</div>
                          <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">OBS</div>
                          <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Andamento</div>
                          <div className="px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 text-center">Status</div>
                          <div className="px-1 py-1.5" />
                        </div>

                        {/* Linhas */}
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {linhas.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                              Nenhum OKR nesta área. Use o + para adicionar.
                            </div>
                          )}
                          {linhas.map(({ okr, index }) => {
                            const statusStyle = getStatusStyle(okr.status);
                            return (
                              <div
                                key={index}
                                className={`grid grid-cols-1 ${GRID_OKR_AREA} ${statusStyle.bg} ${
                                  okr.is_nsm ? 'ring-2 ring-inset ring-amber-400 dark:ring-amber-500' : ''
                                }`}
                              >
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Tema</label>
                                  {/* A estrela fica colada no Tema porque é o Tema que ela qualifica:
                                      esta é A métrica da área, as outras linhas são apoio. */}
                                  <div className="flex items-start gap-1">
                                    <button
                                      type="button"
                                      onClick={() => marcarNSM(index)}
                                      title={okr.is_nsm
                                        ? 'Esta é a North Star Metric da área — clique para desmarcar'
                                        : 'Marcar como North Star Metric da área (a principal)'}
                                      className={`mt-0.5 flex-shrink-0 rounded p-0.5 ${
                                        okr.is_nsm
                                          ? 'text-amber-500'
                                          : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                                      }`}
                                    >
                                      <Star className={`w-4 h-4 ${okr.is_nsm ? 'fill-amber-400' : ''}`} />
                                    </button>
                                    <Textarea
                                      value={okr.epico}
                                      onChange={(e) => updateOKR(index, 'epico', e.target.value)}
                                      className="text-xs font-semibold bg-white/80 dark:bg-gray-700 py-1.5 flex-1 h-8 min-h-0 resize-none"
                                      rows={1}
                                    />
                                  </div>
                                  {okr.is_nsm && (
                                    <span className="inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                                      NSM
                                    </span>
                                  )}
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Big Bet</label>
                                  <Textarea
                                    value={okr.historia}
                                    onChange={(e) => updateOKR(index, 'historia', e.target.value)}
                                    className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                                    rows={1}
                                  />
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">OBS</label>
                                  <Textarea
                                    value={okr.observacoes}
                                    onChange={(e) => updateOKR(index, 'observacoes', e.target.value)}
                                    className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                                    rows={1}
                                  />
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Andamento</label>
                                  <Textarea
                                    value={okr.andamento}
                                    onChange={(e) => updateOKR(index, 'andamento', e.target.value)}
                                    placeholder="Onde está hoje..."
                                    className="text-xs bg-white/80 dark:bg-gray-700 py-1.5 h-8 min-h-0 resize-none"
                                    rows={1}
                                  />
                                </div>
                                <div className="px-1 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Status</label>
                                  <select
                                    value={okr.status}
                                    onChange={(e) => updateOKR(index, 'status', e.target.value)}
                                    className={`w-full h-7 px-1 rounded text-[10px] font-bold cursor-pointer border-2 ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text}`}
                                  >
                                    {statusOptions.map(opt => (
                                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="px-1 py-1 flex items-center justify-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeOKR(index)}
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Botão Add Mobile */}
                        <div className="lg:hidden p-2 border-t border-gray-200 dark:border-gray-700">
                          <Button
                            onClick={() => addOKR(area.key)}
                            className="w-full h-8 bg-green-600 hover:bg-green-700 text-sm"
                            leftIcon={<Plus className="w-4 h-4" />}
                          >
                            Adicionar em {area.label}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/*
        Detalhamento do Bizu / da Singularidade.
        Os rótulos do "o que é" e "o que não é" repetem o TEXTO do Bizu de propósito — foi assim que
        o Gonza pediu ("O que é 'Defender o nosso Barco, Sempre'"). Ler o valor inteiro na pergunta
        é o que força a resposta a ser sobre aquele valor, e não sobre valor em geral.
      */}
      {detalheAberto && (() => {
        const ehBizu = detalheAberto.tipo === 'bizu';
        const ehProblema = detalheAberto.tipo === 'problema';
        const i = detalheAberto.index;
        const titulo = ehBizu
          ? (organizador.valores_centrais?.[i] || `Bizu ${i + 1}`)
          : ehProblema
            ? (organizador.principais_problemas?.[i] || `Problema ${i + 1}`)
            : (organizador.singularidades?.[i] || `Singularidade ${i + 1}`);
        const campo = ehBizu
          ? 'valores_centrais_detalhe'
          : ehProblema ? 'principais_problemas_detalhe' : 'singularidades_detalhe';
        const d: any = (organizador as any)[campo]?.[i] || {};
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setDetalheAberto(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">
                    {ehBizu ? `Bizu ${i + 1}` : ehProblema ? `Problema ${i + 1}` : `Singularidade ${i + 1}`}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{titulo}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetalheAberto(null)}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl leading-none px-2"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">
                    Detalhamento
                  </label>
                  <Textarea
                    value={d.detalhamento || ''}
                    onChange={(e) => updateDetalhe(campo as any, i, 'detalhamento', e.target.value)}
                    placeholder={ehProblema
                      ? 'Qual é o problema, onde dói e o que já se sabe da causa'
                      : 'O que isso quer dizer, na prática'}
                    className="text-sm bg-gray-50 dark:bg-gray-700"
                    rows={4}
                  />
                </div>

                {ehBizu && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 block mb-1">
                        O que É &quot;{titulo}&quot;
                      </label>
                      <Textarea
                        value={d.o_que_e || ''}
                        onChange={(e) => updateDetalhe(campo as any, i, 'o_que_e', e.target.value)}
                        placeholder="Comportamentos e decisões que mostram esse Bizu acontecendo"
                        className="text-sm bg-gray-50 dark:bg-gray-700"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-rose-700 dark:text-rose-400 block mb-1">
                        O que NÃO é &quot;{titulo}&quot;
                      </label>
                      <Textarea
                        value={d.o_que_nao_e || ''}
                        onChange={(e) => updateDetalhe(campo as any, i, 'o_que_nao_e', e.target.value)}
                        placeholder="O que costuma ser confundido com esse Bizu, e não é"
                        className="text-sm bg-gray-50 dark:bg-gray-700"
                        rows={4}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
                <span className="text-[11px] text-gray-500">
                  O texto entra junto no <b>Salvar</b> da tela.
                </span>
                <Button size="sm" onClick={() => setDetalheAberto(null)}>Fechar</Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
