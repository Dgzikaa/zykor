'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import ProfilePhotoUpload from '@/components/uploads/ProfilePhotoUpload';
import {
  User,
  MapPin,
  Calendar,
  Briefcase,
  Shield,
  Key,
  Save,
  AlertCircle,
  CheckCircle,
  Building,
  FileText,
  Activity,
  Clock,
  UserCheck,
  Users,
  Star,
  Crown,
  Edit3,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageTitle } from '@/contexts/PageTitleContext';

interface PerfilUsuario {
  id: number;
  nome: string;
  email: string;
  role: string;
  foto_perfil?: string;
  celular?: string;
  telefone?: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  cep?: string;
  cidade?: string;
  estado?: string;
  bio?: string;
  cargo?: string;
  departamento?: string;
  data_contratacao?: string;
  conta_verificada: boolean;
  criado_em: string;
  ultima_atividade?: string;
  bar?: {
    id: number;
    nome: string;
  };
}

const estadosBrasil = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
];

export default function MinhaContaPage() {
  const { user } = usePermissions();
  const { setPageTitle } = usePageTitle();

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState<{
    tipo: 'success' | 'error';
    texto: string;
  } | null>(null);

  // Estados para edição de perfil
  const [dadosEdicao, setDadosEdicao] = useState<Partial<PerfilUsuario>>({});

  // Estados para troca de senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  useEffect(() => {
    setPageTitle('👤 Minha Conta');
    return () => setPageTitle('');
  }, [setPageTitle]);

  useEffect(() => {
    carregarPerfil();
  }, []);

  const carregarPerfil = async () => {
    try {
      setCarregando(true);
      const response = await fetch('/api/usuarios/perfil');
      const data = await response.json();

      if (data.success) {
        setPerfil(data.perfil);
        setDadosEdicao(data.perfil);
      } else {
        setMensagem({
          tipo: 'error',
          texto: data.error || 'Erro ao carregar perfil',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao carregar perfil' });
    } finally {
      setCarregando(false);
    }
  };

  const salvarPerfil = async () => {
    try {
      setSalvandoPerfil(true);
      const response = await fetch('/api/usuarios/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosEdicao),
      });

      const data = await response.json();

      if (data.success) {
        setPerfil(data.perfil);
        setEditandoPerfil(false);
        setMensagem({
          tipo: 'success',
          texto: 'Perfil atualizado com sucesso!',
        });
      } else {
        setMensagem({
          tipo: 'error',
          texto: data.error || 'Erro ao salvar perfil',
        });
      }
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar perfil' });
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const salvarFotoPerfil = async (foto: string) => {
    try {
      const response = await fetch('/api/usuarios/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foto_perfil: foto }),
      });

      const data = await response.json();

      if (data.success) {
        setPerfil(prev => (prev ? { ...prev, foto_perfil: foto } : prev));
        setMensagem({
          tipo: 'success',
          texto: 'Foto de perfil atualizada com sucesso!',
        });
      } else {
        setMensagem({
          tipo: 'error',
          texto: data.error || 'Erro ao salvar foto de perfil',
        });
        // Reverter a foto em caso de erro
        setDadosEdicao(prev => ({ ...prev, foto_perfil: perfil?.foto_perfil }));
      }
    } catch (error) {
      console.error('Erro ao salvar foto de perfil:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao salvar foto de perfil' });
      // Reverter a foto em caso de erro
      setDadosEdicao(prev => ({ ...prev, foto_perfil: perfil?.foto_perfil }));
    }
  };

  const trocarSenha = async () => {
    try {
      setSalvandoSenha(true);
      const response = await fetch('/api/usuarios/trocar-senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senhaAtual,
          novaSenha,
          confirmarSenha,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMensagem({ tipo: 'success', texto: data.message });
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');

        // Se requer relogin, redirecionar após um tempo
        if (data.require_relogin) {
          setTimeout(() => {
            localStorage.clear();
            window.location.href = '/login';
          }, 3000);
        }
      } else {
        setMensagem({
          tipo: 'error',
          texto: data.error || 'Erro ao trocar senha',
        });
      }
    } catch (error) {
      console.error('Erro ao trocar senha:', error);
      setMensagem({ tipo: 'error', texto: 'Erro ao trocar senha' });
    } finally {
      setSalvandoSenha(false);
    }
  };

  const formatarCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
    }
    return cleaned;
  };

  const formatarTelefone = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) {
      const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
      if (match) return `(${match[1]})${match[2]}-${match[3]}`;
    } else if (cleaned.length === 10) {
      const match = cleaned.match(/^(\d{2})(\d{4})(\d{4})$/);
      if (match) return `(${match[1]})${match[2]}-${match[3]}`;
    }
    return cleaned;
  };

  const formatarCEP = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{5})(\d{3})$/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    return cleaned;
  };

  // Nova função para buscar CEP automaticamente
  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${cepLimpo}/json/`
        );
        const data = await response.json();

        if (!data.erro) {
          setDadosEdicao(prev => ({
            ...prev,
            cep: formatarCEP(cepLimpo),
            endereco: data.logradouro || prev.endereco,
            cidade: data.localidade || prev.cidade,
            estado: data.uf || prev.estado,
          }));

          setMensagem({
            tipo: 'success',
            texto: `Endereço encontrado: ${data.localidade}/${data.uf}`,
          });

          // Limpar mensagem após 3 segundos
          setTimeout(() => setMensagem(null), 3000);
        }
      } catch (error) {
        console.warn('Erro ao buscar CEP:', error);
      }
    }
  };

  // Função para formatar CPF enquanto digita
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '').slice(0, 11); // Limitar a 11 dígitos
    let formatted = cleaned;

    if (cleaned.length >= 4) {
      formatted = cleaned.slice(0, 3) + '.' + cleaned.slice(3);
    }
    if (cleaned.length >= 7) {
      formatted = formatted.slice(0, 7) + '.' + formatted.slice(7);
    }
    if (cleaned.length >= 10) {
      formatted = formatted.slice(0, 11) + '-' + formatted.slice(11);
    }

    setDadosEdicao(prev => ({ ...prev, cpf: formatted }));
  };

  // Função para formatar telefone enquanto digita
  const handleTelefoneChange = (
    value: string,
    tipo: 'celular' | 'telefone'
  ) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 11); // Limitar a 11 dígitos
    let formatted = cleaned;

    if (cleaned.length >= 3) {
      formatted = '(' + cleaned.slice(0, 2) + ')' + cleaned.slice(2);
    }
    if (cleaned.length >= 7) {
      if (cleaned.length === 11) {
        // Celular: (61)99848-3434
        formatted =
          formatted.slice(0, 4) +
          formatted.slice(4, 9) +
          '-' +
          formatted.slice(9);
      } else {
        // Fixo: (61)3848-3434
        formatted =
          formatted.slice(0, 4) +
          formatted.slice(4, 8) +
          '-' +
          formatted.slice(8);
      }
    }

    setDadosEdicao(prev => ({ ...prev, [tipo]: formatted }));
  };

  // Função para formatar CEP e buscar endereço
  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cleaned = value.replace(/\D/g, '').slice(0, 8); // Limitar a 8 dígitos
    let formatted = cleaned;

    if (cleaned.length >= 6) {
      formatted = cleaned.slice(0, 5) + '-' + cleaned.slice(5);
    }

    setDadosEdicao(prev => ({ ...prev, cep: formatted }));

    // Buscar CEP automaticamente quando tiver 8 dígitos
    if (cleaned.length === 8) {
      buscarCEP(cleaned);
    }
  };

  const calcularDiasDesdeContratacao = () => {
    if (!perfil?.data_contratacao) return 0;
    const hoje = new Date();
    const contratacao = new Date(perfil.data_contratacao);
    const diffTime = Math.abs(hoje.getTime() - contratacao.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calcularDiasDesdeUltimaAtividade = () => {
    if (!perfil?.ultima_atividade) return 0;
    const hoje = new Date();
    const atividade = new Date(perfil.ultima_atividade);
    const diffTime = Math.abs(hoje.getTime() - atividade.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="h-4 w-4" />;
      case 'manager':
        return <Star className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'from-purple-500 to-purple-600';
      case 'manager':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-green-500 to-green-600';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'manager':
        return 'Gerente';
      default:
        return 'Funcionário';
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Erro ao carregar perfil
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Não foi possível carregar os dados do seu perfil.
        </p>
        <Button onClick={carregarPerfil}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header com gradiente */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 dark:from-blue-700 dark:via-blue-800 dark:to-blue-900">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative px-8 py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* Foto de perfil grande */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden bg-white/10 backdrop-blur-sm">
                  {perfil.foto_perfil ? (
                    <Image
                      src={perfil.foto_perfil}
                      alt={perfil.nome}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-12 w-12 text-white/70" />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1">
                  {perfil.conta_verificada ? (
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-white">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold">{perfil.nome}</h1>
                  <div
                    className={`px-3 py-1 rounded-full bg-gradient-to-r ${getRoleColor(perfil.role)} flex items-center space-x-1 text-white text-sm font-medium`}
                  >
                    {getRoleIcon(perfil.role)}
                    <span>{getRoleLabel(perfil.role)}</span>
                  </div>
                </div>
                <p className="text-blue-100 text-lg mb-1">{perfil.email}</p>
                <div className="flex items-center space-x-4 text-blue-200 text-sm">
                  {perfil.cargo && (
                    <div className="flex items-center space-x-1">
                      <Briefcase className="h-4 w-4" />
                      <span>{perfil.cargo}</span>
                    </div>
                  )}
                  {perfil.bar && (
                    <div className="flex items-center space-x-1">
                      <Building className="h-4 w-4" />
                      <span>{perfil.bar.nome}</span>
                    </div>
                  )}
                  {perfil.data_contratacao && (
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Desde{' '}
                        {new Date(perfil.data_contratacao).toLocaleDateString(
                          'pt-BR'
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {!editandoPerfil && (
                <Button
                  onClick={() => setEditandoPerfil(true)}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {mensagem && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-3 border ${
            mensagem.tipo === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700'
          }`}
        >
          {mensagem.tipo === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          )}
          <span className="font-medium">{mensagem.texto}</span>
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="card-dark hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Status da Conta
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {perfil.conta_verificada ? 'Verificada' : 'Pendente'}
                </p>
              </div>
              <div
                className={`p-3 rounded-full ${perfil.conta_verificada ? 'bg-green-100 dark:bg-green-900/20' : 'bg-yellow-100 dark:bg-yellow-900/20'}`}
              >
                {perfil.conta_verificada ? (
                  <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dark hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Tempo de Casa
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calcularDiasDesdeContratacao()} dias
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dark hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Última Atividade
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calcularDiasDesdeUltimaAtividade() === 0
                    ? 'Hoje'
                    : `${calcularDiasDesdeUltimaAtividade()} dias`}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/20">
                <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-dark hover:shadow-lg transition-all duration-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Perfil Completo
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(
                    ([
                      perfil.nome,
                      perfil.email,
                      perfil.celular,
                      perfil.cargo,
                      perfil.bio,
                    ].filter(Boolean).length /
                      5) *
                      100
                  )}
                  %
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <User className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="bg-gray-100 dark:bg-gray-800 w-full md:w-auto">
          <TabsTrigger
            value="perfil"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white dark:text-gray-300"
          >
            <User className="h-4 w-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger
            value="seguranca"
            className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white dark:text-gray-300"
          >
            <Shield className="h-4 w-4 mr-2" />
            Segurança
          </TabsTrigger>
        </TabsList>

        {/* Tab do Perfil */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="card-dark">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center space-x-2">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>Informações Pessoais</span>
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Gerencie suas informações pessoais e foto de perfil
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  {perfil.conta_verificada && (
                    <Badge
                      variant="outline"
                      className="text-green-600 dark:text-green-400 border-green-200 dark:border-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verificado
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8 p-8">
              {/* Foto de perfil */}
              <div className="flex flex-col items-center space-y-4">
                <ProfilePhotoUpload
                  currentPhoto={
                    editandoPerfil
                      ? dadosEdicao.foto_perfil
                      : perfil.foto_perfil
                  }
                  onPhotoChange={foto => {
                    setDadosEdicao(prev => ({ ...prev, foto_perfil: foto }));
                    // Se não está em modo de edição, salvar a foto imediatamente
                    if (!editandoPerfil) {
                      salvarFotoPerfil(foto);
                    }
                  }}
                  disabled={false} // Sempre permitir alteração da foto
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Recomendado: imagem quadrada, máximo 5MB
                  <br />
                  Formatos aceitos: JPG, PNG, GIF
                </p>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-700" />

              {/* Informações básicas */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Dados Básicos</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="nome"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Nome completo
                    </Label>
                    <Input
                      id="nome"
                      value={
                        editandoPerfil ? dadosEdicao.nome || '' : perfil.nome
                      }
                      onChange={e =>
                        setDadosEdicao(prev => ({
                          ...prev,
                          nome: e.target.value,
                        }))
                      }
                      disabled={!editandoPerfil}
                      placeholder="Seu nome completo"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="email"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      E-mail
                    </Label>
                    <Input
                      id="email"
                      value={perfil.email}
                      disabled
                      className="bg-gray-50 dark:bg-gray-600 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      O e-mail não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="celular"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Celular
                    </Label>
                    <Input
                      id="celular"
                      value={
                        editandoPerfil
                          ? dadosEdicao.celular || ''
                          : formatarTelefone(perfil.celular || '')
                      }
                      onChange={e =>
                        handleTelefoneChange(e.target.value, 'celular')
                      }
                      disabled={!editandoPerfil}
                      placeholder="(61)99999-9999"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="telefone"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Telefone fixo
                    </Label>
                    <Input
                      id="telefone"
                      value={
                        editandoPerfil
                          ? dadosEdicao.telefone || ''
                          : formatarTelefone(perfil.telefone || '')
                      }
                      onChange={e =>
                        handleTelefoneChange(e.target.value, 'telefone')
                      }
                      disabled={!editandoPerfil}
                      placeholder="(61)3333-4444"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="cpf"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      CPF
                    </Label>
                    <Input
                      id="cpf"
                      value={
                        editandoPerfil
                          ? dadosEdicao.cpf || ''
                          : formatarCPF(perfil.cpf || '')
                      }
                      onChange={handleCPFChange}
                      disabled={!editandoPerfil}
                      placeholder="000.000.000-00"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="data_nascimento"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Data de nascimento
                    </Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={
                        editandoPerfil
                          ? dadosEdicao.data_nascimento || ''
                          : perfil.data_nascimento || ''
                      }
                      onChange={e =>
                        setDadosEdicao(prev => ({
                          ...prev,
                          data_nascimento: e.target.value,
                        }))
                      }
                      disabled={!editandoPerfil}
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-700" />

              {/* Endereço */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Endereço</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="cep"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      CEP
                    </Label>
                    <Input
                      id="cep"
                      value={
                        editandoPerfil
                          ? dadosEdicao.cep || ''
                          : formatarCEP(perfil.cep || '')
                      }
                      onChange={handleCEPChange}
                      disabled={!editandoPerfil}
                      placeholder="00000-000"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Digite o CEP para buscar automaticamente
                    </p>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label
                      htmlFor="endereco"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Endereço completo
                    </Label>
                    <Input
                      id="endereco"
                      value={
                        editandoPerfil
                          ? dadosEdicao.endereco || ''
                          : perfil.endereco || ''
                      }
                      onChange={e =>
                        setDadosEdicao(prev => ({
                          ...prev,
                          endereco: e.target.value,
                        }))
                      }
                      disabled={!editandoPerfil}
                      placeholder="Rua, número, complemento"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="cidade"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Cidade
                    </Label>
                    <Input
                      id="cidade"
                      value={
                        editandoPerfil
                          ? dadosEdicao.cidade || ''
                          : perfil.cidade || ''
                      }
                      onChange={e =>
                        setDadosEdicao(prev => ({
                          ...prev,
                          cidade: e.target.value,
                        }))
                      }
                      disabled={!editandoPerfil}
                      placeholder="Sua cidade"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="estado"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Estado
                    </Label>
                    <Select
                      value={
                        editandoPerfil
                          ? dadosEdicao.estado || ''
                          : perfil.estado || ''
                      }
                      onValueChange={value =>
                        setDadosEdicao(prev => ({ ...prev, estado: value }))
                      }
                      disabled={!editandoPerfil}
                    >
                      <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {estadosBrasil.map(estado => (
                          <SelectItem key={estado} value={estado}>
                            {estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                {editandoPerfil ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditandoPerfil(false);
                        setDadosEdicao(perfil);
                      }}
                      disabled={salvandoPerfil}
                      className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={salvarPerfil}
                      disabled={salvandoPerfil}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                    >
                      {salvandoPerfil ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>
                        {salvandoPerfil ? 'Salvando...' : 'Salvar alterações'}
                      </span>
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => setEditandoPerfil(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editar perfil
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Segurança */}
        <TabsContent value="seguranca" className="space-y-6">
          <Card className="card-dark">
            <CardHeader className="border-b border-gray-200 dark:border-gray-700">
              <CardTitle className="text-gray-900 dark:text-white flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span>Segurança da Conta</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Gerencie sua senha e configurações de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 p-8">
              {/* Trocar senha */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Alterar senha</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label
                      htmlFor="senhaAtual"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Senha atual
                    </Label>
                    <Input
                      id="senhaAtual"
                      type="password"
                      value={senhaAtual}
                      onChange={e => setSenhaAtual(e.target.value)}
                      placeholder="Sua senha atual"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="novaSenha"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Nova senha
                    </Label>
                    <Input
                      id="novaSenha"
                      type="password"
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Nova senha"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="confirmarSenha"
                      className="text-gray-700 dark:text-gray-300"
                    >
                      Confirmar nova senha
                    </Label>
                    <Input
                      id="confirmarSenha"
                      type="password"
                      value={confirmarSenha}
                      onChange={e => setConfirmarSenha(e.target.value)}
                      placeholder="Confirme a nova senha"
                      className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={trocarSenha}
                    disabled={
                      salvandoSenha ||
                      !senhaAtual ||
                      !novaSenha ||
                      !confirmarSenha
                    }
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-2"
                  >
                    {salvandoSenha ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                    <span>
                      {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
                    </span>
                  </Button>
                </div>
              </div>

              <Separator className="bg-gray-200 dark:bg-gray-700" />

              {/* Informações da conta */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Informações da conta
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Conta criada em:
                      </span>
                      <span className="text-gray-900 dark:text-white font-semibold">
                        {new Date(perfil.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {perfil.ultima_atividade && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                          Última atividade:
                        </span>
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {new Date(perfil.ultima_atividade).toLocaleDateString(
                            'pt-BR'
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Status da conta:
                      </span>
                      <Badge
                        variant={
                          perfil.conta_verificada ? 'default' : 'secondary'
                        }
                        className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      >
                        {perfil.conta_verificada
                          ? 'Verificada'
                          : 'Não verificada'}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Nível de acesso:
                      </span>
                      <div
                        className={`px-3 py-1 rounded-full bg-gradient-to-r ${getRoleColor(perfil.role)} flex items-center space-x-1 text-white text-sm font-medium`}
                      >
                        {getRoleIcon(perfil.role)}
                        <span>{getRoleLabel(perfil.role)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
