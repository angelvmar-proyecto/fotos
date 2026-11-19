class LineValidator {
  constructor() {
    this.gapTolerance = 4;
    this.minCoverage = 0.50;
    this.minRunRatio = 0.55;
    this.minSegRatio = 0.60;
    this.segments = 12;
    this.segMin = 0.35;
    this.bradleyT = 8;
    this.bin = null; this.w = 0; this.h = 0;
    this.rowSum = null; this.colSum = null;
    this.inverted = false;
  }

  invalidate() { this.bin = null; this.rowSum = null; this.colSum = null; }

  prepare(imageData) {
    const w = imageData.width, h = imageData.height;
    if (this.bin && this.w === w && this.h === h) return this;
    const t0 = Date.now();
    const d = imageData.data;
    const gray = new Float32Array(w * h);
    let gsum = 0;
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
      gray[j] = v; gsum += v;
    }
    this.inverted = (gsum / (w * h)) < 110;
    if (this.inverted) for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];

    const iw = w + 1;
    const integ = new Float64Array(iw * (h + 1));
    for (let y = 0; y < h; y++) {
      let rs = 0;
      for (let x = 0; x < w; x++) {
        rs += gray[y * w + x];
        integ[(y + 1) * iw + (x + 1)] = rs + integ[y * iw + (x + 1)];
      }
    }
    let win = Math.max(9, Math.round(Math.min(w, h) / 12));
    if (win % 2 === 0) win++;
    const half = (win - 1) / 2;
    const k = 1 - this.bradleyT / 100;
    const bin = new Uint8Array(w * h);
    const rowSum = new Int32Array(h), colSum = new Int32Array(w);
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half);
        const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
        const s = integ[(y2+1)*iw + (x2+1)] - integ[y1*iw + (x2+1)]
                - integ[(y2+1)*iw + x1] + integ[y1*iw + x1];
        if (gray[y * w + x] < (s / cnt) * k) {
          bin[y * w + x] = 1; rowSum[y]++; colSum[x]++;
        }
      }
    }
    this.bin = bin; this.w = w; this.h = h;
    this.rowSum = rowSum; this.colSum = colSum;
    logger.info('  Evidencia lista (Bradley t=' + this.bradleyT + '%, invertido=' + this.inverted + ') en ' + (Date.now() - t0) + 'ms');
    return this;
  }

  measure(start, axis) {
    const w = this.w, h = this.h, bin = this.bin, S = this.segments;
    const len = axis === 'h' ? w : h;
    const lim = axis === 'h' ? h : w;
    let pos = start, drift = 0;
    const maxDrift = Math.min(60, Math.round(lim * 0.06));
    let hits = 0, run = 0, best = 0, gap = 0;
    const segHit = new Float64Array(S), segLen = new Float64Array(S);
    for (let t = 0; t < len; t++) {
      const s = Math.min(S - 1, Math.floor(t * S / len)); segLen[s]++;
      const idx = axis === 'h' ? pos * w + t : t * w + pos;
      let found = bin[idx] === 1;
      if (!found) {
        if (pos > 0 && drift > -maxDrift) {
          const i2 = axis === 'h' ? (pos-1)*w + t : t*w + (pos-1);
          if (bin[i2] === 1) { pos--; drift--; found = true; }
        }
        if (!found && pos < lim - 1 && drift < maxDrift) {
          const i3 = axis === 'h' ? (pos+1)*w + t : t*w + (pos+1);
          if (bin[i3] === 1) { pos++; drift++; found = true; }
        }
      }
      if (found) {
        hits++; segHit[s]++;
        if (gap > 0) { run += gap; gap = 0; }
        run++; if (run > best) best = run;
      } else {
        gap++;
        if (gap > this.gapTolerance) { if (run > best) best = run; run = 0; }
      }
    }
    if (run > best) best = run;
    let ok = 0;
    for (let s = 0; s < S; s++) if (segLen[s] > 0 && segHit[s] / segLen[s] >= this.segMin) ok++;
    return { coverage: hits / len, runRatio: best / len, segRatio: ok / S, end: pos, drift: drift };
  }

  passes(m) {
    return m.coverage >= this.minCoverage &&
           m.runRatio >= this.minRunRatio &&
           m.segRatio >= this.minSegRatio;
  }

  measureLine(line) {
    const a = ((line.angle % 180) + 180) % 180;
    if (a <= 3 || a >= 177) return this.measure(Math.round((line.y1 + line.y2) / 2), 'h');
    if (Math.abs(a - 90) <= 3) return this.measure(Math.round((line.x1 + line.x2) / 2), 'v');
    const dx = line.x2 - line.x1, dy = line.y2 - line.y1;
    const n = Math.max(2, Math.round(Math.sqrt(dx*dx + dy*dy)));
    let hits = 0, run = 0, best = 0, gap = 0;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(line.x1 + dx * i / n), y = Math.round(line.y1 + dy * i / n);
      let found = false;
      for (let oy = -1; oy <= 1 && !found; oy++)
        for (let ox = -1; ox <= 1 && !found; ox++) {
          const xx = x + ox, yy = y + oy;
          if (xx >= 0 && xx < this.w && yy >= 0 && yy < this.h && this.bin[yy*this.w + xx] === 1) found = true;
        }
      if (found) { hits++; if (gap > 0) { run += gap; gap = 0; } run++; if (run > best) best = run; }
      else { gap++; if (gap > this.gapTolerance) { if (run > best) best = run; run = 0; } }
    }
    if (run > best) best = run;
    return { coverage: hits / (n+1), runRatio: best / (n+1), segRatio: 1, end: 0, drift: 0 };
  }

  filterResult(result) {
    if (!this.bin) return result;
    const kept = []; let rejected = 0;
    for (const l of result.lines) {
      const m = this.measureLine(l);
      if (this.passes(m)) {
        l.coverage = m.coverage; l.runRatio = m.runRatio; l.segRatio = m.segRatio;
        kept.push(l);
      } else rejected++;
    }
    result.lines = kept;
    result.metrics.totalLines = kept.length;
    result.metrics.rejectedByEvidence = rejected;
    logger.info('  Validacion de evidencia: ' + kept.length + ' aceptadas, ' + rejected + ' descartadas (texto/fantasmas)');
    return result;
  }
}
const lineValidator = new LineValidator();
window.LineValidator = LineValidator;
window.lineValidator = lineValidator;
