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
  /** Versión de la forma del documento guardado; ver el módulo de guardado. */
  version: number;
  grupos: Grupo[];
  ultimoGrupoAbiertoId: string | null;
}

export type ErrorGrupo =
  | 'nombre-vacio'
  | 'no-encontrado'
  | 'participante-en-gastos'
  | 'concepto-vacio'
  | 'importe-no-valido'
  | 'sin-marcados';

export type ResultadoCrearGrupo =
  | { ok: true; documento: Documento; grupo: Grupo }
  | { ok: false; error: ErrorGrupo };

/** La versión de la forma del documento que entiende esta app. */
export const VERSION_DOCUMENTO = 1;

export function documentoVacio(): Documento {
  return { version: VERSION_DOCUMENTO, grupos: [], ultimoGrupoAbiertoId: null };
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

export type ResultadoMarcarAbierto = { ok: true; documento: Documento } | { ok: false; error: ErrorGrupo };

/** Al entrar en un Grupo: pasa a ser el último abierto y se apunta cuándo. */
export function marcarGrupoAbierto(documento: Documento, grupoId: string, contexto: { ahora: number }): ResultadoMarcarAbierto {
  if (!existeGrupo(documento, grupoId)) return { ok: false, error: 'no-encontrado' };
  return {
    ok: true,
    documento: {
      ...conGrupo(documento, grupoId, (g) => ({ ...g, ultimaApertura: contexto.ahora })),
      ultimoGrupoAbiertoId: grupoId,
    },
  };
}

export type ResultadoCambioGrupo = { ok: true; documento: Documento } | { ok: false; error: ErrorGrupo };

export function renombrarGrupo(documento: Documento, grupoId: string, nombreNuevo: string): ResultadoCambioGrupo {
  const nombre = nombreNuevo.trim();
  if (!nombre) return { ok: false, error: 'nombre-vacio' };
  if (!existeGrupo(documento, grupoId)) return { ok: false, error: 'no-encontrado' };
  return { ok: true, documento: conGrupo(documento, grupoId, (g) => ({ ...g, nombre })) };
}

/** Solo cambia la etiqueta de los importes: los céntimos de los Gastos no se recalculan. */
export function cambiarMonedaGrupo(documento: Documento, grupoId: string, moneda: string): ResultadoCambioGrupo {
  if (!existeGrupo(documento, grupoId)) return { ok: false, error: 'no-encontrado' };
  return { ok: true, documento: conGrupo(documento, grupoId, (g) => ({ ...g, moneda })) };
}

/** Quita el Grupo con sus Participantes y Gastos; si era el último abierto, deja de serlo. */
export function borrarGrupo(documento: Documento, grupoId: string): ResultadoCambioGrupo {
  if (!existeGrupo(documento, grupoId)) return { ok: false, error: 'no-encontrado' };
  return {
    ok: true,
    documento: {
      ...documento,
      grupos: documento.grupos.filter((g) => g.id !== grupoId),
      ultimoGrupoAbiertoId: documento.ultimoGrupoAbiertoId === grupoId ? null : documento.ultimoGrupoAbiertoId,
    },
  };
}

export type ResultadoParticipante =
  | { ok: true; documento: Documento; participante: Participante }
  | { ok: false; error: ErrorGrupo };

export type ResultadoBorrarParticipante ={ ok: true; documento: Documento } | { ok: false; error: ErrorGrupo };

const existeGrupo = (documento: Documento, grupoId: string) => documento.grupos.some((g) => g.id === grupoId);

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
  if (!existeGrupo(documento, grupoId)) return { ok: false, error: 'no-encontrado' };

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

/** Lo que se escribe en el formulario de un Gasto; el importe ya en céntimos. */
export type DatosGasto = Omit<Gasto, 'id'>;

export type ResultadoGasto = { ok: true; documento: Documento; gasto: Gasto } | { ok: false; error: ErrorGrupo };

export type ResultadoBorrarGasto = { ok: true; documento: Documento } | { ok: false; error: ErrorGrupo };

// Comprueba las reglas de un Gasto y lo devuelve normalizado: concepto sin espacios en los
// extremos y marcados en el orden del Grupo. Quien paga puede no estar entre los marcados.
function gastoValido(
  grupo: Grupo | undefined,
  id: string,
  datos: DatosGasto,
): { ok: true; gasto: Gasto } | { ok: false; error: ErrorGrupo } {
  const concepto = datos.concepto.trim();
  if (!concepto) return { ok: false, error: 'concepto-vacio' };
  if (!Number.isSafeInteger(datos.importe) || datos.importe <= 0) return { ok: false, error: 'importe-no-valido' };
  if (!datos.entre.length) return { ok: false, error: 'sin-marcados' };
  const ids = grupo?.participantes.map((p) => p.id) ?? [];
  if (!grupo || !ids.includes(datos.pagadorId) || datos.entre.some((m) => !ids.includes(m))) {
    return { ok: false, error: 'no-encontrado' };
  }
  const entre = ids.filter((m) => datos.entre.includes(m));
  return { ok: true, gasto: { id, concepto, importe: datos.importe, pagadorId: datos.pagadorId, entre } };
}

export function anadirGasto(documento: Documento, grupoId: string, datos: DatosGasto, contexto: { id: string }): ResultadoGasto {
  const validado = gastoValido(documento.grupos.find((g) => g.id === grupoId), contexto.id, datos);
  if (!validado.ok) return validado;
  const { gasto } = validado;
  return { ok: true, documento: conGrupo(documento, grupoId, (g) => ({ ...g, gastos: [...g.gastos, gasto] })), gasto };
}

// El Grupo indicado, solo si existe y tiene ese Gasto.
function grupoConGasto(documento: Documento, grupoId: string, gastoId: string): Grupo | undefined {
  const grupo = documento.grupos.find((g) => g.id === grupoId);
  return grupo?.gastos.some((g) => g.id === gastoId) ? grupo : undefined;
}

export function editarGasto(documento: Documento, grupoId: string, gastoId: string, datos: DatosGasto): ResultadoGasto {
  const grupo = grupoConGasto(documento, grupoId, gastoId);
  if (!grupo) return { ok: false, error: 'no-encontrado' };
  const validado = gastoValido(grupo, gastoId, datos);
  if (!validado.ok) return validado;
  const { gasto } = validado;
  return {
    ok: true,
    documento: conGrupo(documento, grupoId, (g) => ({ ...g, gastos: g.gastos.map((x) => (x.id === gastoId ? gasto : x)) })),
    gasto,
  };
}

export function borrarGasto(documento: Documento, grupoId: string, gastoId: string): ResultadoBorrarGasto {
  if (!grupoConGasto(documento, grupoId, gastoId)) return { ok: false, error: 'no-encontrado' };
  return { ok: true, documento: conGrupo(documento, grupoId, (g) => ({ ...g, gastos: g.gastos.filter((x) => x.id !== gastoId) })) };
}
