'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Settings, 
  Users, 
  BarChart3, 
  Briefcase,
  CreditCard,
  CheckCircle,
  XCircle,
  Save,
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Modulo {
  id: string;
  nome: string;
  categoria: string;
}

interface Role {
  nome: string;
  descricao: string;
  modulos: string[];
}

interface RolesData {
  [key: string]: Role;
}

const CATEGORIA_ICONS = {
  operacoes: Briefcase,
  relatorios: BarChart3,
  dashboards: BarChart3,
  gestao: Users,
  configuracoes: Settings,
  financeiro: CreditCard,
};

const CATEGORIA_COLORS = {
  operacoes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  relatorios: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  dashboards: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gestao: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  configuracoes: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  financeiro: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const ROLE_CONFIGS = {
  admin: {
    icon: Shield,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  funcionario: {
    icon: Users,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  financeiro: {
    icon: CreditCard,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
};

export default function PermissoesPage() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [rolesOriginais, setRolesOriginais] = useState<RolesData>({});
  const [rolesEditadas, setRolesEditadas] = useState<RolesData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState('admin');

  const { toast } = useToast();
  const { setPageTitle } = usePageTitle();
  useEffect(() => {
    setPageTitle('🔐 Gestão de Permissões');
    return () => setPageTitle('');
  }, [setPageTitle]);

  const fetchPermissoes = useCallback(async () => {
    try {
      const response = await fetch('/api/configuracoes/permissoes');
      const data = await response.json();
      
      if (data.modulos && data.roles) {
        setModulos(data.modulos);
        setRolesOriginais(data.roles);
        setRolesEditadas(JSON.parse(JSON.stringify(data.roles))); // Deep copy
      }
    } catch (error) {
      console.error('Erro ao buscar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar permissões',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPermissoes();
  }, [fetchPermissoes]);

  const handleModuloChange = (roleKey: string, moduloId: string, checked: boolean) => {
    setRolesEditadas(prev => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        modulos: checked 
          ? [...prev[roleKey].modulos, moduloId]
          : prev[roleKey].modulos.filter(id => id !== moduloId)
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Salvaria as permissões atualizadas
      // Por enquanto, apenas simula sucesso
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setRolesOriginais(JSON.parse(JSON.stringify(rolesEditadas)));
      
      toast({
        title: 'Sucesso',
        description: 'Permissões atualizadas com sucesso',
      });
    } catch (error) {
      console.error('Erro ao salvar permissões:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar permissões',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setRolesEditadas(JSON.parse(JSON.stringify(rolesOriginais)));
    toast({
      title: 'Resetado',
      description: 'Permissões resetadas para os valores originais',
    });
  };

  const hasChanges = JSON.stringify(rolesOriginais) !== JSON.stringify(rolesEditadas);

  const modulosPorCategoria = modulos.reduce((acc, modulo) => {
    if (!acc[modulo.categoria]) {
      acc[modulo.categoria] = [];
    }
    acc[modulo.categoria].push(modulo);
    return acc;
  }, {} as Record<string, Modulo[]>);

  const getModulosPermitidos = (roleKey: string) => {
    return rolesEditadas[roleKey]?.modulos || [];
  };

  const getTotalModulosCategoria = (categoria: string) => {
    return modulosPorCategoria[categoria]?.length || 0;
  };

  const getModulosPermitidosCategoria = (roleKey: string, categoria: string) => {
    const modulosRole = getModulosPermitidos(roleKey);
    const modulosCategoria = modulosPorCategoria[categoria] || [];
    return modulosCategoria.filter(modulo => modulosRole.includes(modulo.id)).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6">
        <div className="card-dark p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="card-title-dark mb-2">Gestão de Permissões</h1>
              <p className="card-description-dark">
                Configure as permissões para cada função do sistema
              </p>
            </div>
            <div className="flex gap-2">
              {hasChanges && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="btn-outline-dark"
                  disabled={saving}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Resetar
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="btn-primary-dark"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>

          <Tabs value={activeRole} onValueChange={setActiveRole} className="w-full">
            <TabsList className="tabs-list-dark mb-6">
              {Object.entries(rolesEditadas).map(([roleKey, role]) => {
                const config = ROLE_CONFIGS[roleKey as keyof typeof ROLE_CONFIGS];
                const Icon = config?.icon || Shield;
                
                return (
                  <TabsTrigger key={roleKey} value={roleKey} className="tabs-trigger-dark">
                    <Icon className="w-4 h-4 mr-2" />
                    {role.nome}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(rolesEditadas).map(([roleKey, role]) => {
              const config = ROLE_CONFIGS[roleKey as keyof typeof ROLE_CONFIGS];
              const modulosPermitidos = getModulosPermitidos(roleKey);
              
              return (
                <TabsContent key={roleKey} value={roleKey} className="space-y-6">
                  {/* Header da Role */}
                  <Card className={`card-dark border-2 ${config?.borderColor || 'border-gray-200 dark:border-gray-700'}`}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-4">
                        {config?.icon && (
                          <div className={`p-3 rounded-xl ${config.color}`}>
                            <config.icon className="w-6 h-6" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-gray-900 dark:text-white">
                            {role.nome}
                          </CardTitle>
                          <CardDescription className="text-gray-600 dark:text-gray-400">
                            {role.descricao}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-4">
                        <Badge className={config?.color || 'bg-gray-100 text-gray-700'}>
                          {modulosPermitidos.length} de {modulos.length} módulos
                        </Badge>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {((modulosPermitidos.length / modulos.length) * 100).toFixed(0)}% de acesso
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Módulos por Categoria */}
                  <div className="grid gap-6">
                    {Object.entries(modulosPorCategoria).map(([categoria, categoriaModulos]) => {
                      const Icon = CATEGORIA_ICONS[categoria as keyof typeof CATEGORIA_ICONS] || Settings;
                      const totalCategoria = getTotalModulosCategoria(categoria);
                      const permitidosCategoria = getModulosPermitidosCategoria(roleKey, categoria);
                      const isAllSelected = permitidosCategoria === totalCategoria;
                      const isNoneSelected = permitidosCategoria === 0;

                      return (
                        <Card key={categoria} className="card-dark">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${CATEGORIA_COLORS[categoria as keyof typeof CATEGORIA_COLORS] || 'bg-gray-100'}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <CardTitle className="text-lg text-gray-900 dark:text-white capitalize">
                                    {categoria.replace('_', ' ')}
                                  </CardTitle>
                                  <CardDescription className="text-sm">
                                    {permitidosCategoria} de {totalCategoria} módulos selecionados
                                  </CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isAllSelected ? (
                                  <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : isNoneSelected ? (
                                  <XCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700" />
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    isAllSelected ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400' :
                                    isNoneSelected ? 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400' :
                                    'border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400'
                                  }`}
                                >
                                  {((permitidosCategoria / totalCategoria) * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {categoriaModulos.map(modulo => (
                                <div key={modulo.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <Checkbox
                                    checked={modulosPermitidos.includes(modulo.id)}
                                    onCheckedChange={(checked) => 
                                      handleModuloChange(roleKey, modulo.id, checked as boolean)
                                    }
                                  />
                                  <label 
                                    htmlFor={`${roleKey}-${modulo.id}`} 
                                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                                  >
                                    {modulo.nome}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </div>
  );
}