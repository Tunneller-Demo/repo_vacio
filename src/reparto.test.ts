import { describe, expect, it } from 'vitest';
import type { Gasto } from './grupos';
import { partesDeGasto } from './reparto';

const ORDEN = ['ana', 'bruno', 'carla', 'dani'];

function gasto(importe: number, entre: string[], pagadorId = 'ana'): Gasto {
  return { id: 'x1', concepto: 'Cena', importe, pagadorId, entre };
}

const suma = (partes: Map<string, number>) => [...partes.values()].reduce((s, v) => s + v, 0);

describe('partesDeGasto', () => {
  it('reparte a partes iguales cuando el importe es exacto', () => {
    const partes = partesDeGasto(gasto(9000, ['ana', 'bruno', 'carla']), ORDEN);

    expect([...partes]).toEqual([
      ['ana', 3000],
      ['bruno', 3000],
      ['carla', 3000],
    ]);
  });

  it('da los céntimos sobrantes, uno a uno, a los primeros según el orden del Grupo', () => {
    const partes = partesDeGasto(gasto(1000, ['ana', 'bruno', 'carla']), ORDEN);

    expect([...partes]).toEqual([
      ['ana', 334],
      ['bruno', 333],
      ['carla', 333],
    ]);
  });

  it('usa el orden del Grupo aunque se marcaran en otro orden', () => {
    const partes = partesDeGasto(gasto(1001, ['dani', 'carla', 'bruno']), ORDEN);

    expect([...partes]).toEqual([
      ['bruno', 334],
      ['carla', 334],
      ['dani', 333],
    ]);
  });

  it('no da parte a quien paga si no está marcado', () => {
    const partes = partesDeGasto(gasto(5000, ['bruno', 'carla'], 'ana'), ORDEN);

    expect(partes.has('ana')).toBe(false);
    expect([...partes]).toEqual([
      ['bruno', 2500],
      ['carla', 2500],
    ]);
  });

  it('con un solo marcado le toca el importe entero', () => {
    expect([...partesDeGasto(gasto(3333, ['carla']), ORDEN)]).toEqual([['carla', 3333]]);
  });

  it('la suma de las partes es siempre el importe', () => {
    for (let importe = 1; importe <= 500; importe += 7) {
      for (let n = 1; n <= ORDEN.length; n++) {
        expect(suma(partesDeGasto(gasto(importe, ORDEN.slice(0, n).reverse()), ORDEN))).toBe(importe);
      }
    }
  });
});
