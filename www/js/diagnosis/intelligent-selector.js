class IntelligentSelector {
  analyze(results) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'] };
    
    logger.info('Analizando resultados con metricas...');
    
    const scores = results.map(result => {
      const metrics = result.metrics;
      const lines = result.lines;
      
      // Métrica 1: Número de líneas (más es mejor, pero no demasiado)
      const lineCountScore = Math.min(metrics.totalLines / 50, 1);
      
      // Métrica 2: Velocidad (más rápido es mejor)
      const speedScore = 1 - Math.min(metrics.executionTime / 5000, 1);
      
      // Métrica 3: Balance H/V (idealmente 50/50)
      const horizontal = lines.filter(l => l.angle < 45 || l.angle > 135).length;
      const vertical = lines.filter(l => l.angle >= 45 && l.angle <= 135).length;
      const total = horizontal + vertical;
      const balanceScore = total > 0 ? 1 - Math.abs(horizontal - vertical) / total : 0;
      
      // Métrica 4: Longitud promedio de líneas
      const avgLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
      const lengthScore = Math.min(avgLength / 200, 1);
      
      // Score ponderado
      const score = (lineCountScore * 0.3) + (speedScore * 0.2) + (balanceScore * 0.3) + (lengthScore * 0.2);
      
      logger.info(`${result.algorithm}: Score=${score.toFixed(3)} (Lineas=${lineCountScore.toFixed(2)}, Velocidad=${speedScore.toFixed(2)}, Balance=${balanceScore.toFixed(2)}, Longitud=${lengthScore.toFixed(2)})`);
      
      return {
        algorithm: result.algorithm,
        score: score,
        metrics: metrics,
        details: { lineCountScore, speedScore, balanceScore, lengthScore }
      };
    });
    
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];
    
    const reasons = [
      `Score total: ${best.score.toFixed(3)}`,
      `Detecto ${best.metrics.totalLines} lineas`,
      `Tiempo: ${best.metrics.executionTime}ms`
    ];
    
    logger.info(`Mejor algoritmo: ${best.algorithm} (score: ${best.score.toFixed(3)})`);
    
    return { best: best.algorithm, reasons: reasons, ranking: scores };
  }
}
