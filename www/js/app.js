// ===== SEGURIDAD API KEY =====
let SecureStorage = null;
async function cargarSecureStorage(){
  try {
    const mod = await import('@capacitor-community/secure-storage');
    SecureStorage = mod.SecureStorage;
  } catch(e) { SecureStorage = null; }
}
let apiKeyGuardada = null;

async function cargarApiKey(){
  try {
    if(SecureStorage) {
      const { value } = await SecureStorage.get({ key: 'pixabay_key' });
      apiKeyGuardada = value || null;
    } else {
      apiKeyGuardada = localStorage.getItem('pixabay_key');
    }
  } catch(e) { apiKeyGuardada = localStorage.getItem('pixabay_key'); }
  const input = document.getElementById('apiKeyInput');
  if(input && apiKeyGuardada) input.value = apiKeyGuardada;
}

async function guardarApiKey(){
  const v = document.getElementById('apiKeyInput').value.trim();
  if(!v) { mostrarMensaje('Escribe una key', true); return; }
  try {
    if(SecureStorage) await SecureStorage.set({ key: 'pixabay_key', value: v });
    else localStorage.setItem('pixabay_key', v);
    apiKeyGuardada = v;
    mostrarMensaje('✅ Key guardada');
  } catch(e) { mostrarMensaje('Error al guardar', true); }
}

async function borrarApiKey(){
  try {
    if(SecureStorage) await SecureStorage.remove({ key: 'pixabay_key' });
    else localStorage.removeItem('pixabay_key');
    apiKeyGuardada = null;
    document.getElementById('apiKeyInput').value = '';
    mostrarMensaje('🗑️ Key borrada');
  } catch(e) { mostrarMensaje('Error', true); }
}

// ===== ESTADO =====
let colorSeleccionado = 0;
let debounceTimer = null;
let piezas = [];              // Array de piezas { img, x, y, w, h, rot, z }
let piezaSeleccionada = -1;
let MAX_PIEZAS = 4;

const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192, play:512 };

const COLORES = [
  { nombre:'Azul',    bg1:'#1976D2', bg2:'#0D47A1', txt:'#FFFFFF' },
  { nombre:'Naranja', bg1:'#FF9800', bg2:'#E65100', txt:'#FFFFFF' },
  { nombre:'Verde',   bg1:'#4CAF50', bg2:'#1B5E20', txt:'#FFFFFF' },
  { nombre:'Morado',  bg1:'#9C27B0', bg2:'#4A148C', txt:'#FFFFFF' },
  { nombre:'Rojo',    bg1:'#F44336', bg2:'#B71C1C', txt:'#FFFFFF' },
  { nombre:'Negro',   bg1:'#37474F', bg2:'#000000', txt:'#FFFFFF' },
  { nombre:'Rosa',    bg1:'#EC407A', bg2:'#880E4F', txt:'#FFFFFF' },
  { nombre:'Cian',    bg1:'#00BCD4', bg2:'#006064', txt:'#FFFFFF' }
];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await cargarSecureStorage();
  await cargarApiKey();
  initColores();
  initTouchCanvas();

  ['iconText','textPos','fontSize'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { draw(); preview(); }, 250); });
    el.addEventListener('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => { draw(); preview(); }, 250); });
  });

  document.getElementById('busquedaInput').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') buscarImagenes();
  });

  draw(); preview();
});

function initColores(){
  const cont = document.getElementById('colores');
  cont.innerHTML = '';
  COLORES.forEach((c, i) => {
    const b = document.createElement('div');
    b.className = 'color-ball' + (i === 0 ? ' selected' : '');
    b.style.background = `linear-gradient(135deg,${c.bg1},${c.bg2})`;
    b.title = c.nombre;
    b.onclick = () => {
      document.querySelectorAll('.color-ball').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      colorSeleccionado = i;
      draw(); preview();
    };
    cont.appendChild(b);
  });
}

