class LinePostProcessor {
  constructor() {
    this.standards = LineDetectionStandards;
  }

  process(result, imageProfile) {
    if (!result || !result.lines || result.lines.length === 0) return result;
    if (!imageProfile) return result;

    const w = imageProfile.width, h = imageProfile.height;
    const n0 = result.lines.length;

    // Solo snap a bordes y coordenadas enteras
    let lines = this.snapEdges(result.lines, 3, w, h);
    lines = lines.map(function(l){
      l.x1 = Math.round(l.x1); l.y1 = Math.round(l.y1);
      l.x2 = Math.round(l.x2); l.y2 = Math.round(l.y2);
      return l;
    });

    result.lines = lines;
    result.metrics.totalLines = lines.length;
    result.metrics.postProcessed = true;

    logger.info('  Post-proceso ' + result.algorithm + ': ' + n0 + ' -> ' + lines.length + ' (solo snap a bordes)');
    return result;
  }

  isH(l) { const a = ((l.angle % 180) + 180) % 180; return a <= 10 || a >= 170; }
  isV(l) { const a = ((l.angle % 180) + 180) % 180; return Math.abs(a - 90) <= 10; }

  snapEdges(lines, margin, w, h) {
    const self = this;
    return lines.map(function(l){
      if (self.isH(l)) {
        if (Math.min(l.x1, l.x2) <= margin) l.x1 = 0;
        if (Math.max(l.x1, l.x2) >= w - 1 - margin) l.x2 = w - 1;
        const y = Math.round((l.y1 + l.y2) / 2);
        if (y <= margin) { l.y1 = 0; l.y2 = 0; }
        else if (y >= h - 1 - margin) { l.y1 = h - 1; l.y2 = h - 1; }
        else { l.y1 = y; l.y2 = y; }
      } else if (self.isV(l)) {
        if (Math.min(l.y1, l.y2) <= margin) l.y1 = 0;
        if (Math.max(l.y1, l.y2) >= h - 1 - margin) l.y2 = h - 1;
        const x = Math.round((l.x1 + l.x2) / 2);
        if (x <= margin) { l.x1 = 0; l.x2 = 0; }
        else if (x >= w - 1 - margin) { l.x1 = w - 1; l.x2 = w - 1; }
        else { l.x1 = x; l.x2 = x; }
      }
      return l;
    });
  }
}

const linePostProcessor = new LinePostProcessor();
window.LinePostProcessor = LinePostProcessor;
window.linePostProcessor = linePostProcessor;
