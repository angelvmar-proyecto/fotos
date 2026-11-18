class ProfileProjection {
  constructor() { 
    this.name = 'Profile Projection'; 
    this.color = '#FFFF00'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Profile Projection');
    const start = Date.now();
    
    const gray = ImageProcessor.toGrayscale(imageData);
    const width = gray.width;
    const height = gray.height;
    const data = gray.data;
    
    const lines = [];
    
    // Proyección horizontal
    const hProjection = new Array(height).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) hProjection[y]++;
      }
    }
    
    // Detectar líneas horizontales (umbral reducido a 0.15)
    const hThreshold = width * 0.15;
    let inLine = false;
    let lineStart = 0;
    
    for (let y = 0; y < height; y++) {
      if (hProjection[y] > hThreshold) {
        if (!inLine) {
          lineStart = y;
          inLine = true;
        }
      } else {
        if (inLine) {
          const lineY = Math.floor((lineStart + y) / 2);
          lines.push({
            x1: 0, y1: lineY,
            x2: width - 1, y2: lineY,
            angle: 0,
            length: width
          });
          inLine = false;
        }
      }
    }
    
    // Proyección vertical
    const vProjection = new Array(width).fill(0);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        if (data[idx] < 128) vProjection[x]++;
      }
    }
    
    // Detectar líneas verticales (umbral reducido a 0.15)
    const vThreshold = height * 0.15;
    inLine = false;
    lineStart = 0;
    
    for (let x = 0; x < width; x++) {
      if (vProjection[x] > vThreshold) {
        if (!inLine) {
          lineStart = x;
          inLine = true;
        }
      } else {
        if (inLine) {
          const lineX = Math.floor((lineStart + x) / 2);
          lines.push({
            x1: lineX, y1: 0,
            x2: lineX, y2: height - 1,
            angle: 90,
            length: height
          });
          inLine = false;
        }
      }
    }
    
    const time = Date.now() - start;
    logger.info(`Profile Projection completado en ${time}ms. Lineas: ${lines.length}`);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines, 
      metrics: { totalLines: lines.length, executionTime: time } 
    };
  }
}
window.ProfileProjection = ProfileProjection;
