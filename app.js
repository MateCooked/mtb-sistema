'use strict';
/* ---------- Carta por defecto (ingredientes y extras GENÉRICOS, a confirmar) ---------- */
const STD_EXTRAS = () => [{name:'Huevo frito',price:1500,cost:null},{name:'Mayo',price:1500,cost:null},{name:'Cheddar',price:2500,cost:null},{name:'Papas fritas',price:2500,cost:null}];
function defaultCats(){
  return {
    'Lomitos':{ings:['Lechuga','Tomate','Huevo','Jamón','Queso','Mayonesa'],extras:STD_EXTRAS()},
    'Sandwiches':{ings:['Lechuga','Tomate','Jamón','Queso','Mayonesa'],extras:STD_EXTRAS()},
    'Papas Fritas':{ings:[],extras:[]},
    'Milanesas':{ings:['Lechuga','Tomate','Jamón','Queso','Salsa'],extras:STD_EXTRAS()},
    'Tablas para compartir':{ings:[],extras:[]},
    'Hamburguesas':{ings:['Lechuga','Tomate','Cebolla','Pepinillos','Cheddar','Mayonesa','Ketchup'],extras:[{name:'Carne extra',price:1000,cost:null}].concat(STD_EXTRAS())}
  };
}

/* ---------- Datos ---------- */
const IS_ADMIN = document.body.dataset.mode === 'admin';
const LS = IS_ADMIN ? 'rotiseria_admin_v1' : 'rotiseria_v1';
const LSS = IS_ADMIN ? 'rotiseria_sync_admin' : 'rotiseria_sync';
let db = load();
if(!IS_ADMIN){
  costosParaRol(db);
  try{ localStorage.setItem(LS,JSON.stringify(db)); }catch(e){}
}
function load(){
  let d = null;
  try{ d = JSON.parse(localStorage.getItem(LS)); }catch(e){}
  if(!d || !Array.isArray(d.orders)) return {products:[],orders:[],moves:[],cats:defaultCats()};
  const r = {products:d.products||[],orders:d.orders,moves:d.moves||[],cats:d.cats};
  if(!r.cats){ r.cats = defaultCats(); r.products = r.products.filter(p=>p.cat!=='Agregados'); } /* versión anterior: los agregados pasan a ser extras */
  return costosParaRol(r);
}
function costosParaRol(state){
  if(IS_ADMIN) return state;
  state.products.forEach(p=>{ p.cost = null; });
  Object.values(state.cats||{}).forEach(c=>(c.extras||[]).forEach(e=>{ e.cost = null; }));
  state.orders.forEach(o=>(o.items||[]).forEach(i=>{
    i.cost = null;
    (i.ex||[]).forEach(e=>{ e.cost = null; });
  }));
  return state;
}
function save(){
  costosParaRol(db);
  try{ localStorage.setItem(LS, JSON.stringify(db)); }
  catch(e){ alert('No se pudo guardar en este navegador. Exportá una copia desde "Productos y datos".'); }
  scheduleSync();
}

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$ ' + (Math.round(n*100)/100).toLocaleString('es-AR',{minimumFractionDigits:0,maximumFractionDigits:2});
const pad = n => String(n).padStart(2,'0');
const dkey = t => { const d = new Date(t); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
const today = () => dkey(Date.now());
const hhmm = t => { const d = new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const parseKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y,m-1,d,12); };
const addDays = (k,n) => { const d = parseKey(k); d.setDate(d.getDate()+n); return dkey(d); };
const mondayOf = k => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return dkey(d); };
const fmtDate = k => parseKey(k).toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
const fmtShort = k => parseKey(k).toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'numeric'});
const ST = {pendiente:'Pendiente de preparación',listo:'Listo',entregado:'Entregado / despachado',cancelado:'Cancelado'};
const MET = {efectivo:'Efectivo',transferencia:'Transferencia'};
const sum = (arr,f) => arr.reduce((s,x)=>s+f(x),0);
const splitList = s => String(s||'').split(',').map(x=>x.trim()).filter(Boolean);

/* ---------- Ítems con modificaciones ---------- */
const unitOf = i => i.price + sum(i.ex||[], e=>e.price);
const TEMP_UNIT_COST = 4000;
const unitCost = i => {
  const product = db.products.find(p=>String(p.id)===String(i.pid));
  const base = i.cost!=null ? +i.cost : product&&product.cost!=null ? +product.cost : TEMP_UNIT_COST;
  return base + sum(i.ex||[], e=>e.cost||0);
};
const modParts = i => (i.rm||[]).map(x=>'SIN '+x).concat((i.ex||[]).map(e=>'+ '+e.name)).concat(i.note?['“'+i.note+'”']:[]);
const modsHTML = i => { const p = modParts(i); return p.length?'<div class="mods">'+p.map(esc).join(' · ')+'</div>':''; };
const itemText = i => i.qty+' x '+i.name+(modParts(i).length?' ('+modParts(i).join(', ')+')':'');
const lineKey = i => [i.pid,(i.rm||[]).slice().sort().join(','),(i.ex||[]).map(e=>e.name).sort().join(','),i.note||''].join('|');

/* ---------- Catálogo ---------- */
const catOf = p => p.cat || 'Sin categoría';
const catList = () => { const r = []; db.products.forEach(p=>{ if(!r.includes(catOf(p))) r.push(catOf(p)); }); return r; };
const catCfg = c => db.cats[c] || {ings:[],extras:[]};
const prodIngs = p => (p.ings && p.ings.length) ? p.ings : catCfg(p.cat).ings;
const prodExtras = p => catCfg(p.cat).extras;
const hasOpts = p => prodIngs(p).length>0 || prodExtras(p).length>0;

/* ---------- Cálculos (todo derivado de pedidos y movimientos: no hay doble registro) ---------- */
const live = o => o.status !== 'cancelado';
const orderTotal = o => sum(o.items, i=>unitOf(i)*i.qty);
const orderCost = o => sum(o.items, i=>unitCost(i)*i.qty);
const orderNet = o => orderTotal(o)-orderCost(o);
const ordersOn = (a,b) => db.orders.filter(o=>live(o)&&dkey(o.createdAt)>=a&&dkey(o.createdAt)<=b);
const cobrosOn = (a,b) => db.orders.filter(o=>live(o)&&o.paid&&dkey(o.paidAt)>=a&&dkey(o.paidAt)<=b);
const movesOn = (a,b) => db.moves.filter(m=>m.date>=a&&m.date<=b);
function balanceUntil(method, k){
  let s = 0;
  db.orders.forEach(o=>{ if(live(o)&&o.paid&&o.method===method&&dkey(o.paidAt)<=k) s+=orderTotal(o); });
  db.moves.forEach(m=>{ if(m.method===method&&m.date<=k) s+= m.type==='entrada'?m.amount:-m.amount; });
  return s;
}

