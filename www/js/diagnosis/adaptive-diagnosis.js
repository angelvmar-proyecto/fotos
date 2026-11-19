class AdaptiveDiagnosis {
  constructor() {
    this.history = [];
    this.currentParams = {
      sensitivity: 1.0,
      mergeThreshold: 5,
      minLength: 20
    };
  }
  
  analyze(results, imageData) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'], ranking: [] };
    
    logger.info('=== DIAGNÓSTICO AUTO-AJUSTABLE ===');
    
    const width = imageData.width;
    const height = imageData.height;
    
    const scores = results.map(result => {
      const lines = result.lines;
      const metrics = result.metrics;
      
      const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135);
      const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135);
      
      const regularity = this.calculateRegularity(horizontal, vertical);
      const intersections = this.calculateIntersections(horizontal, vertical);
      const coverage = this.calculateCoverage(lines, width, height);
      const consistency = this.calculateLengthConsistency(horizontal, vertical);
      const orthogonality = this.calculateOrthogonality(horizontal, vertical);
      const speed = 1 - Math.min(metrics.executionTime / 5000, 1);
      
      const score = (
        regularity * 0.25 +
        intersections * 0.25 +
        coverage * 0.15 +
        consistency * 0.15 +
        orthogonality * 0.10 +
        speed * 0.10
      );
      
      logger.info(`${result.algorithm}: Score=${score.toFixed(3)}`);
      logger.info(`  Regularidad=${regularity.toFixed(2)} Intersecciones=${intersections.toFixed(2)} Cobertura=${coverage.toFixed(2)}`);
      logger.info(`  Consistencia=${consistency.toFixed(2)} Ortogonalidad=${orthogonality.toFixed(2)} Velocidad=${speed.toFixed(2)}`);
      
      return {
        algorithm: result.algorithm,
        score: score,
        metrics: metrics,
        details: { regularity, intersections, coverage, consistency, orthogonality, speed }
      };
    });
    
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    this.history.push({
      algorithm: best.algorithm,
      score: best.score,
      lines: best.metrics.totalLines,
      timestamp: Date.now()
    });
    
    const adjustments = this.suggestAdjustments(best, scores);
    
    const reasons = [
      `Score: ${best.score.toFixed(3)}`,
      `Detectó ${best.metrics.totalLines} líneas`,
      `Tiempo: ${best.metrics.executionTime}ms`
    ];
    
    if (adjustments.length > 0) {
      reasons.push('⚙️ Ajustes sugeridos:');
      adjustments.forEach(a => reasons.push(`  ${a}`));
    }
    
    logger.info(`🏆 Mejor: ${best.algorithm} (${best.score.toFixed(3)})`);
    
    return {
      best: best.algorithm,
      reasons: reasons,
      ranking: scores,
      adjustments: adjustments
    };
  }
  
  calculateRegularity(horizontal, vertical) {
    if (horizontal.length < 3 && vertical.length < 3) return 0;
    
    let hReg = 0, vReg = 0;
    
    if (horizontal.length >= 3) {
      const sorted = horizontal.map(l => l.y1).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i-1]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (mean > 0) {
        const variance = gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length;
        hReg = 1 - Math.min(Math.sqrt(variance) / mean, 1);
      }
    }
    
    if (vertical.length >= 3) {
      const sorted = vertical.map(l => l.x1).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i-1]);
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      if (mean > 0) {
        const variance = gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length;
        vReg = 1 - Math.min(Math.sqrt(variance) / mean, 1);
      }
    }
    
    return (hReg + vReg) / 2;
  }
  
  calculateIntersections(horizontal, vertical) {
    if (horizontal.length === 0 || vertical.length === 0) return 0;
    
    let valid = 0;
    const total = horizontal.length * vertical.length;
    
    for (const h of horizontal) {
      for (const v of vertical) {
        const minX = Math.min(h.x1, h.x2);
        const maxX = Math.max(h.x1, h.x2);
        const vMinY = Math.min(v.y1, v.y2);
        const vMaxY = Math.max(v.y1, v.y2);
        
        if (v.x1 >= minX && v.x1 <= maxX && h.y1 >= vMinY && h.y1 <= vMaxY) {
          valid++;
        }
      }
    }
    
    return valid / total;
  }
  
  calculateCoverage(lines, width, height) {
    if (lines.length === 0) return 0;
    
    const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135);
    const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135);
    
    if (horizontal.length === 0 || vertical.length === 0) return 0;
    
    const hPositions = horizontal.map(l => l.y1).sort((a, b) => a - b);
    const vPositions = vertical.map(l => l.x1).sort((a, b) => a - b);
    
    const tableHeight = hPositions[hPositions.length - 1] - hPositions[0];
    const tableWidth = vPositions[vPositions.length - 1] - vPositions[0];
    
    const coverageRatio = (tableHeight * tableWidth) / (width * height);
    
    return Math.min(coverageRatio * 2, 1);
  }
  
  calculateLengthConsistency(horizontal, vertical) {
    let hCons = 0, vCons = 0;
    
    if (horizontal.length >= 2) {
      const lengths = horizontal.map(l => l.length);
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      if (mean > 0) {
        const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
        hCons = 1 - Math.min(Math.sqrt(variance) / mean, 1);
      }
    }
    
    if (vertical.length >= 2) {
      const lengths = vertical.map(l => l.length);
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      if (mean > 0) {
        const variance = lengths.reduce((sum, l) => sum + (l - mean) ** 2, 0) / lengths.length;
        vCons = 1 - Math.min(Math.sqrt(variance) / mean, 1);
      }
    }
    
    return (hCons + vCons) / 2;
  }
  
  calculateOrthogonality(horizontal, vertical) {
    if (horizontal.length < 2 || vertical.length < 2) return 0.5;
    
    let totalDev = 0, count = 0;
    
    for (const h of horizontal) {
      const hAngle = h.angle < 90 ? h.angle : h.angle - 180;
      for (const v of vertical) {
        totalDev += Math.abs(Math.abs(hAngle - v.angle) - 90);
        count++;
      }
    }
    
    return 1 - Math.min(totalDev / count / 15, 1);
  }
  
  suggestAdjustments(best, allScores) {
    const suggestions = [];
    
    if (best.details.regularity < 0.3) {
      suggestions.push('Aumentar mergeThreshold para reducir ruido');
    }
    
    if (best.details.intersections < 0.5) {
      suggestions.push('Verificar ortogonalidad de líneas detectadas');
    }
    
    if (best.details.coverage < 0.3) {
      suggestions.push('Reducir minLength para detectar líneas más cortas');
    }
    
    if (best.score < 0.5) {
      suggestions.push('Score bajo - considerar ajustar sensibilidad del algoritmo');
    }
    
    if (this.history.length >= 3) {
      const recentScores = this.history.slice(-3).map(h => h.score);
      const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      if (avg < 0.4) {
        suggestions.push('Tendencia de scores bajos - revisar parámetros globales');
      }
    }
    
    return suggestions;
  }
}
