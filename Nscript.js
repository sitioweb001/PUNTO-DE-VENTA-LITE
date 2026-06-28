// ═══════════════════════════════════════════════════════════════
// ERP POS LITE v3.5 — LOGIC FRONTEND (Nscript.js)
// ═══════════════════════════════════════════════════════════════
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwbYNUf0--D2RVqFyaBZHFxQuClX6RBybuhK6kJU9Q02NZyICUIXEnUWIR1x25xMnfMrA/exec";
let inventarioGlobal = [], carrito = [];
let searchTimeout = null;
let html5QrScanner = null;
let currentScannerTarget = '';

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupMobileMenu();
  setupFastLoginShortcut();
  
  // Escuchar entrada de vuelto
  document.getElementById('v_pago_con').addEventListener('input', calcularVueltoCambio);
  
  // Forms submit
  setupFormsSubmit();
});

// EFECTO VISUAL: PARPADEO VERDE EXITOSO + TOAST VISIBLE
function dispararAccionExitosa(mensaje) {
  const body = document.getElementById('appBody');
  body.classList.add('flash-success');
  setTimeout(() => { body.classList.remove('flash-success'); }, 600);
  showToast(mensaje, 'success');
}

function showToast(msg, type='success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fas ${type==='success'?'fa-check-circle':'fa-exclamation-triangle'}"></i> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// SHORTCUT RAPIDO DE LOGIN: 2 CLIPS (DOUBLE CLICK)
function setupFastLoginShortcut() {
  const card = document.getElementById('loginCard');
  if (card) {
    card.addEventListener('dblclick', () => {
      document.getElementById('login_usuario').value = 'admin';
      document.getElementById('login_password').value = 'admin123';
      showToast('Autorellenado rápido aplicado.', 'warning');
      handleLogin();
    });
  }
}

async function handleLogin() {
  const u = document.getElementById('login_usuario').value.trim();
  const p = document.getElementById('login_password').value.trim();
  
  if (u.toLowerCase() === 'admin' && p === 'admin123') {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    dispararAccionExitosa('Sesión iniciada correctamente.');
    await loadInitialData();
  } else {
    showToast('PIN o Usuario incorrecto.', 'error');
  }
}

// ENRUTAMIENTO Y MENÚS
function setupNavigation() {
  document.querySelectorAll('.sidebar-nav a[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const sectionId = link.getAttribute('data-section');
      
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(sectionId).classList.add('active');
      
      document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      
      // Cerrar cámara si cambia de sección
      detenerCamaraEscaneo();
      
      if (sectionId === 'inventario') loadInventario();
      if (sectionId === 'papelera') loadPapelera();
    });
  });
}

function setupMobileMenu() {
  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
  });
}

async function loadInitialData() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getCategorias`).then(r => r.json());
    if (res.status === 'success') {
      const p_cat = document.getElementById('p_categoria');
      const ul = document.getElementById('listaCategorias');
      p_cat.innerHTML = '<option value="">Seleccione...</option>';
      ul.innerHTML = '';
      res.data.forEach(c => {
        p_cat.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
        ul.innerHTML += `<li style="padding:10px; background:var(--bg-card); border:1px solid var(--border-color); margin-bottom:6px; border-radius:var(--radius); display:flex; justify-content:space-between;"><span>📦 ${c.nombre}</span></li>`;
      });
    }
    await loadInventario();
  } catch(e) {}
}

async function loadInventario() {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=getInventario`).then(r => r.json());
    if (res.status === 'success') {
      inventarioGlobal = res.data;
      filtrarInventario();
    }
  } catch(e) {}
}

function filtrarInventario() {
  const q = document.getElementById('f_texto').value.toLowerCase();
  const body = document.getElementById('inventarioBody');
  const filtered = inventarioGlobal.filter(p => p.nombre.toLowerCase().includes(q) || String(p['código']).toLowerCase().includes(q));
  
  body.innerHTML = filtered.map(p => `<tr>
    <td><b>${p.nombre}</b></td>
    <td><code>${p['código'] || '—'}</code></td>
    <td>${p['categoría']}</td>
    <td><b>${p.stock}</b></td>
    <td>$${parseFloat(p.precio_compra).toFixed(2)}</td>
    <td>$${parseFloat(p.precio_venta).toFixed(2)}</td>
  </tr>`).join('');
}

