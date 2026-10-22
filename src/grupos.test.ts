import { describe, expect, it } from 'vitest';
import {
  anadirParticipante,
  borrarParticipante,
  crearGrupo,
  documentoVacio,
  renombrarParticipante,
  sePuedeBorrarParticipante,
  type Documento,
  type Gasto,
} from './grupos';

// Documento con dos Grupos vacíos: g1 (Viaje a Lisboa) y g2 (Cena del sábado).
function documentoConDosGrupos(): Documento {
  const primero = crearGrupo(documentoVacio(), { nombre: 'Viaje a Lisboa', moneda: 'EUR' }, { id: 'g1', ahora: 1 });
  if (!primero.ok) throw new Error('no se creó g1');
  const segundo = crearGrupo(primero.documento, { nombre: 'Cena del sábado', moneda: 'EUR' }, { id: 'g2', ahora: 2 });
  if (!segundo.ok) throw new Error('no se creó g2');
  return segundo.documento;
}

function conParticipantes(documento: Documento, grupoId: string, nombres: [id: string, nombre: string][]): Documento {
  return nombres.reduce((doc, [id, nombre]) => {
    const resultado = anadirParticipante(doc, grupoId, { nombre }, { id });
    if (!resultado.ok) throw new Error(`no se añadió ${nombre}`);
    return resultado.documento;
  }, documento);
}

// Los Gastos aún no tienen operaciones propias: se colocan directamente en el Grupo.
function conGasto(documento: Documento, grupoId: string, gasto: Gasto): Documento {
  return { ...documento, grupos: documento.grupos.map((g) => (g.id === grupoId ? { ...g, gastos: [...g.gastos, gasto] } : g)) };
}

const grupo = (documento: Documento, id: string) => documento.grupos.find((g) => g.id === id)!;

describe('documentoVacio', () => {
  it('empieza en la versión 1, sin Grupos y sin último Grupo abierto', () => {
    expect(documentoVacio()).toEqual({ version: 1, grupos: [], ultimoGrupoAbiertoId: null });
  });
});

describe('crearGrupo', () => {
  it('añade un Grupo con su nombre y moneda, sin Participantes ni Gastos', () => {
    const resultado = crearGrupo(documentoVacio(), { nombre: 'Viaje a Lisboa', moneda: 'EUR' }, { id: 'g1', ahora: 1000 });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const grupo = { id: 'g1', nombre: 'Viaje a Lisboa', moneda: 'EUR', ultimaApertura: 1000, participantes: [], gastos: [] };
    expect(resultado.grupo).toEqual(grupo);
    expect(resultado.documento.grupos).toEqual([grupo]);
  });

  it('quita los espacios de los extremos del nombre', () => {
    const resultado = crearGrupo(documentoVacio(), { nombre: '  Cena del sábado ', moneda: 'EUR' }, { id: 'g1', ahora: 1 });

    expect(resultado.ok && resultado.grupo.nombre).toBe('Cena del sábado');
  });

  it('permite llevar varios Grupos independientes', () => {
    const primero = crearGrupo(documentoVacio(), { nombre: 'Viaje a Lisboa', moneda: 'EUR' }, { id: 'g1', ahora: 1 });
    if (!primero.ok) throw new Error('no se creó el primer Grupo');
    const segundo = crearGrupo(primero.documento, { nombre: 'Piso en Londres', moneda: 'GBP' }, { id: 'g2', ahora: 2 });

    expect(segundo.ok && segundo.documento.grupos.map((g) => [g.nombre, g.moneda])).toEqual([
      ['Viaje a Lisboa', 'EUR'],
      ['Piso en Londres', 'GBP'],
    ]);
  });

  it('no cambia el documento original', () => {
    const documento = documentoVacio();
    crearGrupo(documento, { nombre: 'Viaje a Lisboa', moneda: 'EUR' }, { id: 'g1', ahora: 1 });

    expect(documento).toEqual(documentoVacio());
  });

  it.each(['', '   '])('rechaza un nombre vacío (%j)', (nombre) => {
    const documento = documentoVacio();
    const resultado = crearGrupo(documento, { nombre, moneda: 'EUR' }, { id: 'g1', ahora: 1 });

    expect(resultado).toEqual({ ok: false, error: 'nombre-vacio' });
    expect(documento.grupos).toEqual([]);
  });
});

