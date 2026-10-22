// Módulo de datos del Grupo: operaciones puras sobre el documento en memoria.
// Ninguna operación muta el documento que recibe; todas devuelven uno nuevo.

export interface Participante {
  id: string;
  nombre: string;
}

export interface Gasto {
  id: string;
  concepto: string;
  /** Importe en céntimos enteros. */
  importe: number;
  pagadorId: string;
  /** Participantes entre los que se reparte el Gasto, a partes iguales. */
  entre: string[];
}

export interface Grupo {
  id: string;
  nombre: string;
  /** Código de moneda ISO 4217, por ejemplo `EUR`. */
  moneda: string;
  /** Marca de tiempo (ms) de la última vez que se abrió. */
  ultimaApertura: number;
  /** En orden de alta: es el orden del Grupo. */
  participantes: Participante[];
  gastos: Gasto[];
}

export interface Documento {
  version: 1;
  grupos: Grupo[];
  ultimoGrupoAbiertoId: string | null;
}

export type ErrorGrupo = 'nombre-vacio';

export type ResultadoCrearGrupo =
  | { ok: true; documento: Documento; grupo: Grupo }
  | { ok: false; error: ErrorGrupo };

export function documentoVacio(): Documento {
  return { version: 1, grupos: [], ultimoGrupoAbiertoId: null };
}

export function crearGrupo(
  documento: Documento,
  datos: { nombre: string; moneda: string },
  contexto: { id: string; ahora: number },
): ResultadoCrearGrupo {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: 'nombre-vacio' };

  const grupo: Grupo = {
    id: contexto.id,
    nombre,
    moneda: datos.moneda,
    ultimaApertura: contexto.ahora,
    participantes: [],
    gastos: [],
  };
  return { ok: true, documento: { ...documento, grupos: [...documento.grupos, grupo] }, grupo };
}
