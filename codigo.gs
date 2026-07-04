// ═══════════════════════════════════════════════════════════════
// ERP POS LITE v4.5 — BACKEND UNIFICADO COMPLETO (Nsg.js)
// ═══════════════════════════════════════════════════════════════

const SPREADSHEET_ID = "1g1jENAm0IxzPZ69Gk-KrEZvpfsjOitW31OrgrkKZaoU"; 

const H_CATEGORIAS   = "Categorias";
const H_PRODUCTOS    = "Productos";
const H_COMPRAS      = "Compras";
const H_VENTAS       = "Ventas";
const H_VENTA_DET    = "VentaDetalle";
const H_PAPELERA     = "Papelera";
const H_ACTIVIDAD    = "Actividad";
const H_SOPORTE      = "Soporte";
const H_HACIENDA     = "HaciendaArchivos";

// ── MANTENIMIENTO ── (guardado en PropertiesService, no en hoja)
function getModoMantenimiento() {
  return PropertiesService.getScriptProperties().getProperty('mantenimiento') === 'true';
}
function setModoMantenimiento(valor) {
  PropertiesService.getScriptProperties().setProperty('mantenimiento', valor ? 'true' : 'false');
}

const HDR = {
  Categorias:    ["id","nombre","emoji","activo"],
  Productos:     ["id","nombre","código","categoría","precio_compra","precio_venta","stock","stock_minimo","imagen_url","favorito","activo","fecha_creado"],
  Compras:       ["id","producto_id","cantidad","precio_compra","fecha","usuario","notas"],
  Ventas:        ["id","fecha","cliente_nombre","subtotal","descuento","impuesto","total","pago_con","cambio","usuario","estado"],
  VentaDetalle:  ["id","venta_id","producto_id","producto_nombre","cantidad","precio_unitario","descuento_linea","subtotal_linea"],
  Papelera:      ["id","tipo","datos_originales","fecha_eliminado","eliminado_por"],
  Actividad:     ["id","fecha","usuario","accion","detalle"],
  Soporte:       ["id","usuario","titulo","descripcion","estado","fecha","fecha_actualizado","respuesta","admin"],
  HaciendaArchivos: ["id","categoria","nombre_archivo","tipo_archivo","contenido_base64","tamano_bytes","fecha","usuario"]
};

function ss()  { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function uid() { return 'id-' + (Date.now().toString(36) + Math.random().toString(36).substring(2,9)).toUpperCase(); }
function sh(n) { return ss().getSheetByName(n); }
function resp(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function log(usuario, accion, detalle) { try { sh(H_ACTIVIDAD).appendRow([uid(), new Date(), usuario||'Sistema', accion, detalle||'']); } catch(e){} }

function getData(nombre) {
  const hoja = sh(nombre);
  if (!hoja || hoja.getLastRow() < 2) return { status:'error', message:`'${nombre}' vacía.` };
  const vals = hoja.getDataRange().getValues();
  const heads = vals[0];
  const rows = vals.slice(1).map(r => {
    const o = {}; heads.forEach((h, i) => { o[h] = (r[i] instanceof Date) ? r[i].toISOString() : (r[i] === '' || r[i] == null ? '' : r[i]); });
    return o;
  }).filter(r => Object.values(r).some(v => v !== ''));
  return { status:'success', data: rows };
}

function findRow(hoja, id) {
  const vals = hoja.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).toLowerCase() === String(id).toLowerCase() || String(vals[i][2]).toLowerCase() === String(id).toLowerCase()) return { row: vals[i], idx: i };
  return { row: null, idx: -1 };
}

function crearHoja(nombre) {
  const spreadsheet = ss();
  if (!HDR[nombre]) return;
  let hoja = spreadsheet.getSheetByName(nombre);
  if (!hoja) hoja = spreadsheet.insertSheet(nombre);
  if (hoja.getLastRow() === 0) { hoja.getRange(1,1,1,HDR[nombre].length).setValues([HDR[nombre]]); hoja.setFrozenRows(1); }
}

