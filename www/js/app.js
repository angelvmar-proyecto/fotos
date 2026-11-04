// ===== ESTADO GLOBAL =====
let currentSize = 'xhdpi';
let history = [];
let historyIndex = -1;
let linealImageData = null;
let iconImage = null;
let fondoTransparente = false;
let debounceTimer = null;

const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192, adap:512, play:512, round:192 };
const coloresPlantillas = {
  mar:['#1976D2','#0D47A1'], caribe:['#FF9800','#E65100'], eco:['#4CAF50','#2E7D32'],
  pro:['#9C27B0','#6A1B9A'], urgente:['#F44336','#C62828'], neutro:['#607D8B','#37474F']
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById('tab-' + id).style.display = 'block';
      if(id === 'design') draw();
      if(id === 'manifest') generarCodigosXML();
    });
  });

  document.querySelectorAll('.size-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.size-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentSize = item.getAttribute('data-size');
      generarVistaPrevia();
    });
  });

  // Listeners de diseño (con debounce para no saturar historial)
  ['bgType','bgColor1','bgColor1Grad','bgColor2','shapeType','shapeColor','shapeSize',
   'iconText','textColor','fontSize'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const handler = () => { drawDebounced(); generarVistaPreviaDebounced(); };
    el.addEventListener('change', handler);
    if(el.tagName !== 'SELECT') el.addEventListener('input', handler);
  });

  // Listeners de arte lineal (en vivo)
  ['linealNivel','linealBrillo','linealContraste','linealUmbral','linealColorLineas','linealFondo','linealGrosor'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => { if(linealImageData) aplicarArteLineal(); });
  });

  document.getElementById('linealNivel').addEventListener('input', function(){
    document.getElementById('linealNivelEtiqueta').textContent = this.value + '%';
  });

  // Listeners de icono (en vivo)
  ['iconScale','iconOffsetX','iconOffsetY'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', dibujarIcono);
  });

  draw();
  cargarProyectosGuardados();
  generarVistaPrevia();
  generarCodigosXML();
});

// ===== DEBOUNCE =====
function drawDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(draw, 400); }
function generarVistaPreviaDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(generarVistaPrevia, 400); }

