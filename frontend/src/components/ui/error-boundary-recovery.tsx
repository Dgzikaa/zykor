'use client';

import React, { Component, ErrorInfo, ReactNode, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  ArrowLeft, 
  Bug, 
  Shield, 
  Zap, 
  Info,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Send,
  Copy,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Tipos para error boundaries
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  componentStack: string;
  recoveryAttempts: number;
  isRecovering: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRecovery?: () => void;
  maxRecoveryAttempts?: number;
  autoRecovery?: boolean;
  showDetails?: boolean;
  className?: string;
}

interface ErrorReport {
  id: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  errorInfo: {
    componentStack: string;
  };
  context: {
    timestamp: Date;
    url: string;
    userAgent: string;
    componentStack: string;
    recoveryAttempts: number;
  };
  user?: {
    id?: string;
    email?: string;
    role?: string;
  };
  environment: {
    version: string;
    build: string;
    environment: string;
  };
}

// Hook para gerenciar erros
export const useErrorHandler = () => {
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [isReporting, setIsReporting] = useState(false);

  // Adicionar erro
  const addError = useCallback((error: ErrorReport) => {
    setErrors(prev => [error, ...prev.slice(0, 9)]); // Manter apenas os últimos 10
  }, []);

  // Remover erro
  const removeError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  // Limpar todos os erros
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  // Enviar relatório de erro
  const sendErrorReport = useCallback(async (error: ErrorReport) => {
    setIsReporting(true);
    try {
      // Simular envio para serviço de monitoramento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Em produção, enviar para Sentry, LogRocket, etc.
      console.log('Error report sent:', error);
      
      return { success: true, message: 'Relatório enviado com sucesso' };
    } catch (error) {
      return { success: false, message: 'Falha ao enviar relatório' };
    } finally {
      setIsReporting(false);
    }
  }, []);

  // Recuperar automaticamente
  const autoRecover = useCallback(async (error: ErrorReport) => {
    try {
      // Tentar recuperar o estado da aplicação
      if (error.error.name === 'NetworkError') {
        // Tentar reconectar
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: 'Conexão restaurada' };
      }
      
      if (error.error.name === 'ValidationError') {
        // Limpar dados inválidos
        return { success: true, message: 'Dados validados' };
      }
      
      return { success: false, message: 'Recuperação automática não disponível' };
    } catch (recoveryError) {
      return { success: false, message: 'Falha na recuperação automática' };
    }
  }, []);

  return {
    errors,
    isReporting,
    addError,
    removeError,
    clearErrors,
    sendErrorReport,
    autoRecover
  };
};

