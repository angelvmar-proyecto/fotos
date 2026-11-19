class EchoRadar {
  constructor() {
    this.name = 'Echo Radar';
    this.color = '#00BFFF';
    this.seedRatio = 0.10;
  }

  async detect(imageData) {
    logger.info('Iniciando Echo Radar (ecolocalizacion: barrido completo, sin cruz local)');
    const t0 = Date.now();
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h;
    const rowSum = lineValidator.rowSum, colSum = lineValidator.colSum;

    const hCand = [];
    for (let y = 0; y < h; y++) {
      if (rowSum[y] < this.seedRatio * w) continue;
      const m = lineValidator.measure(y, 'h');
      if (lineValidator.passes(m)) hCand.push({ pos: y, m: m });
    }
    const vCand = [];
    for (let x = 0; x < w; x++) {
      if (colSum[x] < this.seedRatio * h) continue;
      const m = lineValidator.measure(x, 'v');
      if (lineValidator.passes(m)) vCand.push({ pos: x, m: m });
    }
    logger.info('  Rayos aprobados: H=' + hCand.length + ' V=' + vCand.length);

    const lines = [].concat(this.group(hCand, 'h', w, h), this.group(vCand, 'v', w, h));
    let thick = 0, medium = 0, thin = 0, cov = 0, rr = 0;
    for (const l of lines) {
      if (l.thickness >= 3) thick++; else if (l.thickness === 2) medium++; else thin++;
      cov += l.coverage; rr += l.runRatio;
    }
    const n = Math.max(1, lines.length);
    const time = Date.now() - t0;
    logger.info('  Grosor -> gruesas:' + thick + ' medias:' + medium + ' finas:' + thin);
    logger.info('Echo Radar completado en ' + time + 'ms. Lineas: ' + lines.length);
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: {
        totalLines: lines.length, executionTime: time,
        thickLines: thick, mediumLines: medium, thinLines: thin,
        avgCoverage: cov / n, avgRunRatio: rr / n, validated: true
      }
    };
  }

  group(cand, axis, w, h) {
    if (cand.length === 0) return [];
    cand.sort((a, b) => a.pos - b.pos);
    const out = [];
    let grp = [cand[0]];
    const flush = () => {
      let best = grp[0];
      for (const c of grp) if (c.m.coverage * c.m.runRatio > best.m.coverage * best.m.runRatio) best = c;
      const th = grp.length;
      const p = best.pos, m = best.m;
      let l;
      if (axis === 'h') {
        if (Math.abs(m.drift) <= 3) l = { x1: 0, y1: p, x2: w - 1, y2: p, angle: 0, length: w };
        else l = { x1: 0, y1: p, x2: w - 1, y2: m.end, angle: 0, length: w };
      } else {
        if (Math.abs(m.drift) <= 3) l = { x1: p, y1: 0, x2: p, y2: h - 1, angle: 90, length: h };
        else l = { x1: p, y1: 0, x2: m.end, y2: h - 1, angle: 90, length: h };
      }
      l.thickness = th; l.coverage = m.coverage; l.runRatio = m.runRatio; l.segRatio = m.segRatio;
      out.push(l);
    };
    for (let i = 1; i < cand.length; i++) {
      if (cand[i].pos - cand[i-1].pos <= 2) grp.push(cand[i]);
      else { flush(); grp = [cand[i]]; }
    }
    flush();
    return out;
  }
}
window.EchoRadar = EchoRadar;