function doGet(e) {
  const p = e.parameter; let r;
  try {
    // Acciones que siempre pasan (consulta de estado y control de mantenimiento)
    const accionesSistema = ['getEstado', 'activarMantenimiento', 'desactivarMantenimiento', 'iniciar', 'resetear'];
    if (!accionesSistema.includes(p.action) && getModoMantenimiento()) {
      return resp({status:'mantenimiento', message:'Sistema en mantenimiento. Intente más tarde.'});
    }
    switch(p.action) {
      case 'getEstado':            r = {status:'success', mantenimiento: getModoMantenimiento()}; break;
      case 'activarMantenimiento': setModoMantenimiento(true);  log('Sistema','Mantenimiento','Activado');  r = {status:'success', message:'Mantenimiento activado.'}; break;
      case 'desactivarMantenimiento': setModoMantenimiento(false); log('Sistema','Mantenimiento','Desactivado'); r = {status:'success', message:'Mantenimiento desactivado.'}; break;
      case 'iniciar':   r = iniciarBD(); break;
      case 'resetear':  r = resetearBD(); break;
      case 'getCategorias': r = getData(H_CATEGORIAS); break;
      case 'getInventario': r = {status:'success', data: (getData(H_PRODUCTOS).data || []).filter(x => x.activo === true || x.activo === 'true' || x.activo === 1)}; break;
      case 'getVentas': r = getVentasConDetalle(p.fecha_inicio, p.fecha_fin); break;
      case 'getReporte': r = getReporte(p.tipo, p.fecha_inicio, p.fecha_fin); break;
      case 'getPapelera': r = getData(H_PAPELERA); break;
      case 'getActividad': r = getData(H_ACTIVIDAD); break;
      case 'getSoporte': r = getData(H_SOPORTE); break;
      case 'getArchivosHacienda': r = getArchivosHacienda(p.categoria); break;
      case 'descargarArchivoHacienda': r = descargarArchivoHacienda(p.id); break;
      default: r = {status:'error', message:`Acción '${p.action}' no válida.`};
    }
  } catch(ex) { r = {status:'error', message:ex.message}; }
  return resp(r);
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents); let r;
    // Bloquear todo POST excepto login cuando hay mantenimiento
    if (req.action !== 'login' && getModoMantenimiento()) {
      return resp({status:'mantenimiento', message:'Sistema en mantenimiento. Intente más tarde.'});
    }
    switch(req.action) {
      case 'login': r = login(req); break;
      case 'agregarCategoria': sh(H_CATEGORIAS).appendRow([uid(), req.nombre, req.emoji||'📦', true]); r = {status:'success', message:'Categoría agregada con éxito.'}; break;
      case 'editarCategoria': r = editarCategoria(req); break;
      case 'eliminarCategoria': r = eliminarEntidad(H_CATEGORIAS, req, 'Categoría'); break;
      case 'agregarProducto': sh(H_PRODUCTOS).appendRow([uid(), req.nombre, req.codigo, req.categoria, parseFloat(req.precio_compra)||0, parseFloat(req.precio_venta)||0, parseInt(req.stock)||0, parseInt(req.stock_minimo)||5, req.imagen_url||'', false, true, new Date()]); r = {status:'success', message:'Producto registrado con éxito.'}; break;
      case 'editarProducto': r = editarProducto(req); break;
      case 'eliminarProducto': r = eliminarProducto(req); break;
      case 'restaurarProducto': r = restaurarProducto(req); break;
      case 'registrarVenta': r = registrarVenta(req); break;
      case 'registrarCompra': r = registrarCompra(req); break;
      case 'importarDatos': r = importarDatos(req); break;
      case 'crearTicketSoporte': sh(H_SOPORTE).appendRow([uid(), req.usuario, req.titulo, req.descripcion, 'nuevo', new Date(), new Date(), '', '']); r = {status:'success', message:'Ticket de soporte creado.'}; break;
      case 'subirArchivoHacienda': r = subirArchivoHacienda(req); break;
      case 'eliminarArchivoHacienda': r = eliminarArchivoHacienda(req); break;
      default: r = {status:'error', message:'Acción no reconocida'};
    }
    return resp(r);
  } catch(ex) { return resp({status:'error', message:ex.message}); }
}

