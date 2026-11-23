/**
 * Consultas de disponibilidad de lotes - La Reserva Campestre.
 *
 * Recibe el formulario del tour 360, guarda cada consulta en la hoja "Consultas"
 * y avisa por correo al asesor. La hoja "Lotes" controla qué lotes aparecen
 * como disponibles en el formulario.
 *
 * Instalación: ver apps-script/LEEME.md
 */

const CONFIG = {
  // ID de la hoja de Google (parte de su URL entre /d/ y /edit).
  // Vacío = la hoja a la que está vinculado el script.
  ID_HOJA: '',
  // Correos que reciben el aviso (separados por coma). Vacío = dueño de la hoja.
  CORREO_ASESOR: '',
  HOJA_CONSULTAS: 'Consultas',
  HOJA_LOTES: 'Lotes',
  ESPERA_REENVIO_SEG: 60,
};

const COLUMNAS_CONSULTAS = [
  'Fecha', 'Nombre', 'Celular', 'Correo', 'Lote de interés', 'Mensaje',
  'Autoriza datos', 'Estado', 'Asesor', 'Notas', 'Origen',
];
const COLUMNAS_LOTES = ['Lote', 'Estado', 'Área (m²)', 'Precio', 'Notas'];
const ESTADOS_LOTE = ['Disponible', 'Reservado', 'Vendido'];
const ESTADOS_CONSULTA = ['Nueva', 'Contactado', 'Interesado', 'Cerrado', 'Descartado'];

const LIMITES = { nombre: 100, celular: 20, correo: 120, lote: 60, mensaje: 1000 };

/** Ejecutar una vez desde el editor: crea las hojas con encabezados y listas. */
function configurar() {
  const libro = libro_();
  const consultas = prepararHoja_(libro, CONFIG.HOJA_CONSULTAS, COLUMNAS_CONSULTAS);
  const lotes = prepararHoja_(libro, CONFIG.HOJA_LOTES, COLUMNAS_LOTES);

  const reglaConsulta = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_CONSULTA, true).build();
  consultas.getRange(2, COLUMNAS_CONSULTAS.indexOf('Estado') + 1, 999, 1)
    .setDataValidation(reglaConsulta);

  const reglaLote = SpreadsheetApp.newDataValidation()
    .requireValueInList(ESTADOS_LOTE, true).build();
  lotes.getRange(2, 2, 999, 1).setDataValidation(reglaLote);

  if (lotes.getLastRow() < 2) {
    lotes.getRange(2, 1, 3, 2).setValues([
      ['Lote 1', 'Disponible'], ['Lote 2', 'Disponible'], ['Lote 3', 'Vendido'],
    ]);
  }
}

function prepararHoja_(libro, nombre, columnas) {
  const hoja = libro.getSheetByName(nombre) || libro.insertSheet(nombre);
  hoja.getRange(1, 1, 1, columnas.length).setValues([columnas])
    .setFontWeight('bold').setBackground('#0B2B46').setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
  return hoja;
}

/** GET: devuelve los lotes disponibles para llenar la lista del formulario. */
function doGet() {
  return json_({ ok: true, lotes: lotesDisponibles_() });
}

function lotesDisponibles_() {
  const hoja = libro_().getSheetByName(CONFIG.HOJA_LOTES);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 2).getValues()
    .filter(([lote, estado]) => String(lote).trim() &&
      String(estado).trim().toLowerCase() === 'disponible')
    .map(([lote]) => String(lote).trim());
}

/** POST: guarda una consulta y avisa al asesor. */
function doPost(e) {
  try {
    const datos = validar_((e && e.parameter) || {});
    if (datos.esRobot) return json_({ ok: true }); // trampa anti-spam: fingir éxito

    const cache = CacheService.getScriptCache();
    const clave = 'c_' + Utilities.base64EncodeWebSafe(datos.correo + '|' + datos.celular);
    if (cache.get(clave)) {
      return json_({ ok: false, error: 'Ya recibimos tu consulta. Un asesor te contactará pronto.' });
    }

    guardar_(datos);
    cache.put(clave, '1', CONFIG.ESPERA_REENVIO_SEG);
    avisar_(datos);
    return json_({ ok: true });
  } catch (err) {
    if (err instanceof ErrorValidacion) return json_({ ok: false, error: err.message });
    console.error(err && err.stack || err);
    return json_({ ok: false, error: 'No pudimos registrar la consulta. Intenta de nuevo.' });
  }
}

class ErrorValidacion extends Error {}

function validar_(p) {
  const texto = (v, max) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const datos = {
    nombre: texto(p.nombre, LIMITES.nombre),
    celular: texto(p.celular, LIMITES.celular),
    correo: texto(p.correo, LIMITES.correo).toLowerCase(),
    lote: texto(p.lote, LIMITES.lote) || 'Sin especificar',
    mensaje: String(p.mensaje || '').trim().slice(0, LIMITES.mensaje),
    autoriza: p.autoriza === 'si',
    origen: texto(p.origen, 200),
    esRobot: Boolean(String(p.sitio_web || '').trim()),
  };
  if (datos.esRobot) return datos;
  if (datos.nombre.length < 2) throw new ErrorValidacion('Escribe tu nombre.');
  const digitos = datos.celular.replace(/\D/g, '');
  if (digitos.length < 7 || digitos.length > 15) throw new ErrorValidacion('Revisa el número de celular.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.correo)) throw new ErrorValidacion('Revisa el correo electrónico.');
  if (!datos.autoriza) throw new ErrorValidacion('Debes autorizar el tratamiento de datos.');
  return datos;
}

/** Evita que un texto que empieza por = + - @ se ejecute como fórmula en la hoja. */
function seguro_(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function guardar_(d) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const libro = libro_();
    const hoja = libro.getSheetByName(CONFIG.HOJA_CONSULTAS) ||
      prepararHoja_(libro, CONFIG.HOJA_CONSULTAS, COLUMNAS_CONSULTAS);
    hoja.appendRow([
      new Date(), seguro_(d.nombre), seguro_(d.celular), seguro_(d.correo), seguro_(d.lote),
      seguro_(d.mensaje), d.autoriza ? 'Sí' : 'No', 'Nueva', '', '', seguro_(d.origen),
    ]);
  } finally {
    lock.releaseLock();
  }
}

function avisar_(d) {
  const destino = CONFIG.CORREO_ASESOR || Session.getEffectiveUser().getEmail();
  if (!destino) return;
  const hoja = libro_().getUrl();
  const cuerpo = [
    'Nueva consulta de disponibilidad desde el tour 360:', '',
    'Nombre: ' + d.nombre,
    'Celular: ' + d.celular,
    'Correo: ' + d.correo,
    'Lote de interés: ' + d.lote,
    'Mensaje: ' + (d.mensaje || '(sin mensaje)'), '',
    'Todas las consultas: ' + hoja,
  ].join('\n');
  try {
    MailApp.sendEmail({
      to: destino,
      replyTo: d.correo,
      subject: 'Nueva consulta: ' + d.lote + ' - ' + d.nombre,
      body: cuerpo,
    });
  } catch (err) {
    // La consulta ya quedó guardada; el fallo del correo no debe perderla.
    console.error('Correo no enviado: ' + (err && err.message));
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function libro_() {
  return CONFIG.ID_HOJA
    ? SpreadsheetApp.openById(CONFIG.ID_HOJA)
    : SpreadsheetApp.getActiveSpreadsheet();
}
