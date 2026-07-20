'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { useUser } from '@/contexts/UserContext';
import { setBarCookie, getBarCookie } from '@/lib/cookies';

// Bar selecionado é COMPARTILHADO entre abas via cookie `sgb_bar_id` (cookie-first, 2026-07-11).
// O cookie é legível no SERVIDOR (Server Components/middleware) -> a página já renderiza com o
// bar certo (destrava RSC). localStorage é espelho p/ sincronizar as abas (storage event).
// (Antes era por-aba via sessionStorage; mudou p/ cookie-first porque abas raramente usam bares
// diferentes ao mesmo tempo, e o ganho de RSC compensa — decisão do Rodrigo.)
const SELECTED_BAR_KEY = 'sgb_selected_bar_id';

// Lê o bar selecionado com ISOLAMENTO POR-ABA: sessionStorage (verdade DESTA aba) primeiro; só cai
// no cookie/localStorage pra semear uma aba nova. Antes era cookie-first (compartilhado), o que
// fazia uma aba herdar o bar de outra e lançar no bar errado (bug 14/07). Ver [[lib/selected-bar]].
export const getTabSelectedBarId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const tabBar = sessionStorage.getItem(SELECTED_BAR_KEY);
  if (tabBar != null) return tabBar;
  const cookieBar = getBarCookie();
  if (cookieBar != null) return String(cookieBar);
  return localStorage.getItem(SELECTED_BAR_KEY);
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
  // Whitelist de ROTAS visíveis neste bar (config do bar). Vazio/ausente = mostra tudo.
  // Vale pra TODOS os usuários do bar, inclusive admin — é o que deixa um bar "enxuto"
  // (ex.: Escritório Central só com Relatórios Financeiros). Ver MinimalSidebar/guard.
  modulos_visiveis?: string[];
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

  // Flag para evitar loops de sincronização
  const isSyncingRef = useRef(false);

  // Flag para controlar se já carregou os bares
  const hasLoadedBarsRef = useRef(false);

  // Função para atualizar favicon baseado no bar.
  // Se o bar tem logo cadastrada (logoUrl), usa ela como favicon; senão, cai no Zykor.
  // Sem dependências externas (só toca no DOM) -> identidade estável.
  const updateFavicon = useCallback((barName?: string, logoUrl?: string | null) => {
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
  }, []);

  // Função auxiliar para sincronizar as permissões do bar selecionado no localStorage
  // TODO(rodrigo/2026-05): sgb_user mantido apenas como cache, fonte de verdade é JWT
  // Só usa refs -> identidade estável.
  const syncBarPermissions = useCallback((bar: Bar) => {
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
  }, []);

  const resetBars = useCallback(() => {
    setSelectedBar(null);
    setAvailableBars([]);
    setIsLoading(true);
    // Resetar flag para permitir recarga
    hasLoadedBarsRef.current = false;
    // Resetar favicon para default
    updateFavicon();
  }, [updateFavicon]);

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
  }, [user, userInitialized, retryNonce, updateFavicon, syncBarPermissions]);

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

  // ISOLAMENTO POR-ABA (14/07/2026): REMOVIDO o sync automático entre abas. Antes, quando outra aba
  // trocava de bar, o `storage` event trocava o bar DESTA aba silenciosamente (router.refresh) — o
  // financeiro trabalha Ordinário numa aba e Deboche em outra, então uma aba "virava" a outra sem a
  // pessoa perceber e o boleto era lançado no bar errado. Agora cada aba mantém o SEU bar
  // (sessionStorage é a verdade da aba; ver getTabSelectedBarId e lib/selected-bar). O cookie segue
  // semeando o bar de uma aba NOVA no 1º load; abas já abertas não se atropelam mais.

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

  // Função para alterar o bar selecionado.
  // IMPORTANTE: a seleção é COMPARTILHADA entre abas (cookie `sgb_bar_id` + localStorage);
  // a atualização é "soft" (router.refresh), nunca window.location.reload(). Ao trocar aqui,
  // as OUTRAS abas recebem o `storage` event e se alinham no mesmo bar (cookie-first).
  const handleSetSelectedBar = useCallback((bar: Bar) => {
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
  }, [selectedBar, router, updateFavicon, syncBarPermissions]);

  // Value memoizado: só muda quando o estado real muda (selectedBar/availableBars/
  // isLoading). Evita re-render de TODOS os consumidores de useBar (usado no app
  // inteiro por causa do bar_id) quando o provider re-renderiza sem mudança de estado.
  const value = useMemo<BarContextType>(
    () => ({
      selectedBar,
      availableBars,
      setSelectedBar: handleSetSelectedBar,
      isLoading,
      resetBars,
    }),
    [selectedBar, availableBars, isLoading, handleSetSelectedBar, resetBars]
  );

  return <BarContext.Provider value={value}>{children}</BarContext.Provider>;
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
