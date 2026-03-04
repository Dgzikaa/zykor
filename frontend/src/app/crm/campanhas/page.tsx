'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Send, 
  Mail, 
  MessageCircle, 
  Ticket,
  Plus,
  Calendar,
  TrendingUp,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Trash2,
  Phone,
  AlertCircle,
  Zap,
  BarChart3
} from 'lucide-react';
import Link from 'next/link';
import { useBar } from '@/contexts/BarContext';

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

interface Metricas {
  campanhas: {
    total: number;
    concluidas: number;
    total_enviados: number;
    total_erros: number;
    taxa_entrega: number;
    taxa_resposta: number;
  };
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
    nome: 'Evento Especial - Convite',
    tipo: 'whatsapp',
    categoria: 'evento',
    conteudo: `Olá {nome}! 🎊

Temos um EVENTO ESPECIAL chegando e você está convidado!

📅 Data: {evento_data}
🎵 Atração: {evento_atracao}

Te esperamos! 🎉`,
    variaveis: ['{nome}', '{evento_data}', '{evento_atracao}']
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

export default function CampanhasPage() {
  const { selectedBar } = useBar();
  const currentBarId = selectedBar?.id;

  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [templates] = useState<{ whatsapp: Template[]; email: Template[] }>({ whatsapp: TEMPLATES_WHATSAPP, email: [] });
  const [segmentosStats, setSegmentosStats] = useState<Record<string, number>>({});
  const [umblerConfig, setUmblerConfig] = useState<UmblerConfig | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [criandoCampanha, setCriandoCampanha] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'whatsapp' | 'email'>('whatsapp');
  const [segmentosSelecionados, setSegmentosSelecionados] = useState<string[]>([]);
  const [templateSelecionado, setTemplateSelecionado] = useState('');
  const [mensagemCustom, setMensagemCustom] = useState('');
  const [cupomDesconto, setCupomDesconto] = useState(20);
  const [cupomValidade, setCupomValidade] = useState(7);
  const [executarAgora, setExecutarAgora] = useState(true);
  const [limiteEnvios, setLimiteEnvios] = useState<number | undefined>(undefined);

  const fetchCampanhas = async () => {
    if (!currentBarId) return;
    setLoading(true);
    try {
      // Buscar campanhas da Umbler
      const response = await fetch(`/api/umbler/campanhas?bar_id=${currentBarId}`);
      const result = await response.json();
      setCampanhas(result.campanhas || []);

      // Buscar config da Umbler
      const configResponse = await fetch(`/api/umbler/config?bar_id=${currentBarId}`);
      const configResult = await configResponse.json();
      setUmblerConfig(configResult);

      // Buscar métricas
      const metricasResponse = await fetch(`/api/umbler/metricas?bar_id=${currentBarId}&periodo=30`);
      const metricasResult = await metricasResponse.json();
      setMetricas(metricasResult);

      const integrationResponse = await fetch(`/api/configuracoes/integracoes/status?bar_id=${currentBarId}`);
      const integrationResult = await integrationResponse.json();
      if (integrationResult.success) {
        setIntegrationStatus({
          integracoes: integrationResult.integracoes,
          faltantes: integrationResult.faltantes || [],
        });
      }

      // Buscar stats de segmentos (API existente)
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
      setLoading(false);
    }
  };

  // Calcular total de clientes selecionados
  const totalClientesSelecionados = segmentosSelecionados.reduce(
    (sum, seg) => sum + (segmentosStats[seg] || 0), 
    0
  );

  useEffect(() => {
    if (!currentBarId) return;
    fetchCampanhas();
  }, [currentBarId]);

  const criarCampanha = async () => {
    if (!nome || segmentosSelecionados.length === 0) {
      alert('Preencha o nome e selecione pelo menos um segmento');
      return;
    }

    if (!umblerConfig?.configurado) {
      alert('Umbler não configurado! A integração com WhatsApp via Umbler Talk não está ativa.');
      return;
    }

    // Confirmar envio em massa
    if (executarAgora && totalClientesSelecionados > 10) {
      const confirmar = confirm(
        `Você está prestes a enviar mensagens para ${totalClientesSelecionados.toLocaleString()} clientes.\n\n` +
        `Isso pode demorar alguns minutos.\n\n` +
        `Deseja continuar?`
      );
      if (!confirmar) return;
    }

    setCriandoCampanha(true);
    try {
      // Buscar clientes dos segmentos selecionados
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
          executar_agora: false, // Não executar pela API antiga
          limite_envios: limiteEnvios
        })
      });

      const clientesResult = await clientesResponse.json();

      if (!clientesResult.success) {
        alert(`Erro ao preparar campanha: ${clientesResult.error}`);
        return;
      }

      // Preparar template
      const templateContent = templateSelecionado 
        ? templates.whatsapp.find(t => t.nome === templateSelecionado)?.conteudo || mensagemCustom
        : mensagemCustom;

      // Preparar destinatários a partir dos dados da campanha antiga
      // Por enquanto, vamos criar uma campanha na nova estrutura
      const destinatarios = clientesResult.clientes?.map((c: { telefone: string; nome: string; id: number }) => ({
        telefone: c.telefone,
        nome: c.nome,
        cliente_contahub_id: c.id
      })) || [];

      if (destinatarios.length === 0) {
        alert('Nenhum cliente encontrado nos segmentos selecionados com telefone válido.');
        return;
      }

      // Criar campanha via Umbler
      const response = await fetch('/api/umbler/campanhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bar_id: currentBarId,
          nome,
          tipo: 'marketing',
          template_mensagem: templateContent,
          variaveis: {
            cupom_desconto: cupomDesconto.toString()
          },
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

  const cancelarCampanha = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta campanha?')) return;

    try {
      const response = await fetch(`/api/umbler/campanhas?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        alert('Campanha cancelada com sucesso!');
        fetchCampanhas();
      }
    } catch (error) {
      console.error('Erro ao cancelar campanha:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rascunho':
        return <Badge className="bg-gray-500">📝 Rascunho</Badge>;
      case 'agendada':
        return <Badge className="bg-blue-600">📅 Agendada</Badge>;
      case 'em_execucao':
        return <Badge className="bg-yellow-600">⚡ Executando</Badge>;
      case 'concluida':
        return <Badge className="bg-green-600">✅ Concluída</Badge>;
      case 'cancelada':
        return <Badge className="bg-red-600">❌ Cancelada</Badge>;
      default:
        return <Badge>-</Badge>;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'whatsapp':
        return <Badge className="bg-green-600"><MessageCircle className="w-3 h-3 mr-1" /> WhatsApp</Badge>;
      case 'marketing':
        return <Badge className="bg-green-600"><Zap className="w-3 h-3 mr-1" /> Marketing</Badge>;
      case 'email':
        return <Badge className="bg-blue-600"><Mail className="w-3 h-3 mr-1" /> Email</Badge>;
      case 'reengajamento':
        return <Badge className="bg-orange-600"><Users className="w-3 h-3 mr-1" /> Reengajamento</Badge>;
      default:
        return <Badge className="bg-gray-600">{tipo}</Badge>;
    }
  };

  const toggleSegmento = (segmento: string) => {
    if (segmentosSelecionados.includes(segmento)) {
      setSegmentosSelecionados(segmentosSelecionados.filter(s => s !== segmento));
    } else {
      setSegmentosSelecionados([...segmentosSelecionados, segmento]);
    }
  };

  // Estatísticas gerais
  const stats = {
    total: metricas?.campanhas.total || campanhas.length,
    concluidas: metricas?.campanhas.concluidas || campanhas.filter(c => c.status === 'concluida').length,
    total_enviados: metricas?.campanhas.total_enviados || campanhas.reduce((sum, c) => sum + (c.enviados || 0), 0),
    total_erros: metricas?.campanhas.total_erros || campanhas.reduce((sum, c) => sum + (c.erros || 0), 0),
    taxa_entrega: metricas?.campanhas.taxa_entrega || 0,
    taxa_resposta: metricas?.campanhas.taxa_resposta || 0
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Campanhas WhatsApp
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Disparo em massa via Umbler Talk
              {umblerConfig?.config && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Phone className="w-3 h-3" />
                  {umblerConfig.config.channel_name} ({umblerConfig.config.phone_number})
                </span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/crm/campanhas/analise">
              <Button 
                variant="outline"
                className="border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Análise de Campanhas
              </Button>
            </Link>
            <Button 
              onClick={() => window.location.href = '/crm/conversas'}
              variant="outline"
              className="border-gray-300 dark:border-gray-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Ver Conversas
            </Button>
            <Button 
              onClick={() => setModalAberto(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!umblerConfig?.configurado}
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Campanha
            </Button>
          </div>

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

                {/* Tipo */}
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Tipo de Campanha
                  </label>
                  <Select value={tipo} onValueChange={(value: any) => setTipo(value)}>
                    <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </div>
                      </SelectItem>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          Email
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Segmentos */}
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Segmentos Alvo
                    {segmentosSelecionados.length > 0 && (
                      <span className="ml-2 text-blue-600 dark:text-blue-400 font-bold">
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
                      {(tipo === 'whatsapp' ? templates.whatsapp : templates.email).map(t => (
                        <SelectItem key={t.nome} value={t.nome}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview do Template */}
                {templateSelecionado && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {(tipo === 'whatsapp' ? templates.whatsapp : templates.email)
                        .find(t => t.nome === templateSelecionado)?.conteudo}
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
                      placeholder="Digite sua mensagem... Use {nome}, {cupom_desconto}, {cupom_codigo}, {cupom_validade}"
                      rows={6}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                )}

                {/* Cupom */}
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
                      Validade (dias)
                    </label>
                    <Input
                      type="number"
                      value={cupomValidade}
                      onChange={(e) => setCupomValidade(parseInt(e.target.value))}
                      min={1}
                      max={365}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                    />
                  </div>
                </div>

                {/* Limite de Envios (para teste) */}
                <div>
                  <label className="text-sm font-medium text-gray-900 dark:text-white mb-2 block">
                    Limite de Envios (opcional - para teste)
                  </label>
                  <Input
                    type="number"
                    value={limiteEnvios || ''}
                    onChange={(e) => setLimiteEnvios(e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="Deixe vazio para enviar para todos"
                    min={1}
                    className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 Dica: Teste com 5-10 clientes antes de enviar para todos
                  </p>
                </div>

                {/* Executar */}
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

                {/* Aviso Umbler não configurado */}
                {!umblerConfig?.configurado && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Umbler Talk não configurado</span>
                    </div>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      A integração com Umbler Talk precisa ser configurada para enviar mensagens via WhatsApp.
                    </p>
                  </div>
                )}

                {/* Info Umbler configurado */}
                {umblerConfig?.configurado && umblerConfig.config && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Umbler Talk conectado</span>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Canal: {umblerConfig.config.channel_name} • {umblerConfig.config.phone_number}
                    </p>
                  </div>
                )}

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

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Campanhas</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-green-600 dark:text-green-400 mb-1">Concluídas</div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.concluidas}</div>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Mensagens Enviadas</div>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.total_enviados}</div>
                  </div>
                  <Send className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Taxa Entrega</div>
                    <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">{stats.taxa_entrega}%</div>
                  </div>
                  <Eye className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Taxa Resposta</div>
                    <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">{stats.taxa_resposta}%</div>
                  </div>
                  <MessageCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerta se Umbler não configurado */}
        {!loading && !umblerConfig?.configurado && (
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Integração Umbler não configurada para este bar
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Configure as credenciais da Umbler Talk para habilitar o disparo em massa via WhatsApp.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && integrationStatus && integrationStatus.faltantes.length > 0 && (
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Integrações ausentes para o bar selecionado
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {integrationStatus.faltantes.map((nome) => nome.toUpperCase()).join(' e ')} não está configurado.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Campanhas */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Histórico de Campanhas</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Todas as campanhas criadas e seus resultados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : campanhas.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                Nenhuma campanha criada ainda. Crie sua primeira campanha!
              </div>
            ) : (
              <div className="space-y-4">
                {campanhas.map((campanha) => (
                  <Card key={campanha.id} className="border border-gray-200 dark:border-gray-700">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {campanha.nome}
                          </h3>
                          <div className="flex gap-2 flex-wrap">
                            {getTipoBadge(campanha.tipo)}
                            {getStatusBadge(campanha.status)}
                            <Badge variant="outline" className="text-xs">
                              {campanha.total_destinatarios} destinatários
                            </Badge>
                          </div>
                        </div>

                        {(campanha.status === 'agendada' || campanha.status === 'rascunho') && (
                          <Button
                            onClick={() => cancelarCampanha(campanha.id)}
                            variant="outline"
                            size="sm"
                            className="bg-white dark:bg-gray-700"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                        )}
                      </div>

                      {/* Template Preview */}
                      {campanha.template_mensagem && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg mb-4 text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {campanha.template_mensagem.substring(0, 150)}...
                        </div>
                      )}

                      {/* Métricas */}
                      <div className="grid grid-cols-5 gap-4">
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div className="text-2xl font-bold text-gray-900 dark:text-white">
                            {campanha.total_destinatarios || 0}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Total</div>
                        </div>

                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {campanha.enviados || 0}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400">Enviados</div>
                        </div>

                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {campanha.entregues || 0}
                          </div>
                          <div className="text-xs text-green-600 dark:text-green-400">Entregues</div>
                        </div>

                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {campanha.respostas || 0}
                          </div>
                          <div className="text-xs text-purple-600 dark:text-purple-400">Respostas</div>
                        </div>

                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {campanha.erros || 0}
                          </div>
                          <div className="text-xs text-red-600 dark:text-red-400">Erros</div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Criada em: {new Date(campanha.created_at).toLocaleString('pt-BR')}</span>
                        {campanha.finalizado_em && (
                          <span>Finalizada em: {new Date(campanha.finalizado_em).toLocaleString('pt-BR')}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

