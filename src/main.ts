import './estilos.css';
import {
  anadirParticipante,
  borrarParticipante,
  crearGrupo,
  documentoVacio,
  renombrarParticipante,
  sePuedeBorrarParticipante,
  type Documento,
  type Grupo,
} from './grupos';

type Pestana = 'gastos' | 'saldos' | 'participantes';

type Pantalla = { tipo: 'grupos' } | { tipo: 'grupo'; grupoId: string; pestana: Pestana };

// La hoja modal abierta, si hay alguna. `participanteId: null` es un Participante nuevo.
type Hoja = { tipo: 'crear-grupo' } | { tipo: 'participante'; participanteId: string | null };

const PESTANAS: Record<Pestana, { titulo: string; vacio: string }> = {
  gastos: { titulo: 'Gastos', vacio: 'Sin Gastos todavía.' },
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

let documento: Documento = documentoVacio();
let pantalla: Pantalla = { tipo: 'grupos' };
let hoja: Hoja | null = null;

const app = document.querySelector<HTMLDivElement>('#app')!;

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function grupoAbierto(): Grupo | undefined {
  const actual = pantalla;
  return actual.tipo === 'grupo' ? documento.grupos.find((g) => g.id === actual.grupoId) : undefined;
}

function pintarGrupos(): string {
  const lista = documento.grupos.length
    ? `<ul class="lista">${documento.grupos
        .map((g) => `<li><button type="button" data-accion="abrir-grupo" data-id="${escapar(g.id)}">${escapar(g.nombre)}</button></li>`)
        .join('')}</ul>
       <div class="acciones-lista"><button type="button" class="primario" data-accion="nuevo-grupo">Crear Grupo</button></div>`
    : `<div class="vacio"><p class="apagado">Aún no hay Grupos.</p>
       <button type="button" class="primario" data-accion="nuevo-grupo">Crear Grupo</button></div>`;
  return `<header class="cabecera"><h1>Grupos</h1></header>${lista}`;
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
      : `<div class="vacio apagado" role="tabpanel">${PESTANAS[pestana].vacio}</div>`;
  return `<header class="cabecera">
      <button type="button" data-accion="volver">‹ Grupos</button>
      <h1>${escapar(grupo.nombre)}</h1>
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

function pintarHojaCrearGrupo(): string {
  const opciones = Object.entries(MONEDAS)
    .map(([codigo, nombre]) => `<option value="${codigo}"${codigo === MONEDA_POR_DEFECTO ? ' selected' : ''}>${nombre}</option>`)
    .join('');
  return pintarHoja(
    'Nuevo Grupo',
    `<label class="campo">Nombre del Grupo<input name="nombre" required placeholder="Viaje, cena…" autocomplete="off" /></label>
      <p class="error" id="error-nombre" hidden>Falta el nombre del Grupo.</p>
      <label class="campo">Moneda<select name="moneda">${opciones}</select></label>`,
    `<button type="submit" class="primario">Crear Grupo</button>
      <button type="button" data-accion="cerrar-hoja">Cancelar</button>`,
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

function pintar(): void {
  const grupo = grupoAbierto();
  const contenido = pantalla.tipo === 'grupo' && grupo ? pintarGrupo(grupo, pantalla.pestana) : pintarGrupos();
  let modal = '';
  if (hoja?.tipo === 'crear-grupo') modal = pintarHojaCrearGrupo();
  else if (hoja?.tipo === 'participante' && grupo) modal = pintarHojaParticipante(grupo, hoja.participanteId);
  app.innerHTML = `<main class="pantalla">${contenido}</main>${modal}`;
  app.querySelector<HTMLInputElement>('input[name="nombre"]')?.focus();
}

function borrarParticipanteAbierto(): boolean {
  const grupo = grupoAbierto();
  const participanteId = hoja?.tipo === 'participante' ? hoja.participanteId : null;
  const participante = grupo?.participantes.find((p) => p.id === participanteId);
  if (!grupo || !participante) return false;
  if (!confirm(`¿Borrar a «${participante.nombre}» del Grupo?`)) return false;
  const resultado = borrarParticipante(documento, grupo.id, participante.id);
  if (!resultado.ok) return false;
  documento = resultado.documento;
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
    case 'cerrar-hoja':
      hoja = null;
      break;
    case 'abrir-grupo':
      pantalla = { tipo: 'grupo', grupoId: objetivo.dataset.id!, pestana: 'gastos' };
      break;
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

  let resultado: { ok: true; documento: Documento } | { ok: false } | undefined;
  if (hoja?.tipo === 'crear-grupo') {
    resultado = crearGrupo(
      documento,
      { nombre, moneda: String(datos.get('moneda') ?? MONEDA_POR_DEFECTO) },
      { id: crypto.randomUUID(), ahora: Date.now() },
    );
  } else if (hoja?.tipo === 'participante' && grupo) {
    resultado = hoja.participanteId
      ? renombrarParticipante(documento, grupo.id, hoja.participanteId, nombre)
      : anadirParticipante(documento, grupo.id, { nombre }, { id: crypto.randomUUID() });
  }
  if (!resultado) return;
  // Con el Grupo y el Participante a la vista, el único error posible es el nombre vacío.
  if (!resultado.ok) {
    formulario.querySelector<HTMLElement>('#error-nombre')!.hidden = false;
    formulario.querySelector<HTMLInputElement>('input[name="nombre"]')!.focus();
    return;
  }
  documento = resultado.documento;
  hoja = null;
  pintar();
});

// El aviso de nombre vacío desaparece en cuanto se escribe algo.
app.addEventListener('input', (evento) => {
  if ((evento.target as HTMLElement).matches('input[name="nombre"]')) {
    app.querySelector<HTMLElement>('#error-nombre')!.hidden = true;
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && hoja) {
    hoja = null;
    pintar();
  }
});

pintar();