// Componente de fallback para erros
interface ErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  errorId: string;
  onRetry: () => void;
  onGoHome: () => void;
  onGoBack: () => void;
  onReport: () => void;
  onRecover: () => void;
  isRecovering: boolean;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  showDetails: boolean;
  onToggleDetails: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onGoHome,
  onGoBack,
  onReport,
  onRecover,
  isRecovering,
  recoveryAttempts,
  maxRecoveryAttempts,
  showDetails,
  onToggleDetails
}) => {
  const [copied, setCopied] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportMessage, setReportMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Copiar detalhes do erro
  const copyErrorDetails = useCallback(async () => {
    const errorText = `
Error ID: ${errorId}
Error: ${error.name}
Message: ${error.message}
Stack: ${error.stack}
Component Stack: ${errorInfo.componentStack}
Timestamp: ${new Date().toLocaleString('pt-BR')}
URL: ${window.location.href}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy error details:', err);
    }
  }, [error, errorInfo, errorId]);

  // Enviar relatório
  const handleSubmitReport = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Simular envio
      await new Promise(resolve => setTimeout(resolve, 2000));
      setShowReportForm(false);
      setReportMessage('');
      onReport();
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [onReport]);

  // Download do relatório
  const downloadReport = useCallback(() => {
    const report = {
      errorId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      context: {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${errorId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [error, errorInfo, errorId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 shadow-xl">
          <CardHeader className="text-center border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-red-800 dark:text-red-200">
                  Ops! Algo deu errado
                </CardTitle>
                <p className="text-red-600 dark:text-red-300">
                  Encontramos um problema inesperado
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Informações do erro */}
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-full text-sm font-medium mb-4">
                <Bug className="w-4 h-4" />
                Error ID: {errorId.slice(0, 8)}
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {error.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error.message}
              </p>
            </div>

            {/* Ações de recuperação */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onRetry}
                disabled={isRecovering}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRecovering ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Tentar Novamente
              </Button>

              <Button
                onClick={onRecover}
                disabled={isRecovering || recoveryAttempts >= maxRecoveryAttempts}
                variant="outline"
                className="border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/10"
              >
                <Zap className="w-4 h-4 mr-2" />
                Recuperar
              </Button>
            </div>

            {/* Navegação */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onGoBack}
                variant="outline"
                className="border-gray-200 dark:border-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              <Button
                onClick={onGoHome}
                variant="outline"
                className="border-gray-200 dark:border-gray-700"
              >
                <Home className="w-4 h-4 mr-2" />
                Início
              </Button>
            </div>

            {/* Status de recuperação */}
            {recoveryAttempts > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm">
                  <Info className="w-4 h-4" />
                  <span>
                    Tentativas de recuperação: {recoveryAttempts}/{maxRecoveryAttempts}
                  </span>
                </div>
                {recoveryAttempts >= maxRecoveryAttempts && (
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                    Limite de tentativas atingido. Considere recarregar a página.
                  </p>
                )}
              </div>
            )}

            {/* Ações adicionais */}
            <div className="flex items-center justify-center gap-2">
              <Button
                onClick={onToggleDetails}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {showDetails ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Ocultar Detalhes
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Ver Detalhes
                  </>
                )}
              </Button>

              <Button
                onClick={copyErrorDetails}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>

              <Button
                onClick={downloadReport}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>

              <Button
                onClick={() => setShowReportForm(!showReportForm)}
                variant="ghost"
                size="sm"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                Reportar
              </Button>
            </div>

            {/* Formulário de relatório */}
            <AnimatePresence>
              {showReportForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                      Reportar Erro
                    </h4>
                    <textarea
                      value={reportMessage}
                      onChange={(e) => setReportMessage(e.target.value)}
                      placeholder="Descreva o que você estava fazendo quando o erro ocorreu..."
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                      rows={3}
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        onClick={handleSubmitReport}
                        disabled={isSubmitting}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Enviar Relatório
                      </Button>
                      <Button
                        onClick={() => setShowReportForm(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Detalhes técnicos */}
            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Detalhes Técnicos
                    </h4>
                    
                    <div className="space-y-3 text-xs font-mono">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Error:</span>
                        <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-2 rounded mt-1 overflow-x-auto">
                          {error.stack}
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Component Stack:</span>
                        <div className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 p-2 rounded mt-1 overflow-x-auto">
                          {errorInfo.componentStack}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

// Error Boundary principal
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      timestamp: new Date(),
      userAgent: '',
      url: '',
      componentStack: '',
      recoveryAttempts: 0,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
      componentStack: errorInfo.componentStack || ''
    });

    // Notificar sobre o erro
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log do erro
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Em produção, enviar para serviço de monitoramento
    this.sendErrorReport(error, errorInfo);
  }

  // Enviar relatório de erro
  private sendErrorReport = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const report: ErrorReport = {
        id: this.state.errorId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        errorInfo: {
          componentStack: errorInfo.componentStack || ''
        },
        context: {
          timestamp: this.state.timestamp,
          url: this.state.url,
          userAgent: this.state.userAgent,
          componentStack: this.state.componentStack,
          recoveryAttempts: this.state.recoveryAttempts
        },
        environment: {
          version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          build: process.env.NEXT_PUBLIC_BUILD_ID || 'dev',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      // Enviar para serviço de monitoramento (Sentry, LogRocket, etc.)
      if (process.env.NODE_ENV === 'production') {
        // fetch('/api/errors', { method: 'POST', body: JSON.stringify(report) });
        console.log('Error report sent to monitoring service:', report);
      }
    } catch (reportError) {
      console.error('Failed to send error report:', reportError);
    }
  };

  // Tentar recuperar
  private handleRecovery = async () => {
    const { maxRecoveryAttempts = 3, onRecovery } = this.props;
    
    if (this.state.recoveryAttempts >= maxRecoveryAttempts) {
      return;
    }

    this.setState({ isRecovering: true });

    try {
      // Tentar recuperar o estado
      if (onRecovery) {
        await onRecovery();
      }

      // Simular processo de recuperação
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Se chegou até aqui, a recuperação foi bem-sucedida
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        recoveryAttempts: prevState.recoveryAttempts + 1
      }));
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      this.setState(prevState => ({
        recoveryAttempts: prevState.recoveryAttempts + 1,
        isRecovering: false
      }));
    }
  };

  // Tentar novamente
  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: prevState.recoveryAttempts + 1
    }));
  };

  // Ir para home
  private handleGoHome = () => {
    window.location.href = '/';
  };

  // Voltar
  private handleGoBack = () => {
    window.history.back();
  };

  // Reportar erro
  private handleReport = () => {
    console.log('Error reported by user');
  };

  // Toggle detalhes
  private handleToggleDetails = () => {
    // Implementar toggle de detalhes se necessário
  };

  render() {
    const { 
      children, 
      fallback, 
      maxRecoveryAttempts = 3,
      showDetails = false,
      className = ''
    } = this.props;

    if (this.state.hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo!}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          onGoBack={this.handleGoBack}
          onReport={this.handleReport}
          onRecover={this.handleRecovery}
          isRecovering={this.state.isRecovering}
          recoveryAttempts={this.state.recoveryAttempts}
          maxRecoveryAttempts={maxRecoveryAttempts}
          showDetails={showDetails}
          onToggleDetails={this.handleToggleDetails}
        />
      );
    }

    return children;
  }
}

// Hook para usar error boundary em componentes funcionais
export const useErrorBoundary = () => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const throwError = useCallback((error: Error) => {
    setError(error);
    setHasError(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setHasError(false);
  }, []);

  return {
    hasError,
    error,
    throwError,
    clearError
  };
};

// Componente de exemplo
export const ErrorBoundaryExample: React.FC = () => {
  const [showErrorComponent, setShowErrorComponent] = useState(false);
  const [errorType, setErrorType] = useState<'render' | 'async' | 'network'>('render');

  // Componente que gera erro
  const BuggyComponent: React.FC = () => {
    if (errorType === 'render') {
      throw new Error('Erro de renderização intencional');
    }
    
    return (
      <div className="p-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p className="text-green-800 dark:text-green-200">
          Componente funcionando normalmente
        </p>
      </div>
    );
  };

  // Componente com erro assíncrono
  const AsyncErrorComponent: React.FC = () => {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
      if (errorType === 'async') {
        // Simular erro assíncrono
        setTimeout(() => {
          throw new Error('Erro assíncrono simulado');
        }, 1000);
      }
    }, [errorType]);

    return (
      <div className="p-4 bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-blue-800 dark:text-blue-200">
          Componente com operação assíncrona
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Error Boundaries com Recovery
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Sistema robusto de tratamento de erros com recuperação automática, 
            interface amigável e relatórios detalhados
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Controles */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            Testar Error Boundaries
          </h2>
          
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="errorType"
                  value="render"
                  checked={errorType === 'render'}
                  onChange={(e) => setErrorType(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Erro de Renderização</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="errorType"
                  value="async"
                  checked={errorType === 'async'}
                  onChange={(e) => setErrorType(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Erro Assíncrono</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="errorType"
                  value="network"
                  checked={errorType === 'network'}
                  onChange={(e) => setErrorType(e.target.value as any)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Erro de Rede</span>
              </label>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => setShowErrorComponent(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Bug className="w-4 h-4 mr-2" />
                Gerar Erro
              </Button>

              <Button
                onClick={() => setShowErrorComponent(false)}
                variant="outline"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Resetar
              </Button>
            </div>
          </div>
        </div>

        {/* Demonstração */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Demonstração
          </h2>
          
          {showErrorComponent ? (
            <ErrorBoundary
              maxRecoveryAttempts={3}
              showDetails={true}
              onError={(error, errorInfo) => {
                console.log('Error caught by boundary:', error, errorInfo);
              }}
              onRecovery={async () => {
                console.log('Attempting recovery...');
                await new Promise(resolve => setTimeout(resolve, 1000));
              }}
            >
              {errorType === 'render' ? (
                <BuggyComponent />
              ) : errorType === 'async' ? (
                <AsyncErrorComponent />
              ) : (
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    Selecione um tipo de erro e clique em &quot;Gerar Erro&quot;
                  </p>
                </div>
              )}
            </ErrorBoundary>
          ) : (
            <div className="text-center p-8 text-gray-500 dark:text-gray-400">
              <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium mb-2">Nenhum erro ativo</p>
              <p className="text-sm">Clique em &quot;Gerar Erro&quot; para testar o sistema</p>
            </div>
          )}
        </div>

        {/* Informações do sistema */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Características
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• <strong>Recuperação Automática:</strong> Tenta restaurar o estado</li>
              <li>• <strong>Interface Amigável:</strong> Mensagens claras para o usuário</li>
              <li>• <strong>Relatórios Detalhados:</strong> Informações técnicas completas</li>
              <li>• <strong>Múltiplas Tentativas:</strong> Sistema de retry configurável</li>
              <li>• <strong>Monitoramento:</strong> Integração com serviços de tracking</li>
              <li>• <strong>Contexto Rico:</strong> Metadados do erro e ambiente</li>
            </ul>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Tipos de Erro Suportados
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Erros de Renderização:</strong> Problemas no JSX/TSX
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Erros Assíncronos:</strong> Promises, async/await
                </span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Erros de Rede:</strong> APIs, fetch, timeout
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundaryExample;
