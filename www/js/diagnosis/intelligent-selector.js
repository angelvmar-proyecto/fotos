class IntelligentSelector {
  constructor() {
    this.imageAnalysis = null;
  }

  // Analiza la imagen ANTES de evaluar algoritmos
  analyzeImage(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // 1. Convertir a escala de grises y calcular densidad
    let darkPixels = 0;
    const totalPixels = width * height;
    const grayValues = new Uint8Array(totalPixels);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      grayValues[j] = gray;
      if (gray < 128) darkPixels++;
    }
    
    const density = darkPixels / totalPixels;
    
    // 2. Relación de aspecto
    const aspectRatio = width / height;
    
    // 3. Contraste promedio (desviación estándar de grises)
    let sum = 0, sumSq = 0;
    for (let i = 0; i < grayValues.length; i++) {
      sum += grayValues[i];
      sumSq += grayValues[i] * grayValues[i];
    }
    const mean = sum / totalPixels;
    const variance = (sumSq / totalPixels) - (mean * mean);
    const contrast = Math.sqrt(Math.max(0, variance));
    
    // 4. Estimación de líneas esperadas
    // Basado en heurística: una tabla típica tiene líneas cada 20-50px
    const estimatedHorizontalLines = Math.floor(height / 35);
    const estimatedVerticalLines = Math.floor(width / 50);
    const estimatedTotalLines = estimatedHorizontalLines + estimatedVerticalLines;
    
    // 5. Detectar si es probable una tabla
    const isLikelyTable = density > 0.15 && density < 0.7 && contrast > 30;
    
    this.imageAnalysis = {
      width,
      height,
      density,
      aspectRatio,
      contrast,
      estimatedTotalLines,
      estimatedHorizontalLines,
      estimatedVerticalLines,
      isLikelyTable
    };
    
    logger.info('Análisis de imagen completado:');
    logger.info(`  Tamaño: ${width}x${height}`);
    logger.info(`  Densidad: ${(density * 100).toFixed(1)}%`);
    logger.info(`  Contraste: ${contrast.toFixed(1)}`);
    logger.info(`  Líneas esperadas: ~${estimatedTotalLines} (H:${estimatedHorizontalLines}, V:${estimatedVerticalLines})`);
    logger.info(`  Es tabla: ${isLikelyTable ? 'Sí' : 'No'}`);
    
    return this.imageAnalysis;
  }

  analyze(results, imageData) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'], ranking: [] };
    
    // Analizar imagen si no se ha hecho
    if (!this.imageAnalysis) {
      this.analyzeImage(imageData);
    }
    
    logger.info('Evaluando algoritmos con 6 métricas de calidad...');
    
    const scores = results.map(result => {
      const lines = result.lines;
      const metrics = result.metrics;
      
      // Separar líneas horizontales y verticales
      const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135);
      const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135);
      
      // MÉTRICA 1: Regularidad de espaciado (25%)
      const regularityScore = this.calculateRegularity(horizontal, vertical);
      
      // MÉTRICA 2: Intersecciones válidas H×V (25%)
      const intersectionScore = this.calculateIntersections(horizontal, vertical);
      
      // MÉTRICA 3: Cobertura del área (15%)
      const coverageScore = this.calculateCoverage(lines, this.imageAnalysis);
      
      // MÉTRICA 4: Consistencia de longitud (15%)
      const lengthConsistencyScore = this.calculateLengthConsistency(horizontal, vertical);
      
      // MÉTRICA 5: Ortogonalidad real (10%)
      const orthogonalityScore = this.calculateOrthogonality(horizontal, vertical);
      
      // MÉTRICA 6: Velocidad (10%)
      const speedScore = 1 - Math.min(metrics.executionTime / 5000, 1);
      
      // Penalización por desviación de líneas esperadas
      const totalLines = lines.length;
      const expectedLines = this.imageAnalysis.estimatedTotalLines;
      const ratio = totalLines / expectedLines;
      let deviationPenalty = 1;
      
      if (ratio < 0.2) deviationPenalty = 0.3; // Muy pocas líneas
      else if (ratio < 0.5) deviationPenalty = 0.6;
      else if (ratio > 3) deviationPenalty = 0.5; // Demasiadas líneas (falsos positivos)
      else if (ratio > 2) deviationPenalty = 0.8;
      
      // Score final ponderado
      const score = (
        (regularityScore * 0.25) +
        (intersectionScore * 0.25) +
        (coverageScore * 0.15) +
        (lengthConsistencyScore * 0.15) +
        (orthogonalityScore * 0.10) +
        (speedScore * 0.10)
      ) * deviationPenalty;
      
      logger.info(`${result.algorithm}: Score=${score.toFixed(3)} (penalización: ${deviationPenalty.toFixed(2)})`);
      logger.info(`  Regularidad=${regularityScore.toFixed(2)} Intersecciones=${intersectionScore.toFixed(2)} Cobertura=${coverageScore.toFixed(2)}`);
      logger.info(`  Longitud=${lengthConsistencyScore.toFixed(2)} Ortogonalidad=${orthogonalityScore.toFixed(2)} Velocidad=${speedScore.toFixed(2)}`);
      
      return {
        algorithm: result.algorithm,
        score: score,
        metrics: metrics,
        details: {
          regularityScore,
          intersectionScore,
          coverageScore,
          lengthConsistencyScore,
          orthogonalityScore,
          speedScore,
          deviationPenalty,
          totalLines,
          horizontalLines: horizontal.length,
          verticalLines: vertical.length
        }
      };
    });
    
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    // Generar explicación detallada
    const reasons = this.generateExplanation(best, this.imageAnalysis);
    
    logger.info(`🏆 Mejor algoritmo: ${best.algorithm} (score: ${best.score.toFixed(3)})`);
    
    return {
      best: best.algorithm,
      reasons: reasons,
      ranking: scores,
      imageAnalysis: this.imageAnalysis,
      isLikelyTable: this.imageAnalysis.isLikelyTable
    };
  }

  calculateRegularity(horizontal, vertical) {
    if (horizontal.length < 3 && vertical.length < 3) return 0;
    
    let hRegularity = 0, vRegularity = 0;
    
    // Regularidad horizontal
    if (horizontal.length >= 3) {
      const sorted = horizontal.map(l => l.y1).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(sorted[i] - sorted[i-1]);
      }
      const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (meanGap > 0) {
        const variance = gaps.reduce((sum, g) => sum + (g - meanGap) ** 2, 0) / gaps.length;
        const stdDev = Math.sqrt(variance);
        hRegularity = 1 - Math.min(stdDev / meanGap, 1);
      }
    }
    
    // Regularidad vertical
    if (vertical.length >= 3) {
      const sorted = vertical.map(l => l.x1).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        gaps.push(sorted[i] - sorted[i-1]);
      }
      const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (meanGap > 0) {
        const variance = gaps.reduce((sum, g) => sum + (g - meanGap) ** 2, 0) / gaps.length;
        const stdDev = Math.sqrt(variance);
        vRegularity = 1 - Math.min(stdDev / meanGap, 1);
      }
    }
    
    return (hRegularity + vRegularity) / 2;
  }

  calculateIntersections(horizontal, vertical) {
    if (horizontal.length === 0 || vertical.length === 0) return 0;
    
    let validIntersections = 0;
    let totalExpected = horizontal.length * vertical.length;
    
    for (const h of horizontal) {
      for (const v of vertical) {
        // Verificar si se cruzan dentro de los límites de ambas líneas
        const minX = Math.min(h.x1, h.x2);
        const maxX = Math.max(h.x1, h.x2);
        const minY = Math.min(h.y1, h.y2);
        const maxY = Math.max(h.y1, h.y2);
        
        const vMinX = Math.min(v.x1, v.x2);
        const vMaxX = Math.max(v.x1, v.x2);
        const vMinY = Math.min(v.y1, v.y2);
        const vMaxY = Math.max(v.y1, v.y2);
        
        // Punto de intersección
        const intersectX = v.x1;
        const intersectY = h.y1;
        
        // Verificar si está dentro de ambos segmentos
        if (intersectX >= minX && intersectX <= maxX &&
            intersectY >= vMinY && intersectY <= vMaxY) {
          validIntersections++;
        }
      }
    }
    
    return validIntersections / totalExpected;
  }

  calculateCoverage(lines, imageAnalysis) {
    if (lines.length === 0) return 0;
    
    const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135);
    const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135);
    
    if (horizontal.length === 0 || vertical.length === 0) return 0;
    
    // Calcular bounding box de las líneas
    const hPositions = horizontal.map(l => l.y1).sort((a, b) => a - b);
    const vPositions = vertical.map(l => l.x1).sort((a, b) => a - b);
    
    const hMin = hPositions[0];
    const hMax = hPositions[hPositions.length - 1];
    const vMin = vPositions[0];
    const vMax = vPositions[vPositions.length - 1];
    
    const tableHeight = hMax - hMin;
    const tableWidth = vMax - vMin;
    const tableArea = tableHeight * tableWidth;
    const imageArea = imageAnalysis.width * imageAnalysis.height;
    
    // Cobertura ideal: 30-80% de la imagen
    const coverageRatio = tableArea / imageArea;
    
    if (coverageRatio < 0.1) return 0.3;
    if (coverageRatio > 0.9) return 0.5;
    return 1 - Math.abs(coverageRatio - 0.5) / 0.4;
  }

  calculateLengthConsistency(horizontal, vertical) {
    let hConsistency = 0, vConsistency = 0;
    
    if (horizontal.length >= 2) {
      const lengths = horizontal.map(l => l.length);
      const meanLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      if (meanLength > 0) {
        const variance = lengths.reduce((sum, l) => sum + (l - meanLength) ** 2, 0) / lengths.length;
        const stdDev = Math.sqrt(variance);
        hConsistency = 1 - Math.min(stdDev / meanLength, 1);
      }
    }
    
    if (vertical.length >= 2) {
      const lengths = vertical.map(l => l.length);
      const meanLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      if (meanLength > 0) {
        const variance = lengths.reduce((sum, l) => sum + (l - meanLength) ** 2, 0) / lengths.length;
        const stdDev = Math.sqrt(variance);
        vConsistency = 1 - Math.min(stdDev / meanLength, 1);
      }
    }
    
    return (hConsistency + vConsistency) / 2;
  }

  calculateOrthogonality(horizontal, vertical) {
    if (horizontal.length < 2 || vertical.length < 2) return 0.5; // Neutral
    
    let totalDeviation = 0;
    let count = 0;
    
    for (const h of horizontal) {
      const hAngle = h.angle < 90 ? h.angle : h.angle - 180;
      for (const v of vertical) {
        const deviation = Math.abs(Math.abs(hAngle - v.angle) - 90);
        totalDeviation += deviation;
        count++;
      }
    }
    
    const avgDeviation = totalDeviation / count;
    return 1 - Math.min(avgDeviation / 15, 1);
  }

  generateExplanation(best, imageAnalysis) {
    const reasons = [];
    
    reasons.push(`Score total: ${best.score.toFixed(3)}`);
    reasons.push(`Detectó ${best.details.totalLines} líneas (esperadas: ~${imageAnalysis.estimatedTotalLines})`);
    reasons.push(`Tiempo: ${best.metrics.executionTime}ms`);
    
    if (best.details.regularityScore > 0.7) {
      reasons.push(`✅ Excelente regularidad de espaciado (${(best.details.regularityScore * 100).toFixed(0)}%)`);
    }
    
    if (best.details.intersectionScore > 0.7) {
      reasons.push(`✅ Muchas intersecciones válidas (${(best.details.intersectionScore * 100).toFixed(0)}%)`);
    }
    
    if (best.details.deviationPenalty < 1) {
      reasons.push(`⚠️ Penalizado por detectar ${best.details.totalLines} líneas (esperadas: ~${imageAnalysis.estimatedTotalLines})`);
    }
    
    if (!imageAnalysis.isLikelyTable) {
      reasons.push(`💡 Esta imagen probablemente no es una tabla`);
    }
    
    return reasons;
  }
}
