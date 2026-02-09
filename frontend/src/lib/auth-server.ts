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
 * Retrieves the selected bar ID from cookies in Server Components
 */
export async function getBarIdServer(): Promise<number | null> {
  const cookieStore = await cookies();
  const barIdCookie = cookieStore.get('sgb_bar_id');

  if (!barIdCookie) {
    return null;
  }

  const barId = parseInt(barIdCookie.value);
  return isNaN(barId) ? null : barId;
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
