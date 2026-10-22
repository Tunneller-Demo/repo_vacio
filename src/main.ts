import './estilos.css';
import {
  anadirGasto,
  anadirParticipante,
  borrarGasto,
  borrarGrupo,
  borrarParticipante,
  cambiarMonedaGrupo,
  crearGrupo,
  editarGasto,
  marcarGrupoAbierto,
  renombrarGrupo,
  renombrarParticipante,
  sePuedeBorrarParticipante,
  type Documento,
  type ErrorGrupo,
  type Gasto,
  type Grupo,
} from './grupos';
import { crearGuardado } from './guardado';
import { formatearImporte, importeParaEditar, leerImporte } from './importes';
import { liquidacionDeGrupo, partesDeGasto, saldosDeGrupo, type Transferencia } from './reparto';

type Pestana = 'gastos' | 'saldos' | 'participantes';

type Pantalla = { tipo: 'grupos' } | { tipo: 'grupo'; grupoId: string; pestana: Pestana };

// La hoja modal abierta, si hay alguna. Un id `null` es un Participante o un Gasto nuevo.
type Hoja =
  | { tipo: 'crear-grupo' }
  | { tipo: 'ajustes' }
  | { tipo: 'participante'; participanteId: string | null }
  | { tipo: 'gasto'; gastoId: string | null };

const PESTANAS: Record<Pestana, { titulo: string; vacio: string }> = {
  gastos: { titulo: 'Gastos', vacio: 'Sin Gastos todavía. Pulsa ＋ para añadir.' },
  saldos: { titulo: 'Saldos', vacio: 'Sin Saldos todavía.' },
  participantes: { titulo: 'Participantes', vacio: 'Sin Participantes todavía. Pulsa ＋ para añadir.' },
};

const MONEDA_POR_DEFECTO = 'EUR';

// Solo monedas con céntimos: los importes se guardan en céntimos enteros.
const MONEDAS: Record<string, string> = {
  EUR: 'Euro (EUR)',
  USD: 'Dólar estadounidense (USD)',
  GBP: 'Libra esterlina (GBP)',
  CHF: 'Franco suizo (CHF)',
  MXN: 'Peso mexicano (MXN)',
  ARS: 'Peso argentino (ARS)',
  COP: 'Peso colombiano (COP)',
};

const AVISOS = {
  danado: 'No se pudieron leer los datos guardados; se ha guardado una copia.',
  versionMasNueva: 'Estos datos son de una versión más nueva de la app; recarga la página.',
  falloGuardado: 'No se pudo guardar; los cambios se perderán al cerrar.',
};

// `localStorage` se lee dentro de cada llamada: si está bloqueado, el error lo recoge el guardado.
const guardado = crearGuardado({
  leer: (clave) => localStorage.getItem(clave),
  escribir: (clave, texto) => localStorage.setItem(clave, texto),
});

const carga = guardado.cargar();
let documento: Documento = carga.documento;
// Se abre el último Grupo abierto; si no hay ninguno o se borró, la lista de Grupos.
const ultimoGrupoId = documento.grupos.some((g) => g.id === documento.ultimoGrupoAbiertoId) ? documento.ultimoGrupoAbiertoId : null;
let pantalla: Pantalla = ultimoGrupoId ? { tipo: 'grupo', grupoId: ultimoGrupoId, pestana: 'gastos' } : { tipo: 'grupos' };
let hoja: Hoja | null = null;
// El aviso de la carga (datos dañados o versión más nueva) dura toda la sesión; el de fallo al
// guardar desaparece en cuanto un guardado vuelve a funcionar.
const avisoCarga = carga.estado === 'danado' ? AVISOS.danado : carga.estado === 'version-mas-nueva' ? AVISOS.versionMasNueva : null;
let falloGuardado = carga.estado === 'cargado' && carga.errorGuardado === 'fallo-escritura';

