import './estilos.css';
import { crearGrupo, documentoVacio, type Documento, type Grupo } from './grupos';

type Pestana = 'gastos' | 'saldos' | 'participantes';

type Pantalla = { tipo: 'grupos' } | { tipo: 'grupo'; grupoId: string; pestana: Pestana };

const PESTANAS: Record<Pestana, { titulo: string; vacio: string }> = {
  gastos: { titulo: 'Gastos', vacio: 'Sin Gastos todavía.' },
  saldos: { titulo: 'Saldos', vacio: 'Sin Saldos todavía.' },
  participantes: { titulo: 'Participantes', vacio: 'Sin Participantes todavía.' },
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
let hojaCrearGrupo = false;

const app = document.querySelector<HTMLDivElement>('#app')!;

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

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

function pintarGrupo(grupo: Grupo, pestana: Pestana): string {
  const pestanas = (Object.keys(PESTANAS) as Pestana[])
    .map(
      (p) =>
        `<button type="button" role="tab" aria-selected="${p === pestana}" data-accion="pestana" data-pestana="${p}">${PESTANAS[p].titulo}</button>`,
    )
    .join('');
  return `<header class="cabecera">
      <button type="button" data-accion="volver">‹ Grupos</button>
      <h1>${escapar(grupo.nombre)}</h1>
    </header>
    <nav class="pestanas" role="tablist">${pestanas}</nav>
    <div class="vacio apagado" role="tabpanel">${PESTANAS[pestana].vacio}</div>`;
}

function pintarHojaCrearGrupo(): string {
  const opciones = Object.entries(MONEDAS)
    .map(([codigo, nombre]) => `<option value="${codigo}"${codigo === MONEDA_POR_DEFECTO ? ' selected' : ''}>${nombre}</option>`)
    .join('');
  return `<div class="fondo" data-accion="cerrar-hoja">
    <form class="hoja" role="dialog" aria-labelledby="titulo-hoja" novalidate>
      <h2 id="titulo-hoja">Nuevo Grupo</h2>
      <label class="campo">Nombre del Grupo<input name="nombre" required placeholder="Viaje, cena…" autocomplete="off" /></label>
      <p class="error" id="error-nombre" hidden>Falta el nombre del Grupo.</p>
      <label class="campo">Moneda<select name="moneda">${opciones}</select></label>
      <div class="botones">
        <button type="submit" class="primario">Crear Grupo</button>
        <button type="button" data-accion="cerrar-hoja">Cancelar</button>
      </div>
    </form>
  </div>`;
}

function pintar(): void {
  const actual = pantalla;
  const grupo = actual.tipo === 'grupo' ? documento.grupos.find((g) => g.id === actual.grupoId) : undefined;
  const contenido = actual.tipo === 'grupo' && grupo ? pintarGrupo(grupo, actual.pestana) : pintarGrupos();
  app.innerHTML = `<main class="pantalla">${contenido}</main>${hojaCrearGrupo ? pintarHojaCrearGrupo() : ''}`;
  app.querySelector<HTMLInputElement>('input[name="nombre"]')?.focus();
}

app.addEventListener('click', (evento) => {
  const objetivo = (evento.target as HTMLElement).closest<HTMLElement>('[data-accion]');
  if (!objetivo) return;
  // Un clic dentro de la hoja no debe cerrarla por llegar al fondo.
  if (objetivo.classList.contains('fondo') && evento.target !== objetivo) return;

  switch (objetivo.dataset.accion) {
    case 'nuevo-grupo':
      hojaCrearGrupo = true;
      break;
    case 'cerrar-hoja':
      hojaCrearGrupo = false;
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
  const resultado = crearGrupo(
    documento,
    { nombre: String(datos.get('nombre') ?? ''), moneda: String(datos.get('moneda') ?? MONEDA_POR_DEFECTO) },
    { id: crypto.randomUUID(), ahora: Date.now() },
  );
  if (!resultado.ok) {
    formulario.querySelector<HTMLElement>('#error-nombre')!.hidden = false;
    formulario.querySelector<HTMLInputElement>('input[name="nombre"]')!.focus();
    return;
  }
  documento = resultado.documento;
  hojaCrearGrupo = false;
  pintar();
});

// El aviso de nombre vacío desaparece en cuanto se escribe algo.
app.addEventListener('input', (evento) => {
  if ((evento.target as HTMLElement).matches('input[name="nombre"]')) {
    app.querySelector<HTMLElement>('#error-nombre')!.hidden = true;
  }
});

document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && hojaCrearGrupo) {
    hojaCrearGrupo = false;
    pintar();
  }
});

pintar();
