class ProfileProjection {
  constructor() { 
    this.name = 'Profile Projection'; 
    this.color = '#FFFF00'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Profile Projection (optimizado para tablas densas)');
    const start = Date.now();
    
    const grayData = new Uint8ClampedArray(imageData.width * imageData.height);
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      grayData[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const width = imageData.width;
    const height = imageData.height;
    const lines = [];
    
    // Proyección horizontal con umbral bajo (10%) para tablas densas
    const hProjection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grayData[y * width + x] < 150) hProjection[y]++;
      }
    }
    
    const hThreshold = width * 0.10;
    let inLine = false, lineStart = 0;
    for (let y = 0; y < height; y++) {
      if (hProjection[y] > hThreshold) {
        if (!inLine) { lineStart = y; inLine = true; }
      } else {
        if (inLine) {
          lines.push({ x1: 0, y1: lineStart, x2: width - 1, y2: lineStart, angle: 0, length: width });
          inLine = false;
        }
      }
    }
    
    // Proyección vertical
    const vProjection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (grayData[y * width + x] < 150) vProjection[x]++;
      }
    }
    
    const vThreshold = height * 0.10;
    inLine = false; lineStart = 0;
    for (let x = 0; x < width; x++) {
      if (vProjection[x] > vThreshold) {
        if (!inLine) { lineStart = x; inLine = true; }
      } else {
        if (inLine) {
          lines.push({ x1: lineStart, y1: 0, x2: lineStart, y2: height - 1, angle: 90, length: height });
          inLine = false;
        }
      }
    }
    
    const time = Date.now() - start;
    logger.info(`Profile Projection completado en ${time}ms. Lineas: ${lines.length}`);
    
    return { 
      algorithm: this.name, color: this.color, lines: lines, 
      metrics: { totalLines: lines.length, executionTime: time } 
    };
  }
}
window.ProfileProjection = ProfileProjection;
