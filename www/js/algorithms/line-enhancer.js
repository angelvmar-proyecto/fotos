class LineEnhancer {
  constructor() {
    this.name = 'Line Enhancer';
    this.color = '#00FFFF';
    this.minLength = 15;
    this.projectionThreshold = 0.50; // Umbral base más estricto
    this.edgeMargin = 10; // Zona de borde donde aplicamos umbral más alto
    this.edgeMultiplier = 1.3; // Multiplicador de umbral para bordes (30% más exigente)
    this.minLineSpacing = 15; // Espacio mínimo entre líneas
  }

  async detect(imageData) {
    logger.info('Iniciando Line Enhancer (Filtro morfológico direccional adaptativo con anti-fantasmas)...');
    const t0 = Date.now();
    
    lineValidator.prepare(imageData);
    const w = lineValidator.w, h = lineValidator.h, bin = lineValidator.bin;
    
    // ADAPTACIÓN: Ajustar minLength según el perfil de la imagen
    if (currentImageProfile && currentImageProfile.type) {
      const type = currentImageProfile.type;
      if (type.includes('FINA') || type.includes('DENSA')) {
        this.minLength = 8;
      } else if (type.includes('GRUESA') || type.includes('PANTALLA')) {
        this.minLength = 20;
      } else {
        this.minLength = 15;
      }
    }
    
    const L = this.minLength;
    const half = Math.floor(L / 2);
    const enhancedV = new Uint8Array(w * h);
    const enhancedH = new Uint8Array(w * h);

    // 1. FILTRO VERTICAL
    for (let y = half; y < h - half; y++) {
      for (let x = 0; x < w; x++) {
        let match = true;
        for (let dy = -half; dy <= half; dy++) {
          if (bin[(y + dy) * w + x] === 0) { match = false; break; }
        }
        if (match) enhancedV[y * w + x] = 1;
      }
    }
    const outV = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (enhancedV[y * w + x] === 1) {
          for (let dy = -half; dy <= half; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < h) outV[ny * w + x] = 1;
          }
        }
      }
    }

    // 2. FILTRO HORIZONTAL
    for (let y = 0; y < h; y++) {
      for (let x = half; x < w - half; x++) {
        let match = true;
        for (let dx = -half; dx <= half; dx++) {
          if (bin[y * w + (x + dx)] === 0) { match = false; break; }
        }
        if (match) enhancedH[y * w + x] = 1;
      }
    }
    const outH = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (enhancedH[y * w + x] === 1) {
          for (let dx = -half; dx <= half; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < w) outH[y * w + nx] = 1;
          }
        }
      }
    }

    // 3. Detección con umbral adaptativo para bordes
    const vProj = new Array(w).fill(0);
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (outV[y * w + x]) vProj[x]++;
    const vLines = this.extractLinesWithEdgeAwareThreshold(vProj, w, h, 90, 'v');

    const hProj = new Array(h).fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (outH[y * w + x]) hProj[y]++;
    const hLines = this.extractLinesWithEdgeAwareThreshold(hProj, h, w, 0, 'h');

    const lines = hLines.concat(vLines);
    const time = Date.now() - t0;
    logger.info('Line Enhancer completado en ' + time + 'ms. Lineas: ' + lines.length + ' (H=' + hLines.length + ' V=' + vLines.length + ') [minLength adaptado: ' + this.minLength + 'px]');
    
    return {
      algorithm: this.name, color: this.color, lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, hLines: hLines.length, vLines: vLines.length }
    };
  }

  extractLinesWithEdgeAwareThreshold(proj, len1, len2, angle, axis) {
    const lines = [];
    const baseThreshold = Math.max(...proj) * this.projectionThreshold;
    
    // Paso 1: Detectar todas las líneas candidatas con umbral adaptativo
    const candidates = [];
    for (let i = 0; i < len1; i++) {
      // Determinar si está en zona de borde
      const isEdge = (i < this.edgeMargin || i >= len1 - this.edgeMargin);
      
      // Aplicar umbral más alto para bordes
      const effectiveThreshold = isEdge ? baseThreshold * this.edgeMultiplier : baseThreshold;
      
      if (proj[i] > effectiveThreshold) {
        candidates.push({ pos: i, strength: proj[i], isEdge: isEdge });
      }
    }
    
    if (candidates.length === 0) return lines;
    
    // Paso 2: Eliminar líneas demasiado juntas (fantasmas de texto)
    const filteredBySpacing = [candidates[0]];
    for (let i = 1; i < candidates.length; i++) {
      const prev = filteredBySpacing[filteredBySpacing.length - 1];
      const dist = candidates[i].pos - prev.pos;
      
      if (dist >= this.minLineSpacing) {
        // Suficientemente separada, la aceptamos
        filteredBySpacing.push(candidates[i]);
      } else {
        // Muy cerca de la anterior, solo la aceptamos si es MUCHO más fuerte
        if (candidates[i].strength > prev.strength * 1.5) {
          // Reemplazar la anterior con esta (es más fuerte)
          filteredBySpacing[filteredBySpacing.length - 1] = candidates[i];
        }
        // Si no es más fuerte, la ignoramos (es un fantasma de texto)
      }
    }
    
    // Paso 3: Convertir a líneas
    for (const c of filteredBySpacing) {
      if (axis === 'v') {
        lines.push({ x1: c.pos, y1: 0, x2: c.pos, y2: len2 - 1, angle: angle, length: len2 });
      } else {
        lines.push({ x1: 0, y1: c.pos, x2: len2 - 1, y2: c.pos, angle: angle, length: len2 });
      }
    }
    
    return lines;
  }
}
window.LineEnhancer = LineEnhancer;