/* ---------- Estado de pantalla ---------- */
let view = IS_ADMIN ? 'dashboard' : 'pedidos';
let apiAuthorized = false;
let f = {date: today(), status: 'todos'};
let cajaDate = today();
let weekStart = mondayOf(today());
let catSel = '';
let cust = null;
const newDraft = () => ({editing:null, items:[], notes:'', customer:'', paid:false, method:'efectivo'});
let draft = newDraft();
const ord = id => db.orders.find(o=>o.id===id);

/* ---------- Modal ---------- */
function modal(html){ $('#modal').innerHTML = '<div class="ov"><div class="mod">'+html+'</div></div>'; }
function closeModal(){ $('#modal').innerHTML = ''; cust = null; }
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

/* ---------- Comanda ---------- */
function comandaHTML(o){
  return '<div class="ticket">'
    + '<div class="t-h">COMANDA</div>'
    + '<div class="t-n">N° '+o.number+'</div>'
    + '<div class="t-m">'+fmtShort(dkey(o.createdAt))+' · '+hhmm(o.createdAt)+(o.customer?'<br>'+esc(o.customer):'')+'</div>'
    + o.items.map(i=>'<div class="t-i">'+i.qty+' × '+esc(i.name)
        + (i.rm||[]).map(x=>'<div class="t-d">SIN '+esc(x)+'</div>').join('')
        + (i.ex||[]).map(e=>'<div class="t-d">+ '+esc(e.name)+'</div>').join('')
        + (i.note?'<div class="t-d">» '+esc(i.note)+'</div>':'')+'</div>').join('')
    + (o.notes?'<div class="t-o">OBS: '+esc(o.notes)+'</div>':'')
    + '</div>';
}
function showComanda(id){
  const o = ord(id);
  modal('<h3>Comanda N° '+o.number+'</h3>'+comandaHTML(o)
    + '<div class="row"><button class="btn pri" data-a="print" data-id="'+o.id+'">🖨 Imprimir</button><button class="btn" data-a="closem">Cerrar</button></div>');
}
function printComanda(id){
  $('#print').innerHTML = comandaHTML(ord(id));
  window.print();
}

/* ---------- Vistas ---------- */
function render(){
  document.body.dataset.view = view;
  document.body.classList.toggle('locked',!apiAuthorized);
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on', b.dataset.v===view));
  if(!apiAuthorized){ $('#app').innerHTML = vLogin(); paintSync(); return; }
  const views = IS_ADMIN ? {dashboard:vSemana,productos:vProductos} : {pedidos:vPedidos,nuevo:vNuevo,caja:vCaja};
  if(!views[view]) view = IS_ADMIN ? 'dashboard' : 'pedidos';
  $('#app').innerHTML = views[view]();
  if(view==='nuevo') refreshSum();
  paintSync();
}
function vLogin(){
  const title = IS_ADMIN ? 'Administración' : 'Conectar sistema';
  const message = IS_ADMIN ? 'Ingresá la clave de administrador para ver el dashboard.' : 'Ingresá la clave de atención para acceder a pedidos y caja.';
  return '<section class="auth-card"><h2>'+title+'</h2><p class="note">'+message+'</p>'
    + '<label>Contraseña</label><input type="password" data-bind="stoken" autocomplete="current-password" placeholder="Ingresá tu clave">'
    + '<div class="row spaced-top-sm"><button class="btn pri" data-a="sconnect">Ingresar</button></div>'
    + '<p class="note flush-bottom" id="smsg">'+esc(syncMsg())+'</p></section>';
}

