class RidgeDetector {
  constructor() {
    this.name = 'Ridge Detector';
    this.color = '#00FF00';
    this.minRidgeStrength = 60;
    this.minCoverage = 0.25;
    this.minLineLength = 40;
    this.mergeGap = 3;
  }

  async detect(imageData) {
    logger.info('Iniciando Ridge Detector (Hessiana: valles y crestas, lineas tenues)...');
    const t0 = Date.now();
    const w = imageData.width, h = imageData.height, d = imageData.data;

    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      gray[j] = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    }

    const vCnt = new Int32Array(w), vSum = new Float64Array(w);
    const vMin = new Int32Array(w).fill(h), vMax = new Int32Array(w).fill(-1);
    const hCnt = new Int32Array(h), hSum = new Float64Array(h);
    const hMin = new Int32Array(h).fill(w), hMax = new Int32Array(h).fill(-1);
    const S = this.minRidgeStrength;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, c = gray[i];

        // Perfil perpendicular en X -> lineas VERTICALES
        const l = gray[i-1], r = gray[i+1];
        const valleyX = (c <= l && c <= r) && (c < l || c < r);
        const peakX   = (c >= l && c >= r) && (c > l || c > r);
        if (valleyX || peakX) {
          const dxx = Math.abs(l - 2*c + r);
          if (dxx >= S) {
            vCnt[x]++; vSum[x] += dxx;
            if (y < vMin[x]) vMin[x] = y;
            if (y > vMax[x]) vMax[x] = y;
          }
        }

        // Perfil perpendicular en Y -> lineas HORIZONTALES
        const u = gray[i-w], dn = gray[i+w];
        const valleyY = (c <= u && c <= dn) && (c < u || c < dn);
        const peakY   = (c >= u && c >= dn) && (c > u || c > dn);
        if (valleyY || peakY) {
          const dyy = Math.abs(u - 2*c + dn);
          if (dyy >= S) {
            hCnt[y]++; hSum[y] += dyy;
            if (x < hMin[y]) hMin[y] = x;
            if (x > hMax[y]) hMax[y] = x;
          }
        }
      }
    }

    const vCand = [], hCand = [];
    const vNeed = Math.max(this.minLineLength, Math.round(h * this.minCoverage));
    const hNeed = Math.max(this.minLineLength, Math.round(w * this.minCoverage));

    for (let x = 0; x < w; x++) {
      if (vCnt[x] >= vNeed) vCand.push({ pos: x, cnt: vCnt[x], str: vSum[x] / vCnt[x], a: vMin[x], b: vMax[x] });
    }
    for (let y = 0; y < h; y++) {
      if (hCnt[y] >= hNeed) hCand.push({ pos: y, cnt: hCnt[y], str: hSum[y] / hCnt[y], a: hMin[y], b: hMax[y] });
    }
    logger.info('  Candidatas Hessiana: H=' + hCand.length + ' V=' + vCand.length + ' (fuerza>=' + S + ', pixeles>=' + vNeed + '/' + hNeed + ')');

    const vLines = this.merge(vCand, 'v', w, h);
    const hLines = this.merge(hCand, 'h', w, h);
    const lines = hLines.concat(vLines);

    const time = Date.now() - t0;
    logger.info('Ridge Detector completado en ' + time + 'ms. Lineas: ' + lines.length + ' (H=' + hLines.length + ' V=' + vLines.length + ')');
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: hLines.length, vLines: vLines.length }
    };
  }

  merge(cand, axis, w, h) {
    if (!cand.length) return [];
    cand.sort((a, b) => a.pos - b.pos);
    const out = [];
    let grp = [cand[0]];
    const flush = () => {
      let best = grp[0];
      for (const c of grp) { if (c.cnt * c.str > best.cnt * best.str) best = c; }
      const p = best.pos;
      const a = Math.max(0, best.a), b = Math.min((axis === 'v' ? h : w) - 1, best.b);
      if (axis === 'v') {
        out.push({ x1: p, y1: a, x2: p, y2: b, angle: 90, length: b - a, strength: best.str, ridgePixels: best.cnt });
      } else {
        out.push({ x1: a, y1: p, x2: b, y2: p, angle: 0, length: b - a, strength: best.str, ridgePixels: best.cnt });
      }
    };
    for (let i = 1; i < cand.length; i++) {
      if (cand[i].pos - cand[i-1].pos <= this.mergeGap) grp.push(cand[i]);
      else { flush(); grp = [cand[i]]; }
    }
    flush();
    return out;
  }

  setMinRidgeStrength(s) { this.minRidgeStrength = s; }
  setMinCoverage(c) { this.minCoverage = c; }
  setMinLineLength(l) { this.minLineLength = l; }
}
window.RidgeDetector = RidgeDetector;
