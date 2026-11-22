class LinePostProcessor {
  constructor() {
    this.standards = LineDetectionStandards;
  }

  process(result, imageProfile) {
    if (!result || !result.lines || result.lines.length === 0) return result;
    if (!imageProfile) return result;

    const params = this.standards.getParamsForType(imageProfile.imageType);
    const w = imageProfile.width, h = imageProfile.height;
    const n0 = result.lines.length;

    // 1. Fusionar lineas encimadas (cluster, no pares)
    let lines = this.mergeClusters(result.lines, params.ghostRemoval.mergeThreshold);
    const n1 = lines.length;

    // 2. Snap a bordes SOLO si la linea ya llega casi al borde
    lines = this.snapEdges(lines, params.edgeDetection.borderWidth, w, h);

    // 3. Descartar fragmentos muy cortos (umbral bajo, no arbitrario)
    lines = this.filterShort(lines, params.lineCompletion.minLengthRatio, w, h);
    const n2 = lines.length;

    // 4. Coordenadas enteras
    lines = lines.map(function(l){
      l.x1 = Math.round(l.x1); l.y1 = Math.round(l.y1);
      l.x2 = Math.round(l.x2); l.y2 = Math.round(l.y2);
      return l;
    });

    result.lines = lines;
    result.metrics.totalLines = lines.length;
    result.metrics.postProcessed = true;

    logger.info('  Post-proceso ' + result.algorithm + ': ' + n0 + ' -> ' + lines.length +
                ' (encimadas=-' + (n0 - n1) + ', cortas=-' + (n1 - n2) + ', espaciado=NO FILTRA)');
    return result;
  }

  isH(l) { const a = ((l.angle % 180) + 180) % 180; return a <= 10 || a >= 170; }
  isV(l) { const a = ((l.angle % 180) + 180) % 180; return Math.abs(a - 90) <= 10; }
  pos(l) { return this.isH(l) ? (l.y1 + l.y2) / 2 : (l.x1 + l.x2) / 2; }
  span(l) { return Math.sqrt(Math.pow(l.x2-l.x1,2) + Math.pow(l.y2-l.y1,2)); }

  score(l) {
    const cov = (typeof l.coverage === 'number') ? l.coverage : 0.5;
    const str = (typeof l.strength === 'number') ? Math.min(1, l.strength / 100) : 0.5;
    return this.span(l) * (0.5 + cov) * (0.7 + str * 0.3);
  }

  // Agrupa TODAS las lineas a <= gap px y conserva la mejor del grupo
  mergeClusters(lines, gap) {
    const self = this;
    const out = [];
    [lines.filter(function(l){return self.isH(l);}),
     lines.filter(function(l){return self.isV(l);}),
     lines.filter(function(l){return !self.isH(l) && !self.isV(l);})]
    .forEach(function(group){
      if (!group.length) return;
      group.sort(function(a,b){ return self.pos(a) - self.pos(b); });
      let cluster = [group[0]];
      const flush = function(){
        let best = cluster[0], bs = self.score(best);
        for (let i = 1; i < cluster.length; i++) {
          const s = self.score(cluster[i]);
          if (s > bs) { bs = s; best = cluster[i]; }
        }
        out.push(best);
      };
      for (let i = 1; i < group.length; i++) {
        if (self.pos(group[i]) - self.pos(cluster[cluster.length-1]) <= gap) cluster.push(group[i]);
        else { flush(); cluster = [group[i]]; }
      }
      flush();
    });
    return out;
  }

  // Solo extiende si el extremo YA esta a <= margin del borde. No estira lineas internas.
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

  filterShort(lines, ratio, w, h) {
    const self = this;
    return lines.filter(function(l){
      const expected = self.isH(l) ? w : (self.isV(l) ? h : self.span(l));
      if (!expected) return true;
      return self.span(l) >= expected * ratio;
    });
  }
}

const linePostProcessor = new LinePostProcessor();
window.LinePostProcessor = LinePostProcessor;
window.linePostProcessor = linePostProcessor;
