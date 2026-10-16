/**
 * Backend de la rotiseria sobre Google Sheets.
 * Configura APP_TOKEN en Propiedades del script antes de implementar.
 */
const HOJAS = {
  Productos: ['id', 'categoria', 'nombre', 'precio', 'costo', 'ingredientes'],
  Categorias: ['categoria', 'ingredientes'],
  Extras: ['categoria', 'nombre', 'precio', 'costo'],
  Pedidos: ['id', 'numero', 'fecha', 'hora', 'cliente', 'detalle', 'observaciones', 'total', 'estado', 'pagado', 'medio', 'cobrado', 'json'],
  Movimientos: ['id', 'fecha', 'hora', 'tipo', 'medio', 'monto', 'concepto']
};

function token_() {
  return PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
}

function autorizado_(token) {
  const expected = token_();
  return Boolean(expected && token && token === expected);
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HOJAS[name].length).setValues([HOJAS[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function num_(x) {
  const n = Number(String(x).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function costo_(x) {
  return (x === '' || x === null || x === undefined) ? null : num_(x);
}

function lista_(x) {
  return String(x || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function fecha_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(value || '').slice(0, 10);
}

function hora_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  return String(value || '').slice(0, 5);
}

function doGet(e) {
  try {
    if (!e || !e.parameter || !autorizado_(e.parameter.token)) return out_({ ok: false, error: 'Clave incorrecta o APP_TOKEN sin configurar' });
    if (e.parameter.action === 'catalog') return out_({ ok: true, catalog: leerCarta_() });
    if (e.parameter.action === 'state') {
      return out_({ ok: true, catalog: leerCarta_(), orders: leerPedidos_(), moves: leerMovimientos_() });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const b = JSON.parse(e.postData.contents);
    if (!autorizado_(b.token)) return out_({ ok: false, error: 'Clave incorrecta o APP_TOKEN sin configurar' });
    if (b.action === 'catalog') {
      escribirCarta_(b.catalog);
    } else if (b.action === 'push') {
      if (b.orders && b.orders.length) guardarPedidos_(b.orders);
      guardarMovimientos_(b.moves || [], b.deleteMoves || []);
    } else {
      return out_({ ok: false, error: 'Accion desconocida' });
    }
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function leerCarta_() {
  const sp = sheet_('Productos');
  const v = sp.getDataRange().getValues();
  const products = [];
  for (let r = 1; r < v.length; r++) {
    const row = v[r];
    if (!row[2]) continue;
    let id = String(row[0] || '');
    if (!id) {
      id = 'p' + Utilities.getUuid().slice(0, 8);
      sp.getRange(r + 1, 1).setValue(id);
    }
    products.push({ id: id, cat: String(row[1] || ''), name: String(row[2]), price: num_(row[3]), cost: costo_(row[4]), ings: lista_(row[5]) });
  }
  const cats = {};
  const vc = sheet_('Categorias').getDataRange().getValues();
  for (let r = 1; r < vc.length; r++) {
    if (!vc[r][0]) continue;
    cats[String(vc[r][0])] = { ings: lista_(vc[r][1]), extras: [] };
  }
  const ve = sheet_('Extras').getDataRange().getValues();
  for (let r = 1; r < ve.length; r++) {
    if (!ve[r][0] || !ve[r][1]) continue;
    const c = String(ve[r][0]);
    if (!cats[c]) cats[c] = { ings: [], extras: [] };
    cats[c].extras.push({ name: String(ve[r][1]), price: num_(ve[r][2]), cost: costo_(ve[r][3]) });
  }
  return { products: products, cats: cats };
}

function leerPedidos_() {
  const sh = sheet_('Pedidos');
  const values = sh.getDataRange().getValues();
  const orders = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0]) continue;
    let order;
    try {
      order = JSON.parse(String(row[12] || ''));
    } catch (err) {
      throw new Error('El pedido de la fila ' + (r + 1) + ' tiene un JSON invalido.');
    }
    if (!order || !Array.isArray(order.items)) throw new Error('El pedido de la fila ' + (r + 1) + ' no tiene datos validos.');
    order.id = String(row[0]);
    order.number = num_(row[1]) || order.number;
    orders.push(order);
  }
  return orders;
}

function leerMovimientos_() {
  const sh = sheet_('Movimientos');
  const values = sh.getDataRange().getValues();
  const moves = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0]) continue;
    moves.push({
      id: String(row[0]), date: fecha_(row[1]), time: hora_(row[2]),
      type: String(row[3]), method: String(row[4]), amount: num_(row[5]), concept: String(row[6] || '')
    });
  }
  return moves;
}

function escribirCarta_(c) {
  reemplazar_('Productos', c.products.map(function (p) {
    return [p.id, p.cat, p.name, p.price, p.cost === null || p.cost === undefined ? '' : p.cost, (p.ings || []).join(', ')];
  }));
  const catRows = [];
  const exRows = [];
  Object.keys(c.cats || {}).forEach(function (k) {
    catRows.push([k, (c.cats[k].ings || []).join(', ')]);
    (c.cats[k].extras || []).forEach(function (x) {
      exRows.push([k, x.name, x.price, x.cost === null || x.cost === undefined ? '' : x.cost]);
    });
  });
  reemplazar_('Categorias', catRows);
  reemplazar_('Extras', exRows);
}

function reemplazar_(name, rows) {
  const sh = sheet_(name);
  const cols = HOJAS[name].length;
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, cols).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, cols).setValues(rows);
}

