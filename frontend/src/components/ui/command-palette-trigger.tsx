'use client';

import { useState, useEffect, useMemo } from "react";
import { Button } from '@/components/ui/button';
import { useCommandPalette } from '@/hooks/useCommandPalette';
import { Search } from 'lucide-react';

interface CommandPaletteTriggerProps {
  variant?: 'default' | 'outline' | 'ghost' | 'sidebar';
  size?: 'sm' | 'md' | 'lg';
  showShortcut?: boolean;
  className?: string;
}

interface SearchButtonProps {
  placeholder?: string;
  className?: string;
}

function useKeyHint() {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      // Usa userAgentData quando disponível, senão faz fallback para userAgent
      const platform =
        (navigator as any).userAgentData?.platform || navigator.userAgent || '';
      setIsMac(/Mac|iPhone|iPod|iPad/.test(platform));
    }
  }, []);
  return useMemo(() => (isMac ? '⌘' : 'Ctrl'), [isMac]);
}

export function CommandPaletteTrigger({
  variant = 'outline',
  size = 'md',
  showShortcut = true,
  className = '',
}: CommandPaletteTriggerProps) {
  const { openPalette } = useCommandPalette();
  const keyHint = useKeyHint();

  const getButtonProps = () => {
    switch (variant) {
      case 'sidebar':
        return {
          variant: 'ghost' as const,
          className: `w-full justify-start text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`,
        };
      case 'ghost':
        return {
          variant: 'ghost' as const,
          className: `text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`,
        };
      default:
        return {
          variant,
          className,
        };
    }
  };

  const getSizeProps = () => {
    switch (size) {
      case 'sm':
        return { size: 'sm' as const };
      case 'lg':
        return { size: 'lg' as const };
      default:
        return {};
    }
  };

  const buttonProps = getButtonProps();
  const sizeProps = getSizeProps();

  return (
    <Button
      onClick={openPalette}
      {...buttonProps}
      {...sizeProps}
      title={`Abrir Command Palette (${keyHint}+K)`}
    >
      {variant === 'sidebar' ? (
        <>
          <Search className="w-4 h-4 mr-3" />
          <span className="flex-1 text-left">Buscar</span>
          {showShortcut && (
            <div className="flex items-center gap-1 text-xs opacity-60">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                 {keyHint}K
              </kbd>
            </div>
          )}
        </>
      ) : (
        <>
          <Search className="w-4 h-4 mr-2" />
          <span>Buscar</span>
          {showShortcut && (
            <div className="ml-2 flex items-center gap-1 text-xs opacity-60">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                 {keyHint}K
              </kbd>
            </div>
          )}
        </>
      )}
    </Button>
  );
}

// Versão compacta apenas com ícone - otimizada para mobile
export function CommandPaletteIconTrigger({
  className = '',
  title = 'Buscar',
}: {
  className?: string;
  title?: string;
}) {
  const { openPalette } = useCommandPalette();

  const handleClick = () => {
    openPalette();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={`w-10 h-10 p-0 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded-lg ${className}`}
      title={title}
    >
      <Search className="w-5 h-5" />
    </Button>
  );
}

// Placeholder de busca que abre o Command Palette
export function CommandPaletteSearchPlaceholder({
  placeholder = 'Buscar...',
  className = '',
}: {
  placeholder?: string;
  className?: string;
}) {
  const { openPalette } = useCommandPalette();
  const keyHint = useKeyHint();

  const handleClick = () => {
    openPalette();
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      className={`
        flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 sm:py-1 bg-[hsl(var(--muted))]/50
        border border-[hsl(var(--border))] rounded-full
        cursor-pointer hover:bg-[hsl(var(--muted))]
        transition-colors ${className}
      `}
    >
      <Search className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
      <span className="text-[hsl(var(--muted-foreground))] text-sm flex-1 truncate">
        {placeholder}
      </span>
      <div className=" lg:flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
        <kbd className="px-1.5 py-0.5 text-xs">
          {`${keyHint}+K`}
        </kbd>
      </div>
    </div>
  );
}
