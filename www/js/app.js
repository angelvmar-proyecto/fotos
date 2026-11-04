// ===== ESTADO =====
let currentSize = 'xhdpi';
let history = [];
let historyIndex = -1;
let linealImageData = null;
let designImage = null;
let fondoTransparente = false;
let debounceTimer = null;

// Recorte
let recorteActivo = false;
let recorteX = 0.5, recorteY = 0.5, recorteTam = 0.7;
let recorteTarget = 'design'; // 'design' o 'lineal'
let recorteLinealActivo = false;
let recorteLinealX = 0.5, recorteLinealY = 0.5, recorteLinealTam = 0.7;

const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192, adap:512, play:512, round:192 };

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
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const id = tab.getAttribute('data-tab');
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById('tab-' + id).style.display = 'block';
      if(id === 'design') draw();
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

  ['bgType','bgColor1','bgColor1Grad','bgColor2','shapeType','shapeColor','shapeSize',
   'iconText','textColor','fontSize'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const handler = () => { drawDebounced(); generarVistaPreviaDebounced(); };
    el.addEventListener('change', handler);
    if(el.tagName !== 'SELECT') el.addEventListener('input', handler);
  });

  ['linealNivel','linealBrillo','linealContraste','linealUmbral','linealColorLineas','linealFondo'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => { if(linealImageData) aplicarArteLineal(); });
  });

  document.getElementById('linealNivel').addEventListener('input', function(){
    document.getElementById('linealNivelEtiqueta').textContent = this.value + '%';
  });

  document.getElementById('projName').addEventListener('input', () => {
    const mock = document.getElementById('mockupName');
    if(mock) mock.textContent = document.getElementById('projName').value || 'Mi_App';
  });

  initPaletas();
  draw();
  cargarProyectosGuardados();
  generarVistaPrevia();
});

function drawDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(draw, 400); }
function generarVistaPreviaDebounced(){ clearTimeout(debounceTimer); debounceTimer = setTimeout(generarVistaPrevia, 400); }

// ===== PALETAS =====
function initPaletas(){
  const cont = document.getElementById('paletas');
  cont.innerHTML = '';
  Object.entries(PALETAS).forEach(([nombre, p]) => {
    const d = document.createElement('div');
    d.className = 'palette';
    d.innerHTML = `<div class="palette-swatch" style="background:linear-gradient(135deg,${p.bg1},${p.bg2})"></div><span>${nombre}</span>`;
    d.onclick = () => aplicarPaleta(p);
    cont.appendChild(d);
  });
}

function aplicarPaleta(p){
  document.getElementById('bgType').value = 'gradient';
  document.getElementById('bgColor1Grad').value = p.bg1;
  document.getElementById('bgColor2').value = p.bg2;
  document.getElementById('shapeColor').value = p.shape;
  document.getElementById('textColor').value = p.text;
  toggleBgOptions();
  draw(); generarVistaPrevia();
}

