'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  RefreshCw,
  Package,
  BarChart3,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { usePageTitle } from '@/contexts/PageTitleContext';
import Link from 'next/link';

interface Area {
  id: number;
  nome: string;
  descricao: string | null;
  tipo: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
  estatisticas?: {
    total_itens: number;
    valor_total: number;
  };
}

const TIPOS_AREA = [
  { value: 'freezer', label: 'Freezer' },
  { value: 'geladeira', label: 'Geladeira' },
  { value: 'deposito', label: 'Depósito' },
  { value: 'bar', label: 'Bar' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'prateleira', label: 'Prateleira' },
  { value: 'outros', label: 'Outros' }
];

export default function AreasContagemPage() {
  const { setPageTitle } = usePageTitle();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [areaEditando, setAreaEditando] = useState<Area | null>(null);
  
  // Formulário
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('outros');
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState(0);

  useEffect(() => {
    setPageTitle('📍 Gerenciamento de Áreas');
    buscarAreas();
  }, [setPageTitle]);

  const buscarAreas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/operacoes/areas-contagem');
      const result = await response.json();

      if (result.success) {
        setAreas(result.data || []);
      } else {
        toast.error('Erro ao buscar áreas');
      }
    } catch (error) {
      console.error('Erro ao buscar áreas:', error);
      toast.error('Erro ao buscar áreas');
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovo = () => {
    setAreaEditando(null);
    limparFormulario();
    setModalAberto(true);
  };

  const abrirModalEdicao = (area: Area) => {
    setAreaEditando(area);
    setNome(area.nome);
    setDescricao(area.descricao || '');
    setTipo(area.tipo || 'outros');
    setAtivo(area.ativo);
    setOrdem(area.ordem);
    setModalAberto(true);
  };

  const limparFormulario = () => {
    setNome('');
    setDescricao('');
    setTipo('outros');
    setAtivo(true);
    setOrdem(0);
  };

  const salvarArea = async () => {
    if (!nome.trim()) {
      toast.error('Nome da área é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        tipo,
        ativo,
        ordem,
        usuario_criacao_nome: 'Usuário Sistema'
      };

      let response;
      if (areaEditando) {
        // Atualizar
        response = await fetch('/api/operacoes/areas-contagem', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...dados, id: areaEditando.id })
        });
      } else {
        // Criar
        response = await fetch('/api/operacoes/areas-contagem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dados)
        });
      }

      const result = await response.json();

      if (result.success) {
        toast.success(result.message || 'Área salva com sucesso');
        setModalAberto(false);
        limparFormulario();
        buscarAreas();
      } else {
        toast.error(result.error || 'Erro ao salvar área');
      }
    } catch (error) {
      console.error('Erro ao salvar área:', error);
      toast.error('Erro ao salvar área');
    } finally {
      setLoading(false);
    }
  };

  const excluirArea = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir a área "${nome}"?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/operacoes/areas-contagem?id=${id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Área excluída com sucesso');
        buscarAreas();
      } else {
        toast.error(result.error || 'Erro ao excluir área');
      }
    } catch (error) {
      console.error('Erro ao excluir área:', error);
      toast.error('Erro ao excluir área');
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (area: Area) => {
    setLoading(true);
    try {
      const response = await fetch('/api/operacoes/areas-contagem', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: area.id,
          ativo: !area.ativo
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Área ${!area.ativo ? 'ativada' : 'desativada'} com sucesso`);
        buscarAreas();
      } else {
        toast.error(result.error || 'Erro ao atualizar área');
      }
    } catch (error) {
      console.error('Erro ao atualizar área:', error);
      toast.error('Erro ao atualizar área');
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_AREA.find(t => t.value === tipo)?.label || tipo;
  };

  const getTipoBadgeClass = (tipo: string) => {
    const classes: Record<string, string> = {
      freezer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      geladeira: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
      deposito: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      bar: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      cozinha: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      prateleira: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      outros: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return classes[tipo] || classes.outros;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <div className="card-dark p-3 sm:p-6 mb-4 sm:mb-6">
          <Link href="/ferramentas/contagem-estoque" className="inline-block mb-4">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Voltar para Contagem
            </Button>
          </Link>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Card className="card-dark">
              <CardHeader className="pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Total de Áreas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {areas.length}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {areas.filter(a => a.ativo).length} ativas
                </p>
              </CardContent>
            </Card>

            <Card className="card-dark">
              <CardHeader className="pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Itens Registrados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {areas.reduce((sum, a) => sum + (a.estatisticas?.total_itens || 0), 0)}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total de produtos
                </p>
              </CardContent>
            </Card>

            <Card className="card-dark xs:col-span-2 md:col-span-1">
              <CardHeader className="pb-2 p-3 sm:p-4">
                <CardTitle className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                  Valor Total
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatarValor(areas.reduce((sum, a) => sum + (a.estatisticas?.valor_total || 0), 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Áreas */}
          <Card className="card-dark">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="card-title-dark">Áreas Cadastradas</CardTitle>
                  <CardDescription className="card-description-dark">
                    Gerencie suas áreas de contagem
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={abrirModalNovo}
                    variant="default"
                    size="sm"
                    className="btn-primary-dark flex-1 sm:flex-none"
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    <span className="hidden xs:inline">Nova Área</span>
                    <span className="xs:hidden">Nova</span>
                  </Button>
                  <Button
                    onClick={buscarAreas}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="btn-outline-dark flex-1 sm:flex-none"
                    leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
                  >
                    <span className="hidden xs:inline">Atualizar</span>
                    <span className="xs:hidden">Atualizar</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading && areas.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400">Carregando áreas...</p>
                </div>
              ) : areas.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Nenhuma área cadastrada
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Clique em &quot;Nova Área&quot; acima para começar a organizar as contagens
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className={`p-3 sm:p-4 rounded-lg border ${
                        area.ativo
                          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          : 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 opacity-60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-0">
                        <div className="flex-1 w-full sm:w-auto">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {area.nome}
                            </h4>
                            <Badge className={`text-xs ${getTipoBadgeClass(area.tipo)}`}>
                              {getTipoLabel(area.tipo)}
                            </Badge>
                            {area.ativo ? (
                              <Badge className="badge-success text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativa
                              </Badge>
                            ) : (
                              <Badge className="badge-secondary text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Inativa
                              </Badge>
                            )}
                          </div>

                          {area.descricao && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {area.descricao}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                              <Package className="h-4 w-4" />
                              <span>{area.estatisticas?.total_itens || 0} itens</span>
                            </div>
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <BarChart3 className="h-4 w-4" />
                              <span>{formatarValor(area.estatisticas?.valor_total || 0)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-4">
                          <Button
                            onClick={() => toggleAtivo(area)}
                            variant="outline"
                            size="sm"
                            className="btn-outline-dark text-xs flex-1 sm:flex-none"
                          >
                            {area.ativo ? 'Desativar' : 'Ativar'}
                          </Button>
                          <Button
                            onClick={() => abrirModalEdicao(area)}
                            variant="outline"
                            size="sm"
                            className="btn-outline-dark flex-1 sm:flex-none"
                            leftIcon={<Edit className="h-3 w-3 sm:h-4 sm:w-4" />}
                          >
                            <span className="hidden xs:inline">Editar</span>
                          </Button>
                          <Button
                            onClick={() => excluirArea(area.id, area.nome)}
                            variant="outline"
                            size="sm"
                            className="btn-outline-dark text-red-600 dark:text-red-400 flex-1 sm:flex-none"
                            disabled={loading}
                            leftIcon={<Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />}
                          >
                            <span className="hidden xs:inline">Excluir</span>
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

      {/* Modal de Criar/Editar Área */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="modal-dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              {areaEditando ? 'Editar Área' : 'Nova Área'}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              {areaEditando 
                ? 'Atualize as informações da área de contagem'
                : 'Crie uma nova área para organizar suas contagens'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Nome da Área *</Label>
              <Input
                placeholder="Ex: Freezer Principal, Geladeira Bar..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="input-dark"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_AREA.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Descrição</Label>
              <Textarea
                placeholder="Informações adicionais sobre a área..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="textarea-dark min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Ordem</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={ordem}
                  onChange={(e) => setOrdem(parseInt(e.target.value) || 0)}
                  className="input-dark"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700 dark:text-gray-300">Status</Label>
                <Select 
                  value={ativo ? 'true' : 'false'} 
                  onValueChange={(v) => setAtivo(v === 'true')}
                >
                  <SelectTrigger className="input-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativa</SelectItem>
                    <SelectItem value="false">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col xs:flex-row gap-2 sm:gap-3 pt-4">
              <Button
                onClick={salvarArea}
                disabled={loading}
                loading={loading}
                className="btn-primary-dark flex-1"
                leftIcon={!loading ? <Save className="h-4 w-4" /> : undefined}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button
                onClick={() => setModalAberto(false)}
                variant="outline"
                className="btn-outline-dark xs:w-auto w-full"
                leftIcon={<X className="h-4 w-4" />}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

