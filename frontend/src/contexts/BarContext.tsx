'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { useUser } from '@/contexts/UserContext';
import { setBarCookie } from '@/lib/cookies';

interface Bar {
  id: number;
  nome: string;
  modulos_permitidos?: string[] | Record<string, any>;
  role?: string;
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
  const { user, isInitialized: userInitialized } = useUser();
  const [selectedBar, setSelectedBar] = useState<Bar | null>(null);
  const [availableBars, setAvailableBars] = useState<Bar[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const resetBars = () => {
    setSelectedBar(null);
    setAvailableBars([]);
    setIsLoading(true);
    // Resetar favicon para default
    updateFavicon();
  };

  // Função auxiliar para sincronizar as permissões do bar selecionado no localStorage
  const syncBarPermissions = (bar: Bar) => {
    if (typeof window === 'undefined') return;
    
    if (bar.modulos_permitidos) {
      try {
        const storedUserData = localStorage.getItem('sgb_user');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          // Atualizar as permissões com as do bar selecionado
          userData.modulos_permitidos = bar.modulos_permitidos;
          userData.role = bar.role || userData.role;
          userData.bar_id = bar.id;
          localStorage.setItem('sgb_user', JSON.stringify(userData));
          
          // Disparar evento para notificar o usePermissions e outros hooks
          window.dispatchEvent(new CustomEvent('userDataUpdated'));
          console.log('✅ Permissões sincronizadas para o bar:', bar.nome);
        }
      } catch (e) {
        console.error('❌ Erro ao sincronizar permissões do bar:', e);
      }
    }
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function loadUserBars() {
      try {
        // Aguardar que o UserContext seja inicializado
        if (!userInitialized) {
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
            const storedUser = localStorage.getItem('sgb_user');
            if (storedUser) {
              try {
                const userData = JSON.parse(storedUser);
                userEmail = userData.email;
              } catch (e) {
                console.error('❌ BarContext: Erro ao parsear localStorage:', e);
              }
            }
          }
        }

        if (!userEmail) {
          if (mounted) setIsLoading(false);
          return;
        }

        // SEMPRE buscar da API para garantir dados atualizados
        console.log('🔍 BarContext: Buscando bares atualizados da API...');

        try {
          const response = await fetch('/api/configuracoes/bars/user-bars', {
            headers: {
              'x-user-data': encodeURIComponent(JSON.stringify(user)),
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log('✅ BarContext: Dados recebidos da API:', data.bars?.length || 0, 'bares');

            if (data.bars && data.bars.length > 0) {
              if (mounted) {
                setAvailableBars(data.bars);

                // Atualizar localStorage com os bares mais recentes
                const storedUserData = localStorage.getItem('sgb_user');
                if (storedUserData) {
                  try {
                    const userData = JSON.parse(storedUserData);
                    userData.availableBars = data.bars;
                    localStorage.setItem('sgb_user', JSON.stringify(userData));
                    console.log('✅ BarContext: localStorage atualizado com novos bares');
                  } catch (e) {
                    console.error('❌ BarContext: Erro ao atualizar localStorage:', e);
                  }
                }

                // Verificar se há um bar selecionado no localStorage
                const selectedBarId = localStorage.getItem('sgb_selected_bar_id');
                let barToSelect: Bar;
                
                if (selectedBarId) {
                  const foundBar = data.bars.find(
                    (bar: Bar) => bar.id === parseInt(selectedBarId)
                  );
                  // Se o bar selecionado não existe mais nos bares disponíveis, usar o primeiro
                  barToSelect = foundBar || data.bars[0];
                  
                  if (!foundBar) {
                    console.log('⚠️ BarContext: Bar selecionado não está mais disponível, usando primeiro bar');
                  }
                } else {
                  barToSelect = data.bars[0];
                }
                
                setSelectedBar(barToSelect);
                updateFavicon(barToSelect.nome);
                // Sincronizar permissões do bar selecionado
                syncBarPermissions(barToSelect);
                // Garantir que cookie está atualizado
                setBarCookie(barToSelect.id);

                setIsLoading(false);
                return;
              }
            } else {
              console.log('❌ BarContext: Nenhum bar encontrado na API');
            }
          } else {
            console.error('❌ BarContext: Erro na API:', response.status);
          }
        } catch (error) {
          console.error('❌ BarContext: Erro ao chamar API:', error);
        }

        if (mounted) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar bares do usuário:', error);
        if (mounted) setIsLoading(false);
      }
    }

    loadUserBars();

    return () => {
      mounted = false;
    };
  }, [user, userInitialized]);

  // Listener para mudanças no usuário
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUserDataUpdated = () => {
      setIsLoading(true);
      // O useEffect principal vai recarregar com as novas dependências
    };

    window.addEventListener('userDataUpdated', handleUserDataUpdated);

    return () => {
      window.removeEventListener('userDataUpdated', handleUserDataUpdated);
    };
  }, []);

  // Função para atualizar favicon baseado no bar
  const updateFavicon = (barName?: string) => {
    if (typeof window === 'undefined') return;

    // Mapeamento de nomes de bares para favicons
    const getFaviconPath = (name?: string) => {
      if (!name) return '/logos/zykor-logo-white.png';
      
      const normalizedName = name.toLowerCase().replace(/[^a-z]/g, '');
      const barFavicons: Record<string, string> = {
        'ordinario': '/logos/zykor-logo-white.png', // Temporariamente usando ZYKOR
        'deboche': '/logos/zykor-logo-white.png',   // Temporariamente usando ZYKOR
      };
      
      return barFavicons[normalizedName] || '/logos/zykor-logo-white.png';
    };

    const faviconPath = getFaviconPath(barName);
    const appleTouchPath = barName
      ? `/favicons/${barName.toLowerCase().replace(/[^a-z]/g, '')}/apple-touch-icon.png`
      : '/favicons/zykor/apple-touch-icon.png';

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

  // Função para alterar o bar selecionado
  const handleSetSelectedBar = (bar: Bar) => {
    const previousBarId = selectedBar?.id;
    setSelectedBar(bar);
    // Salvar no localStorage apenas se estamos no cliente
    if (typeof window !== 'undefined') {
      localStorage.setItem('sgb_selected_bar_id', bar.id.toString());
      // Salvar no cookie para acesso server-side
      setBarCookie(bar.id);
      
      // Atualizar favicon baseado no bar selecionado
      updateFavicon(bar.nome);
      
      // Sincronizar permissões do bar selecionado
      syncBarPermissions(bar);
      
      // Se o bar mudou, recarregar a página para atualizar os dados
      if (previousBarId !== undefined && previousBarId !== bar.id) {
        // Disparar evento customizado para notificar componentes
        window.dispatchEvent(new CustomEvent('barChanged', { 
          detail: { previousBarId, newBarId: bar.id, barName: bar.nome } 
        }));
        
        // Recarregar a página para garantir que todos os dados sejam atualizados
        window.location.reload();
      }
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