/* Nuevo / editar pedido */
function vNuevo(){
  if(!db.products.length)
    return '<div class="card empty"><p>La carta todavía no está cargada. Avisale a administración.</p></div>';
  const cats = catList(); if(!cats.includes(catSel)) catSel = cats[0];
  const ed = draft.editing ? ord(draft.editing) : null;
  return '<div class="grid2"><section><h2>'+(ed?'Editar pedido N° '+ed.number:'Nuevo pedido')+'</h2>'
    + '<div class="catbar">'+cats.map(c=>'<button class="cbtn '+(c===catSel?'on':'')+'" data-a="cat" data-c="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>'
    + '<div class="prods">'+db.products.filter(p=>catOf(p)===catSel).map(p=>'<button class="prod" data-a="add" data-id="'+p.id+'"><b>'+esc(p.name)+'</b><span>'+money(p.price)+'</span></button>').join('')+'</div></section>'
    + '<section class="card sticky" id="sum"></section></div><div class="sumbar" id="sumbar"></div>';
}
function sumHTML(){
  const ed = draft.editing ? ord(draft.editing) : null;
  const total = sum(draft.items, i=>unitOf(i)*i.qty);
  let h = '<h3>Pedido</h3>';
  if(!draft.items.length) h += '<p class="note">Elegí una categoría y tocá los productos para agregarlos.</p>';
  h += draft.items.map(i=>'<div class="line"><div class="nm"><b>'+esc(i.name)+'</b>'+modsHTML(i)+'<div class="note">'+money(unitOf(i))+' c/u</div></div>'
    + '<button class="btn sm" data-a="dec" data-id="'+i.lid+'">−</button>'
    + '<input type="number" min="1" value="'+i.qty+'" data-bind="qty" data-id="'+i.lid+'">'
    + '<button class="btn sm" data-a="inc" data-id="'+i.lid+'">＋</button>'
    + '<div class="sub">'+money(unitOf(i)*i.qty)+'</div>'
    + '<button class="btn sm" data-a="editline" data-id="'+i.lid+'" title="Modificar">✎</button>'
    + '<button class="btn sm danger" data-a="rm" data-id="'+i.lid+'" title="Quitar">✕</button></div>').join('');
  h += '<div class="total"><span>Total</span><span>'+money(total)+'</span></div>';
  h += '<label>Cliente / referencia (opcional)</label><input data-bind="customer" value="'+esc(draft.customer)+'" placeholder="Ej: Marta, mesa 3">';
  h += '<label>Observaciones generales para cocina</label><textarea rows="2" data-bind="notes" placeholder="Ej: todo junto, para llevar">'+esc(draft.notes)+'</textarea>';
  if(ed){
    h += '<p class="note">'+(ed.paid
      ? 'Este pedido ya está cobrado ('+MET[ed.method]+'). Si cambia el total, el cobro en caja se ajusta al nuevo importe.'
      : 'El cobro se registra desde la lista de pedidos.')+'</p>';
  } else {
    h += '<label>Pago</label><div class="row">'
      + '<button class="btn '+(!draft.paid?'sel':'')+'" data-a="setpaid" data-v="0">Pendiente de pago</button>'
      + '<button class="btn '+(draft.paid?'sel':'')+'" data-a="setpaid" data-v="1">Pagado</button></div>';
    if(draft.paid) h += '<div class="row spaced-top-sm">'
      + '<button class="btn '+(draft.method==='efectivo'?'sel':'')+'" data-a="setmethod" data-v="efectivo">Efectivo</button>'
      + '<button class="btn '+(draft.method==='transferencia'?'sel':'')+'" data-a="setmethod" data-v="transferencia">Transferencia</button></div>';
  }
  h += '<div class="row spaced-top"><button class="btn pri lg" data-a="savedraft">'+(ed?'Guardar cambios':'Guardar y generar comanda')+'</button>'
    + (ed?'<button class="btn" data-a="canceledit">Descartar cambios</button>':(draft.items.length?'<button class="btn" data-a="clear">Vaciar</button>':''))+'</div>';
  return h;
}
function refreshSum(){
  if($('#sum')) $('#sum').innerHTML = sumHTML();
  const bar = $('#sumbar');
  if(bar){
    const n = sum(draft.items,i=>i.qty), t = sum(draft.items,i=>unitOf(i)*i.qty);
    bar.innerHTML = n ? '<span><b>'+n+'</b> ítem'+(n>1?'s':'')+' · <b>'+money(t)+'</b></span><button class="btn pri" data-a="tosum">Ver pedido ›</button>' : '';
  }
}

/* Personalizar ítem (sin / extras / nota) */
function custHTML(){
  const p = db.products.find(x=>x.id===cust.pid);
  const ings = prodIngs(p), exs = prodExtras(p);
  const unit = p.price + sum(exs.filter(e=>cust.ex.includes(e.name)), e=>e.price);
  let h = '<h3>'+esc(p.name)+'</h3><div class="note">'+money(p.price)+' base</div>';
  h += '<div class="qty"><button class="btn" data-a="cq" data-d="-1">−</button><b>'+cust.qty+'</b><button class="btn" data-a="cq" data-d="1">＋</button></div>';
  if(ings.length) h += '<label>Ingredientes · tocá para quitar</label><div class="chips">'+ings.map(n=>'<button class="chip '+(cust.rm.includes(n)?'rm':'')+'" data-a="crm" data-n="'+esc(n)+'">'+esc(n)+'</button>').join('')+'</div>';
  if(exs.length) h += '<label>Extras · tocá para agregar</label><div class="chips">'+exs.map(e=>'<button class="chip '+(cust.ex.includes(e.name)?'ex':'')+'" data-a="cex" data-n="'+esc(e.name)+'">'+(cust.ex.includes(e.name)?'✓ ':'+ ')+esc(e.name)+' '+money(e.price)+'</button>').join('')+'</div>';
  h += '<label>Nota para este producto (opcional)</label><input data-bind="cnote" value="'+esc(cust.note)+'" placeholder="Ej: bien cocida, cortar al medio">';
  h += '<div class="row spaced-top"><button class="btn pri lg" data-a="cadd">'+(cust.lid?'Guardar cambios':'Agregar')+' · '+money(unit*cust.qty)+'</button><button class="btn" data-a="closem">Cancelar</button></div>';
  return h;
}
function addLine(line){
  const k = lineKey(line), m = draft.items.find(x=>lineKey(x)===k);
  if(m) m.qty += line.qty; else draft.items.push(line);
}

/* Lista de pedidos */
function vPedidos(){
  const day = db.orders.filter(o=>dkey(o.createdAt)===f.date);
  const rank = {pendiente:0,listo:1,entregado:2,cancelado:3};
  const list = day.filter(o=>f.status==='todos'||o.status===f.status).sort((a,b)=>{
    if(rank[a.status]!==rank[b.status]) return rank[a.status]-rank[b.status];
    return a.status==='pendiente'||a.status==='listo' ? a.createdAt-b.createdAt : b.createdAt-a.createdAt;
  });
  const cnt = s => s==='todos'?day.length:day.filter(o=>o.status===s).length;
  const open = db.orders.filter(o=>dkey(o.createdAt)!==f.date && live(o) && (o.status!=='entregado'||!o.paid));
  let h = '<div class="row"><h2 class="sp">Pedidos · '+esc(fmtDate(f.date))+'</h2>'
    + '<input type="date" value="'+f.date+'" data-bind="fdate"><button class="btn" data-a="fhoy">Hoy</button></div>';
  if(open.length){
    const first = open.map(o=>dkey(o.createdAt)).sort()[0];
    h += '<div class="warn">Hay '+open.length+' pedido(s) de otros días sin cerrar (sin entregar o sin cobrar). <button class="btn sm" data-a="fgo" data-d="'+first+'">Ver el más antiguo</button></div>';
  }
  h += '<div class="chips">'+['todos','pendiente','listo','entregado','cancelado'].map(s=>
    '<button class="btn sm '+(f.status===s?'sel':'')+'" data-a="fst" data-s="'+s+'">'+(s==='todos'?'Todos':ST[s])+' ('+cnt(s)+')</button>').join('')+'</div>';
  if(!list.length) h += '<div class="card empty note">No hay pedidos para mostrar.</div>';
  h += list.map(card).join('');
  return h;
}
function card(o){
  const t = orderTotal(o);
  let act = '';
  if(o.status==='pendiente') act += '<button class="btn ok" data-a="st" data-id="'+o.id+'" data-s="listo">✔ Marcar listo</button><button class="btn" data-a="edit" data-id="'+o.id+'">Editar</button>';
  if(o.status==='listo') act += '<button class="btn pri" data-a="st" data-id="'+o.id+'" data-s="entregado">Entregado / despachado</button><button class="btn sm" data-a="st" data-id="'+o.id+'" data-s="pendiente">↩ Volver a pendiente</button>';
  if(o.status==='entregado') act += '<button class="btn sm" data-a="st" data-id="'+o.id+'" data-s="listo">↩ Volver a listo</button>';
  if(o.status!=='cancelado' && !o.paid) act += '<button class="btn pri" data-a="cobrar" data-id="'+o.id+'">$ Cobrar</button>';
  if(o.status!=='cancelado' && o.paid) act += '<button class="btn sm" data-a="undopay" data-id="'+o.id+'">Deshacer cobro</button>';
  act += '<button class="btn" data-a="comanda" data-id="'+o.id+'">Comanda</button>';
  if(o.status!=='cancelado') act += '<button class="btn sm danger" data-a="cancel" data-id="'+o.id+'">Cancelar pedido</button>';
  return '<div class="card ord '+o.status+'"><div class="top"><span class="num">N° '+o.number+'</span><span class="note">'+hhmm(o.createdAt)+(o.customer?' · '+esc(o.customer):'')+'</span><span class="sp"></span>'
    + '<span class="badge b-'+o.status+'">'+ST[o.status]+'</span>'
    + (o.status!=='cancelado'?'<span class="badge '+(o.paid?'b-pag':'b-imp')+'">'+(o.paid?'Pagado · '+MET[o.method]:'Pago pendiente')+'</span>':'')
    + '<b>'+money(t)+'</b></div>'
    + '<div class="items">'+o.items.map(i=>'<div class="it"><b>'+i.qty+' × '+esc(i.name)+'</b>'+modsHTML(i)+'</div>').join('')+'</div>'
    + (o.notes?'<div class="obs">'+esc(o.notes)+'</div>':'')
    + '<div class="row">'+act+'</div></div>';
}

/* Caja */
function vCaja(){
  const d = cajaDate;
  const cb = cobrosOn(d,d), mv = movesOn(d,d);
  const cash = balanceUntil('efectivo',d), transfer = balanceUntil('transferencia',d);
  const total = cash+transfer;
  const rows = cb.map(o=>({ts:o.paidAt,txt:'Cobro pedido N° '+o.number,m:o.method,amt:orderTotal(o),auto:true}))
    .concat(mv.map(x=>({ts:x.ts,txt:(x.type==='entrada'?'Entrada: ':'Salida: ')+esc(x.concept),m:x.method,amt:x.type==='entrada'?x.amount:-x.amount,id:x.id})))
    .sort((a,b)=>b.ts-a.ts);
  let h = '<div class="row"><h2 class="sp">Caja · '+esc(fmtDate(d))+'</h2><input type="date" value="'+d+'" data-bind="cdate"><button class="btn" data-a="choy">Hoy</button></div>';
  h += '<div class="kpi cash-balance"><small>Saldo total al cierre del día</small><b>'+money(total)+'</b>'
    + '<div class="d">Efectivo '+money(cash)+' · Transferencia '+money(transfer)+'</div></div>';
  h += '<h3>Movimientos del día</h3>';
  h += rows.length ? '<table><tr><th>Hora</th><th>Detalle</th><th>Medio</th><th class="r">Monto</th><th></th></tr>'
    + rows.map(r=>'<tr><td>'+hhmm(r.ts)+'</td><td>'+r.txt+'</td><td>'+MET[r.m]+'</td><td class="r '+(r.amt<0?'neg':'pos')+'">'+(r.amt<0?'−':'+')+money(Math.abs(r.amt))+'</td>'
      + '<td class="r">'+(r.auto?'<span class="note">automático</span>':'<button class="btn sm danger" data-a="delmove" data-id="'+r.id+'">Borrar</button>')+'</td></tr>').join('')+'</table>'
    : '<p class="note">Sin movimientos.</p>';
  h += '<h3 class="section-title">Entrada o salida manual</h3><div class="card"><div class="row movement-form">'
    + '<select id="mv-type" class="compact-field"><option value="entrada">Entrada</option><option value="salida">Salida</option></select>'
    + '<select id="mv-method" class="compact-field"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select>'
    + '<input id="mv-amount" class="amount-field" type="number" min="0" step="0.01" placeholder="Monto">'
    + '<input id="mv-concept" class="concept-field" placeholder="Concepto (ej: compra de pollos)">'
    + '<button class="btn pri" data-a="addmove">Registrar</button></div>'
    + '<p class="note flush-bottom">Los cobros de pedidos entran solos a la caja; acá solo cargás lo que no es un pedido.</p></div>';
  return h;
}

/* Resumen semanal */
function vSemana(){
  const a = weekStart, b = addDays(a,6);
  const os = ordersOn(a,b), cb = cobrosOn(a,b), mv = movesOn(a,b);
  const canc = db.orders.filter(o=>!live(o)&&dkey(o.createdAt)>=a&&dkey(o.createdAt)<=b).length;
  const ventas = sum(os,orderTotal), costos = sum(os,orderCost), neto = ventas-costos;
  const cEf = sum(cb.filter(o=>o.method==='efectivo'),orderTotal), cTr = sum(cb.filter(o=>o.method==='transferencia'),orderTotal);
  const en = sum(mv.filter(x=>x.type==='entrada'),x=>x.amount), sa = sum(mv.filter(x=>x.type==='salida'),x=>x.amount);
  const days = [0,1,2,3,4,5,6].map(i=>addDays(a,i));
  const prod = {};
  os.forEach(o=>o.items.forEach(i=>{ const p = prod[i.name]||(prod[i.name]={q:0,t:0}); p.q+=i.qty; p.t+=unitOf(i)*i.qty; }));
  const top = Object.entries(prod).sort((x,y)=>y[1].q-x[1].q);
  const isCurrent = today()>=a && today()<=b;
  let h = '<div class="row"><h2 class="sp">Dashboard · '+fmtShort(a)+' al '+fmtShort(b)+'</h2>'
    + '<button class="btn" data-a="wprev">← Anterior</button><button class="btn" data-a="wnow">Esta semana</button><button class="btn" data-a="wnext">Siguiente →</button></div>';
  if(isCurrent && today()<b) h += '<p class="note">Semana en curso: los números llegan hasta hoy y se completan al cerrar el domingo.</p>';
  h += '<p class="note">Costo temporal: $ 4.000 por producto vendido cuando la hoja todavía no tiene un costo cargado.</p>';
  h += '<div class="kpis"><div class="kpi"><small>Ventas brutas · '+os.length+' pedidos</small><b>'+money(ventas)+'</b><div class="d">Ticket promedio '+money(os.length?ventas/os.length:0)+'</div></div>'
    + '<div class="kpi"><small>Costo de productos estimado</small><b>'+money(costos)+'</b></div>'
    + '<div class="kpi"><small>Neto estimado</small><b>'+money(neto)+'</b><div class="d">Ventas brutas menos costo de productos</div></div>'
    + '<div class="kpi"><small>Cobrado</small><b>'+money(cEf+cTr)+'</b><div class="d">Efectivo '+money(cEf)+' · Transferencia '+money(cTr)+'</div></div>'
    + '<div class="kpi"><small>Movimientos manuales</small><b>'+money(en-sa)+'</b><div class="d">Entradas '+money(en)+' · Salidas '+money(sa)+'</div></div>'
    + '<div class="kpi"><small>Pedidos cancelados</small><b>'+canc+'</b></div></div>';
  h += '<table><tr><th>Día</th><th class="r">Pedidos</th><th class="r">Ventas brutas</th><th class="r">Costo estimado</th><th class="r">Neto estimado</th><th class="r">Cobrado efectivo</th><th class="r">Cobrado transf.</th></tr>'
    + days.map(d=>{ const o = ordersOn(d,d), c = cobrosOn(d,d);
      const gross = sum(o,orderTotal), cost = sum(o,orderCost);
      return '<tr><td>'+esc(fmtShort(d))+'</td><td class="r">'+o.length+'</td><td class="r">'+money(gross)+'</td><td class="r">'+money(cost)+'</td><td class="r">'+money(gross-cost)+'</td>'
        + '<td class="r">'+money(sum(c.filter(x=>x.method==='efectivo'),orderTotal))+'</td><td class="r">'+money(sum(c.filter(x=>x.method==='transferencia'),orderTotal))+'</td></tr>'; }).join('')
    + '</table>';
  h += '<h3 class="section-title">Productos más vendidos</h3>';
  h += top.length ? '<table><tr><th>Producto</th><th class="r">Unidades</th><th class="r">Importe (con extras)</th></tr>'
    + top.map(([n,p])=>'<tr><td>'+esc(n)+'</td><td class="r">'+p.q+'</td><td class="r">'+money(p.t)+'</td></tr>').join('')+'</table>'
    : '<p class="note">Sin ventas en la semana.</p>';
  return h;
}

/* Productos y datos */
function vProductos(){
  const cats = catList();
  Object.keys(db.cats).forEach(c=>{ if(!cats.includes(c)) cats.push(c); });
  let h = '<div class="row"><h2 class="sp">Productos</h2>'+(db.products.length?'':'<button class="btn" data-a="seed">Cargar carta MTB (simulación)</button>')+'<button class="btn pri" data-a="pform">＋ Agregar producto</button></div>';
  if(db.products.length){
    h += '<div class="tw"><table><tr><th>Producto</th><th class="r">Precio</th><th class="r">Costo</th><th></th></tr>';
    cats.forEach(c=>{
      const cfg = catCfg(c), items = db.products.filter(p=>catOf(p)===c);
      h += '<tr class="cathead"><td colspan="3"><b>'+esc(c)+'</b><div class="note">Sin: '+(cfg.ings.length?esc(cfg.ings.join(', ')):'—')+' · Extras: '+(cfg.extras.length?esc(cfg.extras.map(e=>e.name+' '+money(e.price)).join(', ')):'—')+'</div></td>'
        + '<td class="r"><button class="btn sm" data-a="catform" data-c="'+esc(c)+'">Ingredientes y extras</button></td></tr>';
      h += items.map(p=>'<tr><td>'+esc(p.name)+(p.ings&&p.ings.length?' <span class="note">(ingredientes propios)</span>':'')+'</td><td class="r">'+money(p.price)+'</td><td class="r">'+(p.cost==null?'<span class="note">sin cargar</span>':money(p.cost))+'</td>'
        + '<td class="r"><button class="btn sm" data-a="pform" data-id="'+p.id+'">Editar</button> <button class="btn sm danger" data-a="pdel" data-id="'+p.id+'">Borrar</button></td></tr>').join('');
    });
    h += '</table></div>';
  } else h += '<div class="card empty note">Todavía no hay productos. Agregá el primero.</div>';
  h += '<p class="note">El costo permite estimar el neto. Si todavía no está cargado en la hoja, el dashboard usa provisionalmente $ 4.000 por unidad.</p>';
  h += '<h2 class="section-heading">Datos</h2><div class="card"><p class="note flush-top">La carta y los costos se administran desde la hoja compartida.</p>'
    + '<div class="row spaced-top-sm"><button class="btn" data-a="ssync">Sincronizar ahora</button></div></div>';
  h += '<h2 class="section-heading">Copia de seguridad</h2><div class="card"><p class="note flush-top">Los datos también se guardan en este navegador. Descargá una copia de vez en cuando, y antes de cambiar de equipo o borrar datos del navegador.</p>'
    + '<div class="row"><button class="btn" data-a="export">⬇ Descargar copia</button><button class="btn" data-a="import">⬆ Restaurar copia</button><input type="file" id="file" class="file-input" accept="application/json"></div></div>';
  return h;
}

/* ---------- Sincronización con Google Sheets ---------- */
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw0hbLhEpX5obfuvwxR98juGccOQ94qo8NLsqTeMMoSZ-kevZDBmyaOnZb13kotTrNg/exec';
const ADMIN_SESSION = 'rotiseria_admin_session';
function loadSync(){
  const base = {url:SHEETS_URL,token:'',sent:{},sentMoves:{},initialized:false,movesH:'',lastOk:0,catDirty:false};
  try{
    const stored = JSON.parse(localStorage.getItem(LSS))||{};
    const token = IS_ADMIN ? sessionStorage.getItem(ADMIN_SESSION)||'' : stored.token||'';
    return Object.assign(base,stored,{url:SHEETS_URL,token:token,catDirty:IS_ADMIN&&stored.catDirty});
  }catch(e){ return base; }
}
let sync = loadSync(), syncState = sync.token ? 'idle' : 'off', syncErr = '', syncing = false, syncAgain = false, syncTimer = null;
const saveSync = () => {
  const stored = Object.assign({},sync);
  if(IS_ADMIN){
    delete stored.token;
    try{ if(sync.token) sessionStorage.setItem(ADMIN_SESSION,sync.token); else sessionStorage.removeItem(ADMIN_SESSION); }catch(e){}
  }
  try{ localStorage.setItem(LSS, JSON.stringify(stored)); }catch(e){}
};
const hash = s => { let h = 0; for(let i=0;i<s.length;i++) h = (h*31+s.charCodeAt(i))|0; return h+':'+s.length; };
function syncMsg(){
  if(!sync.token) return 'Ingresá la clave para conectar este dispositivo.';
  if(syncState==='error') return 'Error: '+syncErr;
  return sync.lastOk ? 'Última sincronización: '+fmtShort(dkey(sync.lastOk))+' '+hhmm(sync.lastOk) : 'Conectado.';
}
function paintSync(){
  const b = $('#sync'); if(!b) return;
  b.className = 'syncb '+(syncState==='ok'?'ok':syncState==='error'?'err':'');
  b.textContent = !sync.token ? '☁ Sheets: falta clave' : syncState==='syncing' ? '☁ Sincronizando…' : syncState==='error' ? '⚠ Sin sincronizar' : '☁ Sincronizado'+(sync.lastOk?' '+hhmm(sync.lastOk):'');
  b.title = syncState==='error' ? syncErr : '';
  const m = $('#smsg'); if(m) m.textContent = syncMsg();
}
function catChanged(){ sync.catDirty = true; saveSync(); }
function catalogOut(){
  return {products:db.products.map(p=>({id:p.id,cat:p.cat||'',name:p.name,price:p.price,cost:p.cost==null?null:p.cost,ings:p.ings||[]})), cats:db.cats};
}
function applyCatalog(c){
  const before = hash(JSON.stringify(catalogOut()));
  db.products = c.products.map(p=>({id:String(p.id),cat:p.cat||'',name:p.name,price:+p.price||0,cost:(p.cost===''||p.cost==null)?null:+p.cost,ings:p.ings||[]}));
  db.cats = c.cats || {};
  const changed = before !== hash(JSON.stringify(catalogOut()));
  if(changed){ try{ localStorage.setItem(LS, JSON.stringify(db)); }catch(e){} }
  return changed;
}
function moveWithTimestamp(m){
  let ts = Number(m.ts);
  if(!Number.isFinite(ts)){
    const date = String(m.date||'').split('-').map(Number), time = String(m.time||'').split(':').map(Number);
    ts = new Date(date[0],date[1]-1,date[2],time[0]||0,time[1]||0).getTime();
  }
  return Object.assign({},m,{ts:ts});
}
async function sreq(method, body){
  let r;
  if(method==='GET') r = await fetch(sync.url+(sync.url.includes('?')?'&':'?')+'action=state&token='+encodeURIComponent(sync.token));
  else r = await fetch(sync.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({token:sync.token},body))});
  let j; try{ j = await r.json(); }catch(e){ throw new Error('Respuesta inválida: revisá la URL y que la implementación sea para "Cualquier persona".'); }
  if(!j.ok) throw new Error(j.error||'Error desconocido');
  return j;
}
const orderRow = o => ({id:o.id,number:o.number,date:dkey(o.createdAt),time:hhmm(o.createdAt),customer:o.customer||'',detail:o.items.map(itemText).join(' | '),notes:o.notes||'',
  total:orderTotal(o),status:ST[o.status],paid:o.paid?'SI':'NO',method:o.paid?MET[o.method]:'',paidAt:o.paid?dkey(o.paidAt)+' '+hhmm(o.paidAt):'',json:JSON.stringify(o)});
