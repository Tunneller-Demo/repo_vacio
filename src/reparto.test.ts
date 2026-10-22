import { describe, expect, it } from 'vitest';
import type { Gasto, Grupo } from './grupos';
import { liquidacionDeGrupo, partesDeGasto, saldosDeGrupo, type Transferencia } from './reparto';

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

type Datos = Pick<Grupo, 'participantes' | 'gastos'>;

function grupo(gastos: Gasto[], ids = ORDEN): Datos {
  return { participantes: ids.map((id) => ({ id, nombre: id })), gastos };
}

let contador = 0;
function g(importe: number, pagadorId: string, entre: string[]): Gasto {
  return { id: `g${++contador}`, concepto: 'Gasto', importe, pagadorId, entre };
}

const sumaSaldos = (saldos: Map<string, number>) => [...saldos.values()].reduce((s, v) => s + v, 0);

// Aplica las transferencias sobre los Saldos: quien paga sube, quien recibe baja.
function aplicar(datos: Datos, transferencias: Transferencia[]): Map<string, number> {
  const saldos = saldosDeGrupo(datos);
  for (const t of transferencias) {
    saldos.set(t.deId, saldos.get(t.deId)! + t.importe);
    saldos.set(t.aId, saldos.get(t.aId)! - t.importe);
  }
  return saldos;
}

describe('saldosDeGrupo', () => {
  it('es lo pagado menos la suma de las partes, en el orden del Grupo', () => {
    const saldos = saldosDeGrupo(grupo([g(9000, 'ana', ['ana', 'bruno', 'carla'])]));

    expect([...saldos]).toEqual([
      ['ana', 6000],
      ['bruno', -3000],
      ['carla', -3000],
      ['dani', 0],
    ]);
  });

  it('combina varios Gastos', () => {
    const saldos = saldosDeGrupo(
      grupo([g(9000, 'ana', ['ana', 'bruno', 'carla']), g(4000, 'bruno', ORDEN), g(1000, 'dani', ['ana', 'bruno', 'carla'])]),
    );

    expect([...saldos]).toEqual([
      ['ana', 6000 - 1000 - 334],
      ['bruno', -3000 + 3000 - 333],
      ['carla', -3000 - 1000 - 333],
      ['dani', -1000 + 1000],
    ]);
  });

  it('el «plato caro» partido en dos Gastos da los mismos Saldos que su reparto', () => {
    // Cena de 90 € pagada por Ana: 60 € entre todos más la mariscada de Bruno, 30 € solo para él.
    const partido = saldosDeGrupo(grupo([g(6000, 'ana', ORDEN), g(3000, 'ana', ['bruno'])]));

    expect([...partido]).toEqual([
      ['ana', 9000 - 1500],
      ['bruno', -1500 - 3000],
      ['carla', -1500],
      ['dani', -1500],
    ]);
  });

  it('suman siempre cero', () => {
    for (let importe = 1; importe <= 400; importe += 13) {
      const gastos = [g(importe, 'ana', ['bruno', 'carla', 'dani']), g(importe * 3 + 1, 'carla', ORDEN), g(importe + 2, 'dani', ['ana', 'dani'])];
      expect(sumaSaldos(saldosDeGrupo(grupo(gastos)))).toBe(0);
    }
  });

  it('sin Gastos todos están a cero', () => {
    expect([...saldosDeGrupo(grupo([])).values()]).toEqual([0, 0, 0, 0]);
  });
});

describe('liquidacionDeGrupo', () => {
  it('quien más debe paga a quien más tiene que recibir', () => {
    const datos = grupo([g(9000, 'ana', ['ana', 'bruno', 'carla']), g(2000, 'dani', ['bruno', 'dani'])]);
    // Saldos: ana +6000, bruno −4000, carla −3000, dani +1000.

    expect(liquidacionDeGrupo(datos)).toEqual([
      { deId: 'bruno', aId: 'ana', importe: 4000 },
      { deId: 'carla', aId: 'ana', importe: 2000 },
      { deId: 'carla', aId: 'dani', importe: 1000 },
    ]);
  });

  it('aplicarla deja todos los Saldos a cero al céntimo, con como mucho N−1 transferencias', () => {
    for (let importe = 1; importe <= 400; importe += 11) {
      const datos = grupo([g(importe, 'ana', ['bruno', 'carla', 'dani']), g(importe * 7 + 3, 'carla', ORDEN), g(importe + 5, 'dani', ['ana', 'dani'])]);
      const conSaldo = [...saldosDeGrupo(datos).values()].filter((v) => v !== 0).length;
      const transferencias = liquidacionDeGrupo(datos);

      expect([...aplicar(datos, transferencias).values()].every((v) => v === 0)).toBe(true);
      expect(transferencias.length).toBeLessThanOrEqual(Math.max(0, conSaldo - 1));
      expect(transferencias.every((t) => t.importe > 0)).toBe(true);
    }
  });

  it('un Grupo en paz no necesita transferencias', () => {
    expect(liquidacionDeGrupo(grupo([]))).toEqual([]);
    expect(liquidacionDeGrupo(grupo([g(2000, 'ana', ['ana', 'bruno']), g(1000, 'bruno', ['ana'])]))).toEqual([]);
  });

  it('resuelve los empates por el orden del Grupo', () => {
    // dani y carla deben lo mismo; bruno y ana tienen que recibir lo mismo.
    const gastos = [g(2000, 'bruno', ['dani']), g(2000, 'ana', ['carla'])];

    expect(liquidacionDeGrupo(grupo(gastos))).toEqual([
      { deId: 'carla', aId: 'ana', importe: 2000 },
      { deId: 'dani', aId: 'bruno', importe: 2000 },
    ]);
    expect(liquidacionDeGrupo(grupo(gastos, ['bruno', 'dani', 'ana', 'carla']))).toEqual([
      { deId: 'dani', aId: 'bruno', importe: 2000 },
      { deId: 'carla', aId: 'ana', importe: 2000 },
    ]);
  });
});
