class Morphological {
  constructor() {
    this.name = 'Morphological';
    this.color = '#808080';
    this.kernelSize = 15;
    this.enhancer = new LineEnhancer();
  }

  async detect(imageData) {
    logger.info('Iniciando Morphological (con realce de líneas)...');
    const t0 = Date.now();
    
    // Realce de líneas
    const enhanced = this.enhancer.enhance(imageData);
    
    // Umbralización adaptativa
    lineValidator.prepare(enhanced);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    // Kernel horizontal para detectar líneas horizontales
    const hKernel = this.createKernel(this.kernelSize, 1);
    const hDilated = this.dilate(bin, w, h, hKernel);
    
    // Kernel vertical para detectar líneas verticales
    const vKernel = this.createKernel(1, this.kernelSize);
    const vDilated = this.dilate(bin, w, h, vKernel);
    
    // Combinar
    const combined = new Uint8ClampedArray(w * h);
    for (let i = 0; i < combined.length; i++) {
      combined[i] = hDilated[i] || vDilated[i] ? 1 : 0;
    }
    
    // Extraer líneas de la imagen combinada
    const lines = this.extractLines(combined, w, h);
    const time = Date.now() - t0;
    logger.info('Morphological completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: {
        totalLines: lines.length,
        executionTime: time
      }
    };
  }

  createKernel(kw, kh) {
    return { width: kw, height: kh };
  }

  dilate(bin, w, h, kernel) {
    const result = new Uint8ClampedArray(w * h);
    const halfW = Math.floor(kernel.width / 2);
    const halfH = Math.floor(kernel.height / 2);
    
    for (let y = halfH; y < h - halfH; y++) {
      for (let x = halfW; x < w - halfW; x++) {
        let max = 0;
        for (let dy = -halfH; dy <= halfH; dy++) {
          for (let dx = -halfW; dx <= halfW; dx++) {
            if (bin[(y+dy)*w + (x+dx)]) {
              max = 1;
              break;
            }
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
    
    // Detectar líneas horizontales
    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) hProj[y]++;
      }
    }
    
    const hThreshold = Math.max(...hProj) * 0.3;
    for (let y = 1; y < h - 1; y++) {
      if (hProj[y] > hThreshold && hProj[y] >= hProj[y-1] && hProj[y] >= hProj[y+1]) {
        let tooClose = false;
        for (const l of lines) {
          if (Math.abs(l.y1 - y) < 8) { tooClose = true; break; }
        }
        if (!tooClose) {
          lines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
        }
      }
    }
    
    // Detectar líneas verticales
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (bin[y * w + x]) vProj[x]++;
      }
    }
    
    const vThreshold = Math.max(...vProj) * 0.3;
    for (let x = 1; x < w - 1; x++) {
      if (vProj[x] > vThreshold && vProj[x] >= vProj[x-1] && vProj[x] >= vProj[x+1]) {
        let tooClose = false;
        for (const l of lines) {
          if (Math.abs(l.x1 - x) < 8) { tooClose = true; break; }
        }
        if (!tooClose) {
          lines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
        }
      }
    }
    
    return lines;
  }
}
window.Morphological = Morphological;
