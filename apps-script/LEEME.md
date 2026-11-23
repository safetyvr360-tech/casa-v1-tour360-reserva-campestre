# Consultas de disponibilidad (Google Sheets + correo)

El botón **Consultar disponibilidad** del tour (`consulta/consulta.js`) envía cada consulta a este Apps Script. El script:

- guarda la consulta en la pestaña **Consultas** de la hoja «Consultas lotes - La Reserva Campestre»;
- manda un correo de aviso al dueño de la hoja, o a `CONFIG.CORREO_ASESOR` si se llena.

## Uso diario

- **Consultas:** cada fila es una persona. Cambia **Estado** (Nueva → Contactado → Interesado → Cerrado o Descartado) y anota el **Asesor** y las **Notas**.
- **Lotes:** escribe un lote por fila y marca su Estado: Disponible, Reservado o Vendido. Solo los «Disponible» aparecen en la lista del formulario.

## Cambiar el código

1. Edita `Codigo.gs` en el editor de Apps Script (en la hoja: Extensiones → Apps Script).
2. Ve a **Implementar → Gestionar implementaciones → editar (lápiz) → Versión: nueva versión → Implementar**. Así la URL `/exec` sigue siendo la misma.

La copia de este repositorio tiene `ID_HOJA` vacío. La versión desplegada tiene el ID de la hoja.

## Instalar desde cero

1. Crea una hoja de Google y abre Extensiones → Apps Script.
2. Pega `Codigo.gs` y, si el script no quedó vinculado, pon el ID de la hoja en `ID_HOJA`.
3. Ejecuta `configurar` y autoriza los permisos.
4. Ve a Implementar → Nueva implementación → Aplicación web, con «Ejecutar como: yo» y acceso «Cualquier usuario».
5. Copia la URL que termina en `/exec` en `ENDPOINT`, dentro de `consulta/consulta.js`.
