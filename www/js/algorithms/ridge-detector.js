class RidgeDetector {
  constructor() {
    this.name = 'Ridge Detector';
    this.color = '#00FF00';
    this.minRidgeStrength = 50;
    this.minLineLength = 50;
  }

  async detect(imageData) {
    logger.info('Iniciando Ridge Detector (Hessiana para líneas tenues)...');
    const t0 = Date.now();
    
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    
    // 1. Convertir a escala de grises
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    // 2. Calcular segundas derivadas (Hessiana)
    const dxx = new Float32Array(w * h); // ∂²I/∂x² (detecta verticales)
    const dyy = new Float32Array(w * h); // ∂²I/∂y² (detecta horizontales)
    
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        dxx[idx] = gray[idx - 1] - 2 * gray[idx] + gray[idx + 1];
        dyy[idx] = gray[idx - w] - 2 * gray[idx] + gray[idx + w];
      }
    }
    
    // 3. Detectar crestas verticales (dxx muy negativo = línea vertical)
    const verticalRidges = this.detectRidges(dxx, w, h, 'v');
    
    // 4. Detectar crestas horizontales (dyy muy negativo = línea horizontal)
    const horizontalRidges = this.detectRidges(dyy, w, h, 'h');
    
    const lines = horizontalRidges.concat(verticalRidges);
    const time = Date.now() - t0;
    logger.info('Ridge Detector completado en ' + time + 'ms. Lineas: ' + lines.length);
    return { algorithm: this.name, color: this.color, lines: lines, metrics: { totalLines: lines.length, executionTime: time, hLines: horizontalRidges.length, vLines: verticalRidges.length } };
  }

  detectRidges(deriv, w, h, axis) {
    const lines = [];
    const threshold = this.minRidgeStrength;
    
    if (axis === 'v') {
      // Detectar crestas verticales: buscar columnas donde dxx sea muy negativo
      for (let x = 1; x < w - 1; x++) {
        let ridgeStrength = 0;
        let ridgeCount = 0;
        
        for (let y = 1; y < h - 1; y++) {
          const idx = y * w + x;
          if (deriv[idx] < -threshold) {
            ridgeStrength += Math.abs(deriv[idx]);
            ridgeCount++;
          }
        }
        
        if (ridgeCount >= this.minLineLength) {
          lines.push({ x1: x, y1: 0, x2: x, y2: h - 1, angle: 90, length: h, strength: ridgeStrength / ridgeCount });
        }
      }
    } else {
      // Detectar crestas horizontales: buscar filas donde dyy sea muy negativo
      for (let y = 1; y < h - 1; y++) {
        let ridgeStrength = 0;
        let ridgeCount = 0;
        
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (deriv[idx] < -threshold) {
            ridgeStrength += Math.abs(deriv[idx]);
            ridgeCount++;
          }
        }
        
        if (ridgeCount >= this.minLineLength) {
          lines.push({ x1: 0, y1: y, x2: w - 1, y2: y, angle: 0, length: w, strength: ridgeStrength / ridgeCount });
        }
      }
    }
    
    return lines;
  }

  setMinRidgeStrength(s) { this.minRidgeStrength = s; }
  setMinLineLength(l) { this.minLineLength = l; }
}
window.RidgeDetector = RidgeDetector;