// Cada cambio confirmado se guarda al instante; si falla, la app sigue con los datos en memoria.
// Con el guardado bloqueado (versión más nueva) ya se ve el aviso de la carga.
function confirmar(nuevo: Documento): void {
  documento = nuevo;
  const resultado = guardado.guardar(documento);
  falloGuardado = !resultado.ok && resultado.error === 'fallo-escritura';
}

const app = document.querySelector<HTMLDivElement>('#app')!;

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function grupoAbierto(): Grupo | undefined {
  const actual = pantalla;
  return actual.tipo === 'grupo' ? documento.grupos.find((g) => g.id === actual.grupoId) : undefined;
}

const conPlural = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

// El último abierto arriba; cada Grupo con su total gastado y su número de Participantes.
function pintarGrupos(): string {
  const grupos = [...documento.grupos].sort((a, b) => b.ultimaApertura - a.ultimaApertura);
  const lista = grupos.length
    ? `<ul class="lista">${grupos
        .map((g) => {
          const total = g.gastos.reduce((suma, gasto) => suma + gasto.importe, 0);
          return `<li><button type="button" class="grupo" data-accion="abrir-grupo" data-id="${escapar(g.id)}">
            <span><span class="nombre">${escapar(g.nombre)}</span>
              <span class="apagado detalle">${conPlural(g.participantes.length, 'Participante', 'Participantes')}</span></span>
            <span class="importe">${formatearImporte(total, g.moneda)}</span>
          </button></li>`;
        })
        .join('')}</ul>
       <div class="acciones-lista"><button type="button" class="primario" data-accion="nuevo-grupo">Crear Grupo</button></div>`
    : `<div class="vacio"><p class="apagado">Aún no hay Grupos.</p>
       <button type="button" class="primario" data-accion="nuevo-grupo">Crear Grupo</button></div>`;
  return `<header class="cabecera"><h1>Grupos</h1></header>${lista}`;
}

const nombreDe = (grupo: Grupo, participanteId: string) => grupo.participantes.find((p) => p.id === participanteId)?.nombre ?? '?';

function entreQuienes(grupo: Grupo, gasto: Gasto): string {
  if (gasto.entre.length === grupo.participantes.length) return 'entre todos';
  return `entre ${gasto.entre.map((id) => nombreDe(grupo, id)).join(', ')}`;
}

function pintarGastos(grupo: Grupo): string {
  // Sin Participantes no hay a quién apuntar un Gasto: primero hay que añadirlos.
  if (!grupo.participantes.length) {
    return `<div class="vacio" role="tabpanel"><p class="apagado">Para apuntar Gastos, primero añade Participantes.</p>
      <button type="button" class="primario" data-accion="pestana" data-pestana="participantes">Ir a Participantes</button></div>`;
  }
  // El más reciente arriba.
  const lista = grupo.gastos.length
    ? `<ul class="lista">${[...grupo.gastos]
        .reverse()
        .map(
          (g) => `<li><button type="button" class="gasto" data-accion="editar-gasto" data-id="${escapar(g.id)}">
            <span><span class="concepto">${escapar(g.concepto)}</span>
              <span class="apagado detalle">Pagó ${escapar(nombreDe(grupo, g.pagadorId))} · ${escapar(entreQuienes(grupo, g))}</span></span>
            <span class="importe">${formatearImporte(g.importe, grupo.moneda)}</span>
          </button></li>`,
        )
        .join('')}</ul>`
    : `<div class="vacio apagado">${PESTANAS.gastos.vacio}</div>`;
  return `<div role="tabpanel">${lista}</div>
    <button type="button" class="flotante" data-accion="nuevo-gasto" aria-label="Nuevo Gasto">＋</button>`;
}

// Las frases de la Liquidación, tal como se muestran y se copian: «Ana paga 93,67 € a Bruno».
const fraseDe = (grupo: Grupo, t: Transferencia) =>
  `${nombreDe(grupo, t.deId)} paga ${formatearImporte(t.importe, grupo.moneda)} a ${nombreDe(grupo, t.aId)}`;

