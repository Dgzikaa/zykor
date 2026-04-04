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
import { ConfiguracaoLoading } from '@/components/ui/unified-loading';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { usePermissions } from '@/hooks/usePermissions';
import { safeLocalStorage } from '@/lib/client-utils';
import { DataTablePro } from '@/components/ui/datatable-pro';
import { useRouter } from 'next/navigation';

interface Usuario {
  id: number;
  auth_id?: string;
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
  { value: 'admin', label: 'Administrador' },
  { value: 'funcionario', label: 'Funcionário' },
  { value: 'financeiro', label: 'Financeiro' },
];

function UsuariosPage() {
  const router = useRouter();
  const { setPageTitle } = usePageTitle();
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

  useEffect(() => {
    setPageTitle('👤 Usuários');
    return () => setPageTitle('');
  }, [setPageTitle]);
  
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
      const selectedBarId = safeLocalStorage.getItem('sgb_selected_bar_id');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (selectedBarId) {
        headers['x-selected-bar-id'] = selectedBarId;
      }
      
      const response = await fetch('/api/configuracoes/usuarios', { headers });
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
      const selectedBarId = safeLocalStorage.getItem('sgb_selected_bar_id');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (selectedBarId) {
        headers['x-selected-bar-id'] = selectedBarId;
      }
      
      const response = await fetch('/api/configuracoes/permissoes', { headers });
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
      const selectedBarId = safeLocalStorage.getItem('sgb_selected_bar_id');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (selectedBarId) {
        headers['x-selected-bar-id'] = selectedBarId;
      }
      
      const response = await fetch('/api/configuracoes/bars', { headers });
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
          
          // Atualizar localStorage (cache)
          // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache
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

  const handleResetPassword = async (usuario: Usuario) => {
    if (!confirm('⚠️ Tem certeza que deseja resetar a senha deste usuário?\n\nUma nova senha temporária será gerada e você poderá compartilhá-la com o usuário.\n\nO sistema tentará enviar um email, mas mesmo se falhar, você terá a senha temporária para compartilhar.')) return;

    try {
      const response = await fetch('/api/configuracoes/usuarios/redefinir-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: usuario.id,
          userAuthId: usuario.auth_id,
          email: usuario.email,
        }),
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

  const getCategoriaSelectionState = (categoriaModulos: Modulo[]) => {
    const selectedInCategory = categoriaModulos.filter(modulo =>
      formData.modulos_permitidos.includes(modulo.id)
    ).length;
    const total = categoriaModulos.length;
    return {
      allSelected: total > 0 && selectedInCategory === total,
      hasAnySelected: selectedInCategory > 0,
      selectedCount: selectedInCategory,
      totalCount: total,
    };
  };

  const handleCategoriaToggle = (categoriaModulos: Modulo[], checked: boolean) => {
    setFormData(prev => {
      const current = new Set(Array.isArray(prev.modulos_permitidos) ? prev.modulos_permitidos : []);
      if (checked) {
        categoriaModulos.forEach(modulo => current.add(modulo.id));
      } else {
        categoriaModulos.forEach(modulo => current.delete(modulo.id));
      }
      return {
        ...prev,
        modulos_permitidos: Array.from(current),
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
      <Badge variant="outline">
        {roleConfig.label}
      </Badge>
    ) : (
      <Badge variant="outline">{role}</Badge>
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
    return <ConfiguracaoLoading />;
  }

  // Bloquear acesso se não for admin
  if (!isCurrentUserAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="p-4 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center border border-[hsl(var(--border))]">
            <Shield className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Acesso Restrito</h1>
          <p className="text-[hsl(var(--muted-foreground))] mb-6">
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
    return <ConfiguracaoLoading />;
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(var(--muted-foreground))] w-4 h-4" />
            <Input
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
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
        <Button
          onClick={() => {
            resetForm();
            setIsDialogOpen(true);
          }}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Novo Usuário
        </Button>
      </div>

      {/* Tabela */}
      {filteredUsuarios.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-[hsl(var(--muted-foreground))] mx-auto mb-4" />
          <p className="text-[hsl(var(--muted-foreground))]">
            {searchTerm || roleFilter !== 'todos' ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </p>
        </div>
      ) : (
        <DataTablePro
          data={filteredUsuarios}
          selectableRows
          searchable={false}
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
                    <Badge variant="outline" className="text-xs opacity-50">Nenhum</Badge>
                  ) : baresDoUsuario.length <= 2 ? (
                    baresDoUsuario.map(barId => (
                      <Badge key={barId} variant="outline" className="text-xs">
                        {bares.find(b => b.id === barId)?.nome || 'N/A'}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs" title={nomesDosBares}>
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
              u.ativo ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4 opacity-30" />
            ) },
            { key: 'acoes', header: 'Ações', align: 'right', render: (u: Usuario) => (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(u)}
                  aria-label={`Editar usuário ${u.nome}`}
                  title="Editar"
                  leftIcon={<Edit className="w-4 h-4" />}
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResetPassword(u)}
                  aria-label={`Redefinir senha do usuário ${u.nome}`}
                  title="Redefinir senha"
                  leftIcon={<Key className="w-4 h-4" />}
                >
                  Senha
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(u.id)}
                  aria-label={`Excluir usuário ${u.nome}`}
                  title="Excluir"
                  leftIcon={<Trash2 className="w-4 h-4" />}
                >
                  Excluir
                </Button>
              </div>
            ) },
          ]}
        />
      )}

      {/* Modal de Edição/Criação */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-[hsl(var(--border))]">
            <DialogTitle className="text-base font-semibold">
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[hsl(var(--muted-foreground))]">
              {editingUser ? 'Atualize as informações do usuário' : 'Preencha os dados para criar um novo usuário'}
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 px-6 py-5 scrollbar-thin">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados Básicos */}
              <div className="space-y-3">
                <div className="pb-1">
                  <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Dados Básicos</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-sm">
                      Nome Completo *
                    </Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Digite o nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>
                </div>
                
                {/* Bares - Seleção Múltipla */}
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Bares com Acesso *
                  </Label>
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-[hsl(var(--border))]">
                    {bares.map((bar) => (
                      <div key={bar.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`bar-${bar.id}`}
                          checked={formData.bares_ids.includes(bar.id)}
                          onCheckedChange={(checked) => handleBarToggle(bar.id, checked as boolean)}
                        />
                        <Label 
                          htmlFor={`bar-${bar.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {bar.nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="role" className="text-sm">
                      Função *
                    </Label>
                    <Select value={formData.role} onValueChange={(value) => setFormData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES_OPCOES.map(role => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="celular" className="text-sm">
                      Celular
                    </Label>
                    <Input
                      id="celular"
                      value={formData.celular}
                      onChange={(e) => setFormData(prev => ({ ...prev, celular: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpf" className="text-sm">
                      CPF
                    </Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="data_nascimento" className="text-sm">
                      Data de Nascimento
                    </Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={formData.data_nascimento}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_nascimento: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone" className="text-sm">
                      Telefone Fixo
                    </Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                      placeholder="(11) 3333-3333"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-3 pt-4 border-t border-[hsl(var(--border))]">
                <div className="pb-1">
                  <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Endereço</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="cep" className="text-sm">CEP</Label>
                    <Input
                      id="cep"
                      value={formData.cep}
                      onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cidade" className="text-sm">Cidade</Label>
                    <Input
                      id="cidade"
                      value={formData.cidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                      placeholder="Nome da cidade"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="estado" className="text-sm">Estado</Label>
                    <Input
                      id="estado"
                      value={formData.estado}
                      onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value }))}
                      placeholder="SP"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endereco" className="text-sm">Endereço Completo</Label>
                  <Input
                    id="endereco"
                    value={formData.endereco}
                    onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Rua, número, complemento"
                  />
                </div>
              </div>

              {/* Permissões */}
              <div className="space-y-3 pt-4 border-t border-[hsl(var(--border))]">
                <div className="pb-1">
                  <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Permissões</h3>
                </div>
                
                {/* Checkbox de Administrador */}
                <div className="p-3 rounded-lg border border-[hsl(var(--border))]">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={isAdminUser}
                      onCheckedChange={(checked) => setIsAdminUser(checked as boolean)}
                    />
                    <label className="text-sm font-medium cursor-pointer">
                      Administrador (acesso total)
                    </label>
                  </div>
                </div>

                {/* Módulos específicos */}
                <div className={`rounded-lg p-3 border border-[hsl(var(--border))] max-h-64 overflow-y-auto scrollbar-thin ${isAdminUser ? 'opacity-50 pointer-events-none' : ''}`}>
                  {isAdminUser && (
                    <div className="mb-3 p-2 rounded-md bg-[hsl(var(--muted))]">
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Administrador tem acesso a todos os módulos automaticamente
                      </p>
                    </div>
                  )}
                  {Object.entries(modulosPorCategoria).map(([categoria, categoriaModulos]) => (
                    <div key={categoria} className="mb-3 last:mb-0">
                      <div className="flex items-center justify-between mb-2 border-b border-[hsl(var(--border))] pb-1.5">
                        <h4 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] capitalize uppercase tracking-wider">
                          {categoria.replace('_', ' ')}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                            {getCategoriaSelectionState(categoriaModulos).selectedCount}/{getCategoriaSelectionState(categoriaModulos).totalCount}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Checkbox
                              id={`categoria-${categoria}`}
                              checked={isAdminUser || getCategoriaSelectionState(categoriaModulos).allSelected}
                              onCheckedChange={(checked) =>
                                handleCategoriaToggle(categoriaModulos, checked as boolean)
                              }
                              disabled={isAdminUser}
                            />
                            <Label
                              htmlFor={`categoria-${categoria}`}
                              className="text-[11px] text-[hsl(var(--muted-foreground))] cursor-pointer"
                            >
                              Marcar todos
                            </Label>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {categoriaModulos.map(modulo => (
                          <div key={modulo.id} className="flex items-center space-x-2 p-1.5 rounded-md hover:bg-[hsl(var(--muted))]">
                            <Checkbox
                              checked={isAdminUser || (Array.isArray(formData.modulos_permitidos) && formData.modulos_permitidos.includes(modulo.id))}
                              onCheckedChange={(checked) => handleModuloChange(modulo.id, checked as boolean)}
                              disabled={isAdminUser}
                            />
                            <Label 
                              htmlFor={modulo.id} 
                              className="text-xs text-[hsl(var(--foreground))] cursor-pointer flex-1"
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
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[hsl(var(--border))]">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked as boolean }))}
                  />
                  <label htmlFor="ativo" className="text-sm font-medium text-[hsl(var(--foreground))] cursor-pointer">
                    Usuário ativo no sistema
                  </label>
                </div>
                {editingUser && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleResetPassword(editingUser)}
                    leftIcon={<Key className="w-4 h-4" />}
                  >
                    Redefinir Senha
                  </Button>
                )}
              </div>
            </form>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-[hsl(var(--border))] flex gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="button"
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
              className="flex-1"
            >
              {editingUser ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Reset de Senha */}
      <Dialog open={resetModal.open} onOpenChange={(open) => setResetModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {resetModal.emailSent ? 'Email Enviado' : 'Link de Redefinição'}
            </DialogTitle>
            <DialogDescription>
              {resetModal.message}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 px-6">
            {/* Info do Usuário */}
            <div className="rounded-lg p-4 border border-[hsl(var(--border))]">
              <p className="font-medium text-sm">{resetModal.nome}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{resetModal.email}</p>
              {resetModal.emailParaLogin && resetModal.emailParaLogin !== resetModal.email && (
                <p className="text-xs font-medium mt-2">
                  Use este email para login: {resetModal.emailParaLogin}
                </p>
              )}
              {resetModal.avisoEmail && (
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">{resetModal.avisoEmail}</p>
              )}
            </div>

            {/* Senha Temporária */}
            {resetModal.temporaryPassword && (
              <div className="rounded-lg p-4 border border-[hsl(var(--border))]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">Senha Temporária</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(resetModal.temporaryPassword!, 'Senha Temporária')}
                  >
                    Copiar
                  </Button>
                </div>
                <div className="bg-[hsl(var(--muted))] p-3 rounded-lg">
                  <p className="text-lg font-mono font-semibold text-center select-all">
                    {resetModal.temporaryPassword}
                  </p>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">
                  Compartilhe esta senha com o usuário de forma segura. O usuário deve alterá-la no primeiro login.
                </p>
              </div>
            )}

            {/* Link de Redefinição */}
            <div className="rounded-lg p-4 border border-[hsl(var(--border))]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Link de Redefinição</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(resetModal.resetLink, 'Link')}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs font-mono break-all select-all bg-[hsl(var(--muted))] p-2 rounded">
                {resetModal.resetLink}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-2">
                Expira em: {new Date(resetModal.expiresAt).toLocaleString('pt-BR')}
              </p>
            </div>

            {/* Status do Email */}
            {resetModal.emailSent ? (
              <div className="rounded-lg p-3 border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <p className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Email enviado com sucesso
                </p>
              </div>
            ) : (
              <div className="rounded-lg p-3 border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                <p className="text-sm">
                  <strong>Email não foi enviado</strong>
                  <br />
                  Copie o link acima e envie para o usuário pelo WhatsApp ou outro canal.
                </p>
              </div>
            )}

            {/* Instruções */}
            <div className="rounded-lg p-4 border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
              <p className="text-sm font-semibold mb-2">
                Instruções para o usuário:
              </p>
              {resetModal.temporaryPassword ? (
                <ol className="text-sm text-[hsl(var(--muted-foreground))] space-y-2 list-decimal list-inside">
                  <li>Fazer login com o email: <strong>{resetModal.email}</strong></li>
                  <li>Usar a senha temporária fornecida acima</li>
                  <li>O sistema solicitará a criação de uma nova senha no primeiro login</li>
                  <li>Escolher uma senha forte e segura</li>
                </ol>
              ) : (
                <ol className="text-sm text-[hsl(var(--muted-foreground))] space-y-2 list-decimal list-inside">
                  <li>Clicar no link de redefinição acima</li>
                  <li>Digitar uma nova senha</li>
                  <li>Fazer login com a nova senha</li>
                </ol>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2 px-6 py-4 border-t border-[hsl(var(--border))]">
            {resetModal.temporaryPassword && (
              <Button
                onClick={() => copyToClipboard(resetModal.temporaryPassword!, 'Senha Temporária')}
                variant="outline"
              >
                Copiar Senha
              </Button>
            )}
            <Button
              onClick={() => copyToClipboard(resetModal.resetLink, 'Link')}
            >
              Copiar Link
            </Button>
            <Button
              variant="outline"
              onClick={() => setResetModal(prev => ({ ...prev, open: false }))}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UsuariosPage;
