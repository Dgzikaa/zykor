'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus,
  Search,
  MessageSquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw,
  BarChart3,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

interface Chamado {
  id: string;
  numero_chamado: number;
  titulo: string;
  descricao: string;
  categoria: string;
  modulo: string;
  prioridade: string;
  status: string;
  criado_em: string;
  atualizado_em: string;
  primeira_resposta_em: string | null;
  resolvido_em: string | null;
  sla_violado: boolean;
}

interface Stats {
  total: number;
  abertos: number;
  em_andamento: number;
  aguardando_cliente: number;
  resolvidos: number;
  fechados: number;
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

const prioridadeColors: Record<string, string> = {
  baixa: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  media: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  critica: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
};

const categoriaLabels: Record<string, string> = {
  bug: 'Bug',
  melhoria: 'Melhoria',
  duvida: 'Dúvida',
  sugestao: 'Sugestão',
  urgente: 'Urgente'
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

export default function SuportePage() {
  const router = useRouter();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [prioridadeFilter, setPrioridadeFilter] = useState('todos');
  const [categoriaFilter, setCategoriaFilter] = useState('todos');

  const barId = 3; // TODO: Pegar do contexto do usuário

  const fetchChamados = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bar_id: barId.toString(),
        status: statusFilter,
        prioridade: prioridadeFilter,
        categoria: categoriaFilter
      });

      const response = await fetch(`/api/suporte?${params}`);
      const result = await response.json();

      if (result.success) {
        setChamados(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Erro ao buscar chamados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChamados();
  }, [statusFilter, prioridadeFilter, categoriaFilter]);

  const filteredChamados = chamados.filter(c => 
    c.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.numero_chamado.toString().includes(searchTerm)
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Central de Suporte</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seus chamados e solicitações de suporte
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchChamados} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Link href="/suporte/estatisticas">
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Estatísticas
            </Button>
          </Link>
          <Link href="/suporte/novo">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Chamado
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="col-span-1">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="col-span-1 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.abertos}</div>
              <p className="text-xs text-muted-foreground">Abertos</p>
            </CardContent>
          </Card>
          <Card className="col-span-1 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.em_andamento}</div>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </CardContent>
          </Card>
          <Card className="col-span-1 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-purple-600">{stats.aguardando_cliente}</div>
              <p className="text-xs text-muted-foreground">Aguardando</p>
            </CardContent>
          </Card>
          <Card className="col-span-1 border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.resolvidos}</div>
              <p className="text-xs text-muted-foreground">Resolvidos</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-gray-600">{stats.fechados}</div>
              <p className="text-xs text-muted-foreground">Fechados</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título ou número..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
                <SelectItem value="fechado">Fechado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="melhoria">Melhoria</SelectItem>
                <SelectItem value="duvida">Dúvida</SelectItem>
                <SelectItem value="sugestao">Sugestão</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Chamados List */}
      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Carregando chamados...</p>
            </CardContent>
          </Card>
        ) : filteredChamados.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum chamado encontrado</h3>
              <p className="text-muted-foreground mt-1">
                {searchTerm || statusFilter !== 'todos' || prioridadeFilter !== 'todos' 
                  ? 'Tente ajustar os filtros de busca'
                  : 'Abra um novo chamado para começar'}
              </p>
              <Link href="/suporte/novo">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Chamado
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          filteredChamados.map((chamado) => (
            <Card 
              key={chamado.id} 
              className={`cursor-pointer hover:shadow-md transition-shadow ${chamado.sla_violado ? 'border-red-300 dark:border-red-700' : ''}`}
              onClick={() => router.push(`/suporte/${chamado.id}`)}
            >
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-muted-foreground">
                        #{chamado.numero_chamado}
                      </span>
                      <Badge className={statusColors[chamado.status]}>
                        {statusLabels[chamado.status] || chamado.status}
                      </Badge>
                      <Badge variant="outline" className={prioridadeColors[chamado.prioridade]}>
                        {chamado.prioridade}
                      </Badge>
                      {chamado.sla_violado && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          SLA
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground">{chamado.titulo}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      {chamado.descricao}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(chamado.criado_em)}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {categoriaLabels[chamado.categoria] || chamado.categoria}
                    </Badge>
                    {chamado.modulo && (
                      <span className="text-xs">{chamado.modulo}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
