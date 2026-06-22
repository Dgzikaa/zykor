'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, User, ArrowRight } from 'lucide-react';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const validarSenha = () => {
    if (!novaSenha) {
      setErro('Nova senha é obrigatória');
      return false;
    }
    if (novaSenha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres');
      return false;
    }
    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem');
      return false;
    }
    setErro('');
    return true;
  };

  const redefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validarSenha()) return;

    setCarregando(true);
    setErro('');

    try {
      const response = await fetch('/api/configuracoes/auth/redefinir-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          novaSenha,
          token,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSucesso(true);
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setErro(data.error || 'Erro ao redefinir senha');
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Senha Redefinida!
          </h1>
          <p className="text-gray-600 mb-4">
            Sua senha foi atualizada com sucesso. Você será redirecionado para a
            página de login.
          </p>
          <div className="animate-pulse text-blue-600 font-medium">
            Redirecionando em 3 segundos...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Defina sua Nova Senha
          </h1>
          <p className="text-gray-600">
            Como é seu primeiro acesso, você precisa criar uma nova senha para
            sua conta.
          </p>
        </div>

        {/* User Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-3">
            <User className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Conta</p>
              <p className="font-medium text-gray-900">{email}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={redefinirSenha} className="space-y-6">
          {/* Nova Senha */}
          <div>
            <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-2">
              Nova Senha
            </label>
            <div className="relative">
              <input
                id="nova-senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Digite sua nova senha"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {mostrarSenha ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
          </div>

          {/* Confirmar Senha */}
          <div>
            <label htmlFor="confirmar-senha" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                id="confirmar-senha"
                type={mostrarConfirmar ? 'text' : 'password'}
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Confirme sua nova senha"
                required
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmar(!mostrarConfirmar)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {mostrarConfirmar ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Erro */}
          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm">{erro}</p>
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            {carregando ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth={4}
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Redefinindo...</span>
              </>
            ) : (
              <>
                <span>Definir Nova Senha</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            Após redefinir, você será redirecionado para fazer login com sua
            nova senha.
          </p>
        </div>
      </div>
    </div>
  );
}
