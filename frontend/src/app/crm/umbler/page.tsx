'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingState } from '@/components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageCircle,
  Phone,
  User,
  Clock,
  Search,
  RefreshCw,
  UserCheck,
  CheckCircle,
  Calendar,
  TrendingUp,
  MessageSquare,
  Users,
  Target,
  XCircle,
  CalendarCheck,
  UserX,
  ArrowUpRight,
  BarChart3,
  PieChart,
  Activity,
  Send,
  Plus,
  Mail,
  Trash2,
  AlertCircle,
  Zap,
  Eye,
  Star
} from 'lucide-react';
import { useBar } from '@/contexts/BarContext';

interface Metricas {
  total_conversas: number;
  total_mensagens: number;
  contatos_unicos: number;
  conversa_mais_antiga: string;
  conversa_mais_recente: string;
  status_conversas: { status: string; quantidade: number }[];
}

interface CruzamentoDados {
  contatos_conversaram_e_reservaram: number;
  total_reservas: number;
  compareceram_seated: number;
  no_shows: number;
  confirmadas_aguardando: number;
  canceladas_usuario: number;
  canceladas_agente: number;
  pendentes: number;
}

interface TopContato {
  contato_nome: string;
  contato_telefone: string;
  total_conversas: number;
  primeira_conversa: string;
  ultima_conversa: string;
}

interface Campanha {
  id: string;
  nome: string;
  tipo: string;
  channel_id: string;
  template_mensagem: string;
  template_name?: string;
  variaveis?: Record<string, string>;
  segmento_criterios?: Record<string, unknown>;
  total_destinatarios: number;
  enviados: number;
  entregues: number;
  lidos: number;
  erros: number;
  respostas: number;
  status: 'rascunho' | 'agendada' | 'em_execucao' | 'concluida' | 'cancelada';
  agendado_para?: string;
  iniciado_em?: string;
  finalizado_em?: string;
  criado_por_email?: string;
  created_at: string;
}

interface Template {
  nome: string;
  tipo: 'whatsapp' | 'email';
  conteudo: string;
  variaveis: string[];
  categoria: string;
}

interface UmblerConfig {
  configurado: boolean;
  config: {
    channel_name: string;
    phone_number: string;
  } | null;
}

interface IntegrationStatus {
  integracoes: {
    umbler: boolean;
    getin: boolean;
  };
  faltantes: string[];
}

const SEGMENTOS = [
  { value: 'VIP Champions', label: '⭐ VIP Champions', cor: 'purple', desc: 'Visitas frequentes e recentes' },
  { value: 'Clientes Fiéis', label: '💎 Clientes Fiéis', cor: 'blue', desc: 'Muitas visitas, ativos' },
  { value: 'Grande Potencial', label: '🚀 Grande Potencial', cor: 'green', desc: 'Engajados recentemente' },
  { value: 'Em Risco (Churn)', label: '⚠️ Em Risco (Churn)', cor: 'orange', desc: 'Eram ativos, sumiram' },
  { value: 'Novos Promissores', label: '✨ Novos Promissores', cor: 'cyan', desc: 'Novos e ativos' },
  { value: 'Regulares', label: '📊 Regulares', cor: 'gray', desc: 'Frequência moderada' },
  { value: 'Inativos', label: '💤 Inativos', cor: 'red', desc: 'Muito tempo sem visitar' },
];