function pintarSaldos(grupo: Grupo): string {
  if (!grupo.participantes.length) return `<div class="vacio apagado" role="tabpanel">${PESTANAS.saldos.vacio}</div>`;
  const saldos = [...saldosDeGrupo(grupo)]
    .map(([id, saldo]) => {
      const [clase, estado] = saldo > 0 ? ['positivo', 'le deben'] : saldo < 0 ? ['negativo', 'debe'] : ['en-paz', 'en paz'];
      return `<li class="saldo ${clase}"><span>${escapar(nombreDe(grupo, id))}<span class="apagado detalle">${estado}</span></span>
        <span class="importe">${saldo > 0 ? '+' : ''}${formatearImporte(saldo, grupo.moneda)}</span></li>`;
    })
    .join('');
  const transferencias = liquidacionDeGrupo(grupo);
  const liquidacion = transferencias.length
    ? `<ol class="liquidacion">${transferencias.map((t) => `<li>${escapar(fraseDe(grupo, t))}</li>`).join('')}</ol>
       <div class="acciones-lista"><button type="button" data-accion="copiar-liquidacion">Copiar como texto</button></div>`
    : `<p class="en-paz-todos">Todos están en paz: nadie debe nada.</p>`;
  return `<div role="tabpanel"><ul class="lista">${saldos}</ul>
    <section class="seccion"><h2>Liquidación</h2>${liquidacion}</section></div>`;
}

// Copia las frases de la Liquidación, una por línea, y lo cuenta en el propio botón.
async function copiarLiquidacion(boton: HTMLElement): Promise<void> {
  const grupo = grupoAbierto();
  if (!grupo) return;
  const texto = liquidacionDeGrupo(grupo).map((t) => fraseDe(grupo, t)).join('\n');
  try {
    await navigator.clipboard.writeText(texto);
    boton.textContent = 'Copiado ✓';
  } catch {
    boton.textContent = 'No se pudo copiar';
  }
}

function pintarParticipantes(grupo: Grupo): string {
  const lista = grupo.participantes.length
    ? `<ul class="lista">${grupo.participantes
        .map(
          (p) =>
            `<li><button type="button" data-accion="editar-participante" data-id="${escapar(p.id)}">${escapar(p.nombre)}</button></li>`,
        )
        .join('')}</ul>`
    : `<div class="vacio apagado">${PESTANAS.participantes.vacio}</div>`;
  return `<div role="tabpanel">${lista}</div>
    <button type="button" class="flotante" data-accion="nuevo-participante" aria-label="Nuevo Participante">＋</button>`;
}

function pintarGrupo(grupo: Grupo, pestana: Pestana): string {
  const pestanas = (Object.keys(PESTANAS) as Pestana[])
    .map(
      (p) =>
        `<button type="button" role="tab" aria-selected="${p === pestana}" data-accion="pestana" data-pestana="${p}">${PESTANAS[p].titulo}</button>`,
    )
    .join('');
  const panel =
    pestana === 'participantes'
      ? pintarParticipantes(grupo)
      : pestana === 'gastos'
        ? pintarGastos(grupo)
        : pintarSaldos(grupo);
  return `<header class="cabecera">
      <button type="button" data-accion="volver">‹ Grupos</button>
      <h1>${escapar(grupo.nombre)}</h1>
      <button type="button" data-accion="ajustes" aria-label="Ajustes del Grupo">⋯</button>
    </header>
    <nav class="pestanas" role="tablist">${pestanas}</nav>
    ${panel}`;
}

function pintarHoja(titulo: string, campos: string, botones: string): string {
  return `<div class="fondo" data-accion="cerrar-hoja">
    <form class="hoja" role="dialog" aria-labelledby="titulo-hoja" novalidate>
      <h2 id="titulo-hoja">${titulo}</h2>
      ${campos}
      <div class="botones">${botones}</div>
    </form>
  </div>`;
}