describe('anadirParticipante', () => {
  it('añade el Participante al final del Grupo, en orden de alta', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana'], ['b', 'Bruno']]);
    const resultado = anadirParticipante(documento, 'g1', { nombre: 'Carla' }, { id: 'c' });

    expect(resultado.ok && resultado.participante).toEqual({ id: 'c', nombre: 'Carla' });
    expect(resultado.ok && grupo(resultado.documento, 'g1').participantes).toEqual([
      { id: 'a', nombre: 'Ana' },
      { id: 'b', nombre: 'Bruno' },
      { id: 'c', nombre: 'Carla' },
    ]);
  });

  it('quita los espacios de los extremos del nombre', () => {
    const resultado = anadirParticipante(documentoConDosGrupos(), 'g1', { nombre: '  Ana ' }, { id: 'a' });

    expect(resultado.ok && resultado.participante.nombre).toBe('Ana');
  });

  it('no añade el Participante a otros Grupos', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana']]);

    expect(grupo(documento, 'g2').participantes).toEqual([]);
  });

  it('no cambia el documento original', () => {
    const documento = documentoConDosGrupos();
    anadirParticipante(documento, 'g1', { nombre: 'Ana' }, { id: 'a' });

    expect(documento).toEqual(documentoConDosGrupos());
  });

  it.each(['', '   '])('rechaza un nombre vacío (%j)', (nombre) => {
    expect(anadirParticipante(documentoConDosGrupos(), 'g1', { nombre }, { id: 'a' })).toEqual({ ok: false, error: 'nombre-vacio' });
  });

  it('rechaza un Grupo que no existe', () => {
    expect(anadirParticipante(documentoConDosGrupos(), 'g9', { nombre: 'Ana' }, { id: 'a' })).toEqual({
      ok: false,
      error: 'no-encontrado',
    });
  });
});

describe('renombrarParticipante', () => {
  it('cambia el nombre sin moverlo de su sitio', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana'], ['b', 'Bruno']]);
    const resultado = renombrarParticipante(documento, 'g1', 'a', ' Anita ');

    expect(resultado.ok && grupo(resultado.documento, 'g1').participantes).toEqual([
      { id: 'a', nombre: 'Anita' },
      { id: 'b', nombre: 'Bruno' },
    ]);
  });

  it('se puede renombrar a un Participante que aparece en algún Gasto', () => {
    const documento = conGasto(conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana']]), 'g1', {
      id: 'x1', concepto: 'Cena', importe: 1000, pagadorId: 'a', entre: ['a'],
    });

    expect(renombrarParticipante(documento, 'g1', 'a', 'Anita').ok).toBe(true);
  });

  it('no cambia el documento original', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana']]);
    const copia = structuredClone(documento);
    renombrarParticipante(documento, 'g1', 'a', 'Anita');

    expect(documento).toEqual(copia);
  });

  it('rechaza un nombre vacío', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana']]);

    expect(renombrarParticipante(documento, 'g1', 'a', '  ')).toEqual({ ok: false, error: 'nombre-vacio' });
  });

  it('rechaza un Participante de otro Grupo', () => {
    const documento = conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana']]);

    expect(renombrarParticipante(documento, 'g2', 'a', 'Anita')).toEqual({ ok: false, error: 'no-encontrado' });
  });
});

describe('borrarParticipante', () => {
  const documentoConGasto = () =>
    conGasto(conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana'], ['b', 'Bruno'], ['c', 'Carla'], ['d', 'David']]), 'g1', {
      id: 'x1', concepto: 'Vino', importe: 1200, pagadorId: 'a', entre: ['b', 'c'],
    });

  it('quita a un Participante que no aparece en ningún Gasto', () => {
    const resultado = borrarParticipante(documentoConGasto(), 'g1', 'd');

    expect(resultado.ok && grupo(resultado.documento, 'g1').participantes.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it.each([
    ['pagador', 'a'],
    ['marcado', 'b'],
  ])('no borra a un Participante que es %s de algún Gasto', (_papel, id) => {
    const documento = documentoConGasto();

    expect(borrarParticipante(documento, 'g1', id)).toEqual({ ok: false, error: 'participante-en-gastos' });
    expect(grupo(documento, 'g1').participantes).toHaveLength(4);
  });

  it('no cambia el documento original', () => {
    const documento = documentoConGasto();
    borrarParticipante(documento, 'g1', 'd');

    expect(documento).toEqual(documentoConGasto());
  });

  it('rechaza un Participante que no existe', () => {
    expect(borrarParticipante(documentoConGasto(), 'g1', 'z')).toEqual({ ok: false, error: 'no-encontrado' });
  });
});

describe('sePuedeBorrarParticipante', () => {
  const grupoConGasto = () =>
    grupo(
      conGasto(conParticipantes(documentoConDosGrupos(), 'g1', [['a', 'Ana'], ['b', 'Bruno'], ['c', 'Carla']]), 'g1', {
        id: 'x1', concepto: 'Regalo', importe: 3000, pagadorId: 'a', entre: ['b'],
      }),
      'g1',
    );

  it('no se puede borrar a quien pagó un Gasto', () => {
    expect(sePuedeBorrarParticipante(grupoConGasto(), 'a')).toBe(false);
  });

  it('no se puede borrar a quien está marcado en un Gasto', () => {
    expect(sePuedeBorrarParticipante(grupoConGasto(), 'b')).toBe(false);
  });

  it('se puede borrar a quien no aparece en ningún Gasto', () => {
    expect(sePuedeBorrarParticipante(grupoConGasto(), 'c')).toBe(true);
  });
});
