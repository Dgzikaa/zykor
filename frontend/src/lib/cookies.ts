// Utilitários para gerenciamento de cookies de autenticação

export const AUTH_COOKIE_NAME = 'sgb_user';
export const BAR_COOKIE_NAME = 'sgb_bar_id';

export interface UserCookie {
  id: number;
  email: string;
  nome: string;
  role: string;
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

interface UserData {
  id: number;
  email: string;
  nome: string;
  role: string;
  modulos_permitidos?: string[] | Record<string, any>;
  ativo?: boolean;
}

// Cookie do Bar
export const setBarCookie = (barId: number) => {
  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + 30); // 30 dias
    document.cookie = `${BAR_COOKIE_NAME}=${barId}; expires=${expires.toUTCString()}; path=/; secure=${window.location.protocol === 'https:'}; samesite=strict`;
  } catch (error) {
    console.error('❌ Erro ao salvar cookie do bar:', error);
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
    console.error('❌ Erro ao ler cookie do bar:', error);
    return null;
  }
};

// Autenticação
export const setAuthCookie = (userData: UserCookie) => {
  try {
    const cookieData: UserCookie = {
      id: userData.id,
      email: userData.email,
      nome: userData.nome,
      role: userData.role,
      modulos_permitidos: userData.modulos_permitidos || [],
      ativo: userData.ativo !== false,
    };

    const value = JSON.stringify(cookieData);
    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // 7 dias

    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; secure=${window.location.protocol === 'https:'}; samesite=strict`;
  } catch (error) {
    console.error('❌ Erro ao salvar cookie de autenticação:', error);
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

    const value = authCookie.split('=')[1];
    if (!value) return null;

    const userData = JSON.parse(decodeURIComponent(value));
    return userData;
  } catch (error) {
    console.error('❌ Erro ao ler cookie de autenticação:', error);
    return null;
  }
};

export const clearAuthCookie = () => {
  try {
    const pastDate = 'Thu, 01 Jan 1970 00:00:00 UTC';
    document.cookie = `${AUTH_COOKIE_NAME}=; expires=${pastDate}; path=/; domain=${window.location.hostname}`;
    document.cookie = `${AUTH_COOKIE_NAME}=; expires=${pastDate}; path=/`;
    document.cookie = `${AUTH_COOKIE_NAME}=; expires=${pastDate}; path=/; domain=.${window.location.hostname}`;
    document.cookie = `${AUTH_COOKIE_NAME}=; max-age=0; path=/`;
    document.cookie = `${AUTH_COOKIE_NAME}=; max-age=0; path=/; domain=${window.location.hostname}`;
    localStorage.removeItem('sgb_session');
    console.log('✅ Cookie de autenticação removido');
  } catch (error) {
    console.error('❌ Erro ao limpar cookie de autenticação:', error);
  }
};

export const syncAuthData = (userData: UserData, session?: any) => {
  try {
    localStorage.setItem('sgb_user', JSON.stringify(userData));
    if (session) {
      localStorage.setItem('sgb_session', JSON.stringify(session));
    }
    const cookieData: UserCookie = {
      id: userData.id,
      email: userData.email,
      nome: userData.nome,
      role: userData.role,
      modulos_permitidos: userData.modulos_permitidos || [],
      ativo: userData.ativo !== false,
    };
    setAuthCookie(cookieData);
  } catch (error) {
    console.error('❌ Erro ao sincronizar dados de autenticação:', error);
  }
};
