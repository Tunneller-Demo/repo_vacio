import { describe, expect, it } from 'vitest';
import { anadirGasto, anadirParticipante, crearGrupo, documentoVacio, type Documento } from './grupos';
import { CLAVE, crearGuardado, type Almacen } from './guardado';

// Almacén en memoria; con `fallaAlEscribir` simula la cuota llena o el almacenamiento bloqueado.
function almacenEnMemoria(inicial: Record<string, string> = {}, fallaAlEscribir = false) {
  const datos = new Map(Object.entries(inicial));
  const almacen: Almacen = {
    leer: (clave) => datos.get(clave) ?? null,
    escribir: (clave, texto) => {
      if (fallaAlEscribir) throw new DOMException('cuota llena', 'QuotaExceededError');
      datos.set(clave, texto);
    },
  };
  return { almacen, datos };
}

const AHORA = new Date('2026-10-22T10:00:00.000Z');
const CLAVE_DANADOS = `${CLAVE}:dañado:${AHORA.toISOString()}`;

// Un Grupo con dos Participantes y un Gasto.
function documentoConGasto(): Documento {
  const grupo = crearGrupo(documentoVacio(), { nombre: 'Viaje a Lisboa', moneda: 'EUR' }, { id: 'g1', ahora: 1 });
  if (!grupo.ok) throw new Error('no se creó el Grupo');
  let documento = grupo.documento;
  for (const [id, nombre] of [['p1', 'Ana'], ['p2', 'Bruno']]) {
    const resultado = anadirParticipante(documento, 'g1', { nombre }, { id });
    if (!resultado.ok) throw new Error(`no se añadió ${nombre}`);
    documento = resultado.documento;
  }
  const gasto = anadirGasto(documento, 'g1', { concepto: 'Cena', importe: 6001, pagadorId: 'p1', entre: ['p1', 'p2'] }, { id: 'x1' });
  if (!gasto.ok) throw new Error('no se añadió el Gasto');
  return { ...gasto.documento, ultimoGrupoAbiertoId: 'g1' };
}

const GASTO = { id: 'x1', concepto: 'Cena', importe: 6001, pagadorId: 'p1', entre: ['p1'] };

// El texto guardado de `documentoConGasto` con campos del Grupo cambiados, válidos o no.
function conGrupoCambiado(cambios: Record<string, unknown>): string {
  const documento = documentoConGasto();
  return JSON.stringify({ ...documento, grupos: [{ ...documento.grupos[0], ...cambios }] });
}