// Si la moneda elegida no está en la lista, se ofrece igualmente para no cambiarla sin querer.
function opcionesMoneda(elegida: string): string {
  const monedas = elegida in MONEDAS ? MONEDAS : { ...MONEDAS, [elegida]: elegida };
  return Object.entries(monedas)
    .map(([codigo, nombre]) => `<option value="${escapar(codigo)}"${codigo === elegida ? ' selected' : ''}>${escapar(nombre)}</option>`)
    .join('');
}

function pintarHojaCrearGrupo(): string {
  const opciones = opcionesMoneda(MONEDA_POR_DEFECTO);
  return pintarHoja(
    'Nuevo Grupo',
    `<label class="campo">Nombre del Grupo<input name="nombre" required placeholder="Viaje, cena…" autocomplete="off" /></label>
      <p class="error" id="error-nombre" hidden>Falta el nombre del Grupo.</p>
      <label class="campo">Moneda<select name="moneda">${opciones}</select></label>`,
    `<button type="submit" class="primario">Crear Grupo</button>
      <button type="button" data-accion="cerrar-hoja">Cancelar</button>`,
  );
}

function pintarHojaAjustes(grupo: Grupo): string {
  return pintarHoja(
    'Ajustes del Grupo',
    `<label class="campo">Nombre del Grupo<input name="nombre" required value="${escapar(grupo.nombre)}" autocomplete="off" /></label>
      <p class="error" id="error-nombre" hidden>Falta el nombre del Grupo.</p>
      <label class="campo">Moneda<select name="moneda">${opcionesMoneda(grupo.moneda)}</select></label>
      <p class="apagado nota">Cambiar la moneda solo cambia cómo se muestran los importes; no los recalcula.</p>`,
    `<button type="submit" class="primario">Guardar</button>
      <button type="button" data-accion="cerrar-hoja">Cancelar</button>
      <button type="button" class="peligro" data-accion="borrar-grupo">Borrar Grupo</button>`,
  );
}

function pintarHojaParticipante(grupo: Grupo, participanteId: string | null): string {
  const participante = grupo.participantes.find((p) => p.id === participanteId);
  const campos = `<label class="campo">Nombre<input name="nombre" required value="${escapar(participante?.nombre ?? '')}" autocomplete="off" /></label>
      <p class="error" id="error-nombre" hidden>Falta el nombre del Participante.</p>`;
  const botones = `<button type="submit" class="primario">Guardar</button>
      <button type="button" data-accion="cerrar-hoja">Cancelar</button>`;
  if (!participante) return pintarHoja('Nuevo Participante', campos, botones);

  // Quien aparece en algún Gasto no se puede borrar: el botón sale desactivado y se explica por qué.
  if (sePuedeBorrarParticipante(grupo, participante.id)) {
    return pintarHoja('Participante', campos, `${botones}<button type="button" class="peligro" data-accion="borrar-participante">Borrar</button>`);
  }
  return pintarHoja(
    'Participante',
    `${campos}<p class="apagado nota" id="motivo-borrar">Aparece en algún Gasto: solo se puede cambiar el nombre.</p>`,
    `${botones}<button type="button" class="peligro" disabled aria-describedby="motivo-borrar">Borrar</button>`,
  );
}

