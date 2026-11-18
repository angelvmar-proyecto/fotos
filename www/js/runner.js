class AlgorithmRunner {
  constructor() { this.algorithms = new Map(); }
  
  registerAlgorithm(algorithm) { 
    this.algorithms.set(algorithm.name, algorithm); 
    logger.info(`Registrado: ${algorithm.name}`);
  }
  
  async runAlgorithm(name, imageData) {
    const algo = this.algorithms.get(name);
    if (!algo) throw new Error(`Algoritmo ${name} no encontrado`);
    
    logger.info(`Iniciando ${name}`);
    const result = await algo.detect(imageData);
    return result;
  }
  
  async runSelected(selectedNames, imageData) {
    const results = [];
    for (const name of selectedNames) {
      try { 
        results.push(await this.runAlgorithm(name, imageData)); 
      } catch (e) { 
        logger.error(`Fallo en ${name}: ${e.message}`); 
      }
    }
    return results;
  }
}
