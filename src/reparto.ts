// Módulo de reparto: las cuentas del Grupo, puras, sin DOM ni almacenamiento.
// Todos los importes van en céntimos enteros.

import type { Gasto, Grupo } from './grupos';

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

/**
 * El Saldo de cada Participante, en el orden del Grupo: lo que pagó menos la suma de sus partes.
 * Positivo si le deben, negativo si debe. La suma de todos es siempre cero.
 */
export function saldosDeGrupo(grupo: Pick<Grupo, 'participantes' | 'gastos'>): Map<string, number> {
  const orden = grupo.participantes.map((p) => p.id);
  const saldos = new Map(orden.map((id) => [id, 0]));
  for (const gasto of grupo.gastos) {
    saldos.set(gasto.pagadorId, saldos.get(gasto.pagadorId)! + gasto.importe);
    for (const [id, parte] of partesDeGasto(gasto, orden)) saldos.set(id, saldos.get(id)! - parte);
  }
  return saldos;
}

export interface Transferencia {
  deId: string;
  aId: string;
  /** Céntimos enteros, siempre positivo. */
  importe: number;
}

/**
 * Las transferencias que dejan todos los Saldos a cero. Voraz: en cada paso quien más debe
 * paga a quien más tiene que recibir el mínimo de ambas cantidades. Como mucho N−1
 * transferencias (N = Participantes con Saldo distinto de cero); no busca el mínimo exacto.
 * Los empates los gana el primero según el orden del Grupo.
 */
export function liquidacionDeGrupo(grupo: Pick<Grupo, 'participantes' | 'gastos'>): Transferencia[] {
  // `restante` es lo que le queda por pagar o por recibir; `posicion`, su lugar en el orden del Grupo.
  const pendientes = [...saldosDeGrupo(grupo)].map(([id, saldo], posicion) => ({ id, saldo, restante: Math.abs(saldo), posicion }));
  type Pendiente = (typeof pendientes)[number];
  const deMayorAMenor = (a: Pendiente, b: Pendiente) => b.restante - a.restante || a.posicion - b.posicion;
  const deudores = pendientes.filter((p) => p.saldo < 0);
  const acreedores = pendientes.filter((p) => p.saldo > 0);
  const transferencias: Transferencia[] = [];
  while (deudores.length && acreedores.length) {
    deudores.sort(deMayorAMenor);
    acreedores.sort(deMayorAMenor);
    const [deudor, acreedor] = [deudores[0], acreedores[0]];
    const importe = Math.min(deudor.restante, acreedor.restante);
    transferencias.push({ deId: deudor.id, aId: acreedor.id, importe });
    deudor.restante -= importe;
    acreedor.restante -= importe;
    if (!deudor.restante) deudores.shift();
    if (!acreedor.restante) acreedores.shift();
  }
  return transferencias;
}