// La parte de cada marcado («no entra» si no lo está) se rellena en vivo con `actualizarHojaGasto`.
function pintarHojaGasto(grupo: Grupo, gastoId: string | null): string {
  const gasto = grupo.gastos.find((g) => g.id === gastoId);
  const pagadorId = gasto?.pagadorId ?? grupo.participantes[0]?.id;
  const pagadores = grupo.participantes
    .map(
      (p) =>
        `<label class="opcion"><input type="radio" name="pagador" value="${escapar(p.id)}"${p.id === pagadorId ? ' checked' : ''} />${escapar(p.nombre)}</label>`,
    )
    .join('');
  const marcables = grupo.participantes
    .map(
      (p) => `<button type="button" class="marcable" data-accion="marcar" data-id="${escapar(p.id)}" aria-pressed="${!gasto || gasto.entre.includes(p.id)}">
          <span>${escapar(p.nombre)}</span><span class="parte"></span></button>`,
    )
    .join('');
  const importe = gasto ? importeParaEditar(gasto.importe) : '';
  return pintarHoja(
    gasto ? 'Editar Gasto' : 'Nuevo Gasto',
    `<label class="campo">Importe (${escapar(grupo.moneda)})<input name="importe" inputmode="decimal" placeholder="0,00" autocomplete="off" value="${importe}" /></label>
      <label class="campo">Concepto<input name="concepto" placeholder="Cena, gasolina…" autocomplete="off" value="${escapar(gasto?.concepto ?? '')}" /></label>
      <fieldset class="campo"><legend>Lo pagó</legend><div class="opciones">${pagadores}</div></fieldset>
      <fieldset class="campo"><legend>Entre quiénes <span class="apagado">(a partes iguales)</span></legend>
        <div class="atajos"><button type="button" data-accion="marcar-todos">Todos</button><button type="button" data-accion="marcar-ninguno">Ninguno</button></div>
        <div class="marcables">${marcables}</div></fieldset>`,
    `<button type="submit" class="primario">Guardar</button>
      <button type="button" data-accion="cerrar-hoja">Cancelar</button>${
        gasto ? '<button type="button" class="peligro" data-accion="borrar-gasto">Borrar</button>' : ''
      }`,
  );
}

// Lo que hay escrito y marcado ahora mismo en la hoja de Gasto; el importe, `null` si no es válido.
function leerHojaGasto(formulario: HTMLFormElement) {
  return {
    concepto: formulario.querySelector<HTMLInputElement>('input[name="concepto"]')!.value,
    importe: leerImporte(formulario.querySelector<HTMLInputElement>('input[name="importe"]')!.value),
    pagadorId: String(new FormData(formulario).get('pagador') ?? ''),
    entre: [...formulario.querySelectorAll<HTMLElement>('.marcable[aria-pressed="true"]')].map((b) => b.dataset.id!),
  };
}

// Recalcula la parte de cada Participante y si se puede guardar, sin volver a pintar la hoja.
function actualizarHojaGasto(): void {
  const grupo = grupoAbierto();
  const formulario = app.querySelector<HTMLFormElement>('.hoja');
  if (hoja?.tipo !== 'gasto' || !grupo || !formulario) return;
  const { concepto, importe, entre } = leerHojaGasto(formulario);
  const partes =
    importe && entre.length
      ? partesDeGasto({ importe, entre }, grupo.participantes.map((p) => p.id))
      : new Map<string, number>();
  for (const boton of formulario.querySelectorAll<HTMLElement>('.marcable')) {
    const parte = partes.get(boton.dataset.id!);
    const texto = boton.getAttribute('aria-pressed') !== 'true' ? 'no entra' : parte === undefined ? '—' : formatearImporte(parte, grupo.moneda);
    boton.querySelector('.parte')!.textContent = texto;
  }
  formulario.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = !concepto.trim() || !importe || !entre.length;
}

function pintar(): void {
  const grupo = grupoAbierto();
  const contenido = pantalla.tipo === 'grupo' && grupo ? pintarGrupo(grupo, pantalla.pestana) : pintarGrupos();
  let modal = '';
  if (hoja?.tipo === 'crear-grupo') modal = pintarHojaCrearGrupo();
  else if (hoja?.tipo === 'ajustes' && grupo) modal = pintarHojaAjustes(grupo);
  else if (hoja?.tipo === 'participante' && grupo) modal = pintarHojaParticipante(grupo, hoja.participanteId);
  else if (hoja?.tipo === 'gasto' && grupo) modal = pintarHojaGasto(grupo, hoja.gastoId);
  const banda = [avisoCarga, falloGuardado ? AVISOS.falloGuardado : null]
    .filter((aviso) => aviso !== null)
    .map((aviso) => `<p class="aviso" role="alert">${aviso}</p>`)
    .join('');
  app.innerHTML = `<main class="pantalla">${banda}${contenido}</main>${modal}`;
  app.querySelector<HTMLInputElement>('.hoja input')?.focus();
  actualizarHojaGasto();
}

