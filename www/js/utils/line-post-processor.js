// Post-procesador unificado para todos los algoritmos de detección de líneas
class LinePostProcessor {
  constructor() {
    this.standards = LineDetectionStandards;
  }

  // Aplica todos los filtros estandarizados a un resultado
  process(result, imageProfile) {
    if (!result || !result.lines || result.lines.length === 0) return result;

    const params = this.standards.getParamsForType(imageProfile.imageType);
    const w = imageProfile.width;
    const h = imageProfile.height;

    logger.info('  Post-procesando ' + result.algorithm + ' con estándares unificados...');

    // 1. Fusionar líneas duplicadas
    result.lines = this.mergeDuplicates(result.lines, params.ghostRemoval);

    // 2. Validar y corregir bordes
    result.lines = this.validateEdges(result.lines, params.edgeDetection, w, h);

    // 3. Filtrar líneas incompletas
    result.lines = this.filterIncompleteLines(result.lines, params.lineCompletion, w, h);

    // 4. Validar espaciado
    result.lines = this.validateSpacing(result.lines, params.spacing);

    // 5. Corregir desfase
    result.lines = this.correctDrift(result.lines, params.alignment);

    // Actualizar métricas
    result.metrics.totalLines = result.lines.length;
    result.metrics.postProcessed = true;

    return result;
  }

  // Fusiona líneas que están muy cerca
  mergeDuplicates(lines, params) {
    if (lines.length < 2) return lines;

    const merged = [];
    const used = new Set();

    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;

      const line1 = lines[i];
      let bestMatch = -1;
      let bestDist = Infinity;

      // Buscar la línea más cercana del mismo tipo
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        const line2 = lines[j];

        // Solo fusionar líneas del mismo eje
        if (Math.abs(line1.angle - line2.angle) > 10) continue;

        let dist;
        if (Math.abs(line1.angle) < 10 || Math.abs(line1.angle - 180) < 10) {
          // Horizontales: comparar Y
          dist = Math.abs(line1.y1 - line2.y1);
        } else {
          // Verticales: comparar X
          dist = Math.abs(line1.x1 - line2.x1);
        }

        if (dist < params.mergeThreshold && dist < bestDist) {
          bestDist = dist;
          bestMatch = j;
        }
      }

      if (bestMatch >= 0) {
        // Fusionar con la mejor coincidencia
        const line2 = lines[bestMatch];
        const mergedLine = this.mergeTwoLines(line1, line2);
        merged.push(mergedLine);
        used.add(i);
        used.add(bestMatch);
      } else {
        merged.push(line1);
        used.add(i);
      }
    }

    return merged;
  }

  mergeTwoLines(line1, line2) {
    // Tomar la línea con mejor cobertura/longitud
    const len1 = Math.sqrt(Math.pow(line1.x2 - line1.x1, 2) + Math.pow(line1.y2 - line1.y1, 2));
    const len2 = Math.sqrt(Math.pow(line2.x2 - line2.x1, 2) + Math.pow(line2.y2 - line2.y1, 2));

    return len1 >= len2 ? line1 : line2;
  }

  // Valida y corrige líneas en los bordes
  validateEdges(lines, params, w, h) {
    return lines.map(line => {
      const isHorizontal = Math.abs(line.angle) < 10 || Math.abs(line.angle - 180) < 10;

      if (isHorizontal) {
        // Verificar si está en el borde superior o inferior
        if (line.y1 <= params.borderWidth) {
          line.y1 = 0;
          line.y2 = 0;
        } else if (line.y1 >= h - params.borderWidth) {
          line.y1 = h - 1;
          line.y2 = h - 1;
        }
        // Asegurar que cubra todo el ancho
        line.x1 = 0;
        line.x2 = w - 1;
      } else {
        // Verificar si está en el borde izquierdo o derecho
        if (line.x1 <= params.borderWidth) {
          line.x1 = 0;
          line.x2 = 0;
        } else if (line.x1 >= w - params.borderWidth) {
          line.x1 = w - 1;
          line.x2 = w - 1;
        }
        // Asegurar que cubra todo el alto
        line.y1 = 0;
        line.y2 = h - 1;
      }

      return line;
    });
  }

  // Filtra líneas que no cumplen con los requisitos de completitud
  filterIncompleteLines(lines, params, w, h) {
    return lines.filter(line => {
      const isHorizontal = Math.abs(line.angle) < 10 || Math.abs(line.angle - 180) < 10;
      const expectedLength = isHorizontal ? w : h;
      const actualLength = Math.sqrt(Math.pow(line.x2 - line.x1, 2) + Math.pow(line.y2 - line.y1, 2));

      return actualLength >= expectedLength * params.minLengthRatio;
    });
  }

  // Valida que el espaciado entre líneas sea razonable
  validateSpacing(lines, params) {
    const horizontals = lines.filter(l => Math.abs(l.angle) < 10 || Math.abs(l.angle - 180) < 10)
                            .sort((a, b) => a.y1 - b.y1);
    const verticals = lines.filter(l => Math.abs(l.angle - 90) < 10)
                          .sort((a, b) => a.x1 - b.x1);

    const validH = this.filterBySpacing(horizontals, 'y1', params);
    const validV = this.filterBySpacing(verticals, 'x1', params);

    return validH.concat(validV);
  }

  filterBySpacing(lines, coord, params) {
    if (lines.length < 2) return lines;

    const valid = [lines[0]];
    for (let i = 1; i < lines.length; i++) {
      const prev = valid[valid.length - 1];
      const dist = lines[i][coord] - prev[coord];

      if (dist >= params.minSpacing && dist <= params.maxSpacing) {
        valid.push(lines[i]);
      }
    }

    return valid;
  }

  // Corrige pequeñas desviaciones en líneas
  correctDrift(lines, params) {
    return lines.map(line => {
      // Redondear a píxeles enteros para evitar sub-píxel drift
      line.x1 = Math.round(line.x1);
      line.y1 = Math.round(line.y1);
      line.x2 = Math.round(line.x2);
      line.y2 = Math.round(line.y2);
      return line;
    });
  }
}

const linePostProcessor = new LinePostProcessor();
window.LinePostProcessor = LinePostProcessor;
window.linePostProcessor = linePostProcessor;
