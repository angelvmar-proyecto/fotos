class ProfileProjection {
  constructor() {
    this.name = 'Profile Projection';
    this.color = '#FFFF00';
  }

  async detect(imageData) {
    logger.info('Iniciando Profile Projection (filtro selectivo: solo horizontales)...');
    const t0 = Date.now();

    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;

    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) { if (bin[y * w + x]) hProj[y]++; }
    }
    const hTh = Math.max(...hProj) * 0.35;
    const hLines = [];
    for (let y = 0; y < h; y++) {
      const prev = (y > 0) ? hProj[y - 1] : -1;
      const next = (y < h - 1) ? hProj[y + 1] : -1;
      if (hProj[y] > hTh && hProj[y] >= prev && hProj[y] >= next) {
        let close = false;
        for (const l of hLines) { if (Math.abs(l.y1 - y) < 8) { close = true; break; } }
        if (!close) hLines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
      }
    }

    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) { if (bin[y * w + x]) vProj[x]++; }
    }
    const vTh = Math.max(...vProj) * 0.35;
    const vLines = [];
    for (let x = 0; x < w; x++) {
      const prev = (x > 0) ? vProj[x - 1] : -1;
      const next = (x < w - 1) ? vProj[x + 1] : -1;
      if (vProj[x] > vTh && vProj[x] >= prev && vProj[x] >= next) {
        let close = false;
        for (const l of vLines) { if (Math.abs(l.x1 - x) < 8) { close = true; break; } }
        if (!close) vLines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
      }
    }

    const hRes = lineValidator.filterResult({
      algorithm: this.name, color: this.color,
      lines: hLines, metrics: { totalLines: hLines.length }
    });
    const keptH = hRes.lines;
    const lines = keptH.concat(vLines);

    this.audit(lines, w, h);
    const time = Date.now() - t0;
    logger.info('Profile Projection completado en ' + time + 'ms. Lineas: ' + lines.length + ' (H=' + keptH.length + ' V=' + vLines.length + ')');
    
    const result = {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: keptH.length, vLines: vLines.length, verticalsUnfiltered: true }
    };
    
    // === INTEGRACIÓN DEL POST-PROCESADOR UNIFICADO ===
    return window.linePostProcessor ? linePostProcessor.process(result, currentImageProfile) : result;
  }

  audit(lines, w, h) {
    const hs = lines.filter(l => l.angle === 0).map(l => l.y1).sort((a, b) => a - b);
    const vs = lines.filter(l => l.angle === 90).map(l => l.x1).sort((a, b) => a - b);
    const gaps = a => a.slice(1).map((v, i) => v - a[i]);
    const fmt = a => a.length ? a.join(', ') : 'ninguna';
    if (hs.length > 1) {
      const g = gaps(hs);
      logger.info('  [AUD-H] Y primero=' + hs[0] + ' ultimo=' + hs[hs.length-1] + ' (alto=' + h + ') primeras=[' + fmt(hs.slice(0,4)) + '] gaps min=' + Math.min(...g) + ' max=' + Math.max(...g));
    }
    if (vs.length > 1) {
      const g = gaps(vs);
      logger.info('  [AUD-V] X primero=' + vs[0] + ' ultimo=' + vs[vs.length-1] + ' (ancho=' + w + ') primeras=[' + fmt(vs.slice(0,4)) + '] gaps min=' + Math.min(...g) + ' max=' + Math.max(...g));
    }
  }
}
window.ProfileProjection = ProfileProjection;
