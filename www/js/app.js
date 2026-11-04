// ===== ESTADO =====
let currentSize = 'xhdpi';
let history = [];
let historyIndex = -1;
let fotoOriginal = null;     // imagen original subida
let fotoActual = null;       // imagen procesada (con recorte o arte lineal)
let fotoEsLineal = false;
let debounceTimer = null;

const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192, play:512 };

const PALETAS = {
  Material: { bg1:'#1976D2', bg2:'#0D47A1', shape:'#FFFFFF', text:'#FFFFFF' },
  Caribe:   { bg1:'#00BCD4', bg2:'#006064', shape:'#FFEB3B', text:'#FFFFFF' },
  Atardecer:{ bg1:'#FF9800', bg2:'#E65100', shape:'#FFFFFF', text:'#FFFFFF' },
  Bosque:   { bg1:'#4CAF50', bg2:'#1B5E20', shape:'#FFFFFF', text:'#FFFFFF' },
  Neón:     { bg1:'#E91E63', bg2:'#3F51B5', shape:'#00E5FF', text:'#FFFFFF' },
  Pastel:   { bg1:'#F8BBD0', bg2:'#B3E5FC', shape:'#FFFFFF', text:'#37474F' },
  Pro:      { bg1:'#263238', bg2:'#000000', shape:'#FFFFFF', text:'#FFFFFF' },
  Oro:      { bg1:'#FFD700', bg2:'#B8860B', shape:'#000000', text:'#000000' }
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Listeners de diseño
  ['bgType','bgColor1','bgColor2','shapeType','shapeColor','shapeSize',
   'iconText','textColor','textPos','fontSize'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const h = () => { drawDebounced(); previewDebounced(); };
    el.addEventListener('change', h);
    if(el.tagName !== 'SELECT') el.addEventListener('input', h);
  });

  // Listeners de arte lineal
  ['linealNivel','linealUmbral','linealColorLineas','linealFondo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => { if(fotoEsLineal) convertirArteLineal(); });
  });
  document.getElementById('linealNivel').addEventListener('input', function(){
    document.getElementById('linealNivelEtiqueta').textContent = this.value + '%';
  });

  // Tamaños
  document.querySelectorAll('#sizePills button').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('#sizePills button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentSize = b.dataset.size;
      preview();
    });
  });

  document.getElementById('projName').addEventListener('input', () => {
    document.getElementById('mockupName') && (document.getElementById('mockupName').textContent = document.getElementById('projName').value || 'Mi_App');
  });

  initPaletas();
  draw();
  preview();
  cargarProyectosGuardados();
});

function drawDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(()=>{draw();preview();}, 300); }
function previewDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(preview, 300); }

// ===== PALETAS =====
function initPaletas(){
  const cont = document.getElementById('paletas');
  cont.innerHTML = '';
  Object.entries(PALETAS).forEach(([nombre, p]) => {
    const d = document.createElement('div');
    d.className = 'palette';
    d.innerHTML = `<div class="palette-swatch" style="background:linear-gradient(135deg,${p.bg1},${p.bg2})"></div><span>${nombre}</span>`;
    d.onclick = () => {
      document.getElementById('bgType').value = 'gradient';
      document.getElementById('bgColor1').value = p.bg1;
      document.getElementById('bgColor2').value = p.bg2;
      document.getElementById('shapeColor').value = p.shape;
      document.getElementById('textColor').value = p.text;
      toggleBgOptions();
      draw(); preview();
    };
    cont.appendChild(d);
  });
}

function toggleBgOptions(){
  // siempre mostramos los dos colores; el tipo decide cómo se usan
  draw(); preview();
}

