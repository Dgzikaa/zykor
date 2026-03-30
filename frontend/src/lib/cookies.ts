// Utilitários para gerenciamento de cookies de autenticação

export const AUTH_COOKIE_NAME = 'sgb_user';
export const BAR_COOKIE_NAME = 'sgb_bar_id';

export interface UserCookie {
  id: number;
  email: string;
  nome: string;
  role: string;
  bar_id: number;
  auth_id?: string;
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

// Cookie do Bar
export const setBarCookie = (barId: number) => {
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${BAR_COOKIE_NAME}=${barId}; expires=${expires.toUTCString()}; path=/; ${secure ? 'secure;' : ''} samesite=lax`;
  } catch (error) {
    console.error('Erro ao salvar cookie do bar:', error);
  }
};

export const getBarCookie = (): number | null => {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    const barCookie = cookies.find(cookie =>
      cookie.trim().startsWith(`${BAR_COOKIE_NAME}=`)
    );
    if (!barCookie) return null;
    const value = barCookie.split('=')[1];
    if (!value) return null;
    return parseInt(value);
  } catch (error) {
    return null;
  }
};

export const getAuthCookie = (): UserCookie | null => {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(cookie =>
      cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`)
    );
    if (!authCookie) return null;
    const value = authCookie.split('=').slice(1).join('=');
    if (!value) return null;
    return JSON.parse(decodeURIComponent(value.trim()));
  } catch (error) {
    return null;
  }
};

export const clearAuthCookie = () => {
  try {
    const pastDate = 'Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `${AUTH_COOKIE_NAME}=; expires=${pastDate}; path=/`;
    document.cookie = `auth_token=; expires=${pastDate}; path=/`;
    document.cookie = `refresh_token=; expires=${pastDate}; path=/`;
    document.cookie = `${BAR_COOKIE_NAME}=; expires=${pastDate}; path=/`;
    localStorage.removeItem('sgb_user');
    localStorage.removeItem('sgb_session');
    localStorage.removeItem('sgb_selected_bar_id');
  } catch (error) {
    console.error('Erro ao limpar cookies:', error);
  }
};

/**
 * Sincronizar dados de autenticação após login.
 * NÃO seta o cookie sgb_user aqui — o servidor já seta via Set-Cookie header.
 * Apenas salva em localStorage para uso client-side rápido.
 */
export const syncAuthData = (userData: any, session?: any) => {
  try {
    localStorage.setItem('sgb_user', JSON.stringify(userData));
    if (session) {
      localStorage.setItem('sgb_session', JSON.stringify(session));
    }
    // Salvar bar_id selecionado para uso no header x-selected-bar-id
    // IMPORTANTE: Só setar se NÃO existir um valor já salvo (para não sobrescrever seleção do usuário)
    const existingBarId = localStorage.getItem('sgb_selected_bar_id');
    if (userData.bar_id && !existingBarId) {
      localStorage.setItem('sgb_selected_bar_id', String(userData.bar_id));
      setBarCookie(userData.bar_id);
    }
    // NÃO setar sgb_user cookie aqui — o servidor já setou via Set-Cookie
    // Setar client-side sobrescreve o cookie do servidor com sameSite diferente
  } catch (error) {
    console.error('Erro ao sincronizar dados de autenticação:', error);
  }
};

// Re-exportar setAuthCookie para compatibilidade, mas idealmente não usar
export const setAuthCookie = (userData: UserCookie) => {
  try {
    const value = JSON.stringify(userData);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; ${secure ? 'secure;' : ''} samesite=lax`;
  } catch (error) {
    console.error('Erro ao salvar cookie de autenticação:', error);
  }
};
