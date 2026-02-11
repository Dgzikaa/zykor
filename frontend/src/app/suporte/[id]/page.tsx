'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Send,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  Star,
  Loader2,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Chamado {
  id: string;
  numero_chamado: number;
  titulo: string;
  descricao: string;
  categoria: string;
  modulo: string;
  prioridade: string;
  status: string;
  criado_por: string;
  atribuido_para: string | null;
  criado_em: string;
  atualizado_em: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
  fechado_em: string | null;
  sla_primeira_resposta_horas: number;
  sla_resolucao_horas: number;
  sla_violado: boolean;
  anexos: any[];
  tags: string[];
  avaliacao_nota: number | null;
  avaliacao_comentario: string | null;
  avaliacao_em: string | null;
  mensagens: Mensagem[];
  historico: HistoricoItem[];
}

interface Mensagem {
  id: string;
  autor_id: string;
  autor_nome: string;
  autor_tipo: string;
  mensagem: string;
  tipo: string;
  criado_em: string;
  anexos: any[];
}

interface HistoricoItem {
  id: string;
  usuario_nome: string;
  acao: string;
  campo_alterado: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  criado_em: string;
  detalhes: any;
}

const statusColors: Record<string, string> = {
  aberto: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  em_andamento: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  aguardando_cliente: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  aguardando_suporte: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  resolvido: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  fechado: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
};

const statusLabels: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_suporte: 'Aguardando Suporte',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
  cancelado: 'Cancelado'
};