function guardarPedidos_(orders) {
  const sh = sheet_('Pedidos');
  const cols = HOJAS.Pedidos.length;
  const last = sh.getLastRow();
  const pos = {};
  const maxByDate = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, cols).getValues().forEach(function (row, i) {
      const id = String(row[0] || '');
      if (id) pos[id] = { row: i + 2, number: num_(row[1]) };
      const date = fecha_(row[2]);
      maxByDate[date] = Math.max(maxByDate[date] || 0, num_(row[1]));
    });
  }
  const nuevos = [];
  orders.forEach(function (o) {
    const order = JSON.parse(o.json);
    const existing = pos[String(o.id)];
    if (existing) {
      order.number = existing.number || order.number;
    } else {
      const date = String(o.date);
      maxByDate[date] = (maxByDate[date] || 0) + 1;
      order.number = maxByDate[date];
    }
    const row = [order.id, order.number, o.date, o.time, o.customer, o.detail, o.notes, o.total, o.status, o.paid, o.method, o.paidAt, JSON.stringify(order)];
    if (existing) sh.getRange(existing.row, 1, 1, cols).setValues([row]);
    else nuevos.push(row);
  });
  if (nuevos.length) sh.getRange(sh.getLastRow() + 1, 1, nuevos.length, cols).setValues(nuevos);
}

function guardarMovimientos_(moves, deleteIds) {
  const sh = sheet_('Movimientos');
  const cols = HOJAS.Movimientos.length;
  const last = sh.getLastRow();
  const pos = {};
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) {
      if (r[0]) pos[String(r[0])] = i + 2;
    });
  }
  const nuevos = [];
  moves.forEach(function (m) {
    const row = [m.id, m.date, m.time, m.type, m.method, m.amount, m.concept];
    if (pos[String(m.id)]) sh.getRange(pos[String(m.id)], 1, 1, cols).setValues([row]);
    else nuevos.push(row);
  });
  if (nuevos.length) sh.getRange(sh.getLastRow() + 1, 1, nuevos.length, cols).setValues(nuevos);
  const rowsToDelete = deleteIds.map(function (id) { return pos[String(id)]; }).filter(Boolean).sort(function (a, b) { return b - a; });
  rowsToDelete.forEach(function (row) { sh.deleteRow(row); });
}
