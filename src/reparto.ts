// Módulo de reparto: las cuentas del Grupo, puras, sin DOM ni almacenamiento.
// Todos los importes van en céntimos enteros.

import type { Gasto } from './grupos';

/**
 * Cuánto le toca a cada marcado de un Gasto, en el orden del Grupo.
 * A partes iguales; los céntimos sobrantes van, uno a uno, a los primeros marcados
 * según el orden del Grupo. La suma de las partes es siempre el importe.
 */
export function partesDeGasto(gasto: Pick<Gasto, 'importe' | 'entre'>, ordenDelGrupo: string[]): Map<string, number> {
  const marcados = ordenDelGrupo.filter((id) => gasto.entre.includes(id));
  const base = Math.floor(gasto.importe / marcados.length);
  const sobrantes = gasto.importe % marcados.length;
  return new Map(marcados.map((id, i) => [id, base + (i < sobrantes ? 1 : 0)]));
}
