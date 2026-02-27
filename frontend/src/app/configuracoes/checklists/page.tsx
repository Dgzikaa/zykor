'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  CheckSquare,
  Edit,
  Settings,
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  LayoutList,
  Loader2,
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';

interface Checklist {
  id: number;
  nome: string;
  descricao: string;
  tipo: string;
  setor: string;
  frequencia: string;
  prioridade: string;
  tempo_estimado: number;
  status: string;
  criado_em: string;
  total_itens: number;
  bar_id: number;
}

export default function ConfiguracaoChecklistsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [filtro, setFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');

  const carregarChecklists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/operacional/checklists');
      
      if (response.ok) {
        const data = await response.json();
        setChecklists(data.data || data || []);
      } else {
        console.error('Erro ao carregar checklists');
      }
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarChecklists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checklistsFiltrados = checklists.filter((checklist) => {
    const matchFiltro =
      checklist.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      checklist.descricao?.toLowerCase().includes(filtro.toLowerCase());
    const matchTipo = tipoFiltro === 'todos' || checklist.tipo === tipoFiltro;
    return matchFiltro && matchTipo;
  });

  const tiposUnicos = [...new Set(checklists.map((c) => c.tipo).filter(Boolean))];

  const getPrioridadeBadge = (prioridade: string) => {
    switch (prioridade?.toLowerCase()) {
      case 'alta':
      case 'critica':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'media':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'baixa':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ativo':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'inativo':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Carregando checklists..."
          subtitle="Preparando listas de verificação"
          icon={<CheckSquare className="w-4 h-4" />}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                onClick={() => router.push('/configuracoes')}
                className="text-white hover:bg-white/10 flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                  <CheckSquare className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Configuração de Checklists</h1>
                  <p className="text-emerald-100 mt-1">
                    Gerencie templates e configurações de checklists
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-emerald-200">Total de Checklists</div>
                <div className="text-2xl font-bold">{checklists.length}</div>
              </div>
              <Button
                onClick={carregarChecklists}
                variant="ghost"
                className="text-white hover:bg-white/10"
              >
                <RefreshCcw className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Buscar checklists..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  <option value="todos">Todos os tipos</option>
                  {tiposUnicos.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <LayoutList className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {checklists.length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ativos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {checklists.filter((c) => c.status === 'ativo').length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Alta Prioridade</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {checklists.filter((c) => c.prioridade === 'alta' || c.prioridade === 'critica').length}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Itens</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {checklists.reduce((acc, c) => acc + (c.total_itens || 0), 0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Checklists */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
              Templates de Checklists ({checklistsFiltrados.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {checklistsFiltrados.length === 0 ? (
              <div className="p-8 text-center">
                <CheckSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {filtro || tipoFiltro !== 'todos'
                    ? 'Nenhum checklist encontrado com os filtros aplicados'
                    : 'Nenhum checklist cadastrado'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {checklistsFiltrados.map((checklist) => (
                  <div
                    key={checklist.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {checklist.nome}
                          </h3>
                          <Badge className={getStatusBadge(checklist.status)}>
                            {checklist.status || 'Ativo'}
                          </Badge>
                          <Badge className={getPrioridadeBadge(checklist.prioridade)}>
                            {checklist.prioridade || 'Normal'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {checklist.descricao || 'Sem descrição'}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Settings className="w-3 h-3" />
                            {checklist.tipo || 'Geral'}
                          </span>
                          <span className="flex items-center gap-1">
                            <LayoutList className="w-3 h-3" />
                            {checklist.total_itens || 0} itens
                          </span>
                          {checklist.tempo_estimado && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {checklist.tempo_estimado} min
                            </span>
                          )}
                          <span>Setor: {checklist.setor || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={() => {
                            toast({
                              title: '🔧 Em desenvolvimento',
                              description: 'Editor de checklist em breve',
                            });
                          }}
                        >
                          <Edit className="w-4 h-4" />
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

