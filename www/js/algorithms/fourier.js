class FourierAnalysis {
  constructor() {
    this.name = 'Fourier Analysis';
    this.color = '#FFA500';
    this.minDistance = 8;
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Analysis (umbralización directa)...');
    const t0 = Date.now();
    
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) hProj[y]++;
    const hLines = this.findPeaks(hProj, this.minDistance);
    
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (bin[y * w + x]) vProj[x]++;
    const vLines = this.findPeaks(vProj, this.minDistance);
    
    const lines = [];
    hLines.forEach(y => lines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w }));
    vLines.forEach(x => lines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h }));
    
    const time = Date.now() - t0;
    logger.info('Fourier completado en ' + time + 'ms. Lineas: ' + lines.length);
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: hLines.length, vLines: vLines.length }
    };
  }

  findPeaks(proj, minDist) {
    const peaks = [];
    const threshold = Math.max(...proj) * 0.3;
    for (let i = 1; i < proj.length - 1; i++) {
      if (proj[i] > threshold && proj[i] >= proj[i-1] && proj[i] >= proj[i+1]) {
        let tooClose = false;
        for (const p of peaks) { if (Math.abs(p - i) < minDist) { tooClose = true; break; } }
        if (!tooClose) peaks.push(i);
      }
    }
    return peaks;
  }

  setMinDistance(d) { this.minDistance = d; }
}
window.FourierAnalysis = FourierAnalysis;