// ===== DIBUJO PRINCIPAL (bug sombra corregido) =====
function draw() {
  const canvas = document.getElementById('mainCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // Fondo
  const bgType = document.getElementById('bgType').value;
  if(bgType === 'solid') {
    ctx.fillStyle = document.getElementById('bgColor1').value;
    ctx.fillRect(0,0,w,h);
  } else if(bgType === 'gradient') {
    const c1 = document.getElementById('bgColor1Grad').value;
    const c2 = document.getElementById('bgColor2').value;
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  }

  // Sombra ANTES de dibujar figura/texto (bug corregido)
  const sombraOn = document.getElementById('shadowOn').classList.contains('on');
  if(sombraOn) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
  } else {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }

  // Figura
  const shapeType = document.getElementById('shapeType').value;
  const shapeColor = document.getElementById('shapeColor').value;
  const shapeSize = parseInt(document.getElementById('shapeSize').value)/100 * Math.min(w,h);
  const cx = w/2, cy = h/2;

  if(shapeType !== 'none') {
    ctx.fillStyle = shapeColor;
    ctx.beginPath();
    if(shapeType === 'circle') ctx.arc(cx, cy, shapeSize/2, 0, Math.PI*2);
    else if(shapeType === 'square') ctx.rect(cx-shapeSize/2, cy-shapeSize/2, shapeSize, shapeSize);
    else if(shapeType === 'rounded') roundRect(ctx, cx-shapeSize/2, cy-shapeSize/2, shapeSize, shapeSize, shapeSize*0.15);
    else if(shapeType === 'triangle') {
      ctx.moveTo(cx, cy-shapeSize/2);
      ctx.lineTo(cx+shapeSize/2, cy+shapeSize/2);
      ctx.lineTo(cx-shapeSize/2, cy+shapeSize/2);
      ctx.closePath();
    } else if(shapeType === 'hexagon') {
      for(let i=0;i<6;i++){
        const ang = (i*Math.PI/3) - Math.PI/2;
        const px = cx + Math.cos(ang)*shapeSize/2;
        const py = cy + Math.sin(ang)*shapeSize/2;
        if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      ctx.closePath();
    }
    ctx.fill();
  }

  // Texto (sin sombra heredada)
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  const texto = document.getElementById('iconText').value;
  if(texto) {
    ctx.fillStyle = document.getElementById('textColor').value;
    const tam = parseInt(document.getElementById('fontSize').value);
    const negrita = document.getElementById('fontBold').classList.contains('on');
    ctx.font = `${negrita?'bold ':''}${tam}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, w/2, h/2);
  }

  // Borde
  if(document.getElementById('borderOn').classList.contains('on')) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1,1,w-2,h-2);
  }

  guardarHistorial();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

// ===== HISTORIAL (bug 512 corregido) =====
function guardarHistorial() {
  // Solo guardar si cambió respecto al último
  const actual = document.getElementById('mainCanvas').toDataURL();
  if(history[historyIndex] === actual) return;
  historyIndex++;
  history = history.slice(0, historyIndex);
  history.push(actual);
  if(history.length > 30) { history.shift(); historyIndex--; }
}

function undo() {
  if(historyIndex > 0) {
    historyIndex--;
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('mainCanvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
    };
    img.src = history[historyIndex];
  }
}

function redo() {
  if(historyIndex < history.length - 1) {
    historyIndex++;
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('mainCanvas');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
    };
    img.src = history[historyIndex];
  }
}

// ===== PLANTILLAS Y CONTROLES =====
function applyTemplate(nombre) {
  const c = coloresPlantillas[nombre];
  document.getElementById('bgType').value = 'gradient';
  document.getElementById('bgColor1Grad').value = c[0];
  document.getElementById('bgColor2').value = c[1];
  toggleBgOptions();
  draw(); generarVistaPrevia();
}

function toggleBgOptions() {
  const tipo = document.getElementById('bgType').value;
  document.getElementById('bgSolidRow').style.display = tipo === 'solid' ? 'flex' : 'none';
  document.getElementById('bgGradientRow').style.display = tipo === 'gradient' ? 'flex' : 'none';
}

function resetDesign() {
  document.getElementById('bgType').value = 'gradient';
  document.getElementById('bgColor1Grad').value = '#1976D2';
  document.getElementById('bgColor2').value = '#0D47A1';
  document.getElementById('shapeType').value = 'circle';
  document.getElementById('shapeColor').value = '#FFFFFF';
  document.getElementById('shapeSize').value = '38';
  document.getElementById('iconText').value = '';
  document.getElementById('textColor').value = '#FFFFFF';
  document.getElementById('fontSize').value = '48';
  document.getElementById('fontBold').classList.add('on');
  document.getElementById('shadowOn').classList.remove('on');
  document.getElementById('borderOn').classList.remove('on');
  toggleBgOptions(); draw(); generarVistaPrevia();
}

// ===== VISTA PREVIA DE TAMAÑOS =====
function generarVistaPrevia() {
  const contenedor = document.getElementById('previewArea');
  if(!contenedor) return;
  contenedor.innerHTML = '';
  const orig = document.getElementById('mainCanvas');
  ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi'].forEach(tam => {
    const div = document.createElement('div');
    div.className = 'icon-preview';
    const c = document.createElement('canvas');
    c.width = c.height = sizes[tam];
    c.getContext('2d').drawImage(orig,0,0,c.width,c.height);
    const span = document.createElement('span');
    span.textContent = tam + ' (' + sizes[tam] + 'px)';
    div.appendChild(c); div.appendChild(span);
    contenedor.appendChild(div);
  });
}

// ===== PROYECTOS =====
function saveProject() {
  const nombre = document.getElementById('projName').value || 'Proyecto_sin_nombre';
  const datos = {
    nombre,
    bgType: document.getElementById('bgType').value,
    bgColor1: document.getElementById('bgColor1').value,
    bgColor1Grad: document.getElementById('bgColor1Grad').value,
    bgColor2: document.getElementById('bgColor2').value,
    shapeType: document.getElementById('shapeType').value,
    shapeColor: document.getElementById('shapeColor').value,
    shapeSize: document.getElementById('shapeSize').value,
    iconText: document.getElementById('iconText').value,
    textColor: document.getElementById('textColor').value,
    fontSize: document.getElementById('fontSize').value,
    fontBold: document.getElementById('fontBold').classList.contains('on'),
    shadowOn: document.getElementById('shadowOn').classList.contains('on'),
    borderOn: document.getElementById('borderOn').classList.contains('on'),
    fecha: new Date().toLocaleString()
  };
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  proyectos.unshift(datos);
  localStorage.setItem('iconosGuardados', JSON.stringify(proyectos));
  cargarProyectosGuardados();
  mostrarMensaje('✅ Guardado: ' + nombre);
}

function cargarProyectosGuardados() {
  const lista = document.getElementById('projList');
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  lista.innerHTML = '';
  if(proyectos.length === 0) {
    lista.innerHTML = '<p style="font-size:12px;color:#888">No hay proyectos guardados</p>';
    return;
  }
  proyectos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'proj-item';
    item.innerHTML = `<div><strong>${p.nombre}</strong><br><small>${p.fecha}</small></div>
      <div><button class="btn btn-outline btn-sm" onclick="cargarProyecto(${i})">📂</button>
      <button class="btn btn-err btn-sm" onclick="eliminarProyecto(${i})">🗑️</button></div>`;
    lista.appendChild(item);
  });
}

function cargarProyecto(indice) {
  const p = JSON.parse(localStorage.getItem('iconosGuardados') || '[]')[indice];
  document.getElementById('bgType').value = p.bgType;
  document.getElementById('bgColor1').value = p.bgColor1;
  document.getElementById('bgColor1Grad').value = p.bgColor1Grad || p.bgColor1;
  document.getElementById('bgColor2').value = p.bgColor2;
  document.getElementById('shapeType').value = p.shapeType;
  document.getElementById('shapeColor').value = p.shapeColor;
  document.getElementById('shapeSize').value = p.shapeSize;
  document.getElementById('iconText').value = p.iconText;
  document.getElementById('textColor').value = p.textColor;
  document.getElementById('fontSize').value = p.fontSize;
  p.fontBold ? document.getElementById('fontBold').classList.add('on') : document.getElementById('fontBold').classList.remove('on');
  p.shadowOn ? document.getElementById('shadowOn').classList.add('on') : document.getElementById('shadowOn').classList.remove('on');
  p.borderOn ? document.getElementById('borderOn').classList.add('on') : document.getElementById('borderOn').classList.remove('on');
  toggleBgOptions(); draw(); generarVistaPrevia();
  mostrarMensaje('✅ Cargado: ' + p.nombre);
}

function eliminarProyecto(indice) {
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  const nombre = proyectos[indice].nombre;
  proyectos.splice(indice, 1);
  localStorage.setItem('iconosGuardados', JSON.stringify(proyectos));
  cargarProyectosGuardados();
  mostrarMensaje('🗑️ Eliminado: ' + nombre);
}

// ===== ARTE LINEAL (bug proporción + detección de bordes corregido) =====
function cargarImagenLineal(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    const img = new Image();
    img.onload = () => { linealImageData = img; aplicarArteLineal(); };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function alternarFondoTransparente(btn) {
  fondoTransparente = !fondoTransparente;
  btn.style.background = fondoTransparente ? '#ddd' : '';
  if(linealImageData) aplicarArteLineal();
}

function aplicarArteLineal() {
  if(!linealImageData) return;
  const canvas = document.getElementById('linealCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Fondo
  ctx.fillStyle = fondoTransparente ? 'rgba(0,0,0,0)' : document.getElementById('linealFondo').value;
  ctx.fillRect(0,0,w,h);

  // Escalar manteniendo proporción (bug corregido)
  const img = linealImageData;
  const escala = Math.min(w/img.width, h/img.height);
  const dw = img.width * escala, dh = img.height * escala;
  const dx = (w-dw)/2, dy = (h-dh)/2;

  const temp = document.createElement('canvas');
  temp.width = w; temp.height = h;
  const tctx = temp.getContext('2d');
  tctx.drawImage(img, dx, dy, dw, dh);
  const datos = tctx.getImageData(0,0,w,h);

  const brillo = parseInt(document.getElementById('linealBrillo').value);
  const contraste = parseInt(document.getElementById('linealContraste').value)/100;
  const umbral = parseInt(document.getElementById('linealUmbral').value);
  const nivel = parseInt(document.getElementById('linealNivel').value)/100;
  const colorLinea = document.getElementById('linealColorLineas').value;
  const grosor = parseInt(document.getElementById('linealGrosor').value);

  const r = parseInt(colorLinea.slice(1,3),16);
  const g = parseInt(colorLinea.slice(3,5),16);
  const b = parseInt(colorLinea.slice(5,7),16);

  const salida = ctx.createImageData(w,h);
  const sensibilidad = 2.2 - nivel*1.8; // más complejidad = más sensible

  for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
      const i = (y*w+x)*4;
      let gris = datos.data[i]*0.299 + datos.data[i+1]*0.587 + datos.data[i+2]*0.114;
      gris = ((gris-128)*contraste+128)+brillo;
      gris = Math.max(0,Math.min(255,gris));

      const iDer = (y*w+(x+1))*4;
      const iAba = ((y+1)*w+x)*4;
      let gDer = datos.data[iDer]*0.299 + datos.data[iDer+1]*0.587 + datos.data[iDer+2]*0.114;
      let gAba = datos.data[iAba]*0.299 + datos.data[iAba+1]*0.587 + datos.data[iAba+2]*0.114;
      gDer = ((gDer-128)*contraste+128)+brillo;
      gAba = ((gAba-128)*contraste+128)+brillo;

      const diff = Math.max(Math.abs(gris-gDer), Math.abs(gris-gAba));
      const esBorde = diff > umbral * sensibilidad * 0.3;

      if(esBorde){
        salida.data[i]=r; salida.data[i+1]=g; salida.data[i+2]=b; salida.data[i+3]=255;
      } else if(!fondoTransparente){
        const c = hexARgb(document.getElementById('linealFondo').value);
        salida.data[i]=c.r; salida.data[i+1]=c.g; salida.data[i+2]=c.b; salida.data[i+3]=255;
      } else {
        salida.data[i+3]=0;
      }
    }
  }
  ctx.putImageData(salida,0,0);
}

function hexARgb(hex){
  return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
}

function reiniciarLineal(){
  document.getElementById('linealNivel').value=50;
  document.getElementById('linealBrillo').value=0;
  document.getElementById('linealContraste').value=100;
  document.getElementById('linealUmbral').value=128;
  document.getElementById('linealColorLineas').value='#000000';
  document.getElementById('linealFondo').value='#FFFFFF';
  document.getElementById('linealGrosor').value=2;
  fondoTransparente=false;
  document.getElementById('linealNivelEtiqueta').textContent='50%';
  if(linealImageData) aplicarArteLineal();
}

// Bug 3 corregido: ahora SÍ copia al diseño principal
function usarComoIcono(){
  if(!linealImageData) { mostrarMensaje('Primero sube una imagen', true); return; }
  const origen = document.getElementById('linealCanvas');
  const destino = document.getElementById('mainCanvas');
  const ctx = destino.getContext('2d');
  ctx.clearRect(0,0,destino.width,destino.height);
  ctx.drawImage(origen,0,0,destino.width,destino.height);
  generarVistaPrevia();
  mostrarMensaje('✅ Arte lineal copiado al Diseño');
  document.querySelector('.tab[data-tab="design"]').click();
}

// ===== ICONO =====
function processIcon(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    iconImage = new Image();
    iconImage.onload = () => dibujarIcono();
    iconImage.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function dibujarIcono() {
  if(!iconImage) return;
  const canvas = document.getElementById('iconCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const escala = parseInt(document.getElementById('iconScale').value)/100;
  const offX = parseInt(document.getElementById('iconOffsetX').value);
  const offY = parseInt(document.getElementById('iconOffsetY').value);
  const tam = Math.min(w,h)*escala;
  ctx.drawImage(iconImage, (w-tam)/2+offX, (h-tam)/2+offY, tam, tam);
}

function usarIconoComoDiseno() {
  if(!iconImage) { mostrarMensaje('Primero sube un icono', true); return; }
  const origen = document.getElementById('iconCanvas');
  const destino = document.getElementById('mainCanvas');
  const ctx = destino.getContext('2d');
  ctx.clearRect(0,0,destino.width,destino.height);
  ctx.drawImage(origen,0,0,destino.width,destino.height);
  generarVistaPrevia();
  mostrarMensaje('✅ Icono copiado al Diseño');
  document.querySelector('.tab[data-tab="design"]').click();
}

function resetIconSettings() {
  document.getElementById('iconScale').value = 70;
  document.getElementById('iconOffsetX').value = 0;
  document.getElementById('iconOffsetY').value = 0;
  dibujarIcono();
}

// ===== MANIFEST / XML =====
function generarCodigosXML() {
  const colorPrimario = document.getElementById('bgColor1Grad')?.value || '#1976D2';
  document.getElementById('manifestCode').textContent =
`<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:label="@string/app_name"
    android:allowBackup="true"
    android:iconBackground="@color/ic_background" />`;

  document.getElementById('colorsCode').textContent =
`<resources>
    <color name="ic_background">${colorPrimario}</color>
</resources>`;

  document.getElementById('adaptiveCode').textContent =
`<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;
}

function copiarCodigo(id) {
  const texto = document.getElementById(id).innerText;
  navigator.clipboard.writeText(texto).then(() => mostrarMensaje('Código copiado ✅'));
}

// ===== EXPORTAR =====
function descargarIndividual() {
  const canvas = document.getElementById('mainCanvas');
  const enlace = document.createElement('a');
  enlace.download = 'icono_' + currentSize + '.png';
  enlace.href = canvas.toDataURL('image/png');
  enlace.click();
  mostrarMensaje('✅ Imagen descargada');
}

async function descargarTodos() {
  const zip = new JSZip();
  const orig = document.getElementById('mainCanvas');
  for(const [tam, px] of Object.entries(sizes)) {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(orig,0,0,px,px);
    const datos = c.toDataURL('image/png').split(',')[1];
    const ruta = tam === 'play' ? 'play_store_icon.png' : `res/mipmap-${tam}/ic_launcher.png`;
    zip.file(ruta, datos, {base64:true});
  }
  zip.file('AndroidManifest.xml.txt', document.getElementById('manifestCode').textContent);
  zip.file('colors.xml.txt', document.getElementById('colorsCode').textContent);
  const blob = await zip.generateAsync({type:'blob'});
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'iconos_creador.zip';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  mostrarMensaje('✅ ZIP descargado');
}

// ===== UTILIDADES =====
function mostrarMensaje(texto, esError) {
  const m = document.getElementById('status');
  m.textContent = texto;
  m.classList.toggle('err', !!esError);
  m.classList.add('show');
  setTimeout(() => m.classList.remove('show'), 2200);
}
