import { defineConfig } from 'vite';

// Rutas relativas: la app compilada funciona servida desde un subdirectorio (GitHub Pages).
export default defineConfig({
  base: './',
});
