class IntelligentSelector {
  analyze(results) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'] };
    const best = results[0]; // Simplificado para prueba
    return { 
      best: best.algorithm, 
      reasons: [`Detectó ${best.metrics.totalLines} líneas en ${best.metrics.executionTime}ms`] 
    };
  }
}
