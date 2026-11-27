class FourierAnalysis {
  constructor() {
    this.name = 'Fourier Analysis';
    this.color = '#FFA500';
    this.minDistance = 8;
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Analysis (filtro selectivo: solo horizontales)...');
    const t0 = Date.now();

    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;

    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bin[y * w + x]) hProj[y]++;
    const hPos = this.findPeaks(hProj, this.minDistance);

    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (bin[y * w + x]) vProj[x]++;
    const vPos = this.findPeaks(vProj, this.minDistance);

    const hLines = hPos.map(y => ({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w }));
    const vLines = vPos.map(x => ({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h }));

    const hRes = lineValidator.filterResult({
      algorithm: this.name, color: this.color,
      lines: hLines, metrics: { totalLines: hLines.length }
    });
    const keptH = hRes.lines;
    const lines = keptH.concat(vLines);

    const time = Date.now() - t0;
    logger.info('Fourier completado en ' + time + 'ms. Lineas: ' + lines.length + ' (H=' + keptH.length + ' V=' + vLines.length + ')');
    
    const result = {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: keptH.length, vLines: vLines.length, verticalsUnfiltered: true }
    };
    
    // === INTEGRACIÓN DEL POST-PROCESADOR UNIFICADO ===
    return window.linePostProcessor ? linePostProcessor.process(result, currentImageProfile) : result;
  }

  findPeaks(proj, minDist) {
    const peaks = [];
    const mx = Math.max(...proj);
    if (mx <= 0) return peaks;
    const th = mx * 0.35;
    for (let i = 0; i < proj.length; i++) {
      const prev = (i > 0) ? proj[i-1] : -1;
      const next = (i < proj.length - 1) ? proj[i+1] : -1;
      if (proj[i] > th && proj[i] >= prev && proj[i] >= next) {
        let close = false;
        for (const p of peaks) { if (Math.abs(p - i) < minDist) { close = true; break; } }
        if (!close) peaks.push(i);
      }
    }
    return peaks;
  }

  setMinDistance(d) { this.minDistance = d; }
}
window.FourierAnalysis = FourierAnalysis;
