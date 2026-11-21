class AlgorithmRunner {
  constructor() {
    this.algorithms = new Map();
  }

  registerAlgorithm(algorithm) {
    this.algorithms.set(algorithm.name, algorithm);
    logger.info("Registrado: " + algorithm.name);
  }

  async runAlgorithm(name, imageData) {
    const algo = this.algorithms.get(name);
    if (!algo) throw new Error("Algoritmo no encontrado: " + name);

    // Si es Cell Detector, asegurar que tenga las líneas de Echo Radar
    if (name === "Cell Detector" && algo.setEchoRadarLines) {
      const echoRadar = this.algorithms.get("Echo Radar");
      if (echoRadar && echoRadar.lastResult && echoRadar.lastResult.lines) {
        algo.setEchoRadarLines(echoRadar.lastResult.lines);
        logger.info("  Cell Detector usando líneas de Echo Radar como evidencia");
      } else {
        logger.info("  Cell Detector: Sin líneas previas de Echo Radar (ejecución normal)");
      }
    }

    logger.info("Iniciando " + name + "...");
    const result = await algo.detect(imageData);

    // Guardar resultado para uso futuro (especialmente para Cell Detector)
    if (name === "Echo Radar") {
      algo.lastResult = result;
    }

    return result;
  }

  async runSelected(selectedNames, imageData) {
    const results = [];
    
    // Reordenar para garantizar que Echo Radar corra antes que Cell Detector
    let executionOrder = [...selectedNames];
    const hasCell = executionOrder.includes("Cell Detector");
    const hasEcho = executionOrder.includes("Echo Radar");
    
    if (hasCell && hasEcho) {
      // Remover Echo Radar de su posición actual
      executionOrder = executionOrder.filter(n => n !== "Echo Radar");
      // Insertar Echo Radar al principio para que Cell Detector lo encuentre
      executionOrder.unshift("Echo Radar");
      logger.info("⚙️ Reordenando ejecución: Echo Radar correrá antes que Cell Detector");
    }

    for (const name of executionOrder) {
      try {
        results.push(await this.runAlgorithm(name, imageData));
      } catch (e) {
        logger.error("Fallo en " + name + ": " + e.message);
      }
    }
    return results;
  }
}
window.AlgorithmRunner = AlgorithmRunner;
