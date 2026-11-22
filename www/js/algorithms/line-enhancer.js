class LineEnhancer {
  constructor() {
    this.name = 'Line Enhancer';
    this.color = '#00FFFF'; // Cian
    this.minLength = 15; // Longitud mínima para considerar que es una línea (no texto)
  }

  async detect(imageData) {
    logger.info('Iniciando Line Enhancer (Filtro morfológico direccional de forma)...');
    const t0 = Date.now();
    
    // Usamos la imagen binarizada de lineValidator (ya optimizada)
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    const enhancedV = new Uint8Array(w * h);
    const enhancedH = new Uint8Array(w * h);
    const L = this.minLength;
    const half = Math.floor(L / 2);

    // 1. FILTRO VERTICAL: Solo sobrevive si hay L píxeles continuos en la columna
    for (let y = half; y < h - half; y++) {
      for (let x = 0; x < w; x++) {
        let match = true;
        for (let dy = -half; dy <= half; dy++) {
          if (bin[(y + dy) * w + x] === 0) { match = false; break; }
        }
        if (match) enhancedV[y * w + x] = 1;
      }
    }
    // Dilatación vertical para restaurar el grosor de las líneas que sobrevivieron
    const outV = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (enhancedV[y * w + x] === 1) {
          for (let dy = -half; dy <= half; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < h) outV[ny * w + x] = 1;
          }
        }
      }
    }

    // 2. FILTRO HORIZONTAL: Solo sobrevive si hay L píxeles continuos en la fila
    for (let y = 0; y < h; y++) {
      for (let x = half; x < w - half; x++) {
        let match = true;
        for (let dx = -half; dx <= half; dx++) {
          if (bin[y * w + (x + dx)] === 0) { match = false; break; }
        }
        if (match) enhancedH[y * w + x] = 1;
      }
    }
    // Dilatación horizontal para restaurar el grosor
    const outH = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (enhancedH[y * w + x] === 1) {
          for (let dx = -half; dx <= half; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < w) outH[y * w + nx] = 1;
          }
        }
      }
    }

    // 3. Detección por proyección sobre la imagen YA LIMPIA de ruido/texto
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) { if (outV[y * w + x]) vProj[x]++; }
    }
    const vLines = this.extractLines(vProj, w, h, 90, 'v');

    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) { if (outH[y * w + x]) hProj[y]++; }
    }
    const hLines = this.extractLines(hProj, h, w, 0, 'h');

    const lines = hLines.concat(vLines);
    const time = Date.now() - t0;
    logger.info('Line Enhancer completado en ' + time + 'ms. Lineas: ' + lines.length + ' (H=' + hLines.length + ' V=' + vLines.length + ')');
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: hLines.length, vLines: vLines.length }
    };
  }

  extractLines(proj, len1, len2, angle, axis) {
    const lines = [];
    const threshold = Math.max(...proj) * 0.40; // Umbral más bajo porque la imagen ya está limpia
    for (let i = 0; i < len1; i++) {
      if (proj[i] > threshold) {
        // Evitar duplicados muy cercanos
        let tooClose = false;
        for (const l of lines) {
          if (axis === 'v' && Math.abs(l.x1 - i) < 4) { tooClose = true; break; }
          if (axis === 'h' && Math.abs(l.y1 - i) < 4) { tooClose = true; break; }
        }
        if (!tooClose) {
          if (axis === 'v') lines.push({ x1: i, y1: 0, x2: i, y2: len2 - 1, angle: angle, length: len2 });
          else lines.push({ x1: 0, y1: i, x2: len2 - 1, y2: i, angle: angle, length: len2 });
        }
      }
    }
    return lines;
  }

  setMinLength(l) { this.minLength = l; }
}
window.LineEnhancer = LineEnhancer;
