class Morphological {
  constructor() {
    this.name = 'Morphological';
    this.color = '#808080';
    this.kernelSize = 15;
  }
  async detect(imageData) {
    logger.info('Iniciando Morphological (umbralización directa + morph)...');
    const t0 = Date.now();
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    const hDilated = this.dilate(bin, w, h, this.kernelSize, 1);
    const vDilated = this.dilate(bin, w, h, 1, this.kernelSize);
    
    const combined = new Uint8ClampedArray(w * h);
    for (let i = 0; i < combined.length; i++) {
      combined[i] = hDilated[i] || vDilated[i] ? 1 : 0;
    }
    
    const lines = this.extractLines(combined, w, h);
    const time = Date.now() - t0;
    logger.info('Morphological completado en ' + time + 'ms. Lineas: ' + lines.length);
    return { algorithm: this.name, color: this.color, lines: lines, metrics: { totalLines: lines.length, executionTime: time } };
  }
  dilate(bin, w, h, kw, kh) {
    const result = new Uint8ClampedArray(w * h);
    const halfW = Math.floor(kw / 2), halfH = Math.floor(kh / 2);
    for (let y = halfH; y < h - halfH; y++) {
      for (let x = halfW; x < w - halfW; x++) {
        let max = 0;
        for (let dy = -halfH; dy <= halfH; dy++) {
          for (let dx = -halfW; dx <= halfW; dx++) {
            if (bin[(y+dy)*w + (x+dx)]) { max = 1; break; }
          }
          if (max) break;
        }
        result[y * w + x] = max;
      }
    }
    return result;
  }
  extractLines(bin, w, h) {
    const lines = [];
    // Umbral más alto para kernels pequeños, y filtro de longitud mínima (30%)
    const thresholdMultiplier = (this.kernelSize <= 7) ? 0.60 : 0.40;
    const minLengthH = w * 0.30;
    const minLengthV = h * 0.30;
    
    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) hProj[y]++;
    const hTh = Math.max(...hProj) * thresholdMultiplier;
    
    for (let y = 1; y < h - 1; y++) {
      if (hProj[y] > hTh && hProj[y] >= hProj[y-1] && hProj[y] >= hProj[y+1]) {
        let close = false;
        for (const l of lines) { if (Math.abs(l.y1 - y) < 8) { close = true; break; } }
        // Solo agregar si cruza al menos el 30% del ancho
        if (!close && w >= minLengthH) {
          lines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
        }
      }
    }
    
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (bin[y * w + x]) vProj[x]++;
    const vTh = Math.max(...vProj) * thresholdMultiplier;
    
    for (let x = 1; x < w - 1; x++) {
      if (vProj[x] > vTh && vProj[x] >= vProj[x-1] && vProj[x] >= vProj[x+1]) {
        let close = false;
        for (const l of lines) { if (Math.abs(l.x1 - x) < 8) { close = true; break; } }
        // Solo agregar si cruza al menos el 30% del alto
        if (!close && h >= minLengthV) {
          lines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
        }
      }
    }
    return lines;
  }
}
window.Morphological = Morphological;