function login(data) {
  if (String(data.usuario).toLowerCase() === 'admin' && (String(data.password) === 'admin123' || String(data.pin) === 'admin123')) {
    log(data.usuario, 'Login', 'Sesión iniciada');
    return {status:'success', message:'Ingreso exitoso.', data:{id:'1', usuario:'admin', rol:'admin'}};
  }
  return {status:'error', message:'Credenciales de acceso incorrectas.'};
}

function registrarVenta(data) {
  const shV = sh(H_VENTAS); const shD = sh(H_VENTA_DET); const shP = sh(H_PRODUCTOS);
  let subtotal = 0;
  for (const item of data.items) {
    const {row, idx} = findRow(shP, item.producto_id);
    if (!row) return {status:'error', message:`Producto no encontrado.`};
    if ((parseInt(row[6])||0) < parseInt(item.cantidad)) return {status:'warning', message:`Stock insuficiente de ${row[1]}`};
    item._rowIdx = idx; item._nombre = row[1]; item._subtotal = (parseFloat(item.precio_unitario)*parseInt(item.cantidad));
    subtotal += item._subtotal;
  }
  const total = subtotal;
  const ventaId = uid();
  const nombreCliente = data.cliente_nombre && data.cliente_nombre.trim() !== '' ? data.cliente_nombre : 'N/A';
  
  shV.appendRow([ventaId, new Date(), nombreCliente, subtotal, 0, 0, total, data.pago_con||0, data.cambio||0, data.usuario||'Sistema', 'completada']);
  
  for (const item of data.items) {
    shD.appendRow([uid(), ventaId, item.producto_id, item._nombre, parseInt(item.cantidad), parseFloat(item.precio_unitario), 0, item._subtotal]);
    shP.getRange(item._rowIdx+1, 7).setValue((parseInt(shP.getRange(item._rowIdx+1, 7).getValue())||0) - parseInt(item.cantidad));
  }
  log(data.usuario, 'Venta', `Total: $${total}`);
  return {status:'success', message:'Venta registrada con éxito.'};
}

function registrarCompra(data) {
  const shP = sh(H_PRODUCTOS); const {row, idx} = findRow(shP, data.producto_id);
  if (!row) return {status:'error', message:'Producto no encontrado.'};
  const cantidad = parseInt(data.cantidad)||0;
  sh(H_COMPRAS).appendRow([uid(), data.producto_id, cantidad, parseFloat(data.precio_compra)||0, new Date(), data.usuario||'Sistema', data.notas||'']);
  shP.getRange(idx+1,7).setValue((parseInt(shP.getRange(idx+1,7).getValue())||0) + cantidad);
  log(data.usuario, 'Compra', `${row[1]} x${cantidad}`);
  return {status:'success', message:`Compra registrada con éxito. Inventario actualizado.`};
}

function editarProducto(data) {
  const hoja = sh(H_PRODUCTOS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'No encontrado.'};
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  if (data.precio_compra) hoja.getRange(idx+1, 5).setValue(parseFloat(data.precio_compra));
  if (data.precio_venta) hoja.getRange(idx+1, 6).setValue(parseFloat(data.precio_venta));
  if (data.stock !== undefined) hoja.getRange(idx+1, 7).setValue(parseInt(data.stock));
  if (data.categoria) hoja.getRange(idx+1, 4).setValue(data.categoria);
  if (data.codigo) hoja.getRange(idx+1, 3).setValue(data.codigo);
  log(data.usuario, 'Editar producto', data.nombre);
  return {status:'success', message:'Producto actualizado con éxito.'};
}

function editarCategoria(data) {
  const hoja = sh(H_CATEGORIAS); const {idx} = findRow(hoja, data.id);
  if (idx < 0) return {status:'error', message:'Categoría no encontrada.'};
  if (data.nombre) hoja.getRange(idx+1, 2).setValue(data.nombre);
  log(data.usuario, 'Editar categoría', data.nombre);
  return {status:'success', message:'Categoría actualizada con éxito.'};
}

