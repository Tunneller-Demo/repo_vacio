import { describe, expect, it } from 'vitest';
import { crearGrupo, documentoVacio } from './grupos';

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