function borrarGastoAbierto(): boolean {
  const grupo = grupoAbierto();
  const gastoId = hoja?.tipo === 'gasto' ? hoja.gastoId : null;
  const gasto = grupo?.gastos.find((g) => g.id === gastoId);
  if (!grupo || !gasto) return false;
  if (!confirm(`¿Borrar el Gasto «${gasto.concepto}» (${formatearImporte(gasto.importe, grupo.moneda)})?`)) return false;
  const resultado = borrarGasto(documento, grupo.id, gasto.id);
  if (!resultado.ok) return false;
  confirmar(resultado.documento);
  return true;
}

// Avisa de lo que se pierde: «Se borrarán el Grupo "Viaje a Lisboa" y sus 23 Gastos».
function borrarGrupoAbierto(): boolean {
  const grupo = grupoAbierto();
  if (!grupo) return false;
  const n = grupo.gastos.length;
  const pregunta =
    n === 0
      ? `Se borrará el Grupo "${grupo.nombre}", que no tiene Gastos.`
      : `Se borrarán el Grupo "${grupo.nombre}" y ${n === 1 ? 'su único Gasto' : `sus ${n} Gastos`}.`;
  if (!confirm(pregunta)) return false;
  const resultado = borrarGrupo(documento, grupo.id);
  if (!resultado.ok) return false;
  confirmar(resultado.documento);
  return true;
}

function borrarParticipanteAbierto(): boolean {
  const grupo = grupoAbierto();
  const participanteId = hoja?.tipo === 'participante' ? hoja.participanteId : null;
  const participante = grupo?.participantes.find((p) => p.id === participanteId);
  if (!grupo || !participante) return false;
  if (!confirm(`¿Borrar a «${participante.nombre}» del Grupo?`)) return false;
  const resultado = borrarParticipante(documento, grupo.id, participante.id);
  if (!resultado.ok) return false;
  confirmar(resultado.documento);
  return true;
}

app.addEventListener('click', (evento) => {
  const objetivo = (evento.target as HTMLElement).closest<HTMLElement>('[data-accion]');
  if (!objetivo) return;
  // Un clic dentro de la hoja no debe cerrarla por llegar al fondo.
  if (objetivo.classList.contains('fondo') && evento.target !== objetivo) return;

  switch (objetivo.dataset.accion) {
    case 'nuevo-grupo':
      hoja = { tipo: 'crear-grupo' };
      break;
    case 'ajustes':
      hoja = { tipo: 'ajustes' };
      break;
    case 'borrar-grupo':
      if (!borrarGrupoAbierto()) return;
      hoja = null;
      pantalla = { tipo: 'grupos' };
      break;
    case 'nuevo-participante':
      hoja = { tipo: 'participante', participanteId: null };
      break;
    case 'editar-participante':
      hoja = { tipo: 'participante', participanteId: objetivo.dataset.id! };
      break;
    case 'borrar-participante':
      if (!borrarParticipanteAbierto()) return;
      hoja = null;
      break;
    case 'nuevo-gasto':
      hoja = { tipo: 'gasto', gastoId: null };
      break;
    case 'editar-gasto':
      hoja = { tipo: 'gasto', gastoId: objetivo.dataset.id! };
      break;
    case 'borrar-gasto':
      if (!borrarGastoAbierto()) return;
      hoja = null;
      break;
    // Marcar y desmarcar no vuelve a pintar la hoja, para no perder lo escrito.
    case 'marcar':
      objetivo.setAttribute('aria-pressed', String(objetivo.getAttribute('aria-pressed') !== 'true'));
      actualizarHojaGasto();
      return;
    case 'marcar-todos':
    case 'marcar-ninguno':
      for (const boton of objetivo.closest('form')!.querySelectorAll('.marcable')) boton.setAttribute('aria-pressed', String(objetivo.dataset.accion === 'marcar-todos'));
      actualizarHojaGasto();
      return;
    case 'copiar-liquidacion':
      void copiarLiquidacion(objetivo);
      return;
    case 'cerrar-hoja':
      hoja = null;
      break;
    case 'abrir-grupo': {
      const abierto = marcarGrupoAbierto(documento, objetivo.dataset.id!, { ahora: Date.now() });
      if (abierto.ok) confirmar(abierto.documento);
      pantalla = { tipo: 'grupo', grupoId: objetivo.dataset.id!, pestana: 'gastos' };
      break;
    }
    case 'pestana':
      if (pantalla.tipo === 'grupo') pantalla = { ...pantalla, pestana: objetivo.dataset.pestana as Pestana };
      break;
    case 'volver':
      pantalla = { tipo: 'grupos' };
      break;
    default:
      return;
  }
  pintar();
});

