/*
 * Formulario "Consultar disponibilidad" sobre el tour 360.
 * Envía los datos al Apps Script de Google (ver apps-script/LEEME.md),
 * que los guarda en Google Sheets y avisa por correo al asesor.
 */
(function () {
  'use strict';

  // URL del despliegue web de Apps Script (termina en /exec).
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwAHcE8RIIuZ-rlS_4C-pAkWzjHUL3TyyMRZCXuknLDqBtdZyw48s6OmAh1sPw42purKQ/exec';
  var TIEMPO_MAX_MS = 20000;
  // Enlaces del tour que deben abrir el formulario en vez de la web.
  var HOSTS_ASESORIA = ['lareservacampestre.com', 'www.lareservacampestre.com'];

  var html =
    '<button type="button" class="rc-abrir" aria-haspopup="dialog">Consultar disponibilidad</button>' +
    '<div class="rc-fondo" hidden>' +
    ' <div class="rc-caja" role="dialog" aria-modal="true" aria-labelledby="rc-titulo">' +
    '  <button type="button" class="rc-cerrar" aria-label="Cerrar">&times;</button>' +
    '  <h2 id="rc-titulo">Consulta la disponibilidad</h2>' +
    '  <p class="rc-intro">Déjanos tus datos y un asesor se comunicará contigo.</p>' +
    '  <form novalidate>' +
    '   <label>Nombre completo<input name="nombre" autocomplete="name" maxlength="100" required></label>' +
    '   <label>Celular / WhatsApp<input name="celular" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" required></label>' +
    '   <label>Correo electrónico<input name="correo" type="email" autocomplete="email" maxlength="120" required></label>' +
    '   <label>Lote de interés<select name="lote"><option value="">Quiero conocer los disponibles</option></select></label>' +
    '   <label>Mensaje (opcional)<textarea name="mensaje" rows="3" maxlength="1000"></textarea></label>' +
    '   <label class="rc-trampa" aria-hidden="true">Sitio web<input name="sitio_web" tabindex="-1" autocomplete="off"></label>' +
    '   <label class="rc-check"><input type="checkbox" name="autoriza" value="si" required>' +
    '    <span>Autorizo a La Reserva Campestre a tratar mis datos personales para contactarme sobre este proyecto (Ley 1581 de 2012).</span></label>' +
    '   <p class="rc-estado" role="status" aria-live="polite"></p>' +
    '   <button type="submit" class="rc-enviar">Enviar consulta</button>' +
    '  </form>' +
    ' </div>' +
    '</div>';

  function iniciar() {
    var raiz = document.createElement('div');
    raiz.className = 'rc-consulta';
    raiz.innerHTML = html;
    document.body.appendChild(raiz);

    var abrir = raiz.querySelector('.rc-abrir');
    var fondo = raiz.querySelector('.rc-fondo');
    var form = raiz.querySelector('form');
    var estado = raiz.querySelector('.rc-estado');
    var enviar = raiz.querySelector('.rc-enviar');
    var lotesCargados = false;

    // El visor 360 escucha el teclado; que no robe las teclas del formulario.
    ['keydown', 'keyup', 'keypress', 'wheel', 'touchmove'].forEach(function (tipo) {
      fondo.addEventListener(tipo, function (e) {
        if (tipo === 'keydown' && e.key === 'Escape') cerrar();
        e.stopPropagation();
      }, { passive: true });
    });

    function mostrarFormulario() {
      fondo.hidden = false;
      if (!lotesCargados) { lotesCargados = true; cargarLotes(form.lote); }
      setTimeout(function () { form.nombre.focus(); }, 50);
    }
    abrir.addEventListener('click', mostrarFormulario);
    redirigirAsesoria(mostrarFormulario);
    raiz.querySelector('.rc-cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      enviarConsulta(form, estado, enviar);
    });

    function cerrar() {
      fondo.hidden = true;
      abrir.focus();
    }
  }

  // El botón "Agenda tu asesoría" del skin de 3DVista abre la web de la marca.
  // Se intercepta esa apertura para mostrar el formulario sin editar el tour
  // (editar los scripts publicados activa la marca de agua de 3DVista).
  function redirigirAsesoria(mostrarFormulario) {
    var abrirOriginal = window.open;
    window.open = function (url) {
      if (esWebAsesoria(url)) {
        mostrarFormulario();
        // 3DVista llama .focus() sobre la ventana devuelta.
        return { focus: function () {}, close: function () {}, closed: true };
      }
      return abrirOriginal.apply(window, arguments);
    };
  }

  function esWebAsesoria(url) {
    try {
      var u = new URL(String(url), location.href);
      return HOSTS_ASESORIA.indexOf(u.hostname) !== -1 && (u.pathname === '/' || u.pathname === '');
    } catch (e) {
      return false;
    }
  }

  function cargarLotes(select) {
    if (!ENDPOINT) return;
    pedir(ENDPOINT, { method: 'GET' })
      .then(function (r) {
        (r.lotes || []).forEach(function (lote) {
          var op = document.createElement('option');
          op.value = op.textContent = lote;
          select.appendChild(op);
        });
      })
      .catch(function () { /* sin lista: queda la opción general */ });
  }

  function validar(form) {
    if (form.nombre.value.trim().length < 2) return [form.nombre, 'Escribe tu nombre.'];
    var digitos = form.celular.value.replace(/\D/g, '');
    if (digitos.length < 7 || digitos.length > 15) return [form.celular, 'Revisa el número de celular.'];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.correo.value.trim())) return [form.correo, 'Revisa el correo electrónico.'];
    if (!form.autoriza.checked) return [form.autoriza, 'Debes autorizar el tratamiento de datos.'];
    return null;
  }

  function enviarConsulta(form, estado, boton) {
    var error = validar(form);
    if (error) { mostrar(estado, error[1], true); error[0].focus(); return; }
    if (!ENDPOINT) { mostrar(estado, 'El formulario aún no está conectado.', true); return; }

    var datos = new URLSearchParams(new FormData(form));
    datos.set('origen', location.href);
    boton.disabled = true;
    mostrar(estado, 'Enviando…', false);

    pedir(ENDPOINT, { method: 'POST', body: datos })
      .then(function (r) {
        if (!r.ok) throw new Error(r.error || 'No pudimos registrar la consulta.');
        form.reset();
        mostrar(estado, '¡Gracias! Un asesor se comunicará contigo pronto.', false);
      })
      .catch(function (err) {
        var msg = err && err.name === 'AbortError'
          ? 'La conexión tardó demasiado. Intenta de nuevo.'
          : (err && err.message) || 'No pudimos registrar la consulta. Intenta de nuevo.';
        mostrar(estado, msg, true);
      })
      .then(function () { boton.disabled = false; });
  }

  function pedir(url, opciones) {
    var control = typeof AbortController === 'function' ? new AbortController() : null;
    var reloj = control && setTimeout(function () { control.abort(); }, TIEMPO_MAX_MS);
    if (control) opciones.signal = control.signal;
    return fetch(url, opciones)
      .then(function (res) {
        if (!res.ok) throw new Error('No pudimos registrar la consulta. Intenta de nuevo.');
        return res.json();
      })
      .finally(function () { clearTimeout(reloj); });
  }

  function mostrar(nodo, texto, esError) {
    nodo.textContent = texto;
    nodo.classList.toggle('rc-error', esError);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