const TEMPLATES_WHATSAPP: Template[] = [
  {
    nome: 'Reengajamento - Cliente em Risco',
    tipo: 'whatsapp',
    categoria: 'reengajamento',
    conteudo: `Olá {nome}! 👋

Sentimos sua falta no Ordinário! 🍺✨

Preparamos algo especial para você: *{cupom_desconto}% de desconto* em sua próxima visita!

Venha nos visitar! 🎉`,
    variaveis: ['{nome}', '{cupom_desconto}']
  },
  {
    nome: 'Boas-vindas - Novo Cliente',
    tipo: 'whatsapp',
    categoria: 'boas_vindas',
    conteudo: `Olá {nome}! 🎉

Foi um prazer te receber no Ordinário!

Como primeira visita, queremos te dar um presente: *{cupom_desconto}% de desconto* na sua próxima vez!

Mal podemos esperar pra te ver de novo! 🍻`,
    variaveis: ['{nome}', '{cupom_desconto}']
  },
  {
    nome: 'VIP - Cliente Especial',
    tipo: 'whatsapp',
    categoria: 'vip',
    conteudo: `Olá {nome}! ⭐

Você é um cliente VIP do Ordinário!

Como agradecimento pela sua fidelidade, temos um presente exclusivo: *{cupom_desconto}% de desconto* para você!

Você faz parte da nossa família! 🍺❤️`,
    variaveis: ['{nome}', '{cupom_desconto}']
  },
  {
    nome: 'Saudade - Cliente Inativo',
    tipo: 'whatsapp',
    categoria: 'reativacao',
    conteudo: `Ei {nome}! 😢

Faz tempo que você não aparece por aqui...

O Ordinário tá com saudade! 🍺

Volta pra gente? Temos *{cupom_desconto}% de desconto* te esperando!

Bora matar a saudade? 🤗`,
    variaveis: ['{nome}', '{cupom_desconto}']
  }
];

