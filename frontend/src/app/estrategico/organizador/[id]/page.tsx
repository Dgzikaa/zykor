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
  status: string;
}

interface OrganizadorData {
  id?: number;
  bar_id: number;
  ano: number;
  trimestre: number | null;
  tipo: string;
  meta_clientes_ativos: number | null;
  meta_visitas: number | null;
  meta_cmv_limpo: number | null;
  meta_cmo: number | null;
  meta_artistica: number | null;
  faturamento_meta: number | null;
  pessoas_meta: number | null;
  reputacao_meta: number | null;
  ebitda_meta: number | null;
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

const statusOptions = [
  { value: 'verde', label: '✓ Concluído', bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-400', text: 'text-green-700 dark:text-green-300' },
  { value: 'amarelo', label: '◐ Em Progresso', bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-400', text: 'text-yellow-700 dark:text-yellow-300' },
  { value: 'vermelho', label: '✗ Bloqueado', bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-red-400', text: 'text-red-700 dark:text-red-300' },
  { value: 'cinza', label: '○ Pendente', bg: 'bg-gray-100 dark:bg-gray-700', border: 'border-gray-300', text: 'text-gray-600 dark:text-gray-300' },
];

const defaultOrganizador: OrganizadorData = {
  bar_id: 0,
  ano: new Date().getFullYear(),
  trimestre: 1, // 1º Tri 2026
  tipo: 'trimestral',
  meta_clientes_ativos: 5100, // Meta 31/03
  meta_visitas: 15000,
  meta_cmv_limpo: 34, // CMV Limpo Médio do Tri
  meta_cmo: 20,
  meta_artistica: 20, // Atrações/Fat
  faturamento_meta: 18000000, // Meta ano 2026
  pessoas_meta: 6500, // Média-ano Clientes Ativos
  reputacao_meta: 4.9, // Meta 2026
  ebitda_meta: 1800000, // Meta 2026
  missao: 'Ver de Qualé - Segura a Peteca',
  nicho: 'Bares Musicais (Contexto - Responsa - Mundo vivo - Deboche - Brazólia)',
  valores_centrais: ['', '', ''],
  mercado_alvo: 'Adulto com Espírito Jovem de 28 a 48, Pagosambeiro',
  posicionamento: 'Para o Sambagodeiro, o Ordi é o Bar que não tem erro',
  singularidades: [
    'O melhor da Festa (Melhores artistas da cidade, bom som, boa iluminação, melhor horário, grandes projetos)',
    'O melhor do Boteco - Atendimento Eficiente (Garçom cordial, entrega veloz), Bons drinks, poder sentar',
    'Abraça todos os pagosambeiros (coisa que nem Brazólia nem Tia Zélia fazem)'
  ],
  principais_problemas: ['Custo % de artistas alto', 'Risco de dar alguma merda reputacional'],
  meta_10_anos: '',
  imagem_3_anos: '',
  imagem_1_ano: 'Se Consolidar como O Bar de Samba de Brasília',
};

const defaultOKRs: OKR[] = [
  // 1º TRI 2026 - "Ver de Qualé - Segura a Peteca"
  { epico: 'Faturamento', historia: 'DATAS CHAVE - CARNAVAL', responsavel: 'Augusto', observacoes: 'Planejamento da proposta do evento, atrações, preço, modelo. Meta Carnaval +25% = R$ 500.000,00', status: 'cinza' },
  { epico: 'Faturamento', historia: 'DATAS CHAVE - COPA DO MUNDO', responsavel: 'Augusto', observacoes: 'Planejamento da proposta do evento, atrações, preço, modelo', status: 'cinza' },
  { epico: 'Faturamento', historia: 'Estudo da experiência da fila de espera', responsavel: 'Cadu', observacoes: 'Melhorar a experiência da fila de espera. Fila de espera como "expansão" da capacidade', status: 'cinza' },
  { epico: 'Clientes Ativos', historia: 'Ações de fidelização/reativação para aumentar retornantes', responsavel: 'Diogo', observacoes: 'CRM com disparos? Programa de Fidelização?', status: 'cinza' },
  { epico: 'Clientes Novos', historia: 'Ação de Mídia para Awareness', responsavel: 'Diogo', observacoes: 'Plano de mídia digital+OOH', status: 'cinza' },
  { epico: 'Margem', historia: 'ROI das Atrações', responsavel: 'Augusto', observacoes: '(2º semestre?) Fazer Contrato com atrações fixas. "Não mexer em time que está ganhando" mas aproveitar novos entrantes para "começar certo" com melhores negociações', status: 'cinza' },
  { epico: 'Reputação (Marca)', historia: 'Artistas Nacionais com modelo de atendimento padrão', responsavel: 'Augusto', observacoes: 'Aproveitar oportunidade de artistas que já estejam em Brasília? Aniver de Bsb? Na Praia? Fazer 2 no ano. 1 no 1º Semestre em Abril', status: 'cinza' },
];

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
  const [secaoTrimestreAberta, setSecaoTrimestreAberta] = useState(true);
  const [secaoOkrsAberta, setSecaoOkrsAberta] = useState(true);
  
  const [organizador, setOrganizador] = useState<OrganizadorData>({
    ...defaultOrganizador,
    ano: parseInt(searchParams.get('ano') || String(new Date().getFullYear())),
    trimestre: parseInt(searchParams.get('trimestre') || '4'),
  });
  const [okrs, setOkrs] = useState<OKR[]>(defaultOKRs);

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
            setOrganizador({
              ...defaultOrganizador,
              ...data.organizador,
              valores_centrais: data.organizador.valores_centrais?.length ? data.organizador.valores_centrais : ['', '', ''],
              singularidades: data.organizador.singularidades?.length ? data.organizador.singularidades : defaultOrganizador.singularidades,
              principais_problemas: data.organizador.principais_problemas?.length ? data.organizador.principais_problemas : ['', '', ''],
            });
            setOkrs(data.okrs?.length > 0 ? data.okrs : defaultOKRs);
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

  const addOKR = () => {
    setOkrs(prev => [...prev, { epico: '', historia: '', responsavel: '', observacoes: '', status: 'cinza' }]);
  };

  const removeOKR = (index: number) => {
    setOkrs(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusStyle = (status: string) => statusOptions.find(s => s.value === status) || statusOptions[3];

  const getNomePeriodo = () => `${organizador.trimestre}º TRI ${organizador.ano}`;

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

        {/* Título Principal com Seletor de Trimestre */}
        <div className="bg-gradient-to-r from-[#d4e8d1] via-[#e8f0e5] to-[#d4e8d1] dark:from-green-900/40 dark:to-green-900/40 border-2 border-[#8fbc8f] rounded-lg px-4 py-2.5 mb-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-green-700 dark:text-green-400" />
              <h1 className="text-xl font-black text-gray-800 dark:text-white tracking-tight">
                ORGANIZADOR VISÃO
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg px-2 py-1 border border-[#8fbc8f]">
              <button
                onClick={() => updateOrganizador('trimestre', Math.max(1, (organizador.trimestre || 4) - 1))}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                disabled={organizador.trimestre === 1}
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              <select
                value={organizador.trimestre || 4}
                onChange={(e) => updateOrganizador('trimestre', parseInt(e.target.value))}
                className="bg-transparent text-center font-bold text-gray-800 dark:text-white cursor-pointer focus:outline-none"
              >
                <option value={1}>1º TRI {organizador.ano}</option>
                <option value={2}>2º TRI {organizador.ano}</option>
                <option value={3}>3º TRI {organizador.ano}</option>
                <option value={4}>4º TRI {organizador.ano}</option>
              </select>
              <button
                onClick={() => updateOrganizador('trimestre', Math.min(4, (organizador.trimestre || 4) + 1))}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                disabled={organizador.trimestre === 4}
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
                  {/* VALORES CENTRAIS */}
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="bg-[#f5deb3] dark:bg-amber-900/30 p-3 font-bold text-gray-800 dark:text-white w-40 align-top border-r border-gray-300 dark:border-gray-600">
                      VALORES CENTRAIS
                    </td>
                    <td className="p-2">
                      <div className="space-y-1">
                        {[0, 1, 2].map(i => (
                          <Input
                            key={i}
                            value={organizador.valores_centrais?.[i] || ''}
                            onChange={(e) => updateArrayField('valores_centrais', i, e.target.value)}
                            placeholder={`Valor ${i + 1}`}
                            className="h-8 text-sm bg-gray-50 dark:bg-gray-700"
                          />
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

        {/* ==================== SEÇÃO 2: METAS DO TRIMESTRE ==================== */}
        <div className="mb-3">
          <button
            onClick={() => setSecaoTrimestreAberta(!secaoTrimestreAberta)}
            className="w-full flex items-center justify-between bg-[#d4e8d1] dark:bg-green-900/50 border-2 border-[#8fbc8f] dark:border-green-700 rounded-lg px-3 py-2 hover:bg-[#c8e0c5] transition-colors"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-green-700 dark:text-green-400" />
              <span className="font-bold text-sm text-gray-800 dark:text-white">{getNomePeriodo()} • METAS E INDICADORES</span>
            </div>
            {secaoTrimestreAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {secaoTrimestreAberta && (
            <div className="mt-1.5 grid grid-cols-1 lg:grid-cols-3 gap-2">
              {/* Metas do Trimestre */}
              <div className="bg-white dark:bg-gray-800 border-2 border-[#8fbc8f] dark:border-green-700 rounded-lg overflow-hidden">
                <div className="bg-[#d4e8d1] dark:bg-green-900/50 px-3 py-2 font-bold text-center text-gray-800 dark:text-white border-b border-[#8fbc8f] flex items-center justify-center gap-2">
                  <Target className="w-4 h-4" />
                  Metas {organizador.trimestre}º Tri
                </div>
                <div className="p-3 space-y-3">
                  {[
                    { label: 'Clientes Ativos', field: 'meta_clientes_ativos', icon: Users, tag: 'NSM', isNumber: true },
                    { label: 'Nº Visitas', field: 'meta_visitas', icon: TrendingUp, tag: 'INPUT', isNumber: true },
                    { label: 'CMV Limpo', field: 'meta_cmv_limpo', icon: Percent, tag: 'BP', suffix: '%' },
                    { label: 'CMO', field: 'meta_cmo', icon: DollarSign, tag: 'BP', suffix: '%' },
                    { label: '% Artístico', field: 'meta_artistica', icon: Music, tag: 'BP', suffix: '%' },
                  ].map((item) => {
                    const IconComponent = item.icon;
                    const value = (organizador as any)[item.field];
                    // Formatar valor para exibição no input
                    const displayValue = value != null 
                      ? ((item as any).isNumber ? formatarNumero(value) : String(value))
                      : '';
                    return (
                      <div key={item.field} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">{item.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-bold flex-shrink-0">{item.tag}</span>
                        </div>
                        <div className="flex items-center gap-1 w-28 justify-end flex-shrink-0">
                          <Input
                            type="text"
                            value={displayValue}
                            onChange={(e) => {
                              // Remove formatação para salvar como número
                              const rawValue = e.target.value.replace(/\./g, '').replace(',', '.');
                              const numValue = parseFloat(rawValue) || null;
                              updateOrganizador(item.field as keyof OrganizadorData, numValue);
                            }}
                            className="w-20 h-8 text-center text-sm font-bold bg-gray-50 dark:bg-gray-700"
                            placeholder="0"
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
                  {[0, 1, 2].map(i => (
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
                      { label: 'Pessoas', field: 'pessoas_meta', icon: Users, suffix: '/mês', isNumber: true },
                      { label: 'Reputação', field: 'reputacao_meta', icon: Star, prefix: '⭐', isDecimal: true },
                      { label: 'Ebitda', field: 'ebitda_meta', icon: TrendingUp, isCurrency: true },
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
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <IconComponent className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-300 whitespace-nowrap">{item.label}</span>
                            {item.suffix && <span className="text-gray-500 text-[10px]">{item.suffix}</span>}
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
                              className="w-32 h-8 text-right text-xs font-semibold bg-gray-50 dark:bg-gray-700"
                              placeholder={(item as any).isCurrency ? 'R$ 0,00' : '0'}
                            />
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
              <span className="font-bold text-sm text-gray-800 dark:text-white">OKRs • HISTÓRIAS</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">{okrs.length}</span>
            </div>
            {secaoOkrsAberta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {secaoOkrsAberta && (
            <div className="mt-1.5 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-lg overflow-hidden">
              {/* Header da Tabela */}
              <div className="hidden lg:grid grid-cols-12 bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600 text-[11px] font-bold text-gray-700 dark:text-gray-300">
                <div className="col-span-2 px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 flex items-center gap-1">
                  <Target className="w-3 h-3" />Épico
                </div>
                <div className="col-span-3 px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">História</div>
                <div className="col-span-1 px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 text-center">Resp.</div>
                <div className="col-span-4 px-2 py-1.5 border-r border-gray-300 dark:border-gray-600">Observações</div>
                <div className="col-span-1 px-2 py-1.5 border-r border-gray-300 dark:border-gray-600 text-center">Status</div>
                <div className="col-span-1 px-1 py-1 flex justify-center">
                  <Button size="sm" onClick={addOKR} className="h-5 px-1.5 bg-green-600 hover:bg-green-700 text-[10px]">
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              
              {/* Linhas */}
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {okrs.map((okr, index) => {
                  const statusStyle = getStatusStyle(okr.status);
                  return (
                    <div 
                      key={index}
                      className={`grid grid-cols-1 lg:grid-cols-12 ${statusStyle.bg} ${index % 2 === 0 ? '' : 'bg-opacity-50'}`}
                    >
                      <div className="lg:col-span-2 px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Épico</label>
                        <Input
                          value={okr.epico}
                          onChange={(e) => updateOKR(index, 'epico', e.target.value)}
                          className="h-7 text-xs font-semibold bg-white/80 dark:bg-gray-700"
                        />
                      </div>
                      <div className="lg:col-span-3 px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">História</label>
                        <Textarea
                          value={okr.historia}
                          onChange={(e) => updateOKR(index, 'historia', e.target.value)}
                          className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                          rows={2}
                        />
                      </div>
                      <div className="lg:col-span-1 px-1 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Responsável</label>
                        <Input
                          value={okr.responsavel}
                          onChange={(e) => updateOKR(index, 'responsavel', e.target.value)}
                          className="h-7 text-[11px] text-center font-semibold bg-white/80 dark:bg-gray-700"
                        />
                      </div>
                      <div className="lg:col-span-4 px-1.5 py-1 border-r border-gray-200 dark:border-gray-700">
                        <label className="lg:hidden text-[10px] font-bold text-gray-500 mb-0.5 block">Observações</label>
                        <Textarea
                          value={okr.observacoes}
                          onChange={(e) => updateOKR(index, 'observacoes', e.target.value)}
                          className="text-xs bg-white/80 dark:bg-gray-700 min-h-[40px] py-1.5"
                          rows={2}
                        />
                      </div>
                      <div className="lg:col-span-1 px-1 py-1 border-r border-gray-200 dark:border-gray-700">
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
                      <div className="lg:col-span-1 px-1 py-1 flex items-center justify-center">
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
                  onClick={addOKR} 
                  className="w-full h-8 bg-green-600 hover:bg-green-700 text-sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Adicionar OKR
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
