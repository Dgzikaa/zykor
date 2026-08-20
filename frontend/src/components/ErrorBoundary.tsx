'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para que a próxima renderização mostre a UI de erro
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary capturou um erro:', error, errorInfo);
    
    // Armazenar detalhes do erro no state
    this.setState({
      error,
      errorInfo,
    });

    // Reportar erro para serviços de monitoramento (se configurado)
    // Checa a FUNÇÃO, não só o objeto: com o bundle do Sentry bloqueado pelo CSP, `window.Sentry`
    // existe pela metade e `captureException` vira undefined. O erro do handler estourava DENTRO
    // do componentDidCatch e escondia o erro de verdade — foi o que enterrou um
    // "Cannot access 'L' before initialization" atrás de "captureException is not a function"
    // (20/08/2026).
    if (typeof window !== 'undefined' && typeof (window as any).Sentry?.captureException === 'function') {
      try {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
      } catch { /* monitoramento nunca pode derrubar o handler de erro */ }
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (typeof window !== 'undefined') {
      window.location.href = '/home';
    }
  };

  render() {
    if (this.state.hasError) {
      // UI de fallback personalizada
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNavigationError = this.state.error?.message?.includes('removeChild') || 
                               this.state.error?.message?.includes('appendChild') ||
                               this.state.error?.message?.includes('Cannot read properties of null');

      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="card-dark p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
              </div>

              <h1 className="card-title-dark mb-2">
                {isNavigationError ? 'Erro de Navegação' : 'Algo deu errado'}
              </h1>

              <p className="card-description-dark mb-6">
                {isNavigationError 
                  ? 'Detectamos um problema durante a navegação. Isso geralmente se resolve tentando novamente.'
                  : 'Ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando para resolver.'
                }
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="text-left mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                    Detalhes do erro (desenvolvimento):
                  </p>
                  <pre className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap break-all">
                    {this.state.error.message}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="text-xs text-red-600 dark:text-red-400 mt-2 whitespace-pre-wrap break-all">
                      {this.state.errorInfo.componentStack.slice(0, 500)}...
                    </pre>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={this.handleRetry}
                  className="w-full btn-primary-dark"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Voltar ao Início
                </Button>
              </div>

              {isNavigationError && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    💡 <strong>Dica:</strong> Se o problema persistir, tente atualizar a página (F5) ou limpar o cache do navegador.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook para usar em componentes funcionais
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('🚨 Erro capturado manualmente:', error, errorInfo);
    
    // Checa a FUNÇÃO, não só o objeto: com o bundle do Sentry bloqueado pelo CSP, `window.Sentry`
    // existe pela metade e `captureException` vira undefined. O erro do handler estourava DENTRO
    // do componentDidCatch e escondia o erro de verdade — foi o que enterrou um
    // "Cannot access 'L' before initialization" atrás de "captureException is not a function"
    // (20/08/2026).
    if (typeof window !== 'undefined' && typeof (window as any).Sentry?.captureException === 'function') {
      try {
      (window as any).Sentry.captureException(error, {
        contexts: errorInfo ? {
          react: {
            componentStack: errorInfo.componentStack,
          },
        } : undefined,
      });
      } catch { /* monitoramento nunca pode derrubar o handler de erro */ }
    }
  };
}

// Componente simples para erros de carregamento
export function LoadingError({ 
  error, 
  onRetry, 
  message = "Erro ao carregar dados" 
}: { 
  error?: Error;
  onRetry?: () => void;
  message?: string;
}) {
  return (
    <div className="card-dark p-6 text-center">
      <div className="flex justify-center mb-4">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
      </div>
      
      <h3 className="card-title-dark text-lg mb-2">{message}</h3>
      
      {error && process.env.NODE_ENV === 'development' && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-mono">
          {error.message}
        </p>
      )}
      
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar Novamente
        </Button>
      )}
    </div>
  );
}
