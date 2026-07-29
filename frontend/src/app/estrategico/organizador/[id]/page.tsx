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
  principais_problemas: string[];
  meta_10_anos: string;
  imagem_3_anos: string;
  imagem_1_ano: string;
}

/** 7 BIZUS (valores centrais) e 5 Principais Problemas — conforme a planilha. */
const QTD_BIZUS = 7;
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
 * Junta o que veio do banco com os esqueletos padrão: mantém a ordem
 * (Gerais primeiro, depois cada área) e semeia áreas ainda vazias.
 */
const construirOkrs = (salvos?: OKR[] | null): OKR[] => {
  const normalizados = (salvos || []).map(o => ({ ...o, area: o.area || 'GERAL', andamento: o.andamento || '' }));
  const gerais = normalizados.filter(o => o.area === 'GERAL');
  const resultado: OKR[] = gerais.length > 0 ? gerais : [...defaultOKRs];

  AREAS.forEach(area => {
    const daArea = normalizados.filter(o => o.area === area.key);
    resultado.push(...(daArea.length > 0 ? daArea : okrsPadraoDaArea(area.key)));
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
    setPageTitle('🎯 Organizador');
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
    ...defaultOrganizador,
    ano: parseInt(searchParams.get('ano') || String(new Date().getFullYear())),
    semestre: parseInt(searchParams.get('semestre') || String(new Date().getMonth() < 6 ? 1 : 2)),
  });
  const [okrs, setOkrs] = useState<OKR[]>(() => construirOkrs());

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
              ...defaultOrganizador,
              ...salvo,
              // Registros legados (trimestrais/anuais) passam a ser lidos como semestrais.
              tipo: 'semestral',
              trimestre: null,
              semestre: salvo.semestre ?? (salvo.trimestre ? Math.ceil(salvo.trimestre / 2) : defaultOrganizador.semestre),
              valores_centrais: salvo.valores_centrais?.length ? salvo.valores_centrais : defaultOrganizador.valores_centrais,
              singularidades: salvo.singularidades?.length ? salvo.singularidades : defaultOrganizador.singularidades,
              principais_problemas: salvo.principais_problemas?.length ? salvo.principais_problemas : defaultOrganizador.principais_problemas,
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
        okrs: okrs.filter(o => o.epico.trim() !== '')
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

  const updateArrayField = (field: 'valores_centrais' | 'singularidades' | 'principais_problemas', index: number, value: string) => {
    setOrganizador(prev => {
      const arr = [...(prev[field] || [])];
      arr[index] = value;
      return { ...prev, [field]: arr };
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
                        {Array.from({ length: QTD_BIZUS }, (_, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 w-4 flex-shrink-0">{i + 1}.</span>
                            <Input
                              value={organizador.valores_centrais?.[i] || ''}
                              onChange={(e) => updateArrayField('valores_centrais', i, e.target.value)}
                              placeholder={`Bizu ${i + 1}`}
                              className="h-8 text-sm bg-gray-50 dark:bg-gray-700"
                            />
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {/* FOCO CENTRAL */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td rowSpan={2} className="bg-[#f5deb3] dark:bg-amber-900/30 p-3 font-bold text-gray-800 dark:text-white align-top border-r border-gray-300 dark:border-gray-600">
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
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700 min-h-[50px]"
                          rows={2}
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
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700"
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
                          className="text-sm flex-1 bg-gray-50 dark:bg-gray-700"
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
                          {[0, 1, 2].map(i => (
                            <Textarea
                              key={i}
                              value={organizador.singularidades?.[i] || ''}
                              onChange={(e) => updateArrayField('singularidades', i, e.target.value)}
                              className="text-sm bg-gray-50 dark:bg-gray-700 min-h-[40px]"
                              rows={1}
                            />
                          ))}
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
                        className="text-sm bg-gray-50 dark:bg-gray-700"
                        rows={2}
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
                        className="text-sm bg-gray-50 dark:bg-gray-700"
                        rows={2}
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
                    { label: 'Faturamento', field: 'meta_faturamento', icon: DollarSign, tag: 'BP', isCurrency: true },
                    { label: 'Clientes Ativos', field: 'meta_clientes_ativos', icon: Users, tag: 'NSM', isNumber: true },
                    { label: 'CMV Limpo', field: 'meta_cmv_limpo', icon: Percent, tag: 'BP', suffix: '%' },
                    { label: '(Atrações+Produção)/Fat', field: 'meta_artistica', icon: Music, tag: 'BP', suffix: '%' },
                    { label: 'CMO Fixo', field: 'meta_cmo_fixo', icon: DollarSign, tag: 'BP', isCurrency: true },
                  ].map((item) => {
                    const IconComponent = item.icon;
                    const value = (organizador as any)[item.field];
                    // Formatar valor para exibição no input
                    let displayValue = '';
                    if (value != null) {
                      if ((item as any).isCurrency) displayValue = formatCurrency(value);
                      else if ((item as any).isNumber) displayValue = formatarNumero(value);
                      else displayValue = String(value);
                    }
                    return (
                      <div key={item.field} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-bold flex-shrink-0">{item.tag}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end flex-shrink-0">
                          <Input
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Remove formatação para salvar como número
                              const rawValue = e.target.value
                                .replace('R$', '')
                                .replace(/\s/g, '')
                                .replace(/\./g, '')
                                .replace(',', '.');
                              const numValue = parseFloat(rawValue) || null;
                              updateOrganizador(item.field as keyof OrganizadorData, numValue);
                            }}
                            className={`${(item as any).isCurrency ? 'w-32 text-right' : 'w-20 text-center'} h-8 text-sm font-bold bg-gray-50 dark:bg-gray-700`}
                            placeholder={(item as any).isCurrency ? 'R$ 0,00' : '0'}
                          />
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-4 text-left">{item.suffix || ''}</span>
                        </div>
                      </div>
                    );
                  })}
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
                      { label: 'Faturamento', field: 'faturamento_meta', icon: DollarSign, isCurrency: true },
                      { label: 'Lucro Líquido', field: 'lucro_liquido_meta', icon: TrendingUp, isCurrency: true },
                      { label: 'Média-ano Clientes Ativos', field: 'pessoas_meta', icon: Users, isNumber: true },
                      { label: '(Atrações+Produ)/Fat', field: 'artistico_meta', icon: Music, suffix: '%' },
                      { label: 'Avaliações Google', field: 'reputacao_meta', icon: Star, prefix: '⭐', isDecimal: true },
                    ].map(item => {
                      const IconComponent = item.icon;
                      const value = (organizador as any)[item.field];
                      // Formatar valor para exibição no input
                      let displayValue = '';
                      if (value != null) {
                        if ((item as any).isCurrency) {
                          displayValue = formatCurrency(value);
                        } else if ((item as any).isNumber) {
                          displayValue = formatarNumero(value);
                        } else if ((item as any).isDecimal) {
                          displayValue = value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                        } else {
                          displayValue = String(value);
                        }
                      }
                      return (
                        <div key={item.field} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.prefix && <span className="text-gray-500 text-[10px]">{item.prefix}</span>}
                            <Input
                              type="text"
                              value={displayValue}
                              onChange={(e) => {
                                // Remove formatação para salvar como número
                                const rawValue = e.target.value
                                  .replace('R$', '')
                                  .replace(/\s/g, '')
                                  .replace(/\./g, '')
                                  .replace(',', '.');
                                const numValue = parseFloat(rawValue) || null;
                                updateOrganizador(item.field as keyof OrganizadorData, numValue);
                              }}
                              className={`${(item as any).isCurrency ? 'w-32' : 'w-20'} h-8 text-right text-xs font-semibold bg-gray-50 dark:bg-gray-700`}
                              placeholder={(item as any).isCurrency ? 'R$ 0,00' : '0'}
                            />
                            <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 w-3 text-left">{item.suffix || ''}</span>
                          </div>
                        </div>
                      );
                    })}
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
                          className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                          rows={2}
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
                          className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                          rows={2}
                        />
                      </div>
                      <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Andamento</label>
                        <Textarea
                          value={okr.andamento}
                          onChange={(e) => updateOKR(index, 'andamento', e.target.value)}
                          placeholder="Onde está hoje..."
                          className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                          rows={2}
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
                                className={`grid grid-cols-1 ${GRID_OKR_AREA} ${statusStyle.bg}`}
                              >
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Tema</label>
                                  <Textarea
                                    value={okr.epico}
                                    onChange={(e) => updateOKR(index, 'epico', e.target.value)}
                                    className="text-xs font-semibold bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                                    rows={2}
                                  />
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Big Bet</label>
                                  <Textarea
                                    value={okr.historia}
                                    onChange={(e) => updateOKR(index, 'historia', e.target.value)}
                                    className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                                    rows={2}
                                  />
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">OBS</label>
                                  <Textarea
                                    value={okr.observacoes}
                                    onChange={(e) => updateOKR(index, 'observacoes', e.target.value)}
                                    className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                                    rows={2}
                                  />
                                </div>
                                <div className="px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                                  <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Andamento</label>
                                  <Textarea
                                    value={okr.andamento}
                                    onChange={(e) => updateOKR(index, 'andamento', e.target.value)}
                                    placeholder="Onde está hoje..."
                                    className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                                    rows={2}
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
    </div>
  );
}
