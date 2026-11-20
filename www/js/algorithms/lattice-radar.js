class LatticeRadar {
  constructor() {
    this.name = 'Lattice Radar';
    this.color = '#FF1493';
    this.crossThreshold = 0.90; // Aumentado de 0.70 a 0.90 (90% de cruces)
    this.stabilityThreshold = 1.0; // Reducido de 1.5 a 1.0 (más estricto)
    this.windowSize = 2;
    this.numBands = 20;
    this.minVerticalSpacing = 30; // Espaciado mínimo entre verticales
  }

  async detect(imageData) {
    logger.info('Iniciando Lattice Radar (verificacion por cruces anclados)...');
    const t0 = Date.now();
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;

    const horizontals = this.detectHorizontals(bin, w, h);
    logger.info('  Horizontales base: ' + horizontals.length);

    if (horizontals.length < 5) {
      logger.info('  Muy pocas horizontales, no se puede estimar reticula');
      return { algorithm: this.name, color: this.color, lines: [], metrics: { totalLines: 0, executionTime: Date.now() - t0 } };
    }

    const yPositions = horizontals.map(l => Math.round((l.y1 + l.y2) / 2)).sort((a, b) => a - b);
    const bandWidth = Math.ceil(w / this.numBands);

    const verticals = this.findVerticals(bin, w, h, yPositions, bandWidth);
    logger.info('  Verticales validadas por cruces: ' + verticals.length);

    // Filtrar verticales demasiado cercanas
    const filtered = this.filterCloseVerticals(verticals);
    logger.info('  Verticales tras filtrar cercanas: ' + filtered.length);

    const lines = filtered.map(x => ({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h }));
    const time = Date.now() - t0;
    logger.info('Lattice Radar completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines: lines, 
      metrics: { 
        totalLines: lines.length, 
        executionTime: time, 
        horizontalsUsed: horizontals.length,
        crossThreshold: this.crossThreshold,
        stabilityThreshold: this.stabilityThreshold
      } 
    };
  }

  detectHorizontals(bin, w, h) {
    const proj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) proj[y]++;
    const lines = [];
    const threshold = Math.max(...proj) * 0.3;
    for (let y = 1; y < h - 1; y++) {
      if (proj[y] > threshold && proj[y] >= proj[y-1] && proj[y] >= proj[y+1]) {
        let tooClose = false;
        for (const l of lines) if (Math.abs(l.y1 - y) < 10) { tooClose = true; break; }
        if (!tooClose) lines.push({ x1: 0, y1: y, x2: w - 1, y2: y });
      }
    }
    return lines;
  }

  findVerticals(bin, w, h, yPositions, bandWidth) {
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (bin[y * w + x]) vProj[x]++;
    const vThreshold = Math.max(...vProj) * 0.15;
    const candidates = [];
    for (let x = 1; x < w - 1; x++) {
      if (vProj[x] > vThreshold && vProj[x] >= vProj[x-1] && vProj[x] >= vProj[x+1]) candidates.push(x);
    }
    logger.info('  Candidatas verticales: ' + candidates.length);

    const valid = [];
    for (const x of candidates) {
      const crossScore = this.testCrosses(bin, w, x, yPositions);
      const stability = this.testStability(bin, w, h, x, bandWidth);
      if (crossScore >= this.crossThreshold && stability <= this.stabilityThreshold) valid.push(x);
    }
    return valid;
  }

  testCrosses(bin, w, x, yPositions) {
    let hits = 0;
    for (const y of yPositions) {
      let found = false;
      for (let dy = -this.windowSize; dy <= this.windowSize && !found; dy++) {
        for (let dx = -this.windowSize; dx <= this.windowSize && !found; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < bin.length / w && bin[yy * w + xx]) found = true;
        }
      }
      if (found) hits++;
    }
    return hits / yPositions.length;
  }

  testStability(bin, w, h, x, bandWidth) {
    const xPositions = [];
    for (let band = 0; band < this.numBands; band++) {
      const bandStart = band * bandWidth;
      const bandEnd = Math.min((band + 1) * bandWidth, w);
      let bestX = x, bestCount = 0;
      for (let xx = Math.max(bandStart, x - 10); xx <= Math.min(bandEnd - 1, x + 10); xx++) {
        let count = 0;
        for (let y = 0; y < h; y++) if (bin[y * w + xx]) count++;
        if (count > bestCount) { bestCount = count; bestX = xx; }
      }
      xPositions.push(bestX);
    }
    const mean = xPositions.reduce((a, b) => a + b, 0) / xPositions.length;
    const variance = xPositions.reduce((s, xi) => s + (xi - mean) ** 2, 0) / xPositions.length;
    return Math.sqrt(variance);
  }

  filterCloseVerticals(verticals) {
    if (verticals.length === 0) return [];
    const sorted = [...verticals].sort((a, b) => a - b);
    const filtered = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const lastX = filtered[filtered.length - 1];
      if (sorted[i] - lastX >= this.minVerticalSpacing) {
        filtered.push(sorted[i]);
      }
    }
    return filtered;
  }
}
window.LatticeRadar = LatticeRadar;
