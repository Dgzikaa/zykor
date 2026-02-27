'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Key,
  Phone,
  Calendar,
  MapPin,
  User,
  CreditCard,
  Building
} from 'lucide-react';
import { LoadingState } from '@/components/ui/loading-state';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/layouts/PageHeader';
import { usePermissions } from '@/hooks/usePermissions';
import { safeLocalStorage } from '@/lib/client-utils';
import { DataTablePro } from '@/components/ui/datatable-pro';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: number;
  email: string;
  nome: string;
  role: string;
  bar_id?: number;
  bares_ids?: number[]; // Novo campo para múltiplos bares
  modulos_permitidos: string[];
  ativo: boolean;
  criado_em: string;
  ultima_atividade?: string;
  celular?: string;
  telefone?: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
}

interface Modulo {
  id: string;
  nome: string;
  categoria: string;
}

const ROLES_OPCOES = [
  { value: 'admin', label: 'Administrador', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'funcionario', label: 'Funcionário', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

function UsuariosPage() {
  const router = useRouter();
  const { user: currentUser, refreshUserData, isRole, loading: permissionsLoading } = usePermissions();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [bares, setBares] = useState<{id: number, nome: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false); // Checkbox de admin
  const [formData, setFormData] = useState({
    email: '',
    nome: '',
    role: '',
    bar_id: '',
    bares_ids: [] as number[], // Novo campo para múltiplos bares
    modulos_permitidos: [] as string[],
    ativo: true,
    celular: '',
    telefone: '',
    cpf: '',
    data_nascimento: '',
    endereco: '',
    cep: '',
    cidade: '',
    estado: '',
  });

  const { toast } = useToast();
  
  // 🔒 Verificar se é admin - apenas admins podem acessar esta página
  const isCurrentUserAdmin = isRole('admin');
  
  useEffect(() => {
    if (!permissionsLoading && !isCurrentUserAdmin) {
      toast({
        title: 'Acesso Negado',
        description: 'Apenas administradores podem acessar esta página',
        variant: 'destructive',
      });
      router.push('/home');
    }
  }, [permissionsLoading, isCurrentUserAdmin, router, toast]);

  const fetchUsuarios = useCallback(async () => {
    try {
      const response = await fetch('/api/configuracoes/usuarios');
      const data = await response.json();
      if (data.usuarios) {
        setUsuarios(data.usuarios);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar usuários',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchModulos = useCallback(async () => {
    try {
      const response = await fetch('/api/configuracoes/permissoes');
      const data = await response.json();
      if (data.modulos) {
        setModulos(data.modulos);
      }
    } catch (error) {
      console.error('Erro ao buscar módulos:', error);
    }
  }, []);

  const fetchBares = useCallback(async () => {
    try {
      const response = await fetch('/api/configuracoes/bars');
      const data = await response.json();
      if (data.bars) {
        setBares(data.bars);
      }
    } catch (error) {
      console.error('Erro ao buscar bares:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar bares',
        variant: 'destructive',
      });
    }
  }, [toast]);

  useEffect(() => {
    fetchUsuarios();
    fetchModulos();
    fetchBares();
  }, []); // Remove as dependências para evitar loop infinito

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que pelo menos um bar foi selecionado
    if (formData.bares_ids.length === 0) {
      toast({
        title: 'Erro',
        description: 'Selecione pelo menos um bar para o usuário',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // 🔒 Se marcou como admin, garantir role="admin" e adicionar "todos" aos módulos
      let finalFormData = { ...formData };
      if (isAdminUser) {
        finalFormData.role = 'admin';
        if (!finalFormData.modulos_permitidos.includes('todos')) {
          finalFormData.modulos_permitidos = ['todos', ...finalFormData.modulos_permitidos];
        }
      } else {
        // Se desmarcou admin, remover "todos" dos módulos
        finalFormData.modulos_permitidos = finalFormData.modulos_permitidos.filter(m => m !== 'todos');
      }
      
      const method = editingUser ? 'PUT' : 'POST';
      const body = editingUser 
        ? { ...finalFormData, id: editingUser.id }
        : finalFormData;

      const response = await fetch('/api/configuracoes/usuarios', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Verificar se é criação de usuário e se há credenciais para mostrar
        if (!editingUser && result.credentials) {
          toast({
            title: '⚠️ Usuário Criado - Email Não Enviado',
            description: `Usuário criado, mas email não pôde ser enviado. Credenciais: ${result.credentials.email} / ${result.credentials.senha_temporaria}`,
          });
        } else {
          toast({
            title: 'Sucesso',
            description: result.message || `Usuário ${editingUser ? 'atualizado' : 'criado'} com sucesso`,
          });
        }
        
        // Se o usuário editou a si mesmo, atualizar localStorage
        if (editingUser && currentUser && editingUser.id === currentUser.id) {
          const updatedUser = {
            ...currentUser,
            ...formData,
            modulos_permitidos: formData.modulos_permitidos
          };
          
          // Atualizar localStorage
          safeLocalStorage.setItem('sgb_user', JSON.stringify(updatedUser));
          
          // Disparar evento para atualizar contexto de permissões
          window.dispatchEvent(new CustomEvent('userDataUpdated'));
          
          // Mostrar notificação adicional
          setTimeout(() => {
            toast({
              title: 'Permissões Atualizadas',
              description: 'Suas permissões foram atualizadas. A sidebar será atualizada automaticamente.',
            });
          }, 500);
        }
        
        // Para qualquer edição de usuário, disparar evento para possível atualização
        // (caso o usuário editado esteja logado em outra aba)
        window.dispatchEvent(new CustomEvent('userPermissionsChanged', {
          detail: { userId: editingUser?.id, email: editingUser?.email }
        }));
        
        setIsDialogOpen(false);
        resetForm();
        fetchUsuarios();
      } else {
        throw new Error('Erro na requisição');
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar usuário',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUser(usuario);
    
    // Garantir que modulos_permitidos seja sempre um array
    let modulosPermitidos: string[] = [];
    if (Array.isArray(usuario.modulos_permitidos)) {
      modulosPermitidos = usuario.modulos_permitidos;
    } else if (typeof usuario.modulos_permitidos === 'string') {
      try {
        modulosPermitidos = JSON.parse(usuario.modulos_permitidos);
      } catch {
        modulosPermitidos = [];
      }
    }
    
    // Verificar se o usuário é admin (tem permissão "todos" ou role "admin")
    const isAdmin = modulosPermitidos.includes('todos') || usuario.role === 'admin';
    setIsAdminUser(isAdmin);
    
    // Usar bares_ids se existir, senão usar bar_id legado
    const baresIds = usuario.bares_ids && usuario.bares_ids.length > 0
      ? usuario.bares_ids
      : (usuario.bar_id ? [usuario.bar_id] : []);
    
    setFormData({
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      bar_id: usuario.bar_id?.toString() || '',
      bares_ids: baresIds,
      modulos_permitidos: modulosPermitidos,
      ativo: usuario.ativo,
      celular: usuario.celular || '',
      telefone: usuario.telefone || '',
      cpf: usuario.cpf || '',
      data_nascimento: usuario.data_nascimento || '',
      endereco: usuario.endereco || '',
      cep: usuario.cep || '',
      cidade: usuario.cidade || '',
      estado: usuario.estado || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR PERMANENTEMENTE este usuário?\n\nEsta ação:\n• Remove o usuário da tabela\n• Remove do sistema de autenticação\n• NÃO PODE SER DESFEITA\n\nDigite "CONFIRMAR" para prosseguir:')) return;

    const confirmacao = prompt('Digite "CONFIRMAR" para excluir permanentemente:');
    if (confirmacao !== 'CONFIRMAR') {
      toast({
        title: 'Cancelado',
        description: 'Exclusão cancelada pelo usuário',
      });
      return;
    }

    try {
      const response = await fetch(`/api/configuracoes/usuarios?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Sucesso',
          description: result.message || 'Usuário excluído permanentemente',
        });
        fetchUsuarios();
      } else {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao excluir usuário',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setIsAdminUser(false); // Resetar checkbox de admin
    setFormData({
      email: '',
      nome: '',
      role: '',
      bar_id: '',
      bares_ids: [],
      modulos_permitidos: [],
      ativo: true,
      celular: '',
      telefone: '',
      cpf: '',
      data_nascimento: '',
      endereco: '',
      cep: '',
      cidade: '',
      estado: '',
    });
  };
  
  // Handler para toggle de bar na seleção múltipla
  const handleBarToggle = (barId: number, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      bares_ids: checked
        ? [...prev.bares_ids, barId]
        : prev.bares_ids.filter(id => id !== barId)
    }));
  };

  // Estado para modal de redefinição de senha
  const [resetModal, setResetModal] = useState<{
    open: boolean;
    email: string;
    nome: string;
    resetLink: string;
    expiresAt: string;
    emailSent: boolean;
    message: string;
    temporaryPassword?: string; // 🔑 Senha temporária
    emailParaLogin?: string; // Email que deve ser usado no login (pode ser diferente)
    avisoEmail?: string; // Aviso se email for diferente
  }>({ open: false, email: '', nome: '', resetLink: '', expiresAt: '', emailSent: false, message: '' });

  const handleResetPassword = async (userId: number) => {
    if (!confirm('⚠️ Tem certeza que deseja resetar a senha deste usuário?\n\nUma nova senha temporária será gerada e você poderá compartilhá-la com o usuário.\n\nO sistema tentará enviar um email, mas mesmo se falhar, você terá a senha temporária para compartilhar.')) return;

    try {
      const response = await fetch('/api/configuracoes/usuarios/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (response.ok && result.resetData) {
        // Mostrar modal com o link de redefinição e senha temporária
        setResetModal({
          open: true,
          email: result.resetData.email,
          nome: result.resetData.nome,
          resetLink: result.resetData.resetLink,
          expiresAt: result.resetData.expiresAt,
          emailSent: result.emailSent || false,
          message: result.resetData.message,
          temporaryPassword: result.resetData.temporaryPassword, // 🔑 Senha temporária
          emailParaLogin: result.resetData.emailParaLogin || result.resetData.email, // Email para login
          avisoEmail: result.resetData.avisoEmail // Aviso se email for diferente
        });
        
        toast({
          title: result.emailSent ? '✅ Email Enviado!' : '⚠️ Link Gerado',
          description: result.emailSent 
            ? `Link de redefinição enviado para ${result.resetData.email}` 
            : 'Email não enviado. Copie o link no modal e envie manualmente.',
        });
      } else if (response.ok) {
        toast({
          title: 'Sucesso',
          description: result.message || 'Link de redefinição gerado',
        });
      } else {
        throw new Error(result.error || 'Erro ao gerar link de redefinição');
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao redefinir senha',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copiado!',
        description: `${label} copiado para a área de transferência`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar para a área de transferência',
        variant: 'destructive',
      });
    }
  };

  const handleModuloChange = (moduloId: string, checked: boolean) => {
    setFormData(prev => {
      // Garantir que modulos_permitidos é um array
      const currentModulos = Array.isArray(prev.modulos_permitidos) ? prev.modulos_permitidos : [];
      
      return {
        ...prev,
        modulos_permitidos: checked 
          ? [...currentModulos, moduloId]
          : currentModulos.filter(id => id !== moduloId)
      };
    });
  };

  const filteredUsuarios = usuarios.filter(usuario => {
    const matchesSearch = usuario.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'todos' || usuario.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const roleConfig = ROLES_OPCOES.find(r => r.value === role);
    return roleConfig ? (
      <Badge className={roleConfig.color}>
        {roleConfig.label}
      </Badge>
    ) : (
      <Badge variant="secondary">{role}</Badge>
    );
  };

  const modulosPorCategoria = modulos.reduce((acc, modulo) => {
    if (!acc[modulo.categoria]) {
      acc[modulo.categoria] = [];
    }
    acc[modulo.categoria].push(modulo);
    return acc;
  }, {} as Record<string, Modulo[]>);

  // Mostrar loading enquanto verifica permissões
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingState
          title="Verificando permissões..."
          subtitle="Validando acesso ao módulo"
          icon={<Shield className="w-4 h-4" />}
        />
      </div>
    );
  }

  // Bloquear acesso se não for admin
  if (!isCurrentUserAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Shield className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Acesso Restrito</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Apenas administradores podem acessar a configuração de usuários.
          </p>
          <Button onClick={() => router.push('/home')} className="btn-primary-dark">
            Voltar para Home
          </Button>
        </div>
      </div>
    );
  }

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
          <PageHeader title="Gestão de Usuários" description="Gerencie usuários do sistema e suas permissões" />
          <div className="flex items-center justify-between mb-6">
            <div />
            <Button 
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }} 
              className="btn-primary-dark"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl">
                <DialogHeader className="border-b border-gray-200 dark:border-gray-700 pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 -m-6 mb-0 p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl shadow-sm">
                      <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                        {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                      </DialogTitle>
                      <DialogDescription className="text-gray-600 dark:text-gray-400 text-sm">
                        {editingUser ? 'Atualize os dados e permissões do usuário selecionado' : 'Preencha os dados para criar um novo usuário no sistema'}
                      </DialogDescription>
                    </div>
                    {editingUser && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 dark:text-gray-400">ID: {editingUser.id}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Criado: {new Date(editingUser.criado_em).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogHeader>

                <div className="overflow-y-auto max-h-[75vh] py-6 px-1">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Dados Básicos */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dados Básicos</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Informações principais do usuário</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="nome" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Nome Completo *
                          </Label>
                          <Input
                            id="nome"
                            value={formData.nome}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Digite o nome completo"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Email *
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="email@exemplo.com"
                            required
                          />
                        </div>
                      </div>
                      
                      {/* Bares - Seleção Múltipla */}
                      <div className="space-y-3 mb-4">
                        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                          <Building className="w-4 h-4" />
                          Bares com Acesso * <span className="text-xs text-gray-500">(selecione um ou mais)</span>
                        </Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-600">
                          {bares.map((bar) => (
                            <div key={bar.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <Checkbox
                                id={`bar-${bar.id}`}
                                checked={formData.bares_ids.includes(bar.id)}
                                onCheckedChange={(checked) => handleBarToggle(bar.id, checked as boolean)}
                                className="border-blue-300 dark:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <Label 
                                htmlFor={`bar-${bar.id}`}
                                className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer font-medium"
                              >
                                {bar.nome}
                              </Label>
                            </div>
                          ))}
                        </div>
                        {formData.bares_ids.length === 0 && (
                          <p className="text-xs text-red-500 dark:text-red-400">
                            ⚠️ Selecione pelo menos um bar
                          </p>
                        )}
                        {formData.bares_ids.length > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            ✓ {formData.bares_ids.length} bar(es) selecionado(s)
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="role" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Função *
                          </Label>
                          <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                            <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                              <SelectValue placeholder="Selecione uma função" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600">
                              {ROLES_OPCOES.map(role => (
                                <SelectItem key={role.value} value={role.value} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600">
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="celular" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Celular
                          </Label>
                          <Input
                            id="celular"
                            value={formData.celular}
                            onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cpf" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            CPF
                          </Label>
                          <Input
                            id="cpf"
                            value={formData.cpf}
                            onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="data_nascimento" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Data de Nascimento
                          </Label>
                          <Input
                            id="data_nascimento"
                            type="date"
                            value={formData.data_nascimento}
                            onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="telefone" className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Telefone Fixo
                          </Label>
                          <Input
                            id="telefone"
                            value={formData.telefone}
                            onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="(11) 3333-3333"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Endereço */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Endereço</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Informações de localização</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="cep" className="text-sm font-medium text-gray-700 dark:text-gray-300">CEP</Label>
                          <Input
                            id="cep"
                            value={formData.cep}
                            onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="00000-000"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cidade" className="text-sm font-medium text-gray-700 dark:text-gray-300">Cidade</Label>
                          <Input
                            id="cidade"
                            value={formData.cidade}
                            onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="Nome da cidade"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="estado" className="text-sm font-medium text-gray-700 dark:text-gray-300">Estado</Label>
                          <Input
                            id="estado"
                            value={formData.estado}
                            onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                            className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            placeholder="SP"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endereco" className="text-sm font-medium text-gray-700 dark:text-gray-300">Endereço Completo</Label>
                        <Input
                          id="endereco"
                          value={formData.endereco}
                          onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                          className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Rua, número, complemento"
                        />
                      </div>
                    </div>

                    {/* Permissões */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                          <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Permissões</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Selecione os módulos que o usuário pode acessar</p>
                        </div>
                      </div>
                      
                      {/* 🔐 Checkbox de Administrador */}
                      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isAdminUser}
                            onCheckedChange={(checked) => setIsAdminUser(checked as boolean)}
                            className="border-red-300 dark:border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                          />
                          <div className="flex-1">
                            <label className="text-sm font-semibold text-red-700 dark:text-red-400 cursor-pointer">
                              🔐 Marcar como Administrador
                            </label>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                              Administradores têm acesso total ao sistema, incluindo esta página de configurações
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Módulos específicos - desabilitado se for admin */}
                      <div className={`bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 max-h-80 overflow-y-auto ${isAdminUser ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isAdminUser && (
                          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                              ✓ Administrador tem acesso a todos os módulos automaticamente
                            </p>
                          </div>
                        )}
                        {Object.entries(modulosPorCategoria).map(([categoria, categoriaModulos]) => (
                          <div key={categoria} className="mb-6 last:mb-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 capitalize border-b border-gray-200 dark:border-gray-600 pb-2 flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              {categoria.replace('_', ' ')}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                              {categoriaModulos.map(modulo => (
                                <div key={modulo.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <Checkbox
                                    checked={isAdminUser || (Array.isArray(formData.modulos_permitidos) && formData.modulos_permitidos.includes(modulo.id))}
                                    onCheckedChange={(checked) => handleModuloChange(modulo.id, checked as boolean)}
                                    disabled={isAdminUser}
                                    className="border-gray-300 dark:border-gray-600"
                                  />
                                  <Label 
                                    htmlFor={modulo.id} 
                                    className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                                  >
                                    {modulo.nome}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Status e Ações */}
                    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-600 flex-1">
                          <Checkbox
                            checked={formData.ativo}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked as boolean }))}
                            className="border-gray-300 dark:border-gray-600"
                          />
                          <label htmlFor="ativo" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            Usuário ativo no sistema
                          </label>
                        </div>
                        {editingUser && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleResetPassword(editingUser.id)}
                            className="bg-yellow-500/10 border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 transition-all"
                          >
                            <Key className="w-4 h-4 mr-2" />
                            Redefinir Senha
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>

                <DialogFooter className="border-t border-gray-200 dark:border-gray-700 pt-6 bg-gray-50 dark:bg-gray-800/50 -m-6 mt-0 p-6 flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="button"
                    onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white transition-all shadow-lg hover:shadow-xl"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {editingUser ? 'Atualizar' : 'Criar'} Usuário
                  </Button>
                </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Link de Redefinição */}
            <Dialog open={resetModal.open} onOpenChange={(open) => setResetModal(prev => ({ ...prev, open }))}>
              <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white max-w-lg">
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-full ${resetModal.emailSent ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                      <Key className={`w-5 h-5 ${resetModal.emailSent ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`} />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">
                        {resetModal.emailSent ? '✅ Email Enviado!' : '⚠️ Link de Redefinição'}
                      </DialogTitle>
                    </div>
                  </div>
                  <DialogDescription className="text-gray-600 dark:text-gray-400">
                    {resetModal.message}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Info do Usuário */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{resetModal.nome}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Email no banco: {resetModal.email}</p>
                        {resetModal.emailParaLogin && resetModal.emailParaLogin !== resetModal.email && (
                          <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 mt-1">
                            ⚠️ Use este email para login: {resetModal.emailParaLogin}
                          </p>
                        )}
                      </div>
                    </div>
                    {resetModal.avisoEmail && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">{resetModal.avisoEmail}</p>
                      </div>
                    )}
                  </div>

                  {/* 🔑 Senha Temporária - DESTAQUE PRINCIPAL */}
                  {resetModal.temporaryPassword && (
                    <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-lg p-5 border-2 border-yellow-400 dark:border-yellow-600 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                          🔑 Senha Temporária Gerada
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(resetModal.temporaryPassword!, 'Senha Temporária')}
                          className="text-yellow-800 dark:text-yellow-300 hover:text-yellow-900 dark:hover:text-yellow-200 h-8 px-3 font-semibold bg-yellow-100 dark:bg-yellow-900/50"
                        >
                          📋 Copiar Senha
                        </Button>
                      </div>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                        <p className="text-2xl font-mono font-bold text-center text-yellow-900 dark:text-yellow-200 tracking-wider select-all">
                          {resetModal.temporaryPassword}
                        </p>
                      </div>
                      <div className="mt-3 p-3 bg-yellow-100 dark:bg-yellow-900/40 rounded-lg border border-yellow-300 dark:border-yellow-700">
                        <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-1">
                          ⚠️ IMPORTANTE:
                        </p>
                        <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                          <li>Esta é uma senha temporária que o usuário DEVE alterar no primeiro login</li>
                          <li>Compartilhe esta senha com o usuário de forma segura (WhatsApp, telefone, etc.)</li>
                          <li>O usuário poderá fazer login imediatamente com esta senha</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Link de Redefinição (Alternativo) */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                        🔗 Link de Redefinição (Alternativo)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(resetModal.resetLink, 'Link')}
                        className="text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 h-8 px-2 font-semibold"
                      >
                        📋 Copiar Link
                      </Button>
                    </div>
                    <p className="text-sm font-mono text-blue-800 dark:text-blue-300 break-all select-all bg-white dark:bg-gray-800 p-2 rounded border border-blue-200 dark:border-blue-700">
                      {resetModal.resetLink}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                      ⏰ Expira em: {new Date(resetModal.expiresAt).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">
                      💡 Use este link apenas se o usuário preferir redefinir via link em vez da senha temporária
                    </p>
                  </div>

                  {/* Status do Email */}
                  {resetModal.emailSent ? (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
                      <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <strong>Email enviado com sucesso!</strong>
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        O usuário receberá um email com o link para redefinir a senha.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-700">
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        <strong>⚠️ Email não foi enviado</strong>
                        <br />
                        Copie o link acima e envie para o usuário pelo WhatsApp ou outro canal.
                      </p>
                    </div>
                  )}

                  {/* Instruções */}
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      📝 Instruções para o usuário:
                    </p>
                    {resetModal.temporaryPassword ? (
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                        <li>Fazer login com o email: <strong>{resetModal.email}</strong></li>
                        <li>Usar a senha temporária fornecida acima</li>
                        <li>O sistema solicitará a criação de uma nova senha no primeiro login</li>
                        <li>Escolher uma senha forte e segura</li>
                      </ol>
                    ) : (
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
                        <li>Clicar no link de redefinição acima</li>
                        <li>Digitar uma nova senha</li>
                        <li>Fazer login com a nova senha</li>
                      </ol>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  {resetModal.temporaryPassword && (
                    <Button
                      onClick={() => copyToClipboard(resetModal.temporaryPassword!, 'Senha Temporária')}
                      className="bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 text-white font-semibold"
                    >
                      🔑 Copiar Senha
                    </Button>
                  )}
                  <Button
                    onClick={() => copyToClipboard(resetModal.resetLink, 'Link')}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                  >
                    📋 Copiar Link
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setResetModal(prev => ({ ...prev, open: false }))}
                    className="bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                  >
                    Fechar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-dark pl-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 w-48">
                <Filter className="w-4 h-4 mr-2 text-blue-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as funções</SelectItem>
                {ROLES_OPCOES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de Usuários - DataTablePro v2 */}
          <div className="grid gap-4">
            {filteredUsuarios.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || roleFilter !== 'todos' ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
                </p>
              </div>
            ) : (
              <DataTablePro
                toolbarTitle="Colunas"
                data={filteredUsuarios}
                selectableRows
                actions={(
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetForm();
                        setIsDialogOpen(true);
                      }}
                      className="bg-blue-500/10 border-blue-500 text-blue-400 hover:bg-blue-500/20"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Novo
                    </Button>
                  </div>
                )}
                columns={[
                  { key: 'nome', header: 'Nome', sortable: true },
                  { key: 'email', header: 'Email', sortable: true },
                  { key: 'role', header: 'Função', render: (u: Usuario) => getRoleBadge(u.role) },
                  { key: 'bares', header: 'Bares', render: (u: Usuario) => {
                    const baresDoUsuario = u.bares_ids && u.bares_ids.length > 0 
                      ? u.bares_ids 
                      : (u.bar_id ? [u.bar_id] : []);
                    const nomesDosBares = baresDoUsuario
                      .map(barId => bares.find(b => b.id === barId)?.nome || 'N/A')
                      .join(', ');
                    return (
                      <div className="flex flex-wrap gap-1">
                        {baresDoUsuario.length === 0 ? (
                          <Badge variant="outline" className="text-xs text-gray-400">Nenhum</Badge>
                        ) : baresDoUsuario.length <= 2 ? (
                          baresDoUsuario.map(barId => (
                            <Badge key={barId} variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700">
                              {bares.find(b => b.id === barId)?.nome || 'N/A'}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700" title={nomesDosBares}>
                            {baresDoUsuario.length} bares
                          </Badge>
                        )}
                      </div>
                    );
                  }},
                  { key: 'modulos', header: 'Módulos', render: (u: Usuario) => (
                    <Badge variant="outline" className="text-xs">{u.modulos_permitidos?.length || 0} módulos</Badge>
                  ) },
                  { key: 'ativo', header: 'Status', render: (u: Usuario) => (
                    u.ativo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />
                  ) },
                  { key: 'acoes', header: 'Ações', align: 'right', render: (u: Usuario) => (
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(u)}
                        className="bg-blue-500/10 border-blue-500 text-blue-400 hover:bg-blue-500/20"
                        aria-label={`Editar usuário ${u.nome}`}
                        title={`Editar usuário ${u.nome}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(u.id)}
                        className="bg-yellow-500/10 border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                        aria-label={`Redefinir senha do usuário ${u.nome}`}
                        title="Redefinir senha"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(u.id)}
                        className="bg-red-500/10 border-red-500 text-red-400 hover:bg-red-500/20"
                        aria-label={`Excluir usuário ${u.nome}`}
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ) },
                ]}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsuariosPage;