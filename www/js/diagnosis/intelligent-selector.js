class IntelligentSelector {
  analyze(results) {
    if (results.length === 0) return { best: 'Ninguno', reasons: ['Sin resultados'] };
    const best = results[0];
    return { best: best.algorithm, reasons: [`Detecto ${best.metrics.totalLines} lineas en ${best.metrics.executionTime}ms`] };
  }
}
