'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useUser } from '@/contexts/UserContext';
import { setBarCookie } from '@/lib/cookies';

// Bar selecionado é POR ABA (sessionStorage), não compartilhado entre abas.
// localStorage é mantido apenas como "último bar usado" para seedar abas novas.
const SELECTED_BAR_KEY = 'sgb_selected_bar_id';

// Lê o bar da aba: sessionStorage (verdade da aba) -> localStorage (último usado).
export const getTabSelectedBarId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return (
    sessionStorage.getItem(SELECTED_BAR_KEY) ||
    localStorage.getItem(SELECTED_BAR_KEY)
  );
};

// Persiste a seleção da aba (sessionStorage) + hint global (localStorage).
const persistSelectedBarId = (barId: number) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SELECTED_BAR_KEY, String(barId));
  localStorage.setItem(SELECTED_BAR_KEY, String(barId));
};

interface Bar {
  id: number;
  nome: string;
  modulos_permitidos?: string[] | Record<string, any>;
  role?: string;
  logo_url?: string | null;
}

interface BarContextType {
  selectedBar: Bar | null;
  availableBars: Bar[];
  setSelectedBar: (bar: Bar) => void;
  isLoading: boolean;
  resetBars: () => void;
}

const BarContext = createContext<BarContextType | undefined>(undefined);

