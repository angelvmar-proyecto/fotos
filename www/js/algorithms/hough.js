class HoughTransform {
  constructor() { 
    this.name = 'Hough Transform'; 
    this.color = '#FF0000'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Hough Transform (version real)');
    const start = Date.now();
    
    const gray = ImageProcessor.toGrayscale(imageData);
    const width = gray.width;
    const height = gray.height;
    const data = gray.data;
    
    // Detección de bordes simple (Sobel)
    const edges = this.detectEdges(data, width, height);
    
    // Transformada de Hough
    const maxRho = Math.ceil(Math.sqrt(width * width + height * height));
    const acc = new Int32Array(180 * maxRho * 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (edges[y * width + x] > 100) {
          for (let theta = 0; theta < 180; theta++) {
            const rad = (theta - 90) * Math.PI / 180;
            const rho = Math.round(x * Math.cos(rad) + y * Math.sin(rad));
            const rhoIdx = rho + maxRho;
            acc[theta * maxRho * 2 + rhoIdx]++;
          }
        }
      }
    }
    
    // Extraer líneas del acumulador
    const lines = [];
    const threshold = 50;
    
    for (let theta = 0; theta < 180; theta++) {
      for (let rhoIdx = 0; rhoIdx < maxRho * 2; rhoIdx++) {
        if (acc[theta * maxRho * 2 + rhoIdx] > threshold) {
          const rho = rhoIdx - maxRho;
          const rad = (theta - 90) * Math.PI / 180;
          
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          
          let x1, y1, x2, y2;
          
          if (Math.abs(cos) > Math.abs(sin)) {
            x1 = Math.round(rho / cos);
            y1 = 0;
            x2 = Math.round((rho - height * sin) / cos);
            y2 = height;
          } else {
            x1 = 0;
            y1 = Math.round(rho / sin);
            x2 = width;
            y2 = Math.round((rho - width * cos) / sin);
          }
          
          const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          if (length > 50) {
            lines.push({
              x1: Math.max(0, Math.min(width - 1, x1)),
              y1: Math.max(0, Math.min(height - 1, y1)),
              x2: Math.max(0, Math.min(width - 1, x2)),
              y2: Math.max(0, Math.min(height - 1, y2)),
              angle: theta,
              length: length
            });
          }
        }
      }
    }
    
    const time = Date.now() - start;
    logger.info(`Hough Transform completado en ${time}ms. Lineas: ${lines.length}`);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines, 
      metrics: { totalLines: lines.length, executionTime: time } 
    };
  }
  
  detectEdges(data, width, height) {
    const edges = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        
        const gx = -data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x+1)) * 4]
                   -2 * data[(y * width + (x-1)) * 4] + 2 * data[(y * width + (x+1)) * 4]
                   -data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        const gy = -data[((y-1) * width + (x-1)) * 4] - 2 * data[((y-1) * width + x) * 4] - data[((y-1) * width + (x+1)) * 4]
                   +data[((y+1) * width + (x-1)) * 4] + 2 * data[((y+1) * width + x) * 4] + data[((y+1) * width + (x+1)) * 4];
        
        edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
    
    return edges;
  }
}
window.HoughTransform = HoughTransform;