const moveRow = m => ({id:m.id,date:m.date,time:hhmm(m.ts),type:m.type,method:m.method,amount:m.amount,concept:m.concept});
async function doSync(opt){
  opt = opt||{};
  if(!sync.url || !sync.token) return false;
  if(syncing){ syncAgain = true; return false; }
  clearTimeout(syncTimer); syncTimer = null;
  syncing = true; syncState = 'syncing'; paintSync();
  let success = true;
  try{
    const before = hash(JSON.stringify(db));
    const initial = await sreq('GET');
    const expectedRole = IS_ADMIN ? 'admin' : 'operator';
    if(!initial.role) throw new Error('Actualizá Code.gs y desplegá la nueva versión de Apps Script.');
    if(initial.role!==expectedRole) throw new Error(IS_ADMIN ? 'La clave no habilita el acceso de administración.' : 'La clave no habilita el acceso de atención.');
    const wasAuthorized = apiAuthorized;
    apiAuthorized = true;
    const remoteOrders = Array.isArray(initial.orders) ? initial.orders : [];
    const remoteMoves = (Array.isArray(initial.moves) ? initial.moves : []).map(moveWithTimestamp);
    if(!sync.initialized){
      const orderIds = new Set(remoteOrders.map(o=>String(o.id)));
      const moveIds = new Set(remoteMoves.map(m=>String(m.id)));
      const localOrders = db.orders.filter(o=>!orderIds.has(String(o.id)));
      const localMoves = db.moves.filter(m=>!moveIds.has(String(m.id)));
      if(initial.catalog && Array.isArray(initial.catalog.products)){
        if(initial.catalog.products.length){ applyCatalog(initial.catalog); sync.catDirty = false; }
        else if(IS_ADMIN&&db.products.length) sync.catDirty = true;
        else applyCatalog(initial.catalog);
      }
      db.orders = remoteOrders.concat(localOrders);
      db.moves = remoteMoves.concat(localMoves);
      sync.sent = {};
      remoteOrders.forEach(o=>{ sync.sent[o.id] = hash(JSON.stringify(o)); });
      sync.sentMoves = {};
      remoteMoves.forEach(m=>{ sync.sentMoves[m.id] = hash(JSON.stringify(moveRow(m))); });
      sync.initialized = true;
    } else if(initial.catalog && !sync.catDirty){
      applyCatalog(initial.catalog);
    }
    const changed = db.orders.filter(o=>sync.sent[o.id]!==hash(JSON.stringify(o)));
    const changedMoves = db.moves.filter(m=>sync.sentMoves[m.id]!==hash(JSON.stringify(moveRow(m))));
    const localMoveIds = new Set(db.moves.map(m=>String(m.id)));
    const deleteMoves = Object.keys(sync.sentMoves).filter(id=>!localMoveIds.has(String(id)));
    const body = {action:'push'};
    if(changed.length) body.orders = changed.map(orderRow);
    if(changedMoves.length) body.moves = changedMoves.map(moveRow);
    if(deleteMoves.length) body.deleteMoves = deleteMoves;
    let wrote = false;
    if(sync.catDirty){ await sreq('POST',{action:'catalog',catalog:catalogOut()}); sync.catDirty = false; wrote = true; }
    if(body.orders || body.moves || body.deleteMoves){
      await sreq('POST',body);
      wrote = true;
    }
    const state = wrote ? await sreq('GET') : initial;
    if(state.catalog) applyCatalog(state.catalog);
    db.orders = Array.isArray(state.orders) ? state.orders : [];
    db.moves = (Array.isArray(state.moves) ? state.moves : []).map(moveWithTimestamp);
    const stateChanged = before!==hash(JSON.stringify(db));
    sync.sent = {};
    db.orders.forEach(o=>{ sync.sent[o.id] = hash(JSON.stringify(o)); });
    sync.sentMoves = {};
    db.moves.forEach(m=>{ sync.sentMoves[m.id] = hash(JSON.stringify(moveRow(m))); });
    try{ localStorage.setItem(LS, JSON.stringify(db)); }
    catch(e){ throw new Error('No se pudo guardar la copia local de los datos sincronizados.'); }
    sync.lastOk = Date.now(); saveSync(); syncState = 'ok'; syncErr = '';
    if((stateChanged||!wasAuthorized) && !$('#modal').innerHTML) render();
  }catch(e){ success = false; syncState = 'error'; syncErr = (e && e.message) || String(e); saveSync(); }
  syncing = false; paintSync();
  if(syncAgain){ syncAgain = false; scheduleSync(); }
  return success;
}
function scheduleSync(){
  if(!sync.url) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(()=>doSync({}), 2500);
}

