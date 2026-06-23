/**
 * Registro de ícones do menu: nome (string usada em `menu.ts`) -> componente lucide.
 *
 * A fonte única (`menu.ts`) guarda o ícone como string (dados puros). Quem renderiza
 * (MinimalSidebar, BottomNavigation) usa `iconFor(name)` para obter o componente.
 * Centralizado aqui pra não duplicar o mapa em cada componente.
 */
import type { ComponentType } from 'react';
import {
  Target,
  BarChart3,
  Wrench,
  Sparkles,
  Settings,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  Zap,
  Wallet,
  Receipt,
  ReceiptText,
  MessageCircle,
  ChefHat,
  Tag,
  AlertTriangle,
  FileSearch,
  Star,
  Instagram,
  Bot,
  PieChart,
  Package,
  Layers,
  Megaphone,
  Ticket,
  Clock,
  FileText,
  CheckSquare,
  Activity,
  Store,
  Briefcase,
  ClipboardList,
  Server,
  ShoppingCart,
  Boxes,
} from 'lucide-react';

export type MenuIcon = ComponentType<{ className?: string }>;

export const MENU_ICONS: Record<string, MenuIcon> = {
  Target,
  BarChart3,
  Wrench,
  Sparkles,
  Settings,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  Zap,
  Wallet,
  Receipt,
  ReceiptText,
  MessageCircle,
  ChefHat,
  Tag,
  AlertTriangle,
  FileSearch,
  Star,
  Instagram,
  Bot,
  PieChart,
  Package,
  Layers,
  Megaphone,
  Ticket,
  Clock,
  FileText,
  CheckSquare,
  Activity,
  Store,
  Briefcase,
  ClipboardList,
  Server,
  ShoppingCart,
  Boxes,
};

/** Componente do ícone pelo nome; fallback em Activity se faltar. */
export const iconFor = (name: string): MenuIcon => MENU_ICONS[name] ?? Activity;
