class FourierAnalysis {
  constructor() {
    this.name = 'Fourier Analysis';
    this.color = '#FFA500';
    this.minDistance = 15; // Aumentado de 10 a 15 para filtrar renglones de texto
  }
  
  async detect(imageData) {
    logger.info('Iniciando Fourier Analysis (optimizado)');
    const start = Date.now();
    
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Float32Array(width * height);
    
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j++) {
      gray[j] = 0.299 * imageData.data[i] + 0.587 * imageData.data[i+1] + 0.114 * imageData.data[i+2];
    }
    
    const lines = [];
    
    // Proyección horizontal
    const hProjection = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        sum += gray[y * width + x];
      }
      hProjection[y] = sum / width;
    }
    
    const hPeaks = this.findPeriodicPeaks(hProjection, this.minDistance);
    for (const y of hPeaks) {
      lines.push({ x1: 0, y1: y, x2: width-1, y2: y, angle: 0, length: width });
    }
    
    // Proyección vertical
    const vProjection = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = 0; y < height; y++) {
        sum += gray[y * width + x];
      }
      vProjection[x] = sum / height;
    }
    
    const vPeaks = this.findPeriodicPeaks(vProjection, this.minDistance);
    for (const x of vPeaks) {
      lines.push({ x1: x, y1: 0, x2: x, y2: height-1, angle: 90, length: height });
    }
    
    const time = Date.now() - start;
    logger.info(`Fourier completado en ${time}ms. Líneas: ${lines.length} (minDistance: ${this.minDistance})`);
    
    return {
      algorithm: this.name,
      color: this.color,
      lines: lines,
      metrics: { totalLines: lines.length, executionTime: time, minDistance: this.minDistance }
    };
  }
  
  findPeriodicPeaks(signal, minDistance) {
    const peaks = [];
    const n = signal.length;
    
    // Calcular umbral dinámico basado en la media y desviación
    let sum = 0, sumSq = 0;
    for (let i = 0; i < n; i++) {
      sum += signal[i];
      sumSq += signal[i] * signal[i];
    }
    const mean = sum / n;
    const std = Math.sqrt((sumSq / n) - (mean * mean));
    const threshold = mean - std * 0.5; // Picos son valores significativamente bajos
    
    for (let i = 1; i < n - 1; i++) {
      if (signal[i] < threshold && signal[i] < signal[i-1] && signal[i] < signal[i+1]) {
        // Verificar que es un mínimo local significativo
        let isLocalMin = true;
        for (let j = Math.max(0, i - minDistance); j < Math.min(n, i + minDistance); j++) {
          if (j !== i && signal[j] < signal[i]) {
            isLocalMin = false;
            break;
          }
        }
        if (isLocalMin) peaks.push(i);
      }
    }
    
    return peaks;
  }
  
  setMinDistance(distance) {
    this.minDistance = distance;
    logger.info(`Fourier: minDistance ajustado a ${distance}`);
  }
}
window.FourierAnalysis = FourierAnalysis;
