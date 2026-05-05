'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove após a duração especificada
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  removeToast,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-3 max-w-md pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={removeToast} />
        </div>
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animação de entrada
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const dismiss = useCallback(() => {
    onRemove(toast.id);
  }, [onRemove, toast.id]);

  const getToastStyles = () => {
    const baseStyles =
      'flex items-start gap-3 p-4 rounded-xl border-0 shadow-2xl backdrop-blur-md transition-all duration-300 transform';
    const animationStyles = isVisible
      ? 'translate-y-0 opacity-100 scale-100'
      : 'translate-y-4 opacity-0 scale-95';
    const leavingStyles = isLeaving
      ? 'translate-y-4 opacity-0 scale-95'
      : '';

    switch (toast.type) {
      case 'success':
        return `${baseStyles} ${animationStyles} ${leavingStyles} bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500`;
      case 'error':
        return `${baseStyles} ${animationStyles} ${leavingStyles} bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500`;
      case 'warning':
        return `${baseStyles} ${animationStyles} ${leavingStyles} bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500`;
      case 'info':
        return `${baseStyles} ${animationStyles} ${leavingStyles} bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500`;
      default:
        return `${baseStyles} ${animationStyles} ${leavingStyles} bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-gray-500`;
    }
  };

  const getIcon = () => {
    const iconClass = 'w-6 h-6 flex-shrink-0';

    switch (toast.type) {
      case 'success':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'error':
        return <AlertCircle className={`${iconClass} text-red-600`} />;
      case 'warning':
        return <AlertTriangle className={`${iconClass} text-orange-600`} />;
      case 'info':
        return <Info className={`${iconClass} text-blue-600`} />;
      default:
        return <Info className={`${iconClass} text-gray-600`} />;
    }
  };

  const getTitleColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      case 'warning':
        return 'text-orange-800';
      case 'info':
        return 'text-blue-800';
      default:
        return 'text-gray-800';
    }
  };

  const getMessageColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-orange-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className={getToastStyles()}>
      {getIcon()}

      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${getTitleColor()}`}>
          {toast.title}
        </div>
        {toast.message && (
          <div className={`text-sm mt-1 ${getMessageColor()}`}>
            {toast.message}
          </div>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-xs font-medium underline hover:no-underline transition-all duration-200"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleRemove}
        className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 hover:bg-white/20 rounded-full"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Helper functions para facilitar o uso
export const toast = {
  success: (
    title: string,
    message?: string,
    options?: { duration?: number; action?: ToastMessage['action'] }
  ) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('showToast', {
        detail: { type: 'success', title, message, ...options },
      });
      window.dispatchEvent(event);
    }
  },
  error: (
    title: string,
    message?: string,
    options?: { duration?: number; action?: ToastMessage['action'] }
  ) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('showToast', {
        detail: { type: 'error', title, message, ...options },
      });
      window.dispatchEvent(event);
    }
  },
  warning: (
    title: string,
    message?: string,
    options?: { duration?: number; action?: ToastMessage['action'] }
  ) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('showToast', {
        detail: { type: 'warning', title, message, ...options },
      });
      window.dispatchEvent(event);
    }
  },
  info: (
    title: string,
    message?: string,
    options?: { duration?: number; action?: ToastMessage['action'] }
  ) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('showToast', {
        detail: { type: 'info', title, message, ...options },
      });
      window.dispatchEvent(event);
    }
  },
};

// Hook para usar globalmente os toasts
export const useGlobalToast = () => {
  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('showToast', { detail: toast });
      window.dispatchEvent(event);
    }
  }, []);

  return {
    toast: {
      success: (
        title: string,
        message?: string,
        options?: { duration?: number; action?: ToastMessage['action'] }
      ) => showToast({ type: 'success', title, message, ...options }),
      error: (
        title: string,
        message?: string,
        options?: { duration?: number; action?: ToastMessage['action'] }
      ) => showToast({ type: 'error', title, message, ...options }),
      warning: (
        title: string,
        message?: string,
        options?: { duration?: number; action?: ToastMessage['action'] }
      ) => showToast({ type: 'warning', title, message, ...options }),
      info: (
        title: string,
        message?: string,
        options?: { duration?: number; action?: ToastMessage['action'] }
      ) => showToast({ type: 'info', title, message, ...options }),
    },
  };
};

// Componente para ser usado no layout principal
export const GlobalToastListener: React.FC = () => {
  const { showToast } = useToast();

  useEffect(() => {
    const handleShowToast = (event: CustomEvent<Omit<ToastMessage, 'id'>>) => {
      showToast(event.detail);
    };

    window.addEventListener('showToast', handleShowToast as EventListener);
    return () =>
      window.removeEventListener('showToast', handleShowToast as EventListener);
  }, [showToast]);

  return null;
};
