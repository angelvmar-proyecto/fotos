class IntelligentSelector {
  analyze(results) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'], ranking: [] };
    
    logger.info('Analizando resultados con metricas avanzadas...');
    
    const scores = results.map(result => {
      const metrics = result.metrics;
      const lines = result.lines;
      
      // Métrica 1: Número de líneas (penalizar sobre-detección)
      let lineCountScore;
      if (metrics.totalLines > 200) {
        lineCountScore = Math.max(0, 1 - (metrics.totalLines - 200) / 500);
      } else if (metrics.totalLines < 5) {
        lineCountScore = metrics.totalLines / 5;
      } else {
        lineCountScore = 1;
      }
      
      // Métrica 2: Velocidad (más peso: 30%)
      const speedScore = 1 - Math.min(metrics.executionTime / 3000, 1);
      
      // Métrica 3: Balance H/V
      const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135);
      const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135);
      const total = horizontal.length + vertical.length;
      const balanceScore = total > 0 ? 1 - Math.abs(horizontal.length - vertical.length) / total : 0;
      
      // Métrica 4: Ortogonalidad real
      let orthogonalityScore = 0;
      if (horizontal.length > 0 && vertical.length > 0) {
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
        orthogonalityScore = 1 - Math.min(avgDeviation / 15, 1);
      }
      
      // Métrica 5: Regularidad de espaciado (CORREGIDO para evitar NaN)
      let regularityScore = 0;
      if (horizontal.length >= 3) {
        const sorted = horizontal.map(l => l.y1).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
          gaps.push(sorted[i] - sorted[i-1]);
        }
        const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        
        // EVITAR DIVISION POR CERO
        if (meanGap > 0) {
          const variance = gaps.reduce((sum, g) => sum + (g - meanGap) ** 2, 0) / gaps.length;
          const stdDev = Math.sqrt(variance);
          regularityScore = 1 - Math.min(stdDev / meanGap, 1);
        }
      }
      
      // Métrica 6: Ratio de duplicación
      let duplicationScore = 1;
      if (metrics.linesBeforeMerge && metrics.linesAfterMerge) {
        duplicationScore = metrics.linesAfterMerge / metrics.linesBeforeMerge;
      }
      
      // Score ponderado
      const score = 
        (lineCountScore * 0.20) +
        (speedScore * 0.30) +
        (balanceScore * 0.15) +
        (orthogonalityScore * 0.15) +
        (regularityScore * 0.10) +
        (duplicationScore * 0.10);
      
      logger.info(`${result.algorithm}: Score=${score.toFixed(3)}`);
      logger.info(`  Lineas=${lineCountScore.toFixed(2)} Velocidad=${speedScore.toFixed(2)} Balance=${balanceScore.toFixed(2)}`);
      logger.info(`  Ortogonalidad=${orthogonalityScore.toFixed(2)} Regularidad=${regularityScore.toFixed(2)} Duplicacion=${duplicationScore.toFixed(2)}`);
      
      return {
        algorithm: result.algorithm,
        score: score,
        metrics: metrics,
        details: { 
          lineCountScore, 
          speedScore, 
          balanceScore, 
          orthogonalityScore, 
          regularityScore, 
          duplicationScore 
        }
      };
    });
    
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    const reasons = [
      `Score total: ${best.score.toFixed(3)}`,
      `Detecto ${best.metrics.totalLines} lineas`,
      `Tiempo: ${best.metrics.executionTime}ms`,
      `Ortogonalidad: ${(best.details.orthogonalityScore * 100).toFixed(0)}%`,
      `Regularidad: ${(best.details.regularityScore * 100).toFixed(0)}%`
    ];
    
    logger.info(`Mejor algoritmo: ${best.algorithm} (score: ${best.score.toFixed(3)})`);
    
    return { best: best.algorithm, reasons: reasons, ranking: scores };
  }
}
