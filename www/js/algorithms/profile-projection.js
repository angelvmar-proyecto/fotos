class ProfileProjection {
  constructor() {
    this.name = 'Profile Projection';
    this.color = '#FFFF00';
  }

  async detect(imageData) {
    logger.info('Iniciando Profile Projection (con filtros de calidad)...');
    const t0 = Date.now();

    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;

    const minLengthH = w * 0.40;
    const minLengthV = h * 0.40;

    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (bin[y * w + x]) hProj[y]++;
      }
    }

    const threshold = Math.max(...hProj) * 0.35;
    const hLines = [];
    // FIX: recorrer de 0 a h-1 inclusive. Vecino inexistente = -1 (siempre pierde)
    for (let y = 0; y < h; y++) {
      const prev = (y > 0) ? hProj[y - 1] : -1;
      const next = (y < h - 1) ? hProj[y + 1] : -1;
      if (hProj[y] > threshold && hProj[y] >= prev && hProj[y] >= next) {
        let tooClose = false;
        for (const l of hLines) {
          if (Math.abs(l.y1 - y) < 8) { tooClose = true; break; }
        }
        if (!tooClose && w >= minLengthH) {
          hLines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w });
        }
      }
    }

    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        if (bin[y * w + x]) vProj[x]++;
      }
    }

    const vThreshold = Math.max(...vProj) * 0.35;
    const vLines = [];
    // FIX: recorrer de 0 a w-1 inclusive
    for (let x = 0; x < w; x++) {
      const prev = (x > 0) ? vProj[x - 1] : -1;
      const next = (x < w - 1) ? vProj[x + 1] : -1;
      if (vProj[x] > vThreshold && vProj[x] >= prev && vProj[x] >= next) {
        let tooClose = false;
        for (const l of vLines) {
          if (Math.abs(l.x1 - x) < 8) { tooClose = true; break; }
        }
        if (!tooClose && h >= minLengthV) {
          vLines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h });
        }
      }
    }

    const lines = hLines.concat(vLines);

    const result = {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: Date.now() - t0, hLines: hLines.length, vLines: vLines.length }
    };

    const filtered = lineValidator.filterResult(result);

    // AUDITORIA: coordenadas y espaciados DESPUES del filtro
    this.audit(filtered.lines, w, h);
    filtered.metrics.executionTime = Date.now() - t0;
    return filtered;
  }

  audit(lines, w, h) {
    const hs = lines.filter(l => l.angle === 0).map(l => l.y1).sort((a, b) => a - b);
    const vs = lines.filter(l => l.angle === 90).map(l => l.x1).sort((a, b) => a - b);
    const gaps = a => a.slice(1).map((v, i) => v - a[i]);
    const fmt = a => a.length ? a.join(', ') : 'ninguna';

    if (hs.length) {
      const g = gaps(hs);
      logger.info('  [AUD-H] Y primero=' + hs[0] + ' ultimo=' + hs[hs.length-1] + ' (alto=' + h + ')');
      logger.info('  [AUD-H] primeras Y=[' + fmt(hs.slice(0,4)) + '] ultimas Y=[' + fmt(hs.slice(-4)) + ']');
      logger.info('  [AUD-H] espaciados min=' + Math.min(...g) + ' max=' + Math.max(...g) + ' primeros gaps=[' + fmt(g.slice(0,4)) + ']');
    }
    if (vs.length) {
      const g = gaps(vs);
      logger.info('  [AUD-V] X primero=' + vs[0] + ' ultimo=' + vs[vs.length-1] + ' (ancho=' + w + ')');
      logger.info('  [AUD-V] primeras X=[' + fmt(vs.slice(0,4)) + '] ultimas X=[' + fmt(vs.slice(-4)) + ']');
      logger.info('  [AUD-V] espaciados min=' + Math.min(...g) + ' max=' + Math.max(...g) + ' primeros gaps=[' + fmt(g.slice(0,4)) + ']');
    }
  }
}
window.ProfileProjection = ProfileProjection;