// ===== DIBUJO =====
function draw() {
  const canvas = document.getElementById('mainCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // Fondo (si no hay foto)
  if(!fotoActual) {
    const tipo = document.getElementById('bgType').value;
    if(tipo === 'solid') {
      ctx.fillStyle = document.getElementById('bgColor1').value;
      ctx.fillRect(0,0,w,h);
    } else if(tipo === 'gradient') {
      const g = ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0, document.getElementById('bgColor1').value);
      g.addColorStop(1, document.getElementById('bgColor2').value);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    }
  } else {
    // Si hay foto, la dibujamos cubriendo todo el canvas
    ctx.drawImage(fotoActual, 0, 0, w, h);
  }

  // Sombra general (solo si no hay foto, para no ensuciar)
  const sombraOn = document.getElementById('shadowOn').classList.contains('on') && !fotoActual;
  if(sombraOn) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
  }

  // Forma (solo si no hay foto)
  const shapeType = document.getElementById('shapeType').value;
  const shapeColor = document.getElementById('shapeColor').value;
  const shapeSize = parseInt(document.getElementById('shapeSize').value)/100 * Math.min(w,h);
  const cx = w/2, cy = h/2;

  if(shapeType !== 'none' && !fotoActual) {
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

  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Texto con posición elegida
  const texto = document.getElementById('iconText').value;
  if(texto) {
    const tam = parseInt(document.getElementById('fontSize').value);
    const negrita = document.getElementById('fontBold').classList.contains('on');
    const pos = document.getElementById('textPos').value;
    const shadowText = document.getElementById('textShadow').classList.contains('on');
    ctx.fillStyle = document.getElementById('textColor').value;
    ctx.font = `${negrita?'bold ':''}${tam}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if(shadowText) {
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    }
    let ty = h/2;
    if(pos === 'bottom') ty = h - tam/2 - 8;
    if(pos === 'top') ty = tam/2 + 8;
    ctx.fillText(texto, w/2, ty);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }

  if(document.getElementById('borderOn').classList.contains('on')) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
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

function guardarHistorial() {
  const actual = document.getElementById('mainCanvas').toDataURL();
  if(history[historyIndex] === actual) return;
  historyIndex++;
  history = history.slice(0, historyIndex);
  history.push(actual);
  if(history.length > 25) { history.shift(); historyIndex--; }
}

function undo() {
  if(historyIndex > 0) {
    historyIndex--;
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('mainCanvas');
      const ctx = c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
    };
    img.src = history[historyIndex];
  }
}

function redo() {
  if(historyIndex < history.length - 1) {
    historyIndex++;
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('mainCanvas');
      const ctx = c.getContext('2d');
      ctx.clearRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
    };
    img.src = history[historyIndex];
  }
}

// ===== FOTO =====
function subirFoto(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    const img = new Image();
    img.onload = () => {
      fotoOriginal = recortarCuadrado(img, 0.5, 0.5, 1);
      fotoActual = fotoOriginal;
      fotoEsLineal = false;
      document.getElementById('recorteRow').style.display = 'flex';
      document.getElementById('fotoHint').textContent = '✅ Foto cargada. Ajusta el recorte o conviértela a líneas.';
      draw(); preview();
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function recortarCuadrado(img, cx, cy, tam) {
  const lado = Math.min(img.width, img.height) * tam;
  const sx = img.width * cx - lado/2;
  const sy = img.height * cy - lado/2;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  c.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, 512, 512);
  const out = new Image();
  out.src = c.toDataURL();
  return out;
}

function aplicarRecorte() {
  if(!fotoOriginal) return;
  const tam = parseInt(document.getElementById('recorteTam').value) / 100;
  fotoActual = recortarCuadrado(fotoOriginal, 0.5, 0.5, tam);
  fotoEsLineal = false;
  draw(); preview();
  mostrarMensaje('✅ Recorte aplicado');
}

function quitarFoto() {
  fotoOriginal = null;
  fotoActual = null;
  fotoEsLineal = false;
  document.getElementById('recorteRow').style.display = 'none';
  document.getElementById('fotoHint').textContent = 'Opcional. Sin foto, usas solo colores y texto.';
  draw(); preview();
}

// ===== ARTE LINEAL =====
function convertirArteLineal() {
  if(!fotoOriginal && !fotoActual) { mostrarMensaje('Primero sube una foto', true); return; }
  const base = fotoActual || fotoOriginal;
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0, 192, 192);
  const datos = ctx.getImageData(0,0,192,192);

  const nivel = parseInt(document.getElementById('linealNivel').value)/100;
  const umbral = parseInt(document.getElementById('linealUmbral').value);
  const colorLinea = document.getElementById('linealColorLineas').value;
  const r = parseInt(colorLinea.slice(1,3),16);
  const g = parseInt(colorLinea.slice(3,5),16);
  const b = parseInt(colorLinea.slice(5,7),16);

  const salida = ctx.createImageData(192,192);
  const sensibilidad = 2.2 - nivel*1.8;

  for(let y=1; y<191; y++){
    for(let x=1; x<191; x++){
      const i = (y*192+x)*4;
      const gris = datos.data[i]*0.299 + datos.data[i+1]*0.587 + datos.data[i+2]*0.114;
      const iDer = (y*192+(x+1))*4;
      const iAba = ((y+1)*192+x)*4;
      const gDer = datos.data[iDer]*0.299 + datos.data[iDer+1]*0.587 + datos.data[iDer+2]*0.114;
      const gAba = datos.data[iAba]*0.299 + datos.data[iAba+1]*0.587 + datos.data[iAba+2]*0.114;
      const diff = Math.max(Math.abs(gris-gDer), Math.abs(gris-gAba));
      if(diff > umbral * sensibilidad * 0.3) {
        salida.data[i]=r; salida.data[i+1]=g; salida.data[i+2]=b; salida.data[i+3]=255;
      } else {
        const f = hexARgb(document.getElementById('linealFondo').value);
        salida.data[i]=f.r; salida.data[i+1]=f.g; salida.data[i+2]=f.b; salida.data[i+3]=255;
      }
    }
  }
  ctx.putImageData(salida,0,0);

  const out = new Image();
  out.onload = () => {
    fotoActual = out;
    fotoEsLineal = true;
    draw(); preview();
    mostrarMensaje('✅ Convertido a líneas');
  };
  out.src = c.toDataURL();
}

function volverFotoOriginal() {
  if(!fotoOriginal) return;
  fotoActual = fotoOriginal;
  fotoEsLineal = false;
  draw(); preview();
  mostrarMensaje('↩️ Foto original');
}

function autoUmbral() {
  if(!fotoOriginal) { mostrarMensaje('Primero sube una foto', true); return; }
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.drawImage(fotoActual || fotoOriginal, 0, 0, 64, 64);
  const datos = ctx.getImageData(0, 0, 64, 64);
  let suma = 0;
  for(let i=0; i<datos.data.length; i+=4) {
    suma += datos.data[i]*0.299 + datos.data[i+1]*0.587 + datos.data[i+2]*0.114;
  }
  const prom = suma / (datos.data.length / 4);
  const auto = Math.round(Math.max(30, Math.min(220, prom)));
  document.getElementById('linealUmbral').value = auto;
  convertirArteLineal();
  mostrarMensaje('✅ Umbral auto: ' + auto);
}

function hexARgb(hex){
  return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16), b:parseInt(hex.slice(5,7),16) };
}

// ===== PREVIEW DE TAMAÑOS =====
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
    c.getContext('2d').drawImage(orig,0,0,c.width,c.height);
    const span = document.createElement('span');
    span.textContent = tam;
    div.appendChild(c); div.appendChild(span);
    cont.appendChild(div);
  });
}

// ===== RESET =====
function resetTodo() {
  quitarFoto();
  document.getElementById('bgType').value = 'gradient';
  document.getElementById('bgColor1').value = '#1976D2';
  document.getElementById('bgColor2').value = '#0D47A1';
  document.getElementById('shapeType').value = 'circle';
  document.getElementById('shapeColor').value = '#FFFFFF';
  document.getElementById('shapeSize').value = '38';
  document.getElementById('iconText').value = '';
  document.getElementById('textColor').value = '#FFFFFF';
  document.getElementById('textPos').value = 'center';
  document.getElementById('fontSize').value = '48';
  document.getElementById('fontBold').classList.add('on');
  document.getElementById('textShadow').classList.remove('on');
  document.getElementById('shadowOn').classList.remove('on');
  document.getElementById('borderOn').classList.remove('on');
  draw(); preview();
  mostrarMensaje('🗑️ Reiniciado');
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
    c.getContext('2d').drawImage(orig, 0, 0, px, px);
    const datos = c.toDataURL('image/png').split(',')[1];
    const ruta = tam === 'play' ? 'play_store_icon.png' : `res/mipmap-${tam}/ic_launcher.png`;
    zip.file(ruta, datos, {base64:true});

    const cr = document.createElement('canvas');
    cr.width = cr.height = px;
    const ctxr = cr.getContext('2d');
    ctxr.beginPath();
    ctxr.arc(px/2, px/2, px/2, 0, Math.PI*2);
    ctxr.clip();
    ctxr.drawImage(orig, 0, 0, px, px);
    const datosR = cr.toDataURL('image/png').split(',')[1];
    zip.file(`res/mipmap-${tam}/ic_launcher_round.png`, datosR, {base64:true});
  }

  const colorPrimario = document.getElementById('bgColor1').value;
  zip.file('AndroidManifest.xml.txt', `<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:label="@string/app_name" />`);
  zip.file('colors.xml.txt', `<resources>
    <color name="ic_background">${colorPrimario}</color>
</resources>`);
  zip.file('ic_launcher.xml', `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`);

  const blob = await zip.generateAsync({type:'blob'});
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'iconos_creador.zip';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
  mostrarMensaje('✅ ZIP descargado');
}

// ===== PROYECTOS =====
function guardarProyecto() {
  const nombre = document.getElementById('projName').value || 'Proyecto';
  const datos = { nombre, fecha: new Date().toLocaleString() };
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  proyectos.unshift(datos);
  if(proyectos.length > 8) proyectos.pop();
  localStorage.setItem('iconosGuardados', JSON.stringify(proyectos));
  cargarProyectosGuardados();
  mostrarMensaje('✅ Guardado: ' + nombre);
}

function cargarProyectosGuardados() {
  const lista = document.getElementById('projList');
  if(!lista) return;
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  lista.innerHTML = '';
  if(proyectos.length === 0) {
    lista.innerHTML = '<p style="font-size:11px;color:#888">Sin proyectos guardados</p>';
    return;
  }
  proyectos.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'proj-item';
    item.innerHTML = `<span>${p.nombre} · ${p.fecha}</span>
      <button class="btn btn-err btn-sm" onclick="eliminarProyecto(${i})">🗑️</button>`;
    lista.appendChild(item);
  });
}

function eliminarProyecto(indice) {
  const proyectos = JSON.parse(localStorage.getItem('iconosGuardados') || '[]');
  proyectos.splice(indice, 1);
  localStorage.setItem('iconosGuardados', JSON.stringify(proyectos));
  cargarProyectosGuardados();
}

// ===== UTILIDADES =====
function mostrarMensaje(texto, esError) {
  const m = document.getElementById('status');
  m.textContent = texto;
  m.classList.toggle('err', !!esError);
  m.classList.add('show');
  setTimeout(() => m.classList.remove('show'), 2000);
}