function eliminarProducto(data) {
  const hoja = sh(H_PRODUCTOS); const papelera = sh(H_PAPELERA); const {row, idx} = findRow(hoja, data.id);
  if (idx > -1) {
    papelera.appendRow([uid(), 'Producto', JSON.stringify({id:row[0], nombre:row[1], código:row[2], categoría:row[3], precio_compra:row[4], precio_venta:row[5], stock:row[6]}), new Date(), data.usuario||'Sistema']);
    hoja.getRange(idx+1, 11).setValue(false);
    log(data.usuario, 'Eliminar producto', row[1]);
    return {status:'success', message:`Producto movido a papelera exitosamente.`};
  } return {status:'error', message:'No encontrado.'};
}

function restaurarProducto(data) {
  const shPap = sh(H_PAPELERA); const shProd = sh(H_PRODUCTOS);
  const rows = shPap.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.papelera_id)) {
      const orig = JSON.parse(rows[i][2]);
      const {idx} = findRow(shProd, orig.id);
      if (idx > -1) shProd.getRange(idx+1, 11).setValue(true);
      shPap.deleteRow(i+1);
      log(data.usuario, 'Restaurar producto', orig.nombre);
      return {status:'success', message:'Producto restaurado exitosamente.'};
    }
  } return {status:'error', message:'No encontrado en papelera.'};
}

function eliminarEntidad(hoja, data, tipo) {
  const hojaObj = sh(hoja); const {idx} = findRow(hojaObj, data.id);
  if (idx > -1) { hojaObj.deleteRow(idx+1); return {status:'success', message:`${tipo} eliminada con éxito.`}; }
  return {status:'error', message:'No encontrado.'};
}

function getReporte(tipo, fechaIni, fechaFin) {
  const fi = new Date(fechaIni || 0); fi.setHours(0,0,0,0);
  const ff = new Date(fechaFin || Date.now()); ff.setHours(23,59,59,999);
  if (tipo === 'ventas') {
    // Se reutiliza getVentasConDetalle() para que el reporte traiga también
    // los items (productos, cantidades, precios) de cada venta — antes este
    // bloque llamaba directamente a getData(H_VENTAS), que NO incluye el
    // detalle, y por eso el modal de "Detalle de Venta" y el Ticket PDF
    // mostraban "No hay detalle de productos disponible para esta venta".
    const con = getVentasConDetalle();
    if (con.status !== 'success') return con;
    const f = con.data.filter(v=>{const x=new Date(v.fecha);return x>=fi&&x<=ff;});
    return {status:'success', data:f, resumen:{total:f.reduce((s,v)=>s+(parseFloat(v.total)||0),0), tickets:f.length}};
  } else if (tipo === 'compras') {
    const d = getData(H_COMPRAS); if (d.status!=='success') return d;
    const f = d.data.filter(c=>{const x=new Date(c.fecha);return x>=fi&&x<=ff;});
    return {status:'success', data:f, resumen:{total:f.reduce((s,c)=>s+((parseFloat(c.precio_compra)*parseInt(c.cantidad))||0),0)}};
  }
  return {status:'error', message:'Tipo no soportado'};
}

function getVentasConDetalle(fechaIni, fechaFin) {
  const ventas = getData(H_VENTAS).data || [];
  const detalles = getData(H_VENTA_DET).data || [];
  return {status:'success', data: ventas.map(v => ({...v, items: detalles.filter(d => String(d.venta_id) === String(v.id))}))};
}

function importarDatos(data) {
  let ok=0, err=0;
  data.filas.forEach(f => {
    try { if (data.tipo==='productos') { sh(H_PRODUCTOS).appendRow([uid(), f.nombre, f.codigo||'', f.categoria||'', parseFloat(f.precio_compra)||0, parseFloat(f.precio_venta)||0, parseInt(f.stock)||0, 5, '', false, true, new Date()]); ok++; } } catch(e){ err++; }
  });
  return {status:'success', message:`Importados: ${ok} | Errores: ${err}`};
}