describe('guardado', () => {
  it('sin nada guardado, la carga está vacía', () => {
    const { almacen } = almacenEnMemoria();
    expect(crearGuardado(almacen).cargar()).toEqual({ estado: 'vacio', documento: documentoVacio() });
  });

  it('guardar y cargar devuelve el mismo documento', () => {
    const { almacen, datos } = almacenEnMemoria();
    const documento = documentoConGasto();
    expect(crearGuardado(almacen).guardar(documento)).toEqual({ ok: true });
    expect(JSON.parse(datos.get(CLAVE)!)).toEqual(documento);
    expect(crearGuardado(almacen).cargar()).toEqual({ estado: 'cargado', documento });
  });

  it.each([
    ['JSON ilegible', '{"version": 1, "grup'],
    ['sin versión', JSON.stringify({ grupos: [], ultimoGrupoAbiertoId: null })],
    ['versión no entera', JSON.stringify({ version: 1.5, grupos: [], ultimoGrupoAbiertoId: null })],
    ['grupos que no son una lista', JSON.stringify({ version: 1, grupos: {}, ultimoGrupoAbiertoId: null })],
    ['importe con decimales', conGrupoCambiado({ gastos: [{ ...GASTO, importe: 60.01 }] })],
    ['importe como texto', conGrupoCambiado({ gastos: [{ ...GASTO, importe: '6001' }] })],
    ['Gasto sin marcados', conGrupoCambiado({ gastos: [{ ...GASTO, entre: [] }] })],
    ['Participante sin nombre', conGrupoCambiado({ participantes: [{ id: 'p1' }] })],
    ['último Grupo abierto no válido', JSON.stringify({ version: 1, grupos: [], ultimoGrupoAbiertoId: 7 })],
  ])('%s: copia el texto a la clave de dañados, deja la principal intacta y empieza vacío', (_caso, texto) => {
    const { almacen, datos } = almacenEnMemoria({ [CLAVE]: texto });
    const carga = crearGuardado(almacen, { ahora: () => AHORA }).cargar();
    expect(carga).toEqual({ estado: 'danado', documento: documentoVacio(), claveCopia: CLAVE_DANADOS });
    expect(datos.get(CLAVE_DANADOS)).toBe(texto);
    expect(datos.get(CLAVE)).toBe(texto);
  });

  it('con datos de una versión más nueva no carga nada y bloquea el guardado', () => {
    const texto = JSON.stringify({ version: 2, grupos: 'forma desconocida' });
    const { almacen, datos } = almacenEnMemoria({ [CLAVE]: texto });
    const guardado = crearGuardado(almacen);
    expect(guardado.cargar()).toEqual({ estado: 'version-mas-nueva', documento: documentoVacio() });
    expect(guardado.guardar(documentoConGasto())).toEqual({ ok: false, error: 'bloqueado' });
    expect([...datos]).toEqual([[CLAVE, texto]]);
  });

  it('si escribir falla, devuelve el error', () => {
    const { almacen } = almacenEnMemoria({}, true);
    expect(crearGuardado(almacen).guardar(documentoConGasto())).toEqual({ ok: false, error: 'fallo-escritura' });
  });

  it('si leer falla (almacenamiento bloqueado), la carga está vacía', () => {
    const almacen: Almacen = {
      leer: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
      escribir: () => {},
    };
    expect(crearGuardado(almacen).cargar()).toEqual({ estado: 'vacio', documento: documentoVacio() });
  });

  describe('migraciones', () => {
    // Versión 3 de mentira: la 1 se llamaba `listaGrupos`, la 2 no tenía `ultimoGrupoAbiertoId`.
    const opciones = {
      version: 3,
      migraciones: {
        1: (d: any) => ({ version: 2, grupos: d.listaGrupos }),
        2: (d: any) => ({ ...d, version: 3, ultimoGrupoAbiertoId: null }),
      },
    };

    it('aplica la cadena 1→2→3 y guarda el documento ya migrado', () => {
      const { grupos } = documentoConGasto();
      const { almacen, datos } = almacenEnMemoria({ [CLAVE]: JSON.stringify({ version: 1, listaGrupos: grupos }) });
      const esperado = { version: 3, grupos, ultimoGrupoAbiertoId: null };
      expect(crearGuardado(almacen, opciones).cargar()).toEqual({ estado: 'cargado', documento: esperado });
      expect(JSON.parse(datos.get(CLAVE)!)).toEqual(esperado);
    });

    it('si se migró pero no se pudo guardar, lo carga y devuelve el error', () => {
      const { almacen } = almacenEnMemoria({ [CLAVE]: JSON.stringify({ version: 2, grupos: [] }) }, true);
      expect(crearGuardado(almacen, opciones).cargar()).toEqual({
        estado: 'cargado',
        documento: { version: 3, grupos: [], ultimoGrupoAbiertoId: null },
        errorGuardado: 'fallo-escritura',
      });
    });

    it('sin nada que migrar no escribe', () => {
      const texto = JSON.stringify({ version: 3, grupos: [], ultimoGrupoAbiertoId: null });
      const { almacen } = almacenEnMemoria({ [CLAVE]: texto }, true);
      expect(crearGuardado(almacen, opciones).cargar()).toEqual({
        estado: 'cargado',
        documento: { version: 3, grupos: [], ultimoGrupoAbiertoId: null },
      });
    });

    it('si una migración falla, los datos se tratan como dañados', () => {
      const texto = JSON.stringify({ version: 1 });
      const { almacen, datos } = almacenEnMemoria({ [CLAVE]: texto });
      const carga = crearGuardado(almacen, { ...opciones, ahora: () => AHORA }).cargar();
      expect(carga.estado).toBe('danado');
      expect(datos.get(CLAVE_DANADOS)).toBe(texto);
    });
  });
});
