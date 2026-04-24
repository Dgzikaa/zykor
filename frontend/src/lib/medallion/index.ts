/**
 * Entry point da lib medallion.
 *
 * Preferir imports nomeados pra deixar óbvio qual camada está sendo consumida:
 *   ✅ import { gold } from '@/lib/medallion/gold'
 *   ❌ import { gold } from '@/lib/medallion'
 *
 * Este barrel existe só pra casos onde múltiplas camadas são usadas.
 */
export { bronze, bronzePublic } from './bronze';
export { silver, silverPublic, operations } from './silver';
export { gold, analytics } from './gold';