export function BarProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isInitialized: userInitialized } = useUser();
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
  const [availableBars, setAvailableBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);

  const resetBars = () => {
    setSelectedBar(null);
    setAvailableBars([]);
    setIsLoading(true);
    // Resetar flag para permitir recarga
    hasLoadedBarsRef.current = false;
    // Resetar favicon para default
    updateFavicon();
  };

  // Flag para evitar loops de sincronização
  const isSyncingRef = useRef(false);
  
  // Flag para controlar se já carregou os bares
  const hasLoadedBarsRef = useRef(false);

  // Função auxiliar para sincronizar as permissões do bar selecionado no localStorage
  // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache, fonte de verdade é JWT
  const syncBarPermissions = (bar: Bar) => {
    if (typeof window === 'undefined' || isSyncingRef.current) return;
    
    if (bar.modulos_permitidos) {
      try {
        isSyncingRef.current = true;
        const storedUserData = localStorage.getItem('sgb_user');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          // Atualizar as permissões com as do bar selecionado
          userData.modulos_permitidos = bar.modulos_permitidos;
          userData.role = bar.role || userData.role;
          userData.bar_id = bar.id;
          localStorage.setItem('sgb_user', JSON.stringify(userData));
        }
      } catch (e) {
        // Erro silencioso
      } finally {
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      }
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    // Limpar flag de reload ao inicializar (após o reload já aconteceu)
    sessionStorage.removeItem('bar_change_in_progress');

    let mounted = true;

    async function loadUserBars() {
      try {
        // Aguardar que o UserContext seja inicializado
        if (!userInitialized) {
          return;
        }
        
        // Se já carregou os bares, não recarregar (evita loops)
        if (hasLoadedBarsRef.current) {
          return;
        }

        const supabase = await getSupabaseClient();
        if (!supabase) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Determinar email do usuário
        let userEmail: string | null = null;

        if (user && user.email) {
          userEmail = user.email;
        } else {
          // Tentar buscar da sessão do Supabase
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user?.email) {
            userEmail = session.user.email;
          } else {
            // Fallback: tentar localStorage
            // TODO(rodrigo/2026-05): Fallback sgb_user será removido após migração completa
            const storedUser = localStorage.getItem('sgb_user');
            if (storedUser) {
              try {
                const userData = JSON.parse(storedUser);
                userEmail = userData.email;
              } catch (e) {
                // Erro silencioso
              }
            }
          }
        }

        if (!userEmail) {
          if (mounted) setIsLoading(false);
          return;
        }

        // SEMPRE buscar da API para garantir dados atualizados

        try {
          const response = await fetch('/api/configuracoes/bars/user-bars');

          if (response.ok) {
            const json = await response.json();

            // A rota foi refatorada (commit 93ead5a2) para o envelope padrão
            // success({ bars, userData }) -> { success: true, data: { bars, userData } }.
            // Mantemos fallback para o shape antigo (data.bars) por segurança durante
            // a transição, mas o shape canônico hoje é json.data.bars.
            if (json.success === false) {
              console.error('❌ Erro ao carregar bares do usuário:', json);
              if (mounted) setIsLoading(false);
              return;
            }

            const bars: Bar[] | undefined = json?.data?.bars ?? json?.bars;

            if (bars && bars.length > 0) {
              if (mounted) {
                setAvailableBars(bars);

                // Bar da aba: sessionStorage (verdade da aba) -> localStorage (último usado)
                const selectedBarId = getTabSelectedBarId();
                let barToSelect: Bar;

                if (selectedBarId) {
                  const foundBar = bars.find(
                    (bar: Bar) => bar.id === parseInt(selectedBarId)
                  );
                  // Se o bar selecionado não existe mais nos bares disponíveis, usar o primeiro
                  barToSelect = foundBar || bars[0];

                  // Se bar não encontrado, usar primeiro disponível
                } else {
                  barToSelect = bars[0];
                }

                setSelectedBar(barToSelect);
                updateFavicon(barToSelect.nome, barToSelect.logo_url);
                // Sincronizar permissões do bar selecionado
                syncBarPermissions(barToSelect);
                // Fixar a seleção desta aba + garantir cookie p/ Server Components
                persistSelectedBarId(barToSelect.id);
                setBarCookie(barToSelect.id);
                
                // Marcar que os bares foram carregados
                hasLoadedBarsRef.current = true;

                setIsLoading(false);
                return;
              }
            }
          }
        } catch (error) {
          console.error('❌ Falha ao buscar /api/configuracoes/bars/user-bars:', error);
        }

        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) setIsLoading(false);
      }
    }

    loadUserBars();

    return () => {
      mounted = false;
    };
  }, [user, userInitialized, retryNonce]);

  // Listener para mudanças no usuário
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUserDataUpdated = () => {
      // Resetar flag para permitir recarga
      hasLoadedBarsRef.current = false;
      setIsLoading(true);
      // O useEffect principal vai recarregar com as novas dependências
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, []);

  // Retry automatico se o load terminou com lista vazia (race entre /api/auth/me
  // e /api/configuracoes/bars/user-bars, cookie/token chegando atrasado).
  // Implementacao anterior usava setTimeout encadeado que nao re-disparava o main
  // effect (deps estaticas) — virou no-op. Agora incrementa `retryNonce` que faz
  // parte das deps do main effect, garantindo re-execucao real do fetch.
  const retriesRef = useRef(0);
  useEffect(() => {
    if (isLoading) return;
    if (availableBars.length > 0) {
      retriesRef.current = 0;
      return;
    }
    if (!userInitialized) return;
    if (!user?.email) return; // Sem usuario, retry e' inutil.
    if (retriesRef.current >= 2) return;

    const timer = setTimeout(() => {
      retriesRef.current++;
      hasLoadedBarsRef.current = false;
      setRetryNonce((n) => n + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [isLoading, availableBars.length, userInitialized, user?.email]);

  // Função para atualizar favicon baseado no bar.
  // Se o bar tem logo cadastrada (logoUrl), usa ela como favicon; senão, cai no Zykor.
  const updateFavicon = (barName?: string, logoUrl?: string | null) => {
    if (typeof window === 'undefined') return;

    const faviconPath = logoUrl || '/logos/zykor-logo-white.png';
    const appleTouchPath = logoUrl || '/favicons/zykor/apple-touch-icon.png';

    // Atualizar favicon principal
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = faviconPath;

    // Atualizar favicon 32x32
    let favicon32 = document.querySelector(
      'link[rel="icon"][sizes="32x32"]'
    ) as HTMLLinkElement;
    if (!favicon32) {
      favicon32 = document.createElement('link');
      favicon32.rel = 'icon';
      favicon32.setAttribute('sizes', '32x32');
      favicon32.type = 'image/png';
      document.head.appendChild(favicon32);
    }
    favicon32.href = faviconPath;

    // Atualizar apple-touch-icon
    let appleIcon = document.querySelector(
      'link[rel="apple-touch-icon"]'
    ) as HTMLLinkElement;
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = appleTouchPath;
  };

  // Função para alterar o bar selecionado.
  // IMPORTANTE: a seleção é POR ABA (sessionStorage) e a atualização é "soft"
  // (router.refresh), nunca window.location.reload(). Abas diferentes podem ficar
  // em bares diferentes sem brigar pelo cookie/localStorage compartilhado.
  const handleSetSelectedBar = (bar: Bar) => {
    const previousBarId = selectedBar?.id;
    setSelectedBar(bar);

    if (typeof window === 'undefined') return;

    // Verdade da aba (sessionStorage) + hint global (localStorage)
    persistSelectedBarId(bar.id);
    // Cookie p/ Server Components — escrito ANTES do refresh para o servidor
    // já renderizar com o bar novo.
    setBarCookie(bar.id);
    updateFavicon(bar.nome, bar.logo_url);
    syncBarPermissions(bar);

    if (previousBarId !== undefined && previousBarId !== bar.id) {
      // Notificar componentes que escutam troca de bar
      window.dispatchEvent(
        new CustomEvent('barChanged', {
          detail: { previousBarId, newBarId: bar.id, barName: bar.nome },
        })
      );
      // Atualização soft dos Server Components (sem reload de página inteira)
      router.refresh();
    }
  };

  return (
    <BarContext.Provider
      value={{
        selectedBar,
        availableBars,
        setSelectedBar: handleSetSelectedBar,
        isLoading,
        resetBars,
      }}
    >
      {children}
    </BarContext.Provider>
  );
}

export function useBar() {
  const context = useContext(BarContext);
  if (context === undefined) {
    throw new Error('useBar must be used within a BarProvider');
  }
  return context;
}

// Alias para compatibilidade com código existente
export const useBarContext = useBar;
