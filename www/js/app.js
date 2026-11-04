// ===== ESTADO =====
let currentSize = 'xxxhdpi';
let fotoOriginal = null;
let fotoActual = null;
let colorSeleccionado = 0;
let debounceTimer = null;

const sizes = { mdpi:48, hdpi:72, xhdpi:96, xxhdpi:144, xxxhdpi:192, play:512 };

// Colores bonitos: cada uno es {fondo, texto}
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
document.addEventListener('DOMContentLoaded', () => {
  initColores();

  ['iconText','textPos','fontSize'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(dibujarTodo, 250); });
    el.addEventListener('change', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(dibujarTodo, 250); });
  });

  document.getElementById('linealNivel').addEventListener('input', () => {
    if(fotoActual) convertirArteLineal();
  });

  // Primer dibujo
  dibujarTodo();
});

function dibujarTodo(){ draw(); preview(); }

// ===== COLORES =====
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
      dibujarTodo();
    };
    cont.appendChild(b);
  });
}

// ===== DIBUJO =====
function draw() {
  const canvas = document.getElementById('mainCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);

  const color = COLORES[colorSeleccionado];

  // Fondo: foto o color
  if(fotoActual) {
    ctx.drawImage(fotoActual, 0, 0, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, color.bg1);
    g.addColorStop(1, color.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Texto
  const texto = document.getElementById('iconText').value;
  if(texto) {
    const tam = parseInt(document.getElementById('fontSize').value);
    const pos = document.getElementById('textPos').value;
    ctx.fillStyle = color.txt;
    ctx.font = `bold ${tam}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 4;
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
}

// ===== VISTA PREVIA DE TAMAÑOS =====
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

// ===== FOTO =====
function subirFoto(input) {
  const archivo = input.files[0];
  if(!archivo) return;
  const lector = new FileReader();
  lector.onload = e => {
    const img = new Image();
    img.onload = () => {
      recortarCuadrado(img, 1, (recortada) => {
        fotoOriginal = recortada;
        fotoActual = recortada;
        document.getElementById('fotoAcciones').style.display = 'flex';
        document.getElementById('arteLinealBox').style.display = 'block';
        dibujarTodo();
        mostrarMensaje('✅ Foto cargada');
      });
    };
    img.src = e.target.result;
  };
  lector.readAsDataURL(archivo);
}

// Callback: cuando la imagen esté lista, llamar a callback(imagen)
function recortarCuadrado(img, tam, callback) {
  const lado = Math.min(img.width, img.height) * tam;
  const sx = img.width/2 - lado/2;
  const sy = img.height/2 - lado/2;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  c.getContext('2d').drawImage(img, sx, sy, lado, lado, 0, 0, 512, 512);
  const out = new Image();
  out.onload = () => callback(out);
  out.src = c.toDataURL();
}

function abrirRecorte() {
  const row = document.getElementById('recorteRow');
  row.style.display = row.style.display === 'none' ? 'flex' : 'none';
}

function aplicarRecorte() {
  if(!fotoOriginal) return;
  const tam = parseInt(document.getElementById('recorteTam').value) / 100;
  recortarCuadrado(fotoOriginal, tam, (recortada) => {
    fotoActual = recortada;
    draw(); preview();
    document.getElementById('recorteRow').style.display = 'none';
    mostrarMensaje('✅ Recorte aplicado');
  });
}

function quitarFoto() {
  fotoOriginal = null;
  fotoActual = null;
  document.getElementById('fotoAcciones').style.display = 'none';
  document.getElementById('recorteRow').style.display = 'none';
  document.getElementById('arteLinealBox').style.display = 'none';
  document.getElementById('fotoInput').value = '';
  dibujarTodo();
}

// ===== ARTE LINEAL =====
function convertirArteLineal() {
  if(!fotoOriginal && !fotoActual) { mostrarMensaje('Primero sube una foto', true); return; }
  const base = fotoOriginal || fotoActual;
  const c = document.createElement('canvas');
  c.width = c.height = 192;
  const ctx = c.getContext('2d');
  ctx.drawImage(base, 0, 0, 192, 192);
  const datos = ctx.getImageData(0, 0, 192, 192);
  const nivel = parseInt(document.getElementById('linealNivel').value) / 100;
  const color = COLORES[colorSeleccionado];

  // Convertir color hex de fondo a RGB
  const rFondo = parseInt(color.bg2.slice(1,3),16);
  const gFondo = parseInt(color.bg2.slice(3,5),16);
  const bFondo = parseInt(color.bg2.slice(5,7),16);

  // Líneas en color de texto
  const rLinea = parseInt(color.txt.slice(1,3),16);
  const gLinea = parseInt(color.txt.slice(3,5),16);
  const bLinea = parseInt(color.txt.slice(5,7),16);

  const salida = ctx.createImageData(192, 192);
  const sensibilidad = 2.2 - nivel * 1.8;

  for(let y = 1; y < 191; y++){
    for(let x = 1; x < 191; x++){
      const i = (y*192 + x) * 4;
      const gris = datos.data[i]*0.299 + datos.data[i+1]*0.587 + datos.data[i+2]*0.114;
      const iDer = (y*192 + (x+1)) * 4;
      const iAba = ((y+1)*192 + x) * 4;
      const gDer = datos.data[iDer]*0.299 + datos.data[iDer+1]*0.587 + datos.data[iDer+2]*0.114;
      const gAba = datos.data[iAba]*0.299 + datos.data[iAba+1]*0.587 + datos.data[iAba+2]*0.114;
      const diff = Math.max(Math.abs(gris - gDer), Math.abs(gris - gAba));
      if(diff > 128 * sensibilidad * 0.3) {
        salida.data[i] = rLinea; salida.data[i+1] = gLinea; salida.data[i+2] = bLinea; salida.data[i+3] = 255;
      } else {
        salida.data[i] = rFondo; salida.data[i+1] = gFondo; salida.data[i+2] = bFondo; salida.data[i+3] = 255;
      }
    }
  }
  ctx.putImageData(salida, 0, 0);

  const out = new Image();
  out.onload = () => {
    fotoActual = out;
    draw(); preview();
    mostrarMensaje('✅ Convertido a dibujo');
  };
  out.src = c.toDataURL();
}

function volverFotoOriginal() {
  if(!fotoOriginal) return;
  fotoActual = fotoOriginal;
  draw(); preview();
  mostrarMensaje('↩️ Foto original');
}

// ===== REINICIAR =====
function resetTodo() {
  quitarFoto();
  document.getElementById('iconText').value = '';
  document.getElementById('textPos').value = 'center';
  document.getElementById('fontSize').value = 48;
  colorSeleccionado = 0;
  document.querySelectorAll('.color-ball').forEach((b, i) => b.classList.toggle('selected', i === 0));
  dibujarTodo();
  mostrarMensaje('🗑️ Reiniciado');
}

// ===== DESCARGAR =====
async function descargarTodos() {
  const zip = new JSZip();
  const orig = document.getElementById('mainCanvas');

  // Aseguramos que el canvas tiene contenido
  if(!orig || orig.width === 0) { mostrarMensaje('Nada que descargar', true); return; }

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

    // Cuadrado
    const c = document.createElement('canvas');
    c.width = c.height = px;
    c.getContext('2d').drawImage(orig, 0, 0, px, px);
    zip.file(`res/mipmap-${tam}/ic_launcher.png`, c.toDataURL('image/png').split(',')[1], {base64:true});

    // Redondo
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
  zip.file('AndroidManifest.xml.txt', `<application
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:label="@string/app_name" />`);
  zip.file('colors.xml.txt', `<resources>
    <color name="ic_background">${color.bg1}</color>
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

// ===== MENSAJES =====
function mostrarMensaje(texto, esError) {
  const m = document.getElementById('status');
  m.textContent = texto;
  m.classList.toggle('err', !!esError);
  m.classList.add('show');
  setTimeout(() => m.classList.remove('show'), 2000);
}
