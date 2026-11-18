class AlgorithmRunner {
  constructor() { this.algorithms = new Map(); }
  registerAlgorithm(algorithm) { this.algorithms.set(algorithm.name, algorithm); logger.info(`Registrado: ${algorithm.name}`); }
  async runSelected(selectedNames, imageData) {
    const results = [];
    for (const name of selectedNames) {
      const algo = this.algorithms.get(name);
      if (algo) {
        try { results.push(await algo.detect(imageData)); } 
        catch (e) { logger.error(`Fallo en ${name}: ${e.message}`); }
      }
    }
    return results;
  }
}