// ===== DIBUJO PRINCIPAL =====
function draw() {
  const canvas = document.getElementById('mainCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Fondo
  const color = COLORES[colorSeleccionado];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, color.bg1);
  g.addColorStop(1, color.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Piezas ordenadas por z
  const ordenadas = piezas.map((p, i) => ({...p, idx: i})).sort((a,b) => a.z - b.z);
  ordenadas.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.drawImage(p.img, -p.w/2, -p.h/2, p.w, p.h);
    ctx.restore();
  });

  // Texto
  const texto = document.getElementById('iconText').value;
  if(texto) {
    const tam = parseInt(document.getElementById('fontSize').value);
    const pos = document.getElementById('textPos').value;
    ctx.fillStyle = color.txt;
    ctx.font = `bold ${tam}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    let ty = h/2;
    if(pos === 'bottom') ty = h - tam/2 - 10;
    if(pos === 'top') ty = tam/2 + 10;
    ctx.fillText(texto, w/2, ty);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  dibujarOverlay();
}

// ===== OVERLAY (borde de pieza seleccionada) =====
function dibujarOverlay() {
  const ov = document.getElementById('overlayCanvas');
  if(!ov) return;
  const ctx = ov.getContext('2d');
  ctx.clearRect(0, 0, ov.width, ov.height);
  if(piezaSeleccionada < 0 || !piezas[piezaSeleccionada]) return;
  const p = piezas[piezaSeleccionada];
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.strokeStyle = '#1976D2';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2]);
  ctx.strokeRect(-p.w/2 - 2, -p.h/2 - 2, p.w + 4, p.h + 4);
  ctx.setLineDash([]);
  // Esquinas
  ctx.fillStyle = '#1976D2';
  [[-p.w/2, -p.h/2],[p.w/2, -p.h/2],[-p.w/2, p.h/2],[p.w/2, p.h/2]].forEach(([x,y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.restore();
}

// ===== PREVIEW TAMAÑOS =====
function preview() {
  const cont = document.getElementById('previewSizes');
  if(!cont) return;
  cont.innerHTML = '';
  const orig = document.getElementById('mainCanvas');
  ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].forEach(tam => {
    const div = document.createElement('div');
    const c = document.createElement('canvas');
    c.width = c.height = sizes[tam];
    c.style.width = c.style.height = '32px';
    c.getContext('2d').drawImage(orig, 0, 0, c.width, c.height);
    const span = document.createElement('span');
    span.textContent = tam;
    div.appendChild(c);
    div.appendChild(span);
    cont.appendChild(div);
  });
  actualizarMockup();
}

function actualizarMockup() {
  const mock = document.getElementById('mockupCanvas');
  if(!mock) return;
  const ctx = mock.getContext('2d');
  ctx.clearRect(0, 0, 60, 60);
  ctx.drawImage(document.getElementById('mainCanvas'), 0, 0, 60, 60);
}

// ===== MENÚ AÑADIR PIEZA =====
function abrirMenuPieza(){
  if(piezas.length >= MAX_PIEZAS) { mostrarMensaje('Máximo ' + MAX_PIEZAS + ' piezas', true); return; }
  document.getElementById('menuPiezaModal').classList.add('show');
}
function cerrarMenuPieza(){ document.getElementById('menuPiezaModal').classList.remove('show'); }

// ===== CARGAR PIEZA DESDE ARCHIVO =====
function cargarPiezaDesdeArchivo(input){
  const f = input.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      cerrarMenuPieza();
      abrirRecorte(img);
      input.value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
}

// ===== PIXABAY =====
function abrirGaleriaPixabay(){
  if(!apiKeyGuardada) { mostrarMensaje('Configura tu API Key en ⚙️', true); return; }
  cerrarMenuPieza();
  document.getElementById('galeriaModal').classList.add('show');
}
function cerrarGaleria(){ document.getElementById('galeriaModal').classList.remove('show'); }

async function buscarImagenes(){
  const q = document.getElementById('busquedaInput').value.trim();
  if(!q) { mostrarMensaje('Escribe qué buscar', true); return; }
  const grid = document.getElementById('galeriaGrid');
  grid.innerHTML = '<p class="hint" style="grid-column:1/-1;text-align:center;padding:20px">Buscando...</p>';
  try {
    const url = `https://pixabay.com/api/?key=${apiKeyGuardada}&q=${encodeURIComponent(q)}&image_type=photo&per_page=9&lang=es&safesearch=true`;
    const resp = await fetch(url);
    if(!resp.ok) throw new Error('Error ' + resp.status);
    const data = await resp.json();
    if(!data.hits || data.hits.length === 0){
      grid.innerHTML = '<p class="hint" style="grid-column:1/-1;text-align:center;padding:20px">Sin resultados.</p>';
      return;
    }
    grid.innerHTML = '';
    data.hits.forEach(hit => {
      const div = document.createElement('div');
      div.className = 'galeria-item';
      div.innerHTML = `<img src="${hit.previewURL}" alt="${hit.tags}">`;
      div.onclick = () => seleccionarPixabay(hit.webformatURL);
      grid.appendChild(div);
    });
  } catch(err) {
    grid.innerHTML = `<p class="hint" style="grid-column:1/-1;text-align:center;padding:20px;color:#f44336">${err.message}</p>`;
  }
}

