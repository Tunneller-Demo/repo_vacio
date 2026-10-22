import { describe, expect, it } from 'vitest';
import { formatearImporte, leerImporte } from './importes';

describe('leerImporte', () => {
  it('acepta la coma decimal', () => {
    expect(leerImporte('12,50')).toBe(1250);
    expect(leerImporte('0,05')).toBe(5);
  });

  it('acepta el punto decimal', () => {
    expect(leerImporte('12.5')).toBe(1250);
    expect(leerImporte('19.99')).toBe(1999);
  });

  it('acepta importes sin decimales y con espacios en los extremos', () => {
    expect(leerImporte(' 60 ')).toBe(6000);
    expect(leerImporte('7,')).toBe(700);
  });

  it('rechaza el cero', () => {
    expect(leerImporte('0')).toBeNull();
    expect(leerImporte('0,00')).toBeNull();
  });

  it('rechaza los importes negativos', () => {
    expect(leerImporte('-5')).toBeNull();
    expect(leerImporte('-0,50')).toBeNull();
  });

  it('rechaza lo ilegible', () => {
    for (const texto of ['', '   ', 'abc', '12,5a', '1,2,3', '12,345', '1.234,56', ',']) {
      expect(leerImporte(texto), texto).toBeNull();
    }
  });
});

describe('formatearImporte', () => {
  it('usa la configuración regional española y la moneda del Grupo', () => {
    expect(formatearImporte(9367, 'EUR')).toBe('93,67 €');
    expect(formatearImporte(1050, 'USD')).toBe('10,50 US$');
  });
});
