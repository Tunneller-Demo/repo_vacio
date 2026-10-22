# repo_vacio

Reparto de gastos entre amigos: una app web estática que calcula quién debe cuánto a quién. El glosario del dominio está en `CONTEXT.md`.

## Desarrollo

```sh
npm install
npm run dev        # servidor de desarrollo
npm test           # tests con Vitest
npm run build      # comprueba tipos y compila a dist/
```

`dist/` usa rutas relativas, así que se puede publicar tal cual desde un subdirectorio (por ejemplo, GitHub Pages).
