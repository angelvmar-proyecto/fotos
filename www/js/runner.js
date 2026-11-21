class AlgorithmRunner {
  constructor() { this.algorithms = new Map(); }
  
  registerAlgorithm(algorithm) { 
    this.algorithms.set(algorithm.name, algorithm); 
    logger.info(`Registrado: ${algorithm.name}`);
  }
  
  async runAlgorithm(name, imageData) {
    const algo = this.algorithms.find(a => a.name === name);
    if (!algo) throw new Error("Algoritmo no encontrado: " + name);
    
    // Si es Cell Detector, pasar líneas de Echo Radar
    if (name === "Cell Detector" && algo.setEchoRadarLines) {
      const echoRadar = this.algorithms.find(a => a.name === "Echo Radar");
      if (echoRadar && echoRadar.lastResult && echoRadar.lastResult.lines) {
        algo.setEchoRadarLines(echoRadar.lastResult.lines);
        logger.info("  Cell Detector usando líneas de Echo Radar como evidencia");
      }
    }
    
    logger.info("Iniciando " + name + "...");
    const result = await algo.detect(imageData);
    
    // Guardar resultado para uso futuro
    if (name === "Echo Radar") {
      algo.lastResult = result;
    }
    
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