export default function DetalhesChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [avaliacaoNota, setAvaliacaoNota] = useState<number>(0);
  const [avaliacaoComentario, setAvaliacaoComentario] = useState('');
  const [enviandoAvaliacao, setEnviandoAvaliacao] = useState(false);

  const userId = 'b9e11c73-c4ce-42f0-b4a8-d7d41ef6beff'; // TODO: Pegar do contexto
  const userName = 'Usuário'; // TODO: Pegar do contexto

  const fetchChamado = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/suporte/${resolvedParams.id}`);
      const result = await response.json();

      if (result.success) {
        setChamado(result.data);
      } else {
        toast.error('Chamado não encontrado');
        router.push('/suporte');
      }
    } catch (error) {
      console.error('Erro ao buscar chamado:', error);
      toast.error('Erro ao carregar chamado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChamado();
  }, [resolvedParams.id]);

  const enviarMensagem = async () => {
    if (!novaMensagem.trim()) {
      toast.error('Digite uma mensagem');
      return;
    }

    setEnviandoMensagem(true);
    try {
      const response = await fetch(`/api/suporte/${resolvedParams.id}/mensagens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autor_id: userId,
          autor_nome: userName,
          autor_tipo: 'cliente',
          mensagem: novaMensagem.trim()
        })
      });

      const result = await response.json();

      if (result.success) {
        setNovaMensagem('');
        fetchChamado(); // Recarregar para pegar a nova mensagem
        toast.success('Mensagem enviada!');
      } else {
        toast.error(result.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setEnviandoMensagem(false);
    }
  };

  const atualizarStatus = async (novoStatus: string) => {
    try {
      const response = await fetch(`/api/suporte/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: novoStatus,
          usuario_id: userId,
          usuario_nome: userName
        })
      });

      const result = await response.json();

      if (result.success) {
        fetchChamado();
        toast.success('Status atualizado!');
      } else {
        toast.error(result.error || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const enviarAvaliacao = async () => {
    if (avaliacaoNota === 0) {
      toast.error('Selecione uma nota');
      return;
    }

    setEnviandoAvaliacao(true);
    try {
      const response = await fetch(`/api/suporte/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avaliacao_nota: avaliacaoNota,
          avaliacao_comentario: avaliacaoComentario,
          usuario_id: userId,
          usuario_nome: userName
        })
      });

      const result = await response.json();

      if (result.success) {
        fetchChamado();
        toast.success('Avaliação enviada! Obrigado pelo feedback.');
      } else {
        toast.error(result.error || 'Erro ao enviar avaliação');
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação');
    } finally {
      setEnviandoAvaliacao(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Carregando chamado...</p>
        </div>
      </div>
    );
  }

  if (!chamado) {
    return null;
  }

  const podeEnviarMensagem = chamado.status !== 'fechado' && chamado.status !== 'cancelado';
  const podeAvaliar = chamado.status === 'resolvido' && !chamado.avaliacao_nota;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link href="/suporte">
            <Button variant="ghost" size="icon" className="mt-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">
                #{chamado.numero_chamado}
              </span>
              <Badge className={statusColors[chamado.status]}>
                {statusLabels[chamado.status] || chamado.status}
              </Badge>
              {chamado.sla_violado && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  SLA Violado
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground">{chamado.titulo}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(chamado.criado_em)}
              </span>
              <Badge variant="outline">{chamado.categoria}</Badge>
              {chamado.modulo && (
                <Badge variant="outline">{chamado.modulo}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchChamado}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {chamado.status === 'resolvido' && (
            <>
              <Button 
                variant="outline" 
                onClick={() => atualizarStatus('aberto')}
              >
                Reabrir
              </Button>
              <Button onClick={() => atualizarStatus('fechado')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Fechar Chamado
              </Button>
            </>
          )}
          {chamado.status === 'aberto' && (
            <Button 
              variant="outline" 
              onClick={() => atualizarStatus('cancelado')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descrição */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{chamado.descricao}</p>
            </CardContent>
          </Card>

          {/* Mensagens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Mensagens ({chamado.mensagens.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {chamado.mensagens.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhuma mensagem ainda. Aguarde uma resposta da equipe de suporte.
                </p>
              ) : (
                chamado.mensagens.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`p-4 rounded-lg ${
                      msg.autor_tipo === 'suporte' 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' 
                        : 'bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{msg.autor_nome}</span>
                        <Badge variant="outline" className="text-xs">
                          {msg.autor_tipo === 'suporte' ? 'Suporte' : 'Cliente'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(msg.criado_em)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.mensagem}</p>
                  </div>
                ))
              )}

              {podeEnviarMensagem && (
                <div className="pt-4 border-t">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    rows={3}
                  />
                  <div className="flex justify-end mt-2">
                    <Button 
                      onClick={enviarMensagem} 
                      disabled={enviandoMensagem || !novaMensagem.trim()}
                    >
                      {enviandoMensagem ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Enviar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Avaliação */}
          {podeAvaliar && (
            <Card className="border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                  <Star className="h-5 w-5" />
                  Avalie o Atendimento
                </CardTitle>
                <CardDescription>
                  Seu feedback nos ajuda a melhorar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <button
                      key={nota}
                      onClick={() => setAvaliacaoNota(nota)}
                      className={`p-2 rounded-lg transition-all ${
                        avaliacaoNota >= nota
                          ? 'text-yellow-500'
                          : 'text-gray-300 hover:text-yellow-300'
                      }`}
                    >
                      <Star className="h-8 w-8 fill-current" />
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Deixe um comentário (opcional)"
                  value={avaliacaoComentario}
                  onChange={(e) => setAvaliacaoComentario(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button onClick={enviarAvaliacao} disabled={enviandoAvaliacao || avaliacaoNota === 0}>
                    {enviandoAvaliacao ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Star className="h-4 w-4 mr-2" />
                    )}
                    Enviar Avaliação
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Avaliação já enviada */}
          {chamado.avaliacao_nota && (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((nota) => (
                      <Star 
                        key={nota}
                        className={`h-5 w-5 ${
                          chamado.avaliacao_nota && chamado.avaliacao_nota >= nota
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Avaliado em {formatDate(chamado.avaliacao_em!)}
                  </span>
                </div>
                {chamado.avaliacao_comentario && (
                  <p className="mt-2 text-sm italic">&ldquo;{chamado.avaliacao_comentario}&rdquo;</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Informações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={statusColors[chamado.status]}>
                  {statusLabels[chamado.status] || chamado.status}
                </Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Prioridade</p>
                <Badge variant="outline">{chamado.prioridade}</Badge>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Categoria</p>
                <span className="font-medium">{chamado.categoria}</span>
              </div>
              {chamado.modulo && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Módulo</p>
                    <span className="font-medium">{chamado.modulo}</span>
                  </div>
                </>
              )}
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">SLA Resposta</p>
                <span className="font-medium">{chamado.sla_primeira_resposta_horas}h</span>
                {chamado.primeira_resposta_em && (
                  <span className="text-xs text-green-600 ml-2">
                    Respondido em {formatDate(chamado.primeira_resposta_em)}
                  </span>
                )}
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">SLA Resolução</p>
                <span className="font-medium">{chamado.sla_resolucao_horas}h</span>
                {chamado.resolvido_em && (
                  <span className="text-xs text-green-600 ml-2">
                    Resolvido em {formatDate(chamado.resolvido_em)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chamado.historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alteração registrada</p>
              ) : (
                <div className="space-y-3">
                  {chamado.historico.slice(0, 10).map((item) => (
                    <div key={item.id} className="text-sm border-l-2 pl-3 py-1">
                      <p className="font-medium">
                        {item.acao === 'criado' && 'Chamado criado'}
                        {item.acao === 'status_alterado' && `Status: ${item.valor_anterior} → ${item.valor_novo}`}
                        {item.acao === 'prioridade_alterada' && `Prioridade: ${item.valor_anterior} → ${item.valor_novo}`}
                        {item.acao === 'mensagem_enviada' && 'Mensagem enviada'}
                        {item.acao === 'avaliado' && 'Chamado avaliado'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.usuario_nome || 'Sistema'} - {formatDate(item.criado_em)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