export default function UmblerPage() {
  const { selectedBar } = useBar();
  const currentBarId = selectedBar?.id;

  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [cruzamento, setCruzamento] = useState<CruzamentoDados | null>(null);
  const [topContatos, setTopContatos] = useState<TopContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCruzamento, setLoadingCruzamento] = useState(true);
  const [ultimoSync, setUltimoSync] = useState<string | null>(null);

  // Estados para Campanhas
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [umblerConfig, setUmblerConfig] = useState<UmblerConfig | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [segmentosStats, setSegmentosStats] = useState<Record<string, number>>({});
  const [loadingCampanhas, setLoadingCampanhas] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [criandoCampanha, setCriandoCampanha] = useState(false);

  // Form state para nova campanha
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'whatsapp' | 'email'>('whatsapp');
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<string[]>([]);
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [mensagemCustom, setMensagemCustom] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState(20);
  const [executarAgora, setExecutarAgora] = useState(true);
  const [limiteEnvios, setLimiteEnvios] = useState<number | undefined>(undefined);

  // Disparo NPS
  const [npsFonte, setNpsFonte] = useState<'conversas' | 'reservas'>('conversas');
  const [npsDias, setNpsDias] = useState(7);
  const [npsLimite, setNpsLimite] = useState(50);
  const [npsLink, setNpsLink] = useState('');
  const [npsPreview, setNpsPreview] = useState<{ total: number } | null>(null);
  const [npsEnviando, setNpsEnviando] = useState(false);

  const fetchMetricas = useCallback(async () => {
    if (!currentBarId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/umbler/dashboard?bar_id=${currentBarId}`);
      const data = await response.json();
      
      if (data.success) {
        setMetricas(data.metricas);
        setTopContatos(data.top_contatos || []);
        setUltimoSync(data.ultimo_sync);
      }
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  }, [currentBarId]);

  const fetchCruzamento = useCallback(async () => {
    if (!currentBarId) return;
    setLoadingCruzamento(true);
    try {
      const response = await fetch(`/api/umbler/cruzamento-reservas?bar_id=${currentBarId}`);
      const data = await response.json();
      
      if (data.success) {
        setCruzamento(data.dados);
      }
    } catch (error) {
      console.error('Erro ao buscar cruzamento:', error);
    } finally {
      setLoadingCruzamento(false);
    }
  }, [currentBarId]);

  // Funções de Campanhas
  const fetchCampanhas = useCallback(async () => {
    if (!currentBarId) return;
    setLoadingCampanhas(true);
    try {
      const response = await fetch(`/api/umbler/campanhas?bar_id=${currentBarId}`);
      const result = await response.json();
      setCampanhas(result.campanhas || []);

      const configResponse = await fetch(`/api/umbler/config?bar_id=${currentBarId}`);
      const configResult = await configResponse.json();
      setUmblerConfig(configResult);

      const integrationResponse = await fetch(`/api/configuracoes/integracoes/status?bar_id=${currentBarId}`);
      const integrationResult = await integrationResponse.json();
      if (integrationResult.success) {
        setIntegrationStatus({
          integracoes: integrationResult.integracoes,
          faltantes: integrationResult.faltantes || [],
        });
      }

      try {
        const segmentosResponse = await fetch('/api/crm/campanhas?stats=true');
        const segmentosResult = await segmentosResponse.json();
        if (segmentosResult.success) {
          setSegmentosStats(segmentosResult.segmentos_stats || {});
        }
      } catch {
        // Ignorar erro de segmentos
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
    } finally {
      setLoadingCampanhas(false);
    }
  }, [currentBarId]);

  const totalClientesSelecionados = segmentosSelecionados.reduce(
    (sum, seg) => sum + (segmentosStats[seg] || 0), 
    0
  );

  const resetForm = () => {
    setNome('');
    setTipo('whatsapp');
    setSegmentosSelecionados([]);
    setTemplateSelecionado('');
    setMensagemCustom('');
    setCupomDesconto(20);
    setExecutarAgora(true);
    setLimiteEnvios(undefined);
  };

  const criarCampanha = async () => {
    if (!nome || segmentosSelecionados.length === 0) {
      alert('Preencha o nome e selecione pelo menos um segmento');
      return;
    }

    if (!umblerConfig?.configurado) {
      alert('Umbler não configurado!');
      return;
    }

    if (executarAgora && totalClientesSelecionados > 10) {
      const confirmar = confirm(
        `Você está prestes a enviar mensagens para ${totalClientesSelecionados.toLocaleString()} clientes.\n\nDeseja continuar?`
      );
      if (!confirmar) return;
    }

    setCriandoCampanha(true);
    try {
      const clientesResponse = await fetch('/api/crm/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          tipo,
          segmento_alvo: segmentosSelecionados,
          template_id: templateSelecionado || undefined,
          template_custom: mensagemCustom || undefined,
          cupom_desconto: cupomDesconto,
          executar_agora: false,
          limite_envios: limiteEnvios,
          bar_id: currentBarId
        })
      });

      const clientesResult = await clientesResponse.json();

      if (!clientesResult.success) {
        alert(`Erro ao preparar campanha: ${clientesResult.error}`);
        return;
      }

      const templateContent = templateSelecionado 
        ? TEMPLATES_WHATSAPP.find(t => t.nome === templateSelecionado)?.conteudo || mensagemCustom
        : mensagemCustom;

      const destinatarios = clientesResult.clientes?.map((c: { telefone: string; nome: string; id: number }) => ({
        telefone: c.telefone,
        nome: c.nome,
        cliente_contahub_id: c.id
      })) || [];

      if (destinatarios.length === 0) {
        alert('Nenhum cliente encontrado nos segmentos selecionados.');
        return;
      }

      const response = await fetch('/api/umbler/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: currentBarId,
          nome,
          tipo: 'marketing',
          template_mensagem: templateContent,
          variaveis: { cupom_desconto: cupomDesconto.toString() },
          destinatarios: limiteEnvios ? destinatarios.slice(0, limiteEnvios) : destinatarios,
          segmento_criterios: { segmentos: segmentosSelecionados },
          executar_agora: executarAgora
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Campanha criada com sucesso! ${result.total_destinatarios} destinatários.`);
        setModalAberto(false);
        resetForm();
        fetchCampanhas();
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      alert('Erro ao criar campanha');
    } finally {
      setCriandoCampanha(false);
    }
  };

  const cancelarCampanha = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) return;
    try {
      const response = await fetch(`/api/umbler/campanhas?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        alert('Campanha cancelada!');
        fetchCampanhas();
      }
    } catch (error) {
      console.error('Erro ao cancelar campanha:', error);
    }
  };

  const toggleSegmento = (segmento: string) => {
    if (segmentosSelecionados.includes(segmento)) {
      setSegmentosSelecionados(segmentosSelecionados.filter(s => s !== segmento));
    } else {
      setSegmentosSelecionados([...segmentosSelecionados, segmento]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rascunho': return <Badge variant="outline" className="bg-muted text-foreground border-border">📝 Rascunho</Badge>;
      case 'agendada': return <Badge variant="outline" className="bg-muted text-foreground border-border">📅 Agendada</Badge>;
      case 'em_execucao': return <Badge variant="outline" className="bg-muted text-foreground border-border">⚡ Executando</Badge>;
      case 'concluida': return <Badge variant="outline" className="bg-muted text-foreground border-border">✅ Concluída</Badge>;
      case 'cancelada': return <Badge variant="outline" className="bg-muted text-foreground border-border">❌ Cancelada</Badge>;
      default: return <Badge>-</Badge>;
    }
  };

  useEffect(() => {
    if (!currentBarId) return;
    fetchMetricas();
    fetchCruzamento();
    fetchCampanhas();
  }, [fetchMetricas, fetchCruzamento, fetchCampanhas, currentBarId]);

  const formatarData = (data: string | null): string => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const calcularTaxaConversao = (): number => {
    if (!metricas || !cruzamento) return 0;
    return metricas.contatos_unicos > 0
      ? Math.round((cruzamento.contatos_conversaram_e_reservaram / metricas.contatos_unicos) * 100 * 10) / 10
      : 0;
  };

  const calcularTaxaComparecimento = (): number => {
    if (!cruzamento || cruzamento.total_reservas === 0) return 0;
    return Math.round((cruzamento.compareceram_seated / cruzamento.total_reservas) * 100 * 10) / 10;
  };

  const calcularTaxaNoShow = (): number => {
    if (!cruzamento || cruzamento.total_reservas === 0) return 0;
    return Math.round((cruzamento.no_shows / cruzamento.total_reservas) * 100 * 10) / 10;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-2 py-4 max-w-[98vw]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-muted rounded-xl">
                  <MessageCircle className="w-6 h-6 text-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Umbler Talk - Central de Dados
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Histórico completo de conversas e cruzamento com reservas
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {ultimoSync && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Último sync: {formatarData(ultimoSync)}
                </span>
              )}
              <Button 
                onClick={() => { fetchMetricas(); fetchCruzamento(); }} 
                variant="outline" 
                className="border-gray-300 dark:border-gray-600"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {!!currentBarId && integrationStatus && integrationStatus.faltantes.length > 0 && (
          <Card className="mb-6 bg-muted/40 border-border">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">
                    Integrações não configuradas para este bar
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {integrationStatus.faltantes.map((nome) => nome.toUpperCase()).join(' e ')} não está configurado.
                    Configure em Configurações para habilitar dados e funcionalidades completas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : metricas ? (
            <>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Conversas</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {metricas.total_conversas.toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Contatos Únicos</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {metricas.contatos_unicos.toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Mensagens</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">
                    {metricas.total_mensagens.toLocaleString('pt-BR')}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Período</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {formatarData(metricas.conversa_mais_antiga)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    até {formatarData(metricas.conversa_mais_recente)}
                  </p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <Tabs defaultValue="cruzamento" className="space-y-6">
          <TabsList className="bg-muted/70 border border-border">
            <TabsTrigger value="cruzamento" className="data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70">
              <Target className="w-4 h-4 mr-2" />
              Cruzamento com Reservas
            </TabsTrigger>
            <TabsTrigger value="contatos" className="data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70">
              <Users className="w-4 h-4 mr-2" />
              Top Contatos
            </TabsTrigger>
            <TabsTrigger value="status" className="data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70">
              <PieChart className="w-4 h-4 mr-2" />
              Status das Conversas
            </TabsTrigger>
            <TabsTrigger value="campanhas" className="data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70">
              <Send className="w-4 h-4 mr-2" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="nps" className="data-[state=active]:bg-muted data-[state=active]:border data-[state=active]:border-border/70">
              <Star className="w-4 h-4 mr-2" />
              Disparo NPS
            </TabsTrigger>
          </TabsList>

          {/* Tab: Cruzamento com Reservas */}
          <TabsContent value="cruzamento">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funil de Conversão */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-muted-foreground" />
                    Funil: WhatsApp → Reserva → Presença
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Jornada do cliente do primeiro contato até comparecer
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCruzamento ? (
                    <div className="space-y-4">
                      {Array(4).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : cruzamento && metricas ? (
                    <div className="space-y-4">
                      {/* Nível 1: Contatos */}
                      <div className="relative">
                        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <MessageCircle className="w-6 h-6 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">Conversaram no WhatsApp</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Todos os contatos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">
                              {metricas.contatos_unicos.toLocaleString('pt-BR')}
                            </p>
                            <p className="text-sm text-gray-500">100%</p>
                          </div>
                        </div>
                        <div className="ml-6 h-6 border-l-2 border-dashed border-gray-300 dark:border-gray-600" />
                      </div>

                      {/* Nível 2: Fizeram Reserva */}
                      <div className="relative">
                        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <CalendarCheck className="w-6 h-6 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">Fizeram Reserva</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Reservaram pelo Getin</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">
                              {cruzamento.contatos_conversaram_e_reservaram}
                            </p>
                            <p className="text-sm text-gray-500">{calcularTaxaConversao()}%</p>
                          </div>
                        </div>
                        <div className="ml-6 h-6 border-l-2 border-dashed border-gray-300 dark:border-gray-600" />
                      </div>

                      {/* Nível 3: Compareceram */}
                      <div className="relative">
                        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">Compareceram</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Status: Seated</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">
                              {cruzamento.compareceram_seated}
                            </p>
                            <p className="text-sm text-gray-500">{calcularTaxaComparecimento()}% das reservas</p>
                          </div>
                        </div>
                      </div>

                      {/* Nível 3: No-Show */}
                      <div className="relative">
                        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg border border-border">
                          <div className="flex items-center gap-3">
                            <UserX className="w-6 h-6 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">No-Show</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Não compareceram</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-foreground">
                              {cruzamento.no_shows}
                            </p>
                            <p className="text-sm text-gray-500">{calcularTaxaNoShow()}% das reservas</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Detalhes das Reservas */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    Detalhes das Reservas
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Breakdown de status das reservas dos contatos Umbler
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingCruzamento ? (
                    <div className="space-y-3">
                      {Array(6).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : cruzamento ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="text-gray-700 dark:text-gray-300">Total de Reservas</span>
                        <span className="font-bold text-gray-900 dark:text-white">{cruzamento.total_reservas}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">Compareceram (Seated)</span>
                        </div>
                        <span className="font-bold text-foreground">{cruzamento.compareceram_seated}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">No-Show</span>
                        </div>
                        <span className="font-bold text-foreground">{cruzamento.no_shows}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">Confirmadas (Aguardando)</span>
                        </div>
                        <span className="font-bold text-foreground">{cruzamento.confirmadas_aguardando}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">Canceladas (Usuário)</span>
                        </div>
                        <span className="font-bold text-foreground">{cruzamento.canceladas_usuario}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-foreground">Canceladas (Atendente)</span>
                        </div>
                        <span className="font-bold text-foreground">{cruzamento.canceladas_agente}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700 dark:text-gray-300">Pendentes</span>
                        </div>
                        <span className="font-bold text-gray-600 dark:text-gray-400">{cruzamento.pendentes}</span>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {/* Insight Box */}
            <Card className="mt-6 bg-muted/40 border-border">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <Target className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Insight: Oportunidade de Conversão
                    </h3>
                    <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      {metricas && cruzamento ? (
                        <>
                          Dos <strong>{metricas.contatos_unicos.toLocaleString('pt-BR')}</strong> contatos que conversaram no WhatsApp, 
                          apenas <strong>{cruzamento.contatos_conversaram_e_reservaram}</strong> ({calcularTaxaConversao()}%) 
                          fizeram reserva. Isso significa que <strong>{(metricas.contatos_unicos - cruzamento.contatos_conversaram_e_reservaram).toLocaleString('pt-BR')}</strong> contatos 
                          são potenciais clientes que ainda não converteram. Considere campanhas de remarketing para esse público.
                        </>
                      ) : 'Carregando dados...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Top Contatos */}
          <TabsContent value="contatos">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Contatos Mais Frequentes</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Clientes que mais conversaram pelo WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array(10).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : topContatos.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Nenhum contato encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topContatos.map((contato, index) => (
                      <div
                        key={contato.contato_telefone}
                        className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {contato.contato_nome || 'Cliente'}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contato.contato_telefone}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {contato.total_conversas}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">conversas</p>
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                          <p>Primeira: {formatarData(contato.primeira_conversa)}</p>
                          <p>Última: {formatarData(contato.ultima_conversa)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Status das Conversas */}
          <TabsContent value="status">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white">Status das Conversas</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Distribuição por status de atendimento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : metricas?.status_conversas ? (
                  <div className="space-y-4">
                    {metricas.status_conversas.map((item) => {
                      const total = metricas.total_conversas;
                      const percent = total > 0 ? Math.round((item.quantidade / total) * 100) : 0;
                      
                      const statusConfig: Record<string, { cor: string; bg: string }> = {
                        aberta: { cor: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/20' },
                        em_atendimento: { cor: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/20' },
                        finalizada: { cor: 'bg-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' }
                      };
                      const config = statusConfig[item.status] || statusConfig.aberta;
                      
                      return (
                        <div key={item.status} className={`p-4 rounded-lg ${config.bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white capitalize">
                              {item.status === 'em_atendimento' ? 'Em Atendimento' : item.status}
                            </span>
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {item.quantidade.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div
                              className={`${config.cor} h-2 rounded-full transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{percent}%</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Disparo NPS */}
          <TabsContent value="nps">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Disparo de NPS via WhatsApp
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Envie pesquisa de satisfação (NPS) para clientes via Umbler Talk
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!umblerConfig?.configurado ? (
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="text-yellow-800 dark:text-yellow-200">Configure a Umbler Talk primeiro para disparar NPS.</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm">Fonte de destinatários</Label>
                        <Select value={npsFonte} onValueChange={(v: 'conversas' | 'reservas') => setNpsFonte(v)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conversas">Contatos Umbler (últimos X dias)</SelectItem>
                            <SelectItem value="reservas">Clientes com reserva (seated/confirmed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm">Últimos (dias)</Label>
                        <Input type="number" min={1} max={90} value={npsDias} onChange={(e) => setNpsDias(parseInt(e.target.value) || 7)} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-sm">Limite de envios</Label>
                        <Input type="number" min={1} max={500} value={npsLimite} onChange={(e) => setNpsLimite(parseInt(e.target.value) || 50)} className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Link da pesquisa NPS (opcional)</Label>
                      <Input placeholder="https://forms.gle/..." value={npsLink} onChange={(e) => setNpsLink(e.target.value)} className="mt-1" />
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const res = await fetch(`/api/umbler/nps-disparo?bar_id=${currentBarId}&fonte=${npsFonte}&dias=${npsDias}&limite=${npsLimite}`);
                          const data = await res.json();
                          if (data.success) setNpsPreview({ total: data.total });
                        }}
                      >
                        Pré-visualizar
                      </Button>
                      {npsPreview && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {npsPreview.total} destinatário(s) encontrado(s)
                        </span>
                      )}
                      <Button
                        className="bg-amber-600 hover:bg-amber-700"
                        disabled={npsEnviando}
                        onClick={async () => {
                          setNpsEnviando(true);
                          try {
                            const res = await fetch('/api/umbler/nps-disparo', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                bar_id: currentBarId,
                                fonte: npsFonte,
                                dias: npsDias,
                                limite: npsLimite,
                                link_nps: npsLink || undefined,
                                executar_agora: true
                              })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setNpsPreview({ total: data.total_destinatarios });
                              fetchCampanhas();
                              alert(`NPS disparado! ${data.total_destinatarios} mensagens em envio.`);
                            } else {
                              alert('Erro: ' + (data.error || 'Erro desconhecido'));
                            }
                          } finally {
                            setNpsEnviando(false);
                          }
                        }}
                      >
                        {npsEnviando ? 'Enviando...' : 'Disparar NPS'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Campanhas */}
          <TabsContent value="campanhas">
            <div className="space-y-6">
              {/* Header Campanhas */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Campanhas WhatsApp</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Disparo em massa via Umbler Talk
                    {umblerConfig?.config && (
                      <span className="ml-2 text-green-600 dark:text-green-400">
                        • {umblerConfig.config.channel_name}
                      </span>
                    )}
                  </p>
                </div>
                <Button 
                  onClick={() => setModalAberto(true)}
                  variant="outline"
                  disabled={!umblerConfig?.configurado}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Campanha
                </Button>
              </div>

              {/* Alerta se Umbler não configurado */}
              {!loadingCampanhas && !umblerConfig?.configurado && (
                <Card className="bg-muted/40 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-6 h-6 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">
                          Integração Umbler não configurada
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Configure as credenciais da Umbler Talk para habilitar o disparo em massa.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stats Campanhas */}
              {!loadingCampanhas && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">{campanhas.length}</div>
                        </div>
                        <TrendingUp className="w-6 h-6 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">Concluídas</div>
                          <div className="text-2xl font-bold text-foreground">
                            {campanhas.filter(c => c.status === 'concluida').length}
                          </div>
                        </div>
                        <CheckCircle className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">Enviados</div>
                          <div className="text-2xl font-bold text-foreground">
                            {campanhas.reduce((sum, c) => sum + (c.enviados || 0), 0)}
                          </div>
                        </div>
                        <Send className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">Erros</div>
                          <div className="text-2xl font-bold text-foreground">
                            {campanhas.reduce((sum, c) => sum + (c.erros || 0), 0)}
                          </div>
                        </div>
                        <XCircle className="w-6 h-6 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Lista de Campanhas */}
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader>
                  <CardTitle className="text-gray-900 dark:text-white">Histórico de Campanhas</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCampanhas ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                      ))}
                    </div>
                  ) : campanhas.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <Send className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma campanha criada ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {campanhas.map((campanha) => (
                        <div key={campanha.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900 dark:text-white">{campanha.nome}</h3>
                              <div className="flex gap-2 mt-1">
                                {getStatusBadge(campanha.status)}
                                <Badge variant="outline">{campanha.total_destinatarios} destinatários</Badge>
                              </div>
                            </div>
                            {(campanha.status === 'agendada' || campanha.status === 'rascunho') && (
                              <Button
                                onClick={() => cancelarCampanha(campanha.id)}
                                variant="outline"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-2 text-center text-sm">
                            <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded">
                              <div className="font-bold">{campanha.total_destinatarios}</div>
                              <div className="text-xs text-gray-500">Total</div>
                            </div>
                            <div className="p-2 bg-muted/40 rounded border border-border">
                              <div className="font-bold text-foreground">{campanha.enviados}</div>
                              <div className="text-xs text-gray-500">Enviados</div>
                            </div>
                            <div className="p-2 bg-muted/40 rounded border border-border">
                              <div className="font-bold text-foreground">{campanha.entregues}</div>
                              <div className="text-xs text-gray-500">Entregues</div>
                            </div>
                            <div className="p-2 bg-muted/40 rounded border border-border">
                              <div className="font-bold text-foreground">{campanha.respostas}</div>
                              <div className="text-xs text-gray-500">Respostas</div>
                            </div>
                            <div className="p-2 bg-muted/40 rounded border border-border">
                              <div className="font-bold text-foreground">{campanha.erros}</div>
                              <div className="text-xs text-gray-500">Erros</div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-500">
                            Criada em: {new Date(campanha.created_at).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal Nova Campanha */}
        <Dialog open={modalAberto} onOpenChange={setModalAberto}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Criar Nova Campanha</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Configure sua campanha de marketing personalizada
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Nome */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Nome da Campanha
                </label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Reengajamento Black Friday"
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              {/* Segmentos */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Segmentos Alvo
                  {segmentosSelecionados.length > 0 && (
                    <span className="ml-2 text-blue-600 font-bold">
                      ({totalClientesSelecionados.toLocaleString()} clientes)
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SEGMENTOS.map(seg => {
                    const count = segmentosStats[seg.value] || 0;
                    return (
                      <Button
                        key={seg.value}
                        type="button"
                        variant={segmentosSelecionados.includes(seg.value) ? "default" : "outline"}
                        className={`justify-between ${
                          segmentosSelecionados.includes(seg.value)
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-white dark:bg-gray-700'
                        }`}
                        onClick={() => toggleSegmento(seg.value)}
                      >
                        <span>{seg.label}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {count.toLocaleString()}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Template */}
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                  Template de Mensagem
                </label>
                <Select value={templateSelecionado} onValueChange={setTemplateSelecionado}>
                  <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Selecione um template ou personalize" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Mensagem Personalizada</SelectItem>
                    {TEMPLATES_WHATSAPP.map(t => (
                      <SelectItem key={t.nome} value={t.nome}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Template */}
              {templateSelecionado && (
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {TEMPLATES_WHATSAPP.find(t => t.nome === templateSelecionado)?.conteudo}
                  </div>
                </div>
              )}

              {/* Mensagem Custom */}
              {!templateSelecionado && (
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Mensagem Personalizada
                  </label>
                  <Textarea
                    value={mensagemCustom}
                    onChange={(e) => setMensagemCustom(e.target.value)}
                    placeholder="Digite sua mensagem... Use {nome}, {cupom_desconto}"
                    rows={6}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              )}

              {/* Cupom e Limite */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Desconto (%)
                  </label>
                  <Input
                    type="number"
                    value={cupomDesconto}
                    onChange={(e) => setCupomDesconto(parseInt(e.target.value))}
                    min={0}
                    max={100}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Limite de Envios (teste)
                  </label>
                  <Input
                    type="number"
                    value={limiteEnvios || ''}
                    onChange={(e) => setLimiteEnvios(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Vazio = todos"
                    min={1}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              {/* Executar Agora */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="executar_agora"
                  checked={executarAgora}
                  onChange={(e) => setExecutarAgora(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="executar_agora" className="text-sm text-gray-900 dark:text-white">
                  Executar campanha imediatamente
                </label>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={criarCampanha}
                  disabled={criandoCampanha}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {criandoCampanha ? (
                    <>Criando...</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      {executarAgora ? 'Criar e Enviar' : 'Criar Campanha'}
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setModalAberto(false)}
                  variant="outline"
                  className="bg-white dark:bg-gray-700"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