// ===== DIBUJO =====
function draw() {
  const canvas = document.getElementById('mainCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  // Imagen de fondo (si se subió foto)
  if(designImage) {
    ctx.drawImage(designImage, 0, 0, w, h);
  } else {
    const bgType = document.getElementById('bgType').value;
    if(bgType === 'solid') {
      ctx.fillStyle = document.getElementById('bgColor1').value;
      ctx.fillRect(0,0,w,h);
    } else if(bgType === 'gradient') {
      const g = ctx.createLinearGradient(0,0,w,h);
      g.addColorStop(0, document.getElementById('bgColor1Grad').value);
      g.addColorStop(1, document.getElementById('bgColor2').value);
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    }
  }

  const sombraOn = document.getElementById('shadowOn').classList.contains('on');
  if(sombraOn) {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
  }

  const shapeType = document.getElementById('shapeType').value;
  const shapeColor = document.getElementById('shapeColor').value;
  const shapeSize = parseInt(document.getElementById('shapeSize').value)/100 * Math.min(w,h);
  const cx = w/2, cy = h/2;

  if(shapeType !== 'none' && !designImage) {
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

  const texto = document.getElementById('iconText').value;
  if(texto) {
    ctx.fillStyle = document.getElementById('textColor').value;
    const tam = parseInt(document.getElementById('fontSize').value);
    const negrita = document.getElementById('fontBold').classList.contains('on');
    ctx.font = `${negrita?'bold ':''}${tam}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, w/2, h/2);
  }

  if(document.getElementById('borderOn').classList.contains('on')) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1,1,w-2,h-2);
  }

  guardarHistorial();
  actualizarMockup();
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
  if(history.length > 30) { history.shift(); historyIndex--; }
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
      actualizarMockup();
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
      actualizarMockup();
    };
    img.src = history[historyIndex];
  }
}

function actualizarMockup() {
  const mock = document.getElementById('mockupCanvas');
  if(!mock) return;
  const ctx = mock.getContext('2d');
  ctx.clearRect(0,0,60,60);
  ctx.drawImage(document.getElementById('mainCanvas'), 0, 0, 60, 60);
}

// ===== SUBIR IMAGEN AL DISEÑO =====
function cargarImagenDiseno(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    const img = new Image();
    img.onload = () => {
      // Ajustar a cuadrado centrado
      designImage = recortarCuadrado(img, 0.5, 0.5, 1);
      document.getElementById('recorteWrap').style.display = 'block';
      document.getElementById('designUploadHint').textContent = '✅ Imagen cargada. Puedes recortarla con el botón de abajo.';
      draw(); generarVistaPrevia();
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
  const ctx = c.getContext('2d');
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, 512, 512);
  const out = new Image();
  out.src = c.toDataURL();
  return out;
}

// ===== RECORTE =====
function activarRecorte() {
  if(!designImage) { mostrarMensaje('Primero sube una imagen', true); return; }
  recorteActivo = true;
  mostrarMensaje('✂️ Mueve el slider y aplica cuando estés listo');
}

function desactivarRecorte() {
  recorteActivo = false;
  document.getElementById('recorteWrap').style.display = 'none';
}

function aplicarRecorte() {
  if(!designImage) return;
  const tam = parseInt(document.getElementById('recorteTam').value) / 100;
  designImage = recortarCuadrado(designImage, 0.5, 0.5, tam);
  recorteActivo = false;
  document.getElementById('recorteWrap').style.display = 'none';
  draw(); generarVistaPrevia();
  mostrarMensaje('✅ Recorte aplicado');
}

// ===== QUITAR FONDO UNIFORME (sin IA) =====
function quitarFondoUniforme() {
  if(!designImage) { mostrarMensaje('Primero sube una imagen', true); return; }
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.drawImage(designImage, 0, 0, 512, 512);
  const datos = ctx.getImageData(0, 0, 512, 512);

  // Color de las 4 esquinas (promedio)
  const esquinas = [
    [0,0], [511,0], [0,511], [511,511]
  ];
  let rSum=0, gSum=0, bSum=0;
  esquinas.forEach(([x,y]) => {
    const i = (y*512 + x)*4;
    rSum += datos.data[i]; gSum += datos.data[i+1]; bSum += datos.data[i+2];
  });
  const rBg = rSum/4, gBg = gSum/4, bBg = bSum/4;
  const tolerancia = 40;

  for(let i=0; i<datos.data.length; i+=4) {
    const dr = datos.data[i] - rBg;
    const dg = datos.data[i+1] - gBg;
    const db = datos.data[i+2] - bBg;
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);
    if(dist < tolerancia) datos.data[i+3] = 0;
  }

  ctx.putImageData(datos, 0, 0);
  const out = new Image();
  out.onload = () => {
    designImage = out;
    draw(); generarVistaPrevia();
    mostrarMensaje('✅ Fondo eliminado (color uniforme)');
  };
  out.src = c.toDataURL();
}

// ===== CONTROLES =====
function toggleBgOptions() {
  const tipo = document.getElementById('bgType').value;
  document.getElementById('bgSolidRow').style.display = tipo === 'solid' ? 'flex' : 'none';
  document.getElementById('bgGradientRow').style.display = tipo === 'gradient' ? 'flex' : 'none';
}

function resetDesign() {
  designImage = null;
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
  document.getElementById('recorteWrap').style.display = 'none';
  toggleBgOptions(); draw(); generarVistaPrevia();
}

// ===== VISTA PREVIA =====
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

// ===== ARTE LINEAL =====
function cargarImagenLineal(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    const img = new Image();
    img.onload = () => {
      linealImageData = recortarCuadrado(img, 0.5, 0.5, 1);
      aplicarArteLineal();
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

function toggleRecorteLineal() {
  const w = document.getElementById('recorteLinealWrap');
  w.style.display = w.style.display === 'none' ? 'block' : 'none';
}

function aplicarRecorteLineal() {
  if(!linealImageData) return;
  const tam = parseInt(document.getElementById('recorteLinealTam').value) / 100;
  linealImageData = recortarCuadrado(linealImageData, 0.5, 0.5, tam);
  aplicarArteLineal();
  document.getElementById('recorteLinealWrap').style.display = 'none';
  mostrarMensaje('✅ Recorte aplicado');
}

function alternarFondoTransparente(btn) {
  fondoTransparente = !fondoTransparente;
  btn.style.background = fondoTransparente ? '#ddd' : '';
  if(linealImageData) aplicarArteLineal();
}

function autoUmbral() {
  if(!linealImageData) { mostrarMensaje('Primero sube una imagen', true); return; }
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  ctx.drawImage(linealImageData, 0, 0, 192, 192);
  const datos = ctx.getImageData(0, 0, 192, 192);
  let suma = 0;
  for(let i=0; i<datos.data.length; i+=4) {
    suma += datos.data[i]*0.299 + datos.data[i+1]*0.587 + datos.data[i+2]*0.114;
  }
  const prom = suma / (datos.data.length / 4);
  const umbralAuto = Math.round(Math.max(30, Math.min(220, prom)));
  document.getElementById('linealUmbral').value = umbralAuto;
  aplicarArteLineal();
  mostrarMensaje('✅ Umbral automático: ' + umbralAuto);
}

function aplicarArteLineal() {
  if(!linealImageData) return;
  const canvas = document.getElementById('linealCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = fondoTransparente ? 'rgba(0,0,0,0)' : document.getElementById('linealFondo').value;
  ctx.fillRect(0,0,w,h);

  const temp = document.createElement('canvas');
  temp.width = w; temp.height = h;
  const tctx = temp.getContext('2d');
  tctx.drawImage(linealImageData, 0, 0, w, h);
  const datos = tctx.getImageData(0,0,w,h);

  const brillo = parseInt(document.getElementById('linealBrillo').value);
  const contraste = parseInt(document.getElementById('linealContraste').value)/100;
  const umbral = parseInt(document.getElementById('linealUmbral').value);
  const nivel = parseInt(document.getElementById('linealNivel').value)/100;
  const colorLinea = document.getElementById('linealColorLineas').value;

  const r = parseInt(colorLinea.slice(1,3),16);
  const g = parseInt(colorLinea.slice(3,5),16);
  const b = parseInt(colorLinea.slice(5,7),16);

  const salida = ctx.createImageData(w,h);
  const sensibilidad = 2.2 - nivel*1.8;

  for(let y=1; y<h-1; y++){
    for(let x=1; x<w-1; x++){
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
  document.getElementById('linealNivelEtiqueta').textContent='50%';
  fondoTransparente=false;
  if(linealImageData) aplicarArteLineal();
}

function usarComoIcono(){
  if(!linealImageData) { mostrarMensaje('Primero sube una imagen', true); return; }
  const origen = document.getElementById('linealCanvas');
  const destino = document.getElementById('mainCanvas');
  const ctx = destino.getContext('2d');
  ctx.clearRect(0,0,destino.width,destino.height);
  ctx.drawImage(origen,0,0,destino.width,destino.height);
  designImage = null;
  generarVistaPrevia();
  mostrarMensaje('✅ Arte lineal copiado al Diseño');
  document.querySelector('.tab[data-tab="design"]').click();
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
    // Normal (cuadrado)
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(orig, 0, 0, px, px);
    const datos = c.toDataURL('image/png').split(',')[1];
    const ruta = tam === 'play' ? 'play_store_icon.png' : `res/mipmap-${tam}/ic_launcher.png`;
    zip.file(ruta, datos, {base64:true});

    // Redondo
    const cr = document.createElement('canvas');
    cr.width = cr.height = px;
    const ctxr = cr.getContext('2d');
    ctxr.beginPath();
    ctxr.arc(px/2, px/2, px/2, 0, Math.PI*2);
    ctxr.clip();
    ctxr.drawImage(orig, 0, 0, px, px);
    const datosR = cr.toDataURL('image/png').split(',')[1];
    const rutaR = `res/mipmap-${tam}/ic_launcher_round.png`;
    zip.file(rutaR, datosR, {base64:true});
  }

  const colorPrimario = document.getElementById('bgColor1Grad').value;
  const manifiesto = `<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:label="@string/app_name"
    android:allowBackup="true" />`;

  const colores = `<resources>
    <color name="ic_background">${colorPrimario}</color>
</resources>`;

  const adaptativo = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>`;

  zip.file('AndroidManifest.xml.txt', manifiesto);
  zip.file('colors.xml.txt', colores);
  zip.file('ic_launcher.xml', adaptativo);

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
