// Conversión entre el importe que escribe el usuario, los céntimos enteros y el texto que se muestra.

// Solo dígitos, con un separador decimal opcional (coma o punto) y hasta dos decimales.
const IMPORTE = /^(\d+)(?:[.,](\d{0,2}))?$/;

/** Céntimos enteros del importe escrito, o `null` si es cero, negativo o ilegible. */
export function leerImporte(texto: string): number | null {
  const partes = IMPORTE.exec(texto.trim());
  if (!partes) return null;
  const centimos = Number(partes[1]) * 100 + Number((partes[2] ?? '').padEnd(2, '0'));
  return centimos > 0 ? centimos : null;
}

/** Los céntimos como texto editable: `1250` → `12,50`. */
export function importeParaEditar(centimos: number): string {
  return (centimos / 100).toFixed(2).replace('.', ',');
}

/** El importe con la configuración regional española y la moneda del Grupo. */
export function formatearImporte(centimos: number, moneda: string): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: moneda }).format(centimos / 100);
}
