class HoughTransform {
  constructor() { 
    this.name = 'Hough Transform'; 
    this.color = '#FF0000'; 
  }
  async detect(imageData) {
    logger.info('Iniciando Hough Transform');
    const start = Date.now();
    const lines = [];
    
    // Detección básica de prueba (líneas horizontales cada 50px)
    for(let y = 0; y < imageData.height; y += 50) {
      lines.push({
        x1: 0, y1: y, 
        x2: imageData.width, y2: y, 
        angle: 0, 
        length: imageData.width
      });
    }
    
    const time = Date.now() - start;
    logger.info(`Hough completado en ${time}ms. Líneas: ${lines.length}`);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines, 
      metrics: { totalLines: lines.length, executionTime: time } 
    };
  }
}
// Forzar registro global por si acaso
window.HoughTransform = HoughTransform;
