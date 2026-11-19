class FourierAvanzado {
  constructor() {
    this.name = 'Fourier Avanzado';
    this.color = '#FF6600';
    this.minValleyWidth = 4;
    this.thresholdPct = 0.30;
    this.requireEvidence = true;
  }

  async detect(imageData) {
    logger.info('Iniciando Fourier Avanzado (pasa-bajas + ancho de valle + evidencia)');
    const t0 = Date.now();
    const w = imageData.width, h = imageData.height;
    const blur = this.lowPass(imageData);
    const hp = this.projection(blur, w, h, 'h');
    const vp = this.projection(blur, w, h, 'v');
    if (this.requireEvidence) lineValidator.prepare(imageData);

    let rejected = 0;
    const build = (proj, axis) => {
      const valleys = this.valleys(proj);
      const out = [];
      for (const v of valleys) {
        if (this.requireEvidence) {
          const m = lineValidator.measure(v.pos, axis);
          if (!lineValidator.passes(m)) { rejected++; continue; }
        }
        out.push(axis === 'h'
          ? { x1: 0, y1: v.pos, x2: w - 1, y2: v.pos, angle: 0, length: w, valleyWidth: v.width }
          : { x1: v.pos, y1: 0, x2: v.pos, y2: h - 1, angle: 90, length: h, valleyWidth: v.width });
      }
      return out;
    };
    const lines = build(hp, 'h').concat(build(vp, 'v'));
    const time = Date.now() - t0;
    logger.info('  Valles descartados por falta de evidencia: ' + rejected);
    logger.info('Fourier Avanzado completado en ' + time + 'ms. Lineas: ' + lines.length + ' (anchoMin=' + this.minValleyWidth + ')');
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, minValleyWidth: this.minValleyWidth,
                 thresholdPct: this.thresholdPct, rejectedByEvidence: rejected, validated: this.requireEvidence }
    };
  }

  lowPass(imageData) {
    const w = imageData.width, h = imageData.height, d = imageData.data;
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
    const o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x === 0 || y === 0 || x === w-1 || y === h-1) { o[y*w+x] = g[y*w+x]; continue; }
        o[y*w+x] = (g[(y-1)*w+x-1] + 2*g[(y-1)*w+x] + g[(y-1)*w+x+1]
                  + 2*g[y*w+x-1] + 4*g[y*w+x] + 2*g[y*w+x+1]
                  + g[(y+1)*w+x-1] + 2*g[(y+1)*w+x] + g[(y+1)*w+x+1]) / 16;
      }
    }
    return o;
  }

  projection(g, w, h, axis) {
    const n = axis === 'h' ? h : w;
    const p = new Float64Array(n);
    if (axis === 'h') { for (let y = 0; y < h; y++) { let s = 0; for (let x = 0; x < w; x++) s += g[y*w+x]; p[y] = s / w; } }
    else { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p[x] += g[y*w+x]; for (let x = 0; x < w; x++) p[x] /= h; }
    return p;
  }

  valleys(p) {
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < p.length; i++) { if (p[i] < mn) mn = p[i]; if (p[i] > mx) mx = p[i]; }
    const th = mn + (mx - mn) * this.thresholdPct;
    const out = [];
    let inV = false, st = 0, bp = 0, bv = Infinity;
    for (let i = 0; i < p.length; i++) {
      if (p[i] < th) {
        if (!inV) { inV = true; st = i; bp = i; bv = p[i]; }
        else if (p[i] < bv) { bv = p[i]; bp = i; }
      } else if (inV) {
        const width = i - st;
        if (width >= this.minValleyWidth) out.push({ pos: bp, width: width });
        inV = false;
      }
    }
    if (inV && (p.length - st) >= this.minValleyWidth) out.push({ pos: bp, width: p.length - st });
    return out;
  }
}
window.FourierAvanzado = FourierAvanzado;
