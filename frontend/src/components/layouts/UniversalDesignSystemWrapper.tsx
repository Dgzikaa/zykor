'use client';

import React, { useState, useEffect } from 'react';
import {
  ErrorBoundary,
  PageTransition,
  ScrollToTop,
} from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Search, Command, Settings, Accessibility } from 'lucide-react';

// =====================================================
// 🚀 WRAPPER UNIVERSAL DO DESIGN SYSTEM - ZYKOR
// =====================================================

interface UniversalDesignSystemWrapperProps {
  children: React.ReactNode;
  enableAnimations?: boolean;
  enableGestures?: boolean;
  enableAccessibility?: boolean;
  enableAnalytics?: boolean;
  enableKeyboardShortcuts?: boolean;
  enableGlobalSearch?: boolean;
  enableCommandPalette?: boolean;
  enableThemeSwitcher?: boolean;
  className?: string;
}

export function UniversalDesignSystemWrapper({
  children,
  enableAnimations = true,
  enableGestures = true,
  enableAccessibility = true,
  enableAnalytics = true,
  enableKeyboardShortcuts = true,
  enableGlobalSearch = true,
  enableCommandPalette = true,
  enableThemeSwitcher = true,
  className = '',
}: UniversalDesignSystemWrapperProps) {
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);

  // Keyboard shortcuts globais
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K ou Ctrl+K para busca global
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (enableGlobalSearch) {
          setShowGlobalSearch(true);
        }
      }
      
      // Cmd+Shift+P ou Ctrl+Shift+P para command palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        if (enableCommandPalette) {
          setShowCommandPalette(true);
        }
      }
      
      // Alt+A para acessibilidade
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        if (enableAccessibility) {
          setShowAccessibilityPanel(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, enableGlobalSearch, enableCommandPalette, enableAccessibility]);

  return (
    <ErrorBoundary>
      {enableAccessibility && enableAnalytics && (
                <PageTransition>
                  <div className={`design-system-wrapper ${className}`}>
                    {children}
                    
                    {/* Floating Action Buttons */}
                    <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-50">
                      {/* Theme Switcher - Removido na otimização */}
                      
                      {/* Accessibility Button */}
                      {enableAccessibility && (
                        <Button
                          onClick={() => setShowAccessibilityPanel(true)}
                          size="sm"
                          variant="outline"
                          className="rounded-full w-12 h-12 p-0 shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                          title="Acessibilidade (Alt+A)"
                        >
                          <Accessibility className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {/* Global Search Button */}
                      {enableGlobalSearch && (
                        <Button
                          onClick={() => setShowGlobalSearch(true)}
                          size="sm"
                          variant="outline"
                          className="rounded-full w-12 h-12 p-0 shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                          title="Busca Global (⌘K)"
                        >
                          <Search className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {/* Command Palette Button */}
                      {enableCommandPalette && (
                        <Button
                          onClick={() => setShowCommandPalette(true)}
                          size="sm"
                          variant="outline"
                          className="rounded-full w-12 h-12 p-0 shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800"
                          title="Command Palette (⌘⇧P)"
                        >
                          <Command className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {/* Scroll to Top */}
                      <ScrollToTop />
                    </div>
                    
                    {/* Modals e Overlays - Desabilitados temporariamente */}
                    {/* GlobalSearch e CommandPalette removidos na otimização */}
                    
                    {/* Keyboard Shortcuts Handler */}
                    {/* KeyboardShortcuts não implementado ainda
                    {enableKeyboardShortcuts && (
                      <KeyboardShortcuts />
                    )}
                    */}
                  </div>
                </PageTransition>
      )}
      
      {/* Fallback sem acessibilidade */}
      {!enableAccessibility && (
        <>
          {enableAnalytics && (
                <PageTransition>
                  <div className={`design-system-wrapper ${className}`}>
                    {children}
                    
                    {/* Floating Action Buttons (sem acessibilidade) */}
                    <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-50">
                      <ScrollToTop />
                    </div>
                  </div>
                </PageTransition>
          )}
          
          {!enableAnalytics && (
            <PageTransition>
              <div className={`design-system-wrapper ${className}`}>
                {children}
                
                <div className="fixed bottom-6 right-6 flex flex-col space-y-3 z-50">
                  <ScrollToTop />
                </div>
              </div>
            </PageTransition>
          )}
        </>
      )}
    </ErrorBoundary>
  );
}

// Hook para usar o Design System
export function useDesignSystem() {
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  
  const openGlobalSearch = () => setGlobalSearchOpen(true);
  const closeGlobalSearch = () => setGlobalSearchOpen(false);
  
  const openCommandPalette = () => setCommandPaletteOpen(true);
  const closeCommandPalette = () => setCommandPaletteOpen(false);
  
  return {
    globalSearch: {
      isOpen: globalSearchOpen,
      open: openGlobalSearch,
      close: closeGlobalSearch,
    },
    commandPalette: {
      isOpen: commandPaletteOpen,
      open: openCommandPalette,
      close: closeCommandPalette,
    },
  };
}

export default UniversalDesignSystemWrapper;