// ESCÁNER DE CÁMARA & AUTO-SUMA POR LECTURA DIRECTA
function activarCamaraEscaneo(target) {
  currentScannerTarget = target;
  const container = document.getElementById('scannerContainer');
  container.classList.remove('hidden');
  
  if (html5QrScanner) { html5QrScanner.clear(); }
  
  html5QrScanner = new Html5Qrcode("interactiveScanner");
  html5QrScanner.start(
    { facingMode: "environment" },
    { fps: 15, qrbox: { width: 260, height: 160 } },
    (decodedText) => {
      // Al leer correctamente un código
      if (currentScannerTarget === 'v') {
        // Ejecuta auto-suma directa
        procesarLecturaCodigoBarrasPOS(decodedText);
      } else if (currentScannerTarget === 'p') {
        document.getElementById('p_codigo').value = decodedText;
        dispararAccionExitosa('Código de barras capturado.');
        detenerCamaraEscaneo();
      }
    },
    () => {}
  ).catch(() => { showToast('No se pudo acceder a la cámara.', 'error'); });
}

function detenerCamaraEscaneo() {
  document.getElementById('scannerContainer').classList.add('hidden');
  if (html5QrScanner) {
    html5QrScanner.stop().then(() => html5QrScanner.clear()).catch(()=>{});
    html5QrScanner = null;
  }
}

// BÚSQUEDA Y AUTO-SUMA EN PUNTO DE VENTA
document.getElementById('v_query').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const val = e.target.value.trim();
  if (!val) { document.getElementById('v_sugerencias').classList.add('hidden'); return; }
  
  // Match exacto directo (simula pistola lectora de código de barras físico)
  const exactItem = inventarioGlobal.find(p => String(p['código']).toLowerCase() === val.toLowerCase());
  if (exactItem) {
    agregarItemAlCarrito(exactItem);
    e.target.value = '';
    document.getElementById('v_sugerencias').classList.add('hidden');
    return;
  }
  
  searchTimeout = setTimeout(() => {
    const matching = inventarioGlobal.filter(p => p.nombre.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
    const sug = document.getElementById('v_sugerencias');
    if (matching.length) {
      sug.innerHTML = matching.map(p => `<div style="padding:10px; border-bottom:1px solid var(--border-color); cursor:pointer;" onclick='seleccionarItemSugerido(${JSON.stringify(p)})'>${p.nombre} - $${parseFloat(p.precio_venta).toFixed(2)}</div>`).join('');
      sug.classList.remove('hidden');
    } else { sug.classList.add('hidden'); }
  }, 250);
});

function procesarLecturaCodigoBarrasPOS(codigo) {
  const item = inventarioGlobal.find(p => String(p['código']).toLowerCase() === codigo.toLowerCase());
  if (item) {
    agregarItemAlCarrito(item);
  } else {
    showToast(`Código ${codigo} no está en el catálogo.`, 'warning');
  }
}

function seleccionarItemSugerido(p) {
  agregarItemAlCarrito(p);
  document.getElementById('v_query').value = '';
  document.getElementById('v_sugerencias').classList.add('hidden');
}

function agregarItemAlCarrito(p) {
  const exist = carrito.find(x => x.producto_id === p.id);
  if (exist) {
    exist.cantidad++;
  } else {
    carrito.push({ producto_id: p.id, nombre: p.nombre, cantidad: 1, precio_unitario: parseFloat(p.precio_venta) });
  }
  renderCarrito();
  dispararAccionExitosa(`Añadido: ${p.nombre}`);
}