/* ---------- Acciones ---------- */
const A = {
  go: d => {
    const allowed = IS_ADMIN ? ['dashboard','productos'] : ['pedidos','nuevo','caja'];
    if(allowed.includes(d.v)){ view = d.v; render(); }
  },
  closem: () => closeModal(),
  /* nuevo pedido */
  cat: d => { catSel = d.c; render(); },
  add: d => {
    const p = db.products.find(x=>x.id===d.id);
    if(hasOpts(p)){ cust = {pid:p.id,lid:null,qty:1,rm:[],ex:[],note:''}; modal(custHTML()); return; }
    addLine({lid:uid(),pid:p.id,name:p.name,price:p.price,cost:p.cost==null?null:p.cost,qty:1,rm:[],ex:[],note:''});
    refreshSum();
  },
  editline: d => {
    const i = draft.items.find(x=>x.lid===d.id), p = db.products.find(x=>x.id===i.pid);
    if(!p){ alert('Este producto ya no está en la carta. Quitalo y volvé a agregarlo.'); return; }
    cust = {pid:p.id,lid:i.lid,qty:i.qty,rm:(i.rm||[]).slice(),ex:(i.ex||[]).map(e=>e.name),note:i.note||''}; modal(custHTML());
  },
  cq: d => { cust.qty = Math.max(1,cust.qty+Number(d.d)); modal(custHTML()); },
  crm: d => { const k = cust.rm.indexOf(d.n); if(k<0) cust.rm.push(d.n); else cust.rm.splice(k,1); modal(custHTML()); },
  cex: d => { const k = cust.ex.indexOf(d.n); if(k<0) cust.ex.push(d.n); else cust.ex.splice(k,1); modal(custHTML()); },
  cadd: () => {
    const p = db.products.find(x=>x.id===cust.pid);
    const ex = prodExtras(p).filter(e=>cust.ex.includes(e.name)).map(e=>({name:e.name,price:e.price,cost:e.cost==null?null:e.cost}));
    const line = {lid:cust.lid||uid(),pid:p.id,name:p.name,price:p.price,cost:p.cost==null?null:p.cost,qty:cust.qty,rm:cust.rm.slice(),ex:ex,note:cust.note.trim()};
    if(cust.lid){ const k = draft.items.findIndex(x=>x.lid===cust.lid); draft.items[k] = line; } else addLine(line);
    closeModal(); refreshSum();
  },
  inc: d => { draft.items.find(i=>i.lid===d.id).qty++; refreshSum(); },
  dec: d => { const it = draft.items.find(i=>i.lid===d.id); if(--it.qty<=0) draft.items = draft.items.filter(x=>x!==it); refreshSum(); },
  rm: d => { draft.items = draft.items.filter(i=>i.lid!==d.id); refreshSum(); },
  tosum: () => { const s = $('#sum'); if(s && s.scrollIntoView) s.scrollIntoView({behavior:'smooth',block:'start'}); },
  setpaid: d => { draft.paid = d.v==='1'; refreshSum(); },
  setmethod: d => { draft.method = d.v; refreshSum(); },
  clear: () => { draft = newDraft(); refreshSum(); },
  canceledit: () => { draft = newDraft(); view = 'pedidos'; render(); },
  savedraft: async () => {
    if(!draft.items.length){ alert('Agregá al menos un producto.'); return; }
    let o;
    if(draft.editing){
      o = ord(draft.editing);
      o.items = draft.items.map(i=>({...i})); o.notes = draft.notes.trim(); o.customer = draft.customer.trim();
    } else {
      const now = Date.now(), k = dkey(now);
      const n = db.orders.filter(x=>dkey(x.createdAt)===k).reduce((m,x)=>Math.max(m,x.number),0)+1;
      o = {id:uid(),number:n,createdAt:now,items:draft.items.map(i=>({...i})),notes:draft.notes.trim(),customer:draft.customer.trim(),
           status:'pendiente',paid:draft.paid,method:draft.paid?draft.method:null,paidAt:draft.paid?now:null};
      db.orders.push(o);
    }
    save();
    const synced = await doSync({});
    draft = newDraft(); view = 'pedidos'; f.date = dkey(o.createdAt); f.status = 'todos'; render();
    if(!synced) alert('El pedido quedó guardado en este navegador, pero no se pudo confirmar en Google Sheets. Revisá la conexión antes de usarlo desde otro dispositivo.');
    showComanda(o.id);
  },
  /* lista */
  fhoy: () => { f.date = today(); render(); },
  fgo: d => { f.date = d.d; f.status = 'todos'; render(); },
  fst: d => { f.status = d.s; render(); },
  st: d => { const o = ord(d.id); o.status = d.s; const now = Date.now();
    o.readyAt = (d.s==='listo'||d.s==='entregado') ? (o.readyAt||now) : null;
    o.deliveredAt = d.s==='entregado' ? now : null; save(); render(); },
  edit: d => { const o = ord(d.id);
    draft = {editing:o.id,items:o.items.map(i=>({...i,lid:i.lid||uid(),rm:i.rm||[],ex:i.ex||[],note:i.note||''})),notes:o.notes||'',customer:o.customer||'',paid:o.paid,method:o.method||'efectivo'};
    view = 'nuevo'; render(); },
  comanda: d => showComanda(d.id),
  print: d => printComanda(d.id),
  cobrar: d => { const o = ord(d.id);
    modal('<h3>Cobrar pedido N° '+o.number+'</h3><div class="big">'+money(orderTotal(o))+'</div><p class="note">Elegí cómo pagó:</p>'
      + '<div class="row"><button class="btn pri lg" data-a="pay" data-id="'+o.id+'" data-m="efectivo">Efectivo</button><button class="btn pri lg" data-a="pay" data-id="'+o.id+'" data-m="transferencia">Transferencia</button></div>'
      + '<div class="spaced-top-xs"><button class="btn" data-a="closem">Volver</button></div>'); },
  pay: d => { const o = ord(d.id); if(o.paid) { closeModal(); return; } o.paid = true; o.method = d.m; o.paidAt = Date.now(); save(); closeModal(); render(); },
  undopay: d => { if(!confirm('¿Deshacer el cobro? Se descuenta de la caja.')) return; const o = ord(d.id); o.paid = false; o.method = null; o.paidAt = null; save(); render(); },
  cancel: d => { const o = ord(d.id);
    if(!confirm('¿Cancelar el pedido N° '+o.number+'?'+(o.paid?' Está cobrado: el importe se descuenta de la caja.':''))) return;
    o.status = 'cancelado'; o.cancelledAt = Date.now(); save(); render(); },
  /* caja */
  choy: () => { cajaDate = today(); render(); },
  addmove: () => {
    const amount = Math.round(parseFloat($('#mv-amount').value)*100)/100, concept = $('#mv-concept').value.trim();
    if(!(amount>0)){ alert('Ingresá un monto mayor a cero.'); return; }
    if(!concept){ alert('Escribí un concepto.'); return; }
    const ts = cajaDate===today() ? Date.now() : parseKey(cajaDate).getTime();
    db.moves.push({id:uid(),ts:ts,date:cajaDate,type:$('#mv-type').value,method:$('#mv-method').value,amount:amount,concept:concept});
    save(); render(); },
  delmove: d => { if(!confirm('¿Borrar este movimiento?')) return; db.moves = db.moves.filter(m=>m.id!==d.id); save(); render(); },
  /* semana */
  wprev: () => { weekStart = addDays(weekStart,-7); render(); },
  wnext: () => { weekStart = addDays(weekStart,7); render(); },
  wnow: () => { weekStart = mondayOf(today()); render(); },
  /* productos */
  pform: d => { const p = d.id ? db.products.find(x=>x.id===d.id) : null;
    modal('<h3>'+(p?'Editar producto':'Nuevo producto')+'</h3>'
      + '<label>Nombre</label><input id="p-name" value="'+esc(p?p.name:'')+'">'
      + '<label>Categoría</label><input id="p-cat" list="cats" value="'+esc(p&&p.cat?p.cat:(catSel||''))+'"><datalist id="cats">'+catList().map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>'
      + '<label>Precio de venta</label><input id="p-price" type="number" min="0" step="0.01" value="'+(p?p.price:'')+'">'
      + '<label>Costo (opcional, para estimar la ganancia)</label><input id="p-cost" type="number" min="0" step="0.01" value="'+(p&&p.cost!=null?p.cost:'')+'">'
      + '<label>Ingredientes propios (separados por coma). Vacío = usa los de la categoría</label><input id="p-ings" value="'+esc(p&&p.ings?p.ings.join(', '):'')+'">'
      + '<div class="row spaced-top"><button class="btn pri" data-a="psave" data-id="'+(p?p.id:'')+'">Guardar</button><button class="btn" data-a="closem">Cancelar</button></div>'); },
  psave: d => {
    const cat = $('#p-cat').value.trim(), name = $('#p-name').value.trim(), price = parseFloat($('#p-price').value), cs = $('#p-cost').value.trim(), cost = cs===''?null:parseFloat(cs);
    const ings = splitList($('#p-ings').value);
    if(!name){ alert('Escribí el nombre.'); return; }
    if(!(price>=0)){ alert('Ingresá un precio válido.'); return; }
    if(cost!==null && !(cost>=0)){ alert('El costo no es válido.'); return; }
    if(d.id){ const p = db.products.find(x=>x.id===d.id); p.name = name; p.cat = cat; p.price = price; p.cost = cost; p.ings = ings; }
    else db.products.push({id:uid(),name:name,cat:cat,price:price,cost:cost,ings:ings});
    catChanged(); save(); closeModal(); render(); },
  pdel: d => { const p = db.products.find(x=>x.id===d.id); if(!confirm('¿Borrar "'+p.name+'"? Los pedidos anteriores no cambian.')) return; db.products = db.products.filter(x=>x.id!==d.id); catChanged(); save(); render(); },
  catform: d => { const c = catCfg(d.c);
    modal('<h3>'+esc(d.c)+'</h3><label>Ingredientes que se pueden quitar (separados por coma)</label><input id="c-ings" value="'+esc(c.ings.join(', '))+'">'
      + '<label>Extras con precio (uno por línea: Nombre: precio, o Nombre: precio: costo)</label><textarea id="c-ex" rows="6">'+esc(c.extras.map(e=>e.name+': '+e.price+(e.cost!=null?': '+e.cost:'')).join('\n'))+'</textarea>'
      + '<div class="row spaced-top"><button class="btn pri" data-a="catsave" data-c="'+esc(d.c)+'">Guardar</button><button class="btn" data-a="closem">Cancelar</button></div>'); },
  catsave: d => {
    const extras = [];
    for(const line of $('#c-ex').value.split('\n')){
      if(!line.trim()) continue;
      const parts = line.split(':').map(x=>x.trim()), price = parseFloat(parts[1]), cost = parts[2]===undefined||parts[2]===''?null:parseFloat(parts[2]);
      if(!parts[0] || !(price>=0) || (cost!==null && !(cost>=0))){ alert('Revisá esta línea de extras: "'+line+'". Formato: Nombre: precio'); return; }
      extras.push({name:parts[0],price:price,cost:cost});
    }
    db.cats[d.c] = {ings:splitList($('#c-ings').value),extras:extras};
    catChanged(); save(); closeModal(); render(); },
  seed: () => {
    if(db.products.length && !confirm('Ya hay productos cargados. ¿Agregar igual la carta de ejemplo?')) return;
    const C = [
      ['Lomitos',[['Lomito Clasico Completo',15000],['Americano',17000],['Lomito Especial MTB',14000],['Lomo Funghi',16000],['Lomo Blue',15000]]],
      ['Sandwiches',[['Mila Completa',16500],['Mila BBQ',16000],['Mila MTB',15500],['Mexicano',15000]]],
      ['Papas Fritas',[['Papas Clásicas',8500],['Criminales',10000],['Salchipapas',9000],['Tentación',12000],['LomiPapas',13000]]],
      ['Milanesas',[['Milanesa Napolitana',15000],['Gula',17000],['Milanesa Especial MTB',15000],['Fugazzeta',14500],['Suprema Napolitana',15000]]],
      ['Tablas para compartir',[['Tabla MTB',16500]]],
      ['Hamburguesas',[['Cuarto de Libra',13000],['Hamburguesa Clasica Completa',12000],['Cheeseburguer',13000],['Onion Burguer',14000],['Hamburguesa Especial MTB',15000],['Crispy Burguer',14000],['Tasty Burguer',14000],['Explosiva',14000]]]
    ];
    C.forEach(([cat,items])=>items.forEach(([name,price])=>db.products.push({id:uid(),name:name,cat:cat,price:price,cost:null,ings:[]})));
    Object.keys(defaultCats()).forEach(c=>{ if(!db.cats[c]) db.cats[c] = defaultCats()[c]; });
    catChanged(); save(); render(); },
  /* Google Sheets */
  sconnect: async () => {
    if(!sync.token){ alert('Completá la clave de conexión.'); return; }
    saveSync();
    await doSync({pull:true});
    render();
  },
  ssync: () => doSync({pull:true}),
  spush: () => { if(!sync.token){ alert('Ingresá la clave y conectá primero.'); return; } if(!confirm('Esto reemplaza la carta del Sheet por la de la app. ¿Continuar?')) return; sync.catDirty = true; saveSync(); doSync({}); },
  sdisc: () => { if(!confirm('¿Cerrar la sesión de administración en este navegador?')) return; sync = {url:SHEETS_URL,token:'',sent:{},sentMoves:{},initialized:false,movesH:'',lastOk:0,catDirty:false}; apiAuthorized = false; saveSync(); syncState = 'off'; render(); },
  /* datos */
  export: () => {
    const blob = new Blob([JSON.stringify(db,null,1)],{type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rotiseria-copia-'+today()+'.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); },
  import: () => $('#file').click()
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if(!b) return;
  const fn = A[b.dataset.a]; if(fn) fn(b.dataset);
});
document.addEventListener('input', e => {
  const b = e.target.dataset && e.target.dataset.bind;
  if(b==='customer') draft.customer = e.target.value;
  else if(b==='notes') draft.notes = e.target.value;
  else if(b==='cnote' && cust) cust.note = e.target.value;
  else if(b==='stoken'){ sync.token = e.target.value.trim(); saveSync(); }
});
document.addEventListener('change', e => {
  const t = e.target, b = t.dataset && t.dataset.bind;
  if(b==='qty'){
    const it = draft.items.find(i=>i.lid===t.dataset.id), q = Math.floor(+t.value);
    if(it){ if(q>0) it.qty = q; else draft.items = draft.items.filter(x=>x!==it); }
    refreshSum();
  } else if(b==='fdate'){ f.date = t.value || today(); render(); }
  else if(b==='cdate'){ cajaDate = t.value || today(); render(); }
  else if(t.id==='file' && t.files[0]){
    const r = new FileReader();
    r.onload = () => {
      try{
        const d = JSON.parse(r.result);
        if(!d || !Array.isArray(d.orders) || !Array.isArray(d.products)) throw 0;
        if(!confirm('Esto reemplaza TODOS los datos actuales por los de la copia. ¿Continuar?')) return;
        db = {products:d.products,orders:d.orders,moves:d.moves||[],cats:d.cats||defaultCats()}; catChanged(); save(); render(); alert('Copia restaurada.');
      }catch(err){ alert('El archivo no es una copia válida.'); }
    };
    r.readAsText(t.files[0]);
  }
});
window.addEventListener('afterprint', () => { $('#print').innerHTML = ''; });
window.addEventListener('online', () => doSync({pull:true}));
setInterval(() => { if(sync.token && !$('#modal').innerHTML) doSync({pull:true}); }, 120000);
render();
if(sync.token) doSync({pull:true});
