'use client';

import { useState } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = ({
    title,
    description,
    variant = 'default',
  }: Omit<Toast, 'id'>) => {
    const id = (++toastCount).toString();
    const newToast: Toast = { id, title, description, variant };

    setToasts(prev => [...prev, newToast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter((t: Toast) => t.id !== id));
    }, 5000);

    // Show browser notification
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body: description });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(title, { body: description });
          }
        });
      }
    }

    // Console log for development
    console.log(
      `[${variant.toUpperCase()}] ${title}${description ? ': ' + description : ''}`
    );
  };

  const dismiss = (toastId: string) => {
    setToasts(prev => prev.filter((t: Toast) => t.id !== toastId));
  };

  return {
    toast,
    dismiss,
    toasts,
  };
}