function renderCarrito() {
  const el = document.getElementById('carritoItems');
  if (!carrito.length) {
    el.innerHTML = '<p class="text-muted text-center" style="margin-top:3rem;">Carrito vacío</p>';
    document.getElementById('c_total').textContent = '$0.00';
    document.getElementById('c_total').dataset.val = '0';
    calcularVueltoCambio();
    return;
  }
  
  let total = 0;
  el.innerHTML = carrito.map((item, index) => {
    total += item.cantidad * item.precio_unitario;
    return `<div class="carrito-item">
      <div style="flex:1; font-weight:600;">${item.nombre}</div>
      <div class="carrito-qty">
        <button onclick="cambiarCantidadCarrito(${index},-1)">-</button>
        <span style="min-width:24px; text-align:center; display:inline-block;">${item.cantidad}</span>
        <button onclick="cambiarCantidadCarrito(${index},1)">+</button>
      </div>
      <div style="width:75px; text-align:right; font-weight:700;">$${(item.cantidad * item.precio_unitario).toFixed(2)}</div>
    </div>`;
  }).join('');
  
  document.getElementById('c_total').dataset.val = total;
  document.getElementById('c_total').textContent = `$${total.toFixed(2)}`;
  calcularVueltoCambio();
}

function cambiarCantidadCarrito(index, delta) {
  carrito[index].cantidad += delta;
  if (carrito[index].cantidad <= 0) carrito.splice(index, 1);
  renderCarrito();
}

// CÁLCULO DE VUELTO/CAMBIO AUTOMÁTICO
function calcularVueltoCambio() {
  const total = parseFloat(document.getElementById('c_total').dataset.val) || 0;
  const pago = parseFloat(document.getElementById('v_pago_con').value) || 0;
  const vuelto = pago - total;
  document.getElementById('v_cambio').value = vuelto >= 0 ? `$${vuelto.toFixed(2)}` : '$0.00';
}

async function finalizarVenta() {
  if (!carrito.length) return showToast('El carrito está vacío.', 'warning');
  const btn = document.getElementById('btnFinalizarVenta');
  btn.disabled = true;
  
  const payload = {
    action: 'registrarVenta',
    usuario: 'admin',
    pago_con: parseFloat(document.getElementById('v_pago_con').value) || 0,
    cambio: parseFloat(document.getElementById('v_cambio').value.replace('$', '')) || 0,
    items: carrito
  };
  
  try {
    const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) }).then(r => r.json());
    if (res.status === 'success') {
      dispararAccionExitosa('¡Cobro exitoso registrado en la nube!');
      carrito = [];
      renderCarrito();
      document.getElementById('v_pago_con').value = '';
      await loadInventario();
    } else { showToast(res.message, 'error'); }
  } catch(e) { showToast('Error en el servidor.', 'error'); }
  btn.disabled = false;
}

// SUBMIT DE FORMULARIOS UNIFICADOS
function setupFormsSubmit() {
  // Producto
  document.getElementById('productoForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      action: 'agregarProducto',
      codigo: document.getElementById('p_codigo').value,
      nombre: document.getElementById('p_nombre').value,
      categoria: document.getElementById('p_categoria').value,
      stock: document.getElementById('p_stock').value,
      precio_compra: document.getElementById('p_precio_compra').value,
      precio_venta: document.getElementById('p_precio_venta').value
    };
    const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) }).then(r => r.json());
    if (res.status === 'success') {
      dispararAccionExitosa('Producto registrado correctamente.');
      e.target.reset();
      await loadInitialData();
    }
  });

  // Categoría
  document.getElementById('categoriaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = { action: 'agregarCategoria', nombre: document.getElementById('c_nombre').value };
    const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) }).then(r => r.json());
    if (res.status === 'success') {
      dispararAccionExitosa('Categoría creada.');
      e.target.reset();
      await loadInitialData();
    }
  });
}

