// Módulo de guardado: el documento entero, en JSON, bajo una sola clave del almacenamiento del navegador.
// El almacenamiento se inyecta para poder probarlo en memoria; en la app es `localStorage`.

import { documentoVacio, VERSION_DOCUMENTO, type Documento } from './grupos';

/** Lo mínimo que se necesita del almacenamiento. Escribir una clave que no existe la crea. */
export interface Almacen {
  leer(clave: string): string | null;
  escribir(clave: string, texto: string): void;
}

export const CLAVE = 'reparto-gastos';

/** Pasa un documento de la versión n a la n+1. Recibe y devuelve datos sin validar. */
export type Migracion = (documento: unknown) => unknown;

// Una por versión anterior a la actual: `MIGRACIONES[n]` pasa de la versión n a la n+1.
const MIGRACIONES: Record<number, Migracion> = {};

export type ErrorGuardado = 'bloqueado' | 'fallo-escritura';

export type ResultadoGuardar = { ok: true } | { ok: false; error: ErrorGuardado };

export type Carga =
  | { estado: 'vacio'; documento: Documento }
  /** `errorGuardado`: se migró, pero no se pudo guardar ya migrado. */
  | { estado: 'cargado'; documento: Documento; errorGuardado?: ErrorGuardado }
  /** El texto original se copió a `claveCopia`; la clave principal no se tocó. */
  | { estado: 'danado'; documento: Documento; claveCopia: string }
  /** Datos de una versión más nueva: no se cargan y el guardado queda bloqueado. */
  | { estado: 'version-mas-nueva'; documento: Documento };

export interface Guardado {
  cargar(): Carga;
  guardar(documento: Documento): ResultadoGuardar;
}

export function crearGuardado(
  almacen: Almacen,
  opciones: { ahora?: () => Date; version?: number; migraciones?: Record<number, Migracion> } = {},
): Guardado {
  const { ahora = () => new Date(), version = VERSION_DOCUMENTO, migraciones = MIGRACIONES } = opciones;
  let bloqueado = false;
  const vacio = (): Documento => ({ ...documentoVacio(), version });

  function guardar(documento: Documento): ResultadoGuardar {
    if (bloqueado) return { ok: false, error: 'bloqueado' };
    try {
      almacen.escribir(CLAVE, JSON.stringify(documento));
      return { ok: true };
    } catch {
      return { ok: false, error: 'fallo-escritura' };
    }
  }

  function danado(texto: string): Carga {
    const claveCopia = `${CLAVE}:dañado:${ahora().toISOString()}`;
    // Si ni la copia se puede escribir, la clave principal sigue intacta: no se pierde nada.
    try {
      almacen.escribir(claveCopia, texto);
    } catch {}
    return { estado: 'danado', documento: vacio(), claveCopia };
  }

  function cargar(): Carga {
    let texto: string | null;
    try {
      texto = almacen.leer(CLAVE);
    } catch {
      texto = null;
    }
    if (texto === null) return { estado: 'vacio', documento: vacio() };

    let datos: unknown;
    try {
      datos = JSON.parse(texto);
    } catch {
      return danado(texto);
    }
    const versionGuardada = esObjeto(datos) ? datos.version : undefined;
    if (!Number.isSafeInteger(versionGuardada) || (versionGuardada as number) < 1) return danado(texto);
    if ((versionGuardada as number) > version) {
      bloqueado = true;
      return { estado: 'version-mas-nueva', documento: vacio() };
    }

    for (let v = versionGuardada as number; v < version; v++) {
      try {
        datos = migraciones[v](datos);
      } catch {
        return danado(texto);
      }
    }
    if (!esDocumento(datos, version)) return danado(texto);
    if (versionGuardada === version) return { estado: 'cargado', documento: datos };

    const guardadoMigrado = guardar(datos);
    return guardadoMigrado.ok
      ? { estado: 'cargado', documento: datos }
      : { estado: 'cargado', documento: datos, errorGuardado: guardadoMigrado.error };
  }

  return { cargar, guardar };
}

// Validación estructural: el tipo de cada campo, los importes en céntimos enteros y positivos,
// y al menos un marcado por Gasto.
// No se comprueban las referencias cruzadas (pagadores y marcados que existan en el Grupo).

type Objeto = Record<string, unknown>;

const esObjeto = (x: unknown): x is Objeto => typeof x === 'object' && x !== null && !Array.isArray(x);
const esTexto = (x: unknown): x is string => typeof x === 'string';
const listaDe = (x: unknown, esValido: (y: unknown) => boolean) => Array.isArray(x) && x.every(esValido);

const esParticipante = (x: unknown) => esObjeto(x) && esTexto(x.id) && esTexto(x.nombre);

const esGasto = (x: unknown) =>
  esObjeto(x) &&
  esTexto(x.id) &&
  esTexto(x.concepto) &&
  Number.isSafeInteger(x.importe) &&
  (x.importe as number) > 0 &&
  esTexto(x.pagadorId) &&
  listaDe(x.entre, esTexto) &&
  (x.entre as unknown[]).length > 0;

const esGrupo = (x: unknown) =>
  esObjeto(x) &&
  esTexto(x.id) &&
  esTexto(x.nombre) &&
  esTexto(x.moneda) &&
  Number.isFinite(x.ultimaApertura) &&
  listaDe(x.participantes, esParticipante) &&
  listaDe(x.gastos, esGasto);

function esDocumento(x: unknown, version: number): x is Documento {
  return (
    esObjeto(x) &&
    x.version === version &&
    listaDe(x.grupos, esGrupo) &&
    (x.ultimoGrupoAbiertoId === null || esTexto(x.ultimoGrupoAbiertoId))
  );
}