app.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const formulario = evento.target as HTMLFormElement;
  const datos = new FormData(formulario);
  const nombre = String(datos.get('nombre') ?? '');
  const grupo = grupoAbierto();

  let resultado: { ok: true; documento: Documento } | { ok: false; error: ErrorGrupo } | undefined;
  if (hoja?.tipo === 'crear-grupo') {
    resultado = crearGrupo(
      documento,
      { nombre, moneda: String(datos.get('moneda') ?? MONEDA_POR_DEFECTO) },
      { id: crypto.randomUUID(), ahora: Date.now() },
    );
  } else if (hoja?.tipo === 'ajustes' && grupo) {
    const renombrado = renombrarGrupo(documento, grupo.id, nombre);
    resultado = renombrado.ok
      ? cambiarMonedaGrupo(renombrado.documento, grupo.id, String(datos.get('moneda') ?? grupo.moneda))
      : renombrado;
  } else if (hoja?.tipo === 'participante' && grupo) {
    resultado = hoja.participanteId
      ? renombrarParticipante(documento, grupo.id, hoja.participanteId, nombre)
      : anadirParticipante(documento, grupo.id, { nombre }, { id: crypto.randomUUID() });
  } else if (hoja?.tipo === 'gasto' && grupo) {
    const leido = leerHojaGasto(formulario);
    const gasto = { ...leido, importe: leido.importe ?? 0 };
    resultado = hoja.gastoId
      ? editarGasto(documento, grupo.id, hoja.gastoId, gasto)
      : anadirGasto(documento, grupo.id, gasto, { id: crypto.randomUUID() });
  }
  if (!resultado) return;
  if (!resultado.ok && resultado.error === 'nombre-vacio') {
    formulario.querySelector<HTMLElement>('#error-nombre')!.hidden = false;
    formulario.querySelector<HTMLInputElement>('input[name="nombre"]')!.focus();
    return;
  }
  // Los demás Gastos inválidos ya tienen Guardar desactivado: la hoja sigue abierta.
  if (!resultado.ok && resultado.error !== 'no-encontrado') return;
  // Si el Grupo, el Participante o el Gasto ya no existen, se cierra la hoja sin cambios.
  if (resultado.ok) confirmar(resultado.documento);
  hoja = null;
  pintar();
});

// El aviso de nombre vacío desaparece en cuanto se escribe algo; la hoja de Gasto se recalcula.
app.addEventListener('input', (evento) => {
  if ((evento.target as HTMLElement).matches('input[name="nombre"]')) {
    app.querySelector<HTMLElement>('#error-nombre')!.hidden = true;
  }
  actualizarHojaGasto();
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && hoja) {
    hoja = null;
    pintar();
  }
});

pintar();