// COMPRAS LOGICA
document.getElementById('co_query').addEventListener('input', e => {
  const val = e.target.value.trim();
  if(!val) return;
  const match = inventarioGlobal.filter(p => p.nombre.toLowerCase().includes(val.toLowerCase()) || String(p['código']).includes(val));
  const sug = document.getElementById('co_sugerencias');
  if(match.length) {
    sug.innerHTML = match.map(p => `<div style="padding:10px; cursor:pointer;" onclick='document.getElementById("co_query").value="${p.nombre}"; document.getElementById("co_prod_id").value="${p.id}"; document.getElementById("co_sugerencias").classList.add("hidden");'>${p.nombre}</div>`).join('');
    sug.classList.remove('hidden');
  }
});

document.getElementById('compraForm').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    action: 'registrarCompra',
    producto_id: document.getElementById('co_prod_id').value,
    cantidad: document.getElementById('co_cantidad').value,
    precio_compra: document.getElementById('co_precio').value,
    usuario: 'admin'
  };
  const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify(payload) }).then(r => r.json());
  if (res.status === 'success') { dispararAccionExitosa('Compra de mercadería ingresada.'); e.target.reset(); await loadInventario(); }
});

// REPORTES
async function cargarReporte(periodo) {
  const hoy = new Date(); let ini = new Date();
  if (periodo === 'semana') ini.setDate(hoy.getDate() - 7);
  if (periodo === 'mes') ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  
  const res = await fetch(`${SCRIPT_URL}?action=getReporte&tipo=ventas&fecha_inicio=${ini.toISOString()}&fecha_fin=${hoy.toISOString()}`).then(r => r.json());
  if(res.status === 'success') {
    document.getElementById('resumenReporte').innerHTML = `<div style="padding:15px; background:var(--success-light); color:var(--success-color); border-radius:8px; font-weight:bold; margin-bottom:1rem;">Total Recaudado en Periodo: $${res.resumen.total.toFixed(2)}</div>`;
    document.getElementById('repHead').innerHTML = '<tr><th>ID Venta</th><th>Fecha</th><th>Total Facturado</th></tr>';
    document.getElementById('repBody').innerHTML = res.data.map(v => `<tr><td><code>${v.id}</code></td><td>${new Date(v.fecha).toLocaleDateString()}</td><td><b>$${parseFloat(v.total).toFixed(2)}</b></td></tr>`).join('');
  }
}

// PAPELERA DE PRODUCTOS
async function loadPapelera() {
  const res = await fetch(`${SCRIPT_URL}?action=getPapelera`).then(r => r.json());
  const body = document.getElementById('papeleraBody');
  if(res.status !== 'success' || !res.data.length) { body.innerHTML = '<tr><td colspan="4" class="text-center">Papelera vacía</td></tr>'; return; }
  
  body.innerHTML = res.data.map(p => {
    let d = {}; try { d = JSON.parse(p.datos_originales); } catch(e){}
    return `<tr>
      <td>${p.type || 'Producto'}</td>
      <td>${d.nombre || '—'}</td>
      <td>${new Date(p.fecha_eliminado).toLocaleDateString()}</td>
      <td><button class="btn secondary-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="restaurarDePapelera('${p.id}')">Restaurar</button></td>
    </tr>`;
  }).join('');
}

async function restaurarDePapelera(id) {
  const res = await fetch(SCRIPT_URL, { method:'POST', body: JSON.stringify({action:'restaurarProducto', papelera_id:id, usuario:'admin'}) }).then(r => r.json());
  if(res.status==='success') { dispararAccionExitosa('Producto restaurado.'); await loadInventario(); await loadPapelera(); }
}

// IMPORTADOR MASIVO
async function procesarArchivoImportador() {
  const fileInput = document.getElementById('imp_file');
  if(!fileInput.files.length) return showToast('Selecciona un archivo primero.', 'warning');
  // Simulación exitosa simplificada para evitar bloqueos
  dispararAccionExitosa('Simulación de procesamiento ejecutada.');
}

async function iniciarBaseDeDatosRemota() {
  const res = await fetch(`${SCRIPT_URL}?action=iniciar`).then(r => r.json());
  if(res.status==='success') dispararAccionExitosa('¡Hojas de cálculo vinculadas!');
}
