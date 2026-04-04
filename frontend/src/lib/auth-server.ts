import { cookies } from 'next/headers';

export interface User {
  id: number;
  email: string;
  nome: string;
  role: 'admin' | 'manager' | 'funcionario';
  modulos_permitidos: string[] | Record<string, any>;
  ativo: boolean;
}

/**
 * Retrieves the authenticated user from cookies in Server Components
 * @returns User object or null if not authenticated
 */
export async function getServerUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const userDataCookie = cookieStore.get('userData');

  if (!userDataCookie) {
    return null;
  }

  try {
    const userData = JSON.parse(decodeURIComponent(userDataCookie.value));
    return userData as User;
  } catch (error) {
    console.error('Error parsing user data from cookie:', error);
    return null;
  }
}

/**
 * Checks if the current user has the 'admin' role
 */
export async function isServerAdmin(): Promise<boolean> {
  const user = await getServerUser();
  return user?.role === 'admin';
}

/**
 * Checks if the current user has permission for a specific module
 */
export async function hasServerPermission(moduleId: string): Promise<boolean> {
  const user = await getServerUser();
  if (!user) return false;

  if (user.role === 'admin') return true;

  // Check modulos_permitidos
  if (Array.isArray(user.modulos_permitidos)) {
    return user.modulos_permitidos.includes(moduleId) || user.modulos_permitidos.includes('todos');
  } else if (typeof user.modulos_permitidos === 'object') {
    return user.modulos_permitidos[moduleId] === true || user.modulos_permitidos['todos'] === true;
  }

  return false;
}

/**
 * Retrieves the selected bar ID from cookies in Server Components.
 * Falls back to the bar_id stored in sgb_user cookie (set at login)
 * so the page works even when sgb_bar_id hasn't been explicitly set yet.
 */
export async function getBarIdServer(): Promise<number | null> {
  const cookieStore = await cookies();

  // Primary: sgb_bar_id (bar explicitly selected by the user)
  const barIdCookie = cookieStore.get('sgb_bar_id');
  if (barIdCookie) {
    const barId = parseInt(barIdCookie.value);
    if (!isNaN(barId) && barId > 0) return barId;
  }

  // Fallback: bar_id embedded in sgb_user cookie (written server-side at login)
  // TODO(rodrigo/2026-05): Remover sgb_user quando migração estiver completa
  const userCookie = cookieStore.get('sgb_user');
  if (userCookie) {
    try {
      let raw = userCookie.value;
      try { raw = decodeURIComponent(raw); } catch { /* already decoded */ }
      const userData = JSON.parse(raw);
      if (userData?.bar_id && userData.bar_id > 0) {
        return userData.bar_id;
      }
    } catch {
      // Ignore parse errors — cookie may be malformed
    }
  }

  return null;
}

/**
 * Retrieves the selected bar name from cookies in Server Components
 */
export async function getBarNomeServer(): Promise<string | null> {
  const cookieStore = await cookies();
  const barNomeCookie = cookieStore.get('sgb_bar_nome');

  if (!barNomeCookie) {
    return null;
  }

  try {
    return decodeURIComponent(barNomeCookie.value);
  } catch {
    return barNomeCookie.value;
  }
}
