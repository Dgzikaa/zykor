'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Eye, EyeOff, Fingerprint } from 'lucide-react';
import BiometricAuth from '@/components/auth/BiometricAuth';
import { api } from '@/lib/api-client';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Estado para controlar o método de login
  const [loginMethod, setLoginMethod] = useState<'traditional' | 'biometric'>(
    'traditional'
  );
  const [showBiometricRegistration, setShowBiometricRegistration] = useState(false);
  const [lastLoginData, setLastLoginData] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  // Capturar URL de retorno se houver (só no cliente)
  const returnUrl = isHydrated ? searchParams.get('returnUrl') : null;

  // Controlar hidratação - só executa após componente montar
  useEffect(() => {
    setIsHydrated(true);

    // Detectar dispositivo móvel
    const checkMobileDevice = () => {
      const userAgent =
        navigator.userAgent ||
        navigator.vendor ||
        ((window as unknown as Record<string, unknown>).opera as string);
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      const isMobile = mobileRegex.test(userAgent);
      const isTablet = /iPad|Android(?!.*Mobile)/i.test(userAgent);
      setIsMobileDevice(isMobile || isTablet);
    };

    checkMobileDevice();

    // Configurar sincronização de sessão entre abas
    const setupSync = async () => {
      const { setupSessionSync } = await import('@/lib/auth/session-manager');
      setupSessionSync();
    };
    setupSync();
  }, []);

  // Verificar se usuário já está logado (apenas cache local, não validar sessão)
  useEffect(() => {
    const checkAuthStatus = () => {
      // Verificar se estamos no cliente antes de acessar localStorage
      if (typeof window === 'undefined') return;

      try {
        // Apenas verificar se há dados em cache, não validar sessão
        // (SessionManager já faz a validação)
        const userData = localStorage.getItem('sgb_user');
        const sessionToken = localStorage.getItem('sgb_session');
        
        if (userData && sessionToken) {
          const user = JSON.parse(userData);
          if (user && user.email && user.nome) {
            console.log('✅ Sessão em cache encontrada, redirecionando...', user.nome);
            const destination = returnUrl
              ? decodeURIComponent(returnUrl)
              : '/home';
            setSuccess(
              `Usuário já logado! Redirecionando para ${destination}...`
            );
            setTimeout(() => {
              router.push(destination);
            }, 1000);
          }
        }
      } catch (error) {
        console.log('🔍 Verificação de cache falhou:', error);
      }
    };

    checkAuthStatus();
  }, [router, returnUrl]);

  // Auto-fechar modal de recuperação após sucesso
  useEffect(() => {
    if (forgotSuccess) {
      const timer = setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotSuccess(false);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [forgotSuccess]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotEmail
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('✅ Solicitação de reset enviada para:', forgotEmail);
        setForgotSuccess(true);
      } else {
        throw new Error(result.error || 'Erro ao processar solicitação');
      }
    } catch (error: unknown) {
      console.error('❌ Erro no reset de senha:', error);
      setError(
        'Erro ao enviar email de recuperação: ' + (error as Error).message
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;

      const response = await api.post('/api/auth/login', {
        email,
        password,
      });

      console.log('🔍 Resposta da API:', response);

      if (response && response.success) {
        const userData = response.user as Record<string, unknown>;

        if (!userData) {
          setError('Dados do usuário não recebidos');
          return;
        }

        // Salvar dados do usuário no localStorage como cache (cookie JWT já setado pelo servidor)
        // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache
        const { syncAuthData } = await import('@/lib/cookies');
        syncAuthData(userData as any);

        // IMPORTANTE: Autenticar no Supabase Auth Client para manter sessão
        try {
          const { supabase } = await import('@/lib/supabase');
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });
          
          if (signInError) {
            console.error('⚠️ Erro ao registrar sessão no Supabase Auth:', signInError);
          } else {
            console.log('✅ Sessão registrada no Supabase Auth Client');
          }
        } catch (authError) {
          console.error('⚠️ Falha ao autenticar no Supabase Auth:', authError);
        }

        const destination = returnUrl ? decodeURIComponent(returnUrl) : '/home';
        setSuccess(
          `🎉 Login realizado com sucesso! Bem-vindo(a), ${userData.nome as string}! Redirecionando...`
        );
        setTimeout(() => {
          router.push(destination);
        }, 2000);
      } else if (response && response.requirePasswordReset) {
        // Primeiro acesso - redirecionar para redefinição de senha
        setSuccess('🔑 Primeiro acesso detectado. Redirecionando para redefinição de senha...');
        setTimeout(() => {
          window.location.href = response.redirectUrl;
        }, 2000);
      } else {
        setError(response?.error || 'Erro no login');
      }
    } catch (err: unknown) {
      console.error('❌ Erro no login:', err);

      if (err instanceof Error) {
        setError(`Erro no login: ${err.message}`);
      } else {
        setError('Erro desconhecido no login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Função para lidar com sucesso do login biométrico
  const handleBiometricLoginSuccess = async (result: {
    credentialId: string;
    userEmail: string;
    barId: string;
    success: boolean;
  }) => {
    if (result && result.success) {
      // Buscar dados do usuário baseado no email
      try {
        const response = await api.post('/api/auth/biometric/login', {
          credentialId: result.credentialId,
          userEmail: result.userEmail,
          barId: result.barId,
        });

        if (response.success && response.user) {
          // Salvar dados do usuário no localStorage e cookie
          const { syncAuthData } = await import('@/lib/cookies');
          syncAuthData(response.user, response.session);
          
          // IMPORTANTE: Registrar a sessão no Supabase Auth Client
          if (response.session) {
            const { supabase } = await import('@/lib/supabase');
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: response.session.access_token,
              refresh_token: response.session.refresh_token,
            });
            
            if (setSessionError) {
              console.error('❌ Erro ao registrar sessão no Supabase Auth:', setSessionError);
            } else {
              console.log('✅ Sessão registrada no Supabase Auth Client (biométrico)');
            }
          }

          const destination = returnUrl
            ? decodeURIComponent(returnUrl)
            : '/home';
          setSuccess(
            `🎉 Login biométrico realizado com sucesso! Bem-vindo(a), ${response.user.nome}! Redirecionando...`
          );
          setTimeout(() => {
            router.push(destination);
          }, 2000);
        }
      } catch (error) {
        setError('Erro ao processar login biométrico');
      }
    }
  };

  // Função para lidar com erro do login biométrico
  const handleBiometricLoginError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // Função para lidar com sucesso do registro biométrico após login
  const handlePostLoginBiometricRegister = async (result: {
    credentialId: string;
    userEmail: string;
    barId: string;
    success: boolean;
  }) => {
    if (result && result.success && lastLoginData) {
      setShowBiometricRegistration(false);
      setSuccess(
        `🎉 Biometria configurada! Agora você pode fazer login rapidamente!`
      );

      const destination = returnUrl ? decodeURIComponent(returnUrl) : '/home';
      setTimeout(() => {
        router.push(destination);
      }, 2000);
    }
  };

  // Função para pular registro biométrico
  const skipBiometricRegistration = () => {
    setShowBiometricRegistration(false);
    const destination = returnUrl ? decodeURIComponent(returnUrl) : '/home';
    setSuccess(`✅ Login concluído! Redirecionando...`);
    setTimeout(() => {
      router.push(destination);
    }, 1000);
  };

  // Não renderizar nada até hidratação completa para evitar mismatch
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center py-8">
            <div className="animate-pulse">Carregando...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4"
      suppressHydrationWarning
    >
      <div className="w-full max-w-md" suppressHydrationWarning>
        {/* Logo e Header */}
        <div className="text-center" suppressHydrationWarning>
          <div
            className="inline-flex items-center justify-center w-80 h-32 lg:w-96 lg:h-36"
            suppressHydrationWarning
          >
            {!logoError ? (
              <Image
                src="/logos/logo_zykor.png"
                alt="ZYKOR Logo"
                width={400}
                height={180}
                onError={() => setLogoError(true)}
                className="logo-zykor favicon-improved"
              />
            ) : (
              <div
                className="w-80 h-40 lg:w-96 lg:h-44 flex items-center justify-center rounded-2xl"
                style={{background: 'var(--zykor-gradient)'}}
                suppressHydrationWarning
              >
                <span className="text-6xl lg:text-7xl text-white">Z</span>
              </div>
            )}
          </div>
        </div>

        {/* Configuração de biometria pós-login */}
        {showBiometricRegistration && lastLoginData && (
          <div
            className="mb-6 card-dark rounded-xl p-6 shadow-lg"
            suppressHydrationWarning
          >
            <div className="text-center mb-4" suppressHydrationWarning>
              <div
                className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3"
                suppressHydrationWarning
              >
                <Fingerprint className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Configurar Biometria
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Quer configurar biometria para próximos logins?
              </p>
            </div>

            <BiometricAuth
              mode="register"
              onSuccess={handlePostLoginBiometricRegister}
              onError={handleBiometricLoginError}
              userEmail={lastLoginData?.email as string}
              barId={lastLoginData?.bar_id as string}
              className="mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={skipBiometricRegistration}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Agora Não
              </button>
            </div>
          </div>
        )}

        {/* Notificações */}
        {returnUrl && !showBiometricRegistration && (
          <div
            className="mb-6 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-xl p-4"
            suppressHydrationWarning
          >
            <div
              className="flex items-center space-x-3"
              suppressHydrationWarning
            >
              <div
                className="w-8 h-8 bg-[hsl(var(--muted))] rounded-full flex items-center justify-center"
                suppressHydrationWarning
              >
                <span className="text-[hsl(var(--foreground))] text-sm">
                  🔒
                </span>
              </div>
              <div>
                <p className="text-[hsl(var(--foreground))] text-sm font-medium">
                  Acesso protegido
                </p>
                <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">
                  Faça login para acessar a página solicitada
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className="mb-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4"
            suppressHydrationWarning
          >
            <div
              className="flex items-center space-x-3"
              suppressHydrationWarning
            >
              <div
                className="w-8 h-8 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center"
                suppressHydrationWarning
              >
                <span className="text-red-600 dark:text-red-400 text-sm">
                  !
                </span>
              </div>
              <p className="text-red-700 dark:text-red-300 text-sm font-medium">
                {error}
              </p>
            </div>
          </div>
        )}

        {success && (
          <div
            className="mb-6 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4"
            suppressHydrationWarning
          >
            <div
              className="flex items-center space-x-3"
              suppressHydrationWarning
            >
              <div
                className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center"
                suppressHydrationWarning
              >
                <span className="text-green-600 dark:text-green-400 text-sm animate-pulse">
                  ✓
                </span>
              </div>
              <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                {success}
              </p>
            </div>
          </div>
        )}

        {/* Seletor de Método de Login */}
        {!showBiometricRegistration && (
          <div className="mb-2">
            {isMobileDevice ? (
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                <button
                  onClick={() => setLoginMethod('traditional')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                    loginMethod === 'traditional'
                      ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  Email & Senha
                </button>
                <button
                  onClick={() => setLoginMethod('biometric')}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                    loginMethod === 'biometric'
                      ? 'bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
                >
                  <Fingerprint className="w-4 h-4" />
                  Biométrico
                </button>
              </div>
            ) : (
              <div className="p-1 bg-gray-100 dark:bg-gray-800 rounded-[10px] border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-[8px] font-medium text-sm bg-white dark:bg-gray-700 text-slate-800 dark:text-white shadow-sm">
                  <LogIn className="w-4 h-4" />
                  Email & Senha
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo baseado no método escolhido */}
        {!showBiometricRegistration && (
          <div className="card-dark rounded-2xl p-8 shadow-lg">
            {loginMethod === 'traditional' ? (
              /* Formulário de Login Tradicional */
              <>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2"
                    >
                      Email
                    </label>
                    <div className="elegant-form-group">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="elegant-input w-full input-dark px-2 py-1 rounded-[4px]"
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3"
                    >
                      Senha
                    </label>
                    <div className="relative elegant-form-group">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="elegant-input w-full px-2 py-1 rounded-[4px] input-dark"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-zykor py-4 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        <span>Entrar no sistema</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Links adicionais */}
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-slate-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              </>
            ) : (
              /* Login Biométrico */
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-full mb-4">
                    <Fingerprint className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                    Login Biométrico
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    Use seu rosto para fazer login de forma rápida e segura
                  </p>
                </div>

                <BiometricAuth
                  mode="login"
                  onSuccess={handleBiometricLoginSuccess}
                  onError={handleBiometricLoginError}
                  barId="1" // Você pode pegar isso de algum contexto ou seleção
                  className="border-0 shadow-none p-0 bg-transparent"
                />

                <div className="text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Problemas com a biometria?
                  </p>
                  <button
                    onClick={() => setLoginMethod('traditional')}
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                  >
                    Use login tradicional
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-slate-400 dark:text-gray-500 text-sm">
          <p>
            © 2025 ZYKOR - O núcleo da gestão de bares
          </p>
        </div>
      </div>

      {/* Modal Esqueci Minha Senha */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          suppressHydrationWarning
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
            suppressHydrationWarning
          >
            <div className="text-center mb-6" suppressHydrationWarning>
              <div
                className="inline-flex items-center justify-center w-16 h-16 bg-[hsl(var(--muted))] rounded-full mb-4"
                suppressHydrationWarning
              >
                <span className="text-2xl">🔑</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                Recuperar Senha
              </h2>
              <p className="text-slate-600 dark:text-gray-400">
                Digite seu e-mail para receber as instruções de recuperação
              </p>
            </div>

            {forgotSuccess ? (
              <div className="text-center" suppressHydrationWarning>
                <div
                  className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full mb-4"
                  suppressHydrationWarning
                >
                  <span className="text-2xl text-green-600 dark:text-green-400">
                    ✓
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                  Nova Senha Enviada!
                </h3>
                <p className="text-slate-600 dark:text-gray-400 mb-4">
                  Se o email existir em nossa base, você receberá uma nova senha temporária. 
                  Use-a para fazer login e o sistema solicitará a criação de uma nova senha.
                </p>
                <div className="text-sm text-slate-500 dark:text-gray-500">
                  Este modal será fechado automaticamente...
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    E-mail
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    className="elegant-input w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white px-2 py-1 rounded-[4px]"
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotEmail('');
                      setError(null);
                    }}
                    className="flex-1 bg-slate-200 dark:bg-gray-600 hover:bg-slate-300 dark:hover:bg-gray-500 text-slate-700 dark:text-gray-200 font-medium py-3 px-4 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                    ) : (
                      'Enviar'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
