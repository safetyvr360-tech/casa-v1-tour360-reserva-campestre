# Casa Versión 1 · La Reserva Campestre

Tour virtual 360° (3DVista). Abre index.html o visita la página de GitHub Pages del repositorio.

## Formulario de consulta de lotes

El botón «Consultar disponibilidad» (`consulta/`) guarda los datos en Google Sheets y avisa por correo. Para instalarlo y usarlo, ver `apps-script/LEEME.md`.

**Si vuelves a publicar desde 3DVista:** index.htm se sobrescribe. Vuelve a agregar estas dos líneas después de `fonts.css` en `index.htm` y en `index.html`:

```html
<link rel="stylesheet" href="consulta/consulta.css?v=3">
<script src="consulta/consulta.js?v=3" defer></script>
```