async function seleccionarPixabay(url){
  mostrarMensaje('Descargando...');
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const dataURL = await blobToDataURL(blob);
    const img = new Image();
    img.onload = () => {
      cerrarGaleria();
      abrirRecorte(img);
    };
    img.src = dataURL;
  } catch(e) { mostrarMensaje('Error al descargar', true); }
}

function blobToDataURL(blob){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// ===== RECORTE =====
let recorteImg = null;
let recorteSel = { x:0, y:0, w:0, h:0 };
let recorteArrastrando = false;
let recorteInicio = null;

function abrirRecorte(img){
  recorteImg = img;
  const modal = document.getElementById('recorteModal');
  modal.classList.add('show');
  const canvas = document.getElementById('recorteCanvas');
  // Ajustar tamaño del canvas al contenedor
  const maxW = Math.min(400, window.innerWidth - 60);
  const escala = Math.min(maxW / img.width, 400 / img.height, 1);
  canvas.width = img.width * escala;
  canvas.height = img.height * escala;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  recorteSel = { x:0, y:0, w:0, h:0 };
  initRecorteTouch();
}

function initRecorteTouch(){
  const canvas = document.getElementById('recorteCanvas');
  canvas.onpointerdown = (e) => {
    const r = canvas.getBoundingClientRect();
    recorteInicio = { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
    recorteArrastrando = true;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if(!recorteArrastrando) return;
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * canvas.width / r.width;
    const y = (e.clientY - r.top) * canvas.height / r.height;
    recorteSel.x = Math.min(recorteInicio.x, x);
    recorteSel.y = Math.min(recorteInicio.y, y);
    recorteSel.w = Math.abs(x - recorteInicio.x);
    recorteSel.h = Math.abs(y - recorteInicio.y);
    redibujarRecorte();
  };
  canvas.onpointerup = () => { recorteArrastrando = false; };
}

function redibujarRecorte(){
  const canvas = document.getElementById('recorteCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(recorteImg, 0, 0, canvas.width, canvas.height);
  if(recorteSel.w > 0 && recorteSel.h > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(recorteSel.x, recorteSel.y, recorteSel.w, recorteSel.h);
    ctx.drawImage(recorteImg, 0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(recorteSel.x, recorteSel.y, recorteSel.w, recorteSel.h);
    ctx.clip();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(recorteImg, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.strokeStyle = '#1976D2';
    ctx.lineWidth = 3;
    ctx.strokeRect(recorteSel.x, recorteSel.y, recorteSel.w, recorteSel.h);
  }
}

function confirmarRecorte(){
  if(recorteSel.w < 10 || recorteSel.h < 10) { mostrarMensaje('Selecciona un trozo más grande', true); return; }
  const canvas = document.getElementById('recorteCanvas');
  const escalaX = recorteImg.width / canvas.width;
  const escalaY = recorteImg.height / canvas.height;
  const c = document.createElement('canvas');
  c.width = recorteSel.w * escalaX;
  c.height = recorteSel.h * escalaY;
  c.getContext('2d').drawImage(recorteImg,
    recorteSel.x * escalaX, recorteSel.y * escalaY, recorteSel.w * escalaX, recorteSel.h * escalaY,
    0, 0, c.width, c.height);
  const out = new Image();
  out.onload = () => {
    cerrarRecorte();
    añadirPieza(out);
  };
  out.src = c.toDataURL();
}

function cerrarRecorte(){
  document.getElementById('recorteModal').classList.remove('show');
  recorteImg = null;
}

// ===== DIBUJO A MANO =====
let dibujando = false;
let dibujoCtx = null;

function abrirDibujo(){
  cerrarMenuPieza();
  document.getElementById('dibujoModal').classList.add('show');
  const canvas = document.getElementById('dibujoCanvas');
  canvas.width = 400; canvas.height = 400;
  dibujoCtx = canvas.getContext('2d');
  dibujoCtx.clearRect(0, 0, 400, 400);
  dibujoCtx.strokeStyle = COLORES[colorSeleccionado].txt;
  dibujoCtx.lineWidth = 8;
  dibujoCtx.lineCap = 'round';
  dibujoCtx.lineJoin = 'round';
  canvas.onpointerdown = (e) => {
    const r = canvas.getBoundingClientRect();
    dibujoCtx.beginPath();
    dibujoCtx.moveTo((e.clientX - r.left) * 400 / r.width, (e.clientY - r.top) * 400 / r.height);
    dibujando = true;
  };
  canvas.onpointermove = (e) => {
    if(!dibujando) return;
    const r = canvas.getBoundingClientRect();
    dibujoCtx.lineTo((e.clientX - r.left) * 400 / r.width, (e.clientY - r.top) * 400 / r.height);
    dibujoCtx.stroke();
  };
  canvas.onpointerup = () => { dibujando = false; };
}

function limpiarDibujo(){
  dibujoCtx.clearRect(0, 0, 400, 400);
}

function confirmarDibujo(){
  const canvas = document.getElementById('dibujoCanvas');
  // Comprobar que hay algo dibujado
  const datos = dibujoCtx.getImageData(0, 0, 400, 400);
  let hayAlgo = false;
  for(let i = 3; i < datos.data.length; i += 4) {
    if(datos.data[i] > 0) { hayAlgo = true; break; }
  }
  if(!hayAlgo) { mostrarMensaje('Dibuja algo primero', true); return; }
  const out = new Image();
  out.onload = () => {
    cerrarDibujo();
    añadirPieza(out);
  };
  out.src = canvas.toDataURL();
}

function cerrarDibujo(){
  document.getElementById('dibujoModal').classList.remove('show');
}

// ===== AÑADIR PIEZA =====
function añadirPieza(img){
  if(piezas.length >= MAX_PIEZAS) { mostrarMensaje('Máximo ' + MAX_PIEZAS + ' piezas', true); return; }
  const canvas = document.getElementById('mainCanvas');
  // Escala inicial: 50% del canvas
  const escala = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.5;
  const w = img.width * escala;
  const h = img.height * escala;
  piezas.push({
    img,
    x: canvas.width / 2,
    y: canvas.height / 2,
    w, h,
    rot: 0,
    z: piezas.length
  });
  piezaSeleccionada = piezas.length - 1;
  renderListaPiezas();
  draw(); preview();
  mostrarMensaje('✅ Pieza añadida. Arrástrala para moverla.');
}

function renderListaPiezas(){
  const card = document.getElementById('piezasCard');
  const lista = document.getElementById('piezasLista');
  if(piezas.length === 0) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  lista.innerHTML = '';
  piezas.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'pieza-thumb' + (i === piezaSeleccionada ? ' selected' : '');
    const img = document.createElement('img');
    img.src = p.img.src;
    d.appendChild(img);
    d.onclick = () => { piezaSeleccionada = i; renderListaPiezas(); draw(); };
    lista.appendChild(d);
  });
}

// ===== TOUCH SOBRE CANVAS =====
let toqueActivo = false;
let dedos = {};
let estadoInicial = null;

function initTouchCanvas(){
  const canvas = document.getElementById('mainCanvas');
  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  };
  const hitPieza = (x, y) => {
    // Buscar de arriba a abajo (mayor z primero)
    const ordenadas = piezas.map((p, i) => ({...p, idx: i})).sort((a,b) => b.z - a.z);
    for(const p of ordenadas) {
      const dx = x - p.x, dy = y - p.y;
      const cos = Math.cos(-p.rot), sin = Math.sin(-p.rot);
      const lx = dx*cos - dy*sin;
      const ly = dx*sin + dy*cos;
      if(Math.abs(lx) <= p.w/2 && Math.abs(ly) <= p.h/2) return p.idx;
    }
    return -1;
  };

  canvas.onpointerdown = (e) => {
    const pos = getPos(e);
    const idx = hitPieza(pos.x, pos.y);
    if(idx >= 0) {
      piezaSeleccionada = idx;
      // Traer al frente
      piezas[idx].z = Math.max(...piezas.map(p => p.z)) + 1;
      renderListaPiezas();
      draw();
      estadoInicial = { x: pos.x, y: pos.y, pieza: {...piezas[idx]} };
      toqueActivo = true;
      canvas.setPointerCapture(e.pointerId);
    } else {
      piezaSeleccionada = -1;
      renderListaPiezas();
      draw();
    }
  };

  canvas.onpointermove = (e) => {
    if(!toqueActivo || piezaSeleccionada < 0) return;
    const pos = getPos(e);
    const p = piezas[piezaSeleccionada];
    p.x = estadoInicial.pieza.x + (pos.x - estadoInicial.x);
    p.y = estadoInicial.pieza.y + (pos.y - estadoInicial.y);
    draw();
  };

  canvas.onpointerup = () => { toqueActivo = false; };
  canvas.onpointercancel = () => { toqueActivo = false; };

  // Pellizco y rotación con dos dedos
  canvas.addEventListener('touchmove', (e) => {
    if(e.touches.length === 2 && piezaSeleccionada >= 0 && !toqueActivo) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const t1 = e.touches[0], t2 = e.touches[1];
      const x1 = (t1.clientX - r.left) * canvas.width / r.width;
      const y1 = (t1.clientY - r.top) * canvas.height / r.height;
      const x2 = (t2.clientX - r.left) * canvas.width / r.width;
      const y2 = (t2.clientY - r.top) * canvas.height / r.height;
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const ang = Math.atan2(y2 - y1, x2 - x1);

      if(!estadoInicial || estadoInicial.tipo !== 'pinch') {
        estadoInicial = {
          tipo: 'pinch',
          dist, ang,
          pieza: {...piezas[piezaSeleccionada]}
        };
      } else {
        const p = piezas[piezaSeleccionada];
        const escala = dist / estadoInicial.dist;
        p.w = estadoInicial.pieza.w * escala;
        p.h = estadoInicial.pieza.h * escala;
        p.rot = estadoInicial.pieza.rot + (ang - estadoInicial.ang);
        draw();
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if(e.touches.length < 2) estadoInicial = null;
  });
}

// ===== ACCIONES PIEZA =====
function centrarPieza(){
  if(piezaSeleccionada < 0) return;
  const canvas = document.getElementById('mainCanvas');
  piezas[piezaSeleccionada].x = canvas.width / 2;
  piezas[piezaSeleccionada].y = canvas.height / 2;
  draw();
}

function traerAlFrente(){
  if(piezaSeleccionada < 0) return;
  piezas[piezaSeleccionada].z = Math.max(...piezas.map(p => p.z)) + 1;
  draw();
}

function borrarPieza(){
  if(piezaSeleccionada < 0) return;
  piezas.splice(piezaSeleccionada, 1);
  piezaSeleccionada = piezas.length > 0 ? 0 : -1;
  renderListaPiezas();
  draw(); preview();
}

function resetTodo(){
  piezas = [];
  piezaSeleccionada = -1;
  document.getElementById('iconText').value = '';
  document.getElementById('textPos').value = 'center';
  document.getElementById('fontSize').value = 48;
  colorSeleccionado = 0;
  document.querySelectorAll('.color-ball').forEach((b, i) => b.classList.toggle('selected', i === 0));
  renderListaPiezas();
  draw(); preview();
  mostrarMensaje('🗑️ Reiniciado');
}

// ===== DESCARGAR =====
async function descargarTodos() {
  const zip = new JSZip();
  const orig = document.getElementById('mainCanvas');
  const nombres = { mdpi:'mdpi', hdpi:'hdpi', xhdpi:'xhdpi', xxhdpi:'xxhdpi', xxxhdpi:'xxxhdpi' };

  for(const [tam, px] of Object.entries(sizes)) {
    if(tam === 'play') {
      const cp = document.createElement('canvas');
      cp.width = cp.height = 512;
      cp.getContext('2d').drawImage(orig, 0, 0, 512, 512);
      zip.file('play_store_icon.png', cp.toDataURL('image/png').split(',')[1], {base64:true});
      continue;
    }
    if(!nombres[tam]) continue;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(orig, 0, 0, px, px);
    zip.file(`res/mipmap-${tam}/ic_launcher.png`, c.toDataURL('image/png').split(',')[1], {base64:true});

    const cr = document.createElement('canvas');
    cr.width = cr.height = px;
    const ctxr = cr.getContext('2d');
    ctxr.beginPath();
    ctxr.arc(px/2, px/2, px/2, 0, Math.PI*2);
    ctxr.clip();
    ctxr.drawImage(orig, 0, 0, px, px);
    zip.file(`res/mipmap-${tam}/ic_launcher_round.png`, cr.toDataURL('image/png').split(',')[1], {base64:true});
  }

  const color = COLORES[colorSeleccionado];
  zip.file('AndroidManifest.xml.txt', `<application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:label="@string/app_name" />`);
  zip.file('colors.xml.txt', `<resources><color name="ic_background">${color.bg1}</color></resources>`);
  zip.file('ic_launcher.xml', `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`);

  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'iconos_creador.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  mostrarMensaje('✅ ZIP descargado');
}

function mostrarMensaje(txt, err){
  const m = document.getElementById('status');
  m.textContent = txt;
  m.classList.toggle('err', !!err);
  m.classList.add('show');
  setTimeout(() => m.classList.remove('show'), 2200);
}

// Exponer globales
Object.assign(window, {
  abrirMenuPieza, cerrarMenuPieza, cargarPiezaDesdeArchivo,
  abrirGaleriaPixabay, cerrarGaleria, buscarImagenes, seleccionarPixabay,
  confirmarRecorte, cerrarRecorte,
  abrirDibujo, limpiarDibujo, confirmarDibujo, cerrarDibujo,
  centrarPieza, traerAlFrente, borrarPieza, resetTodo,
  descargarTodos, guardarApiKey, borrarApiKey
});
