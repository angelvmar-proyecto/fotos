class AlgorithmRunner {
  constructor() { this.algorithms = new Map(); this.results = []; }
  registerAlgorithm(algorithm) { 
    this.algorithms.set(algorithm.name, algorithm); 
    logger.info(`Registrado: ${algorithm.name}`);
  }
  async runSelected(selectedNames, imageData) {
    this.results = [];
    for (const name of selectedNames) {
      const algo = this.algorithms.get(name);
      if (algo) {
        try {
          const result = await algo.detect(imageData);
          this.results.push(result);
        } catch (e) {
          logger.error(`Fallo en ${name}: ${e.message}`);
        }
      }
    }
    return this.results;
  }
}