// ── MINISTERIO DE HACIENDA — Archivos Generales (G) y Específicos (E) ──
// Los archivos se guardan en base64 directamente en la hoja de cálculo.
// Google Sheets tiene un límite de ~50,000 caracteres por celda, por lo
// que se restringe cada archivo a un tamaño prudente (~30 KB reales).
const HACIENDA_MAX_BASE64 = 45000;

function getArchivosHacienda(categoria) {
  const hoja = sh(H_HACIENDA);
  if (!hoja || hoja.getLastRow() < 2) return {status:'success', data:[]};
  const d = getData(H_HACIENDA);
  if (d.status !== 'success') return {status:'success', data:[]};
  let rows = d.data.map(r => ({
    id: r.id, categoria: r.categoria, nombre_archivo: r.nombre_archivo,
    tipo_archivo: r.tipo_archivo, tamano_bytes: r.tamano_bytes, fecha: r.fecha, usuario: r.usuario
  }));
  if (categoria) rows = rows.filter(r => r.categoria === categoria);
  rows.sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
  return {status:'success', data: rows};
}

function descargarArchivoHacienda(id) {
  const hoja = sh(H_HACIENDA);
  if (!hoja) return {status:'error', message:'No encontrado.'};
  const vals = hoja.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      const r = vals[i];
      return {status:'success', data:{ id:r[0], categoria:r[1], nombre_archivo:r[2], tipo_archivo:r[3], contenido_base64:r[4], tamano_bytes:r[5], fecha:r[6], usuario:r[7] }};
    }
  }
  return {status:'error', message:'Archivo no encontrado.'};
}

function subirArchivoHacienda(data) {
  if (!data.categoria || ['G','E'].indexOf(data.categoria) === -1) return {status:'error', message:'Categoría inválida (debe ser G o E).'};
  if (!data.nombre_archivo) return {status:'error', message:'Falta el nombre del archivo.'};
  if (!data.contenido_base64) return {status:'error', message:'Falta el contenido del archivo.'};
  if (data.contenido_base64.length > HACIENDA_MAX_BASE64) return {status:'error', message:'El archivo es demasiado grande. Límite aprox. 30 KB por restricción de Google Sheets.'};
  sh(H_HACIENDA).appendRow([uid(), data.categoria, data.nombre_archivo, data.tipo_archivo||'', data.contenido_base64, data.tamano_bytes||0, new Date(), data.usuario||'Sistema']);
  log(data.usuario, 'Hacienda - Subir archivo', `[${data.categoria}] ${data.nombre_archivo}`);
  return {status:'success', message:'Archivo subido con éxito.'};
}

function eliminarArchivoHacienda(data) {
  const hoja = sh(H_HACIENDA); const {idx} = findRow(hoja, data.id);
  if (idx > -1) {
    const nombre = hoja.getRange(idx+1, 3).getValue();
    hoja.deleteRow(idx+1);
    log(data.usuario, 'Hacienda - Eliminar archivo', nombre);
    return {status:'success', message:'Archivo eliminado con éxito.'};
  }
  return {status:'error', message:'No encontrado.'};
}

function iniciarBD() {
  [H_CATEGORIAS,H_PRODUCTOS,H_COMPRAS,H_VENTAS,H_VENTA_DET,H_PAPELERA,H_ACTIVIDAD,H_SOPORTE,H_HACIENDA].forEach(crearHoja);
  return {status:'success', message:'BD Lite inicializada correctamente.'};
}

function resetearBD() {
  const spreadsheet = ss();
  let tempSheet = spreadsheet.insertSheet("TempReset_" + Date.now());
  spreadsheet.getSheets().forEach(s => {
    if (s.getName() !== tempSheet.getName()) spreadsheet.deleteSheet(s);
  });
  iniciarBD();
  spreadsheet.deleteSheet(tempSheet);
  return {status: 'success', message: '¡Formateo completado! Base de datos recreada desde cero.'};
}
