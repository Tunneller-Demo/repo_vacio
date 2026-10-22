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

export type ErrorGrupo = 'nombre-vacio' | 'no-encontrado' | 'participante-en-gastos';

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

export type ResultadoParticipante =
  | { ok: true; documento: Documento; participante: Participante }
  | { ok: false; error: ErrorGrupo };

export type ResultadoBorrarParticipante ={ ok: true; documento: Documento } | { ok: false; error: ErrorGrupo };

// Devuelve el documento con el Grupo indicado sustituido por `cambiar(grupo)`.
function conGrupo(documento: Documento, grupoId: string, cambiar: (grupo: Grupo) => Grupo): Documento {
  return { ...documento, grupos: documento.grupos.map((g) => (g.id === grupoId ? cambiar(g) : g)) };
}

// El Grupo indicado, solo si existe y tiene ese Participante.
function grupoConParticipante(documento: Documento, grupoId: string, participanteId: string): Grupo | undefined {
  const grupo = documento.grupos.find((g) => g.id === grupoId);
  return grupo?.participantes.some((p) => p.id === participanteId) ? grupo : undefined;
}

/** Un Participante que aparece en algún Gasto, como pagador o como marcado, no se puede borrar. */
export function sePuedeBorrarParticipante(grupo: Grupo, participanteId: string): boolean {
  return !grupo.gastos.some((g) => g.pagadorId === participanteId || g.entre.includes(participanteId));
}

export function anadirParticipante(
  documento: Documento,
  grupoId: string,
  datos: { nombre: string },
  contexto: { id: string },
): ResultadoParticipante {
  const nombre = datos.nombre.trim();
  if (!nombre) return { ok: false, error: 'nombre-vacio' };
  if (!documento.grupos.some((g) => g.id === grupoId)) return { ok: false, error: 'no-encontrado' };

  const participante: Participante = { id: contexto.id, nombre };
  return {
    ok: true,
    documento: conGrupo(documento, grupoId, (g) => ({ ...g, participantes: [...g.participantes, participante] })),
    participante,
  };
}

export function renombrarParticipante(
  documento: Documento,
  grupoId: string,
  participanteId: string,
  nombreNuevo: string,
): ResultadoParticipante {
  const nombre = nombreNuevo.trim();
  if (!nombre) return { ok: false, error: 'nombre-vacio' };
  if (!grupoConParticipante(documento, grupoId, participanteId)) return { ok: false, error: 'no-encontrado' };

  const participante: Participante = { id: participanteId, nombre };
  return {
    ok: true,
    documento: conGrupo(documento, grupoId, (g) => ({
      ...g,
      participantes: g.participantes.map((p) => (p.id === participanteId ? participante : p)),
    })),
    participante,
  };
}

export function borrarParticipante(documento: Documento, grupoId: string, participanteId: string): ResultadoBorrarParticipante {
  const grupo = grupoConParticipante(documento, grupoId, participanteId);
  if (!grupo) return { ok: false, error: 'no-encontrado' };
  if (!sePuedeBorrarParticipante(grupo, participanteId)) return { ok: false, error: 'participante-en-gastos' };

  return {
    ok: true,
    documento: conGrupo(documento, grupoId, (g) => ({
      ...g,
      participantes: g.participantes.filter((p) => p.id !== participanteId),
    })),
  };
}
