class HoughTransform {
  constructor() { 
    this.name = 'Hough Transform'; 
    this.color = '#FF0000'; 
  }
  
  async detect(imageData) {
    logger.info('Iniciando Hough Transform (sobre escala de grises)');
    const start = Date.now();
    
    // 1. Preprocesamiento (Sauvola + deskew)
    const preprocessed = preprocessor.process(imageData);
    const preMetrics = preprocessor.getMetrics();
    
    // 2. Trabajar sobre escala de grises original (no binarizada)
    const gray = this.toGrayscale(imageData);
    
    // 3. Reescalar para velocidad (max 1000px)
    const { data: scaled, width: sw, height: sh, scale } = this.downscale(gray, 1000);
    logger.info(`  Imagen reescalada a ${sw}x${sh} (factor: ${scale.toFixed(3)})`);
    
    // 4. Deteccion de bordes Sobel sobre escala de grises
    const edges = this.sobelEdges(scaled, sw, sh);
    const edgeCount = edges.reduce((a, b) => a + (b > 50 ? 1 : 0), 0);
    logger.info(`  Pixeles de borde: ${edgeCount}`);
    
    // 5. Hough en angulos de tabla (0+-15 y 90+-15)
    const angles = [];
    for (let a = -15; a <= 15; a++) angles.push(a);
    for (let a = 75; a <= 105; a++) angles.push(a);
    
    // Precalcular sen/cos
    const trigTable = angles.map(a => {
      const rad = a * Math.PI / 180;
      return { angle: a, cos: Math.cos(rad), sin: Math.sin(rad) };
    });
    
    const maxRho = Math.ceil(Math.sqrt(sw * sw + sh * sh));
    const rhoRange = maxRho * 2 + 1;
    const acc = new Int32Array(angles.length * rhoRange);
    
    // 6. Votacion
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (edges[y * sw + x] > 50) {
          for (let i = 0; i < trigTable.length; i++) {
            const t = trigTable[i];
            const rho = Math.round(x * t.cos + y * t.sin);
            acc[i * rhoRange + rho + maxRho]++;
          }
        }
      }
    }
    
    // 7. Umbral adaptativo
    const threshold = Math.max(30, Math.floor(edgeCount * 0.003));
    logger.info(`  Umbral adaptativo: ${threshold}`);
    
    // 8. NMS + extraccion de picos
    const peaks = [];
    for (let i = 0; i < trigTable.length; i++) {
      for (let r = 1; r < rhoRange - 1; r++) {
        const v = acc[i * rhoRange + r];
        if (v > threshold) {
          // Verificar que es maximo local en ventana 3x3
          let isMax = true;
          for (let di = -1; di <= 1 && isMax; di++) {
            for (let dr = -1; dr <= 1 && isMax; dr++) {
              if (di === 0 && dr === 0) continue;
              const ni = i + di;
              const nr = r + dr;
              if (ni >= 0 && ni < trigTable.length && nr >= 0 && nr < rhoRange) {
                if (acc[ni * rhoRange + nr] > v) isMax = false;
              }
            }
          }
          if (isMax) {
            peaks.push({
              angle: trigTable[i].angle,
              rho: r - maxRho,
              votes: v,
              cos: trigTable[i].cos,
              sin: trigTable[i].sin
            });
          }
        }
      }
    }
    logger.info(`  Picos tras NMS: ${peaks.length}`);
    
    // 9. Fusion de colineales (angulo +-2, rho +-4)
    const merged = this.mergeColinear(peaks);
    logger.info(`  Lineas tras fusion: ${merged.length}`);
    
    // 10. Convertir a segmentos reales
    const segments = merged
      .map(p => this.lineToSegment(p, sw, sh))
      .filter(s => s !== null && s.length > 30)
      .slice(0, 300);
    
    // 11. Reescalar coordenadas al tamano original
    const lines = segments.map(s => ({
      x1: Math.round(s.x1 / scale),
      y1: Math.round(s.y1 / scale),
      x2: Math.round(s.x2 / scale),
      y2: Math.round(s.y2 / scale),
      angle: s.angle,
      length: Math.round(s.length / scale)
    }));
    
    const time = Date.now() - start;
    logger.info(`Hough Transform completado en ${time}ms. Lineas: ${lines.length}`);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines, 
      metrics: { 
        totalLines: lines.length, 
        executionTime: time,
        preprocessingTime: preMetrics.preprocessingTime,
        skewAngle: preMetrics.skewAngle,
        edgePixels: edgeCount,
        peaksAfterNMS: peaks.length,
        afterMerge: merged.length
      } 
    };
  }
  
  toGrayscale(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    }
    
    return { data: gray, width, height };
  }
  
  downscale(image, maxSize) {
    const { data, width, height } = image;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const nw = Math.round(width * scale);
    const nh = Math.round(height * scale);
    
    if (scale === 1) return { data, width, height, scale: 1 };
    
    const out = new Uint8Array(nw * nh);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const sx = Math.round(x / scale);
        const sy = Math.round(y / scale);
        out[y * nw + x] = data[sy * width + sx];
      }
    }
    return { data: out, width: nw, height: nh, scale };
  }
  
  sobelEdges(data, width, height) {
    const edges = new Uint8Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const gx = 
          -data[(y-1)*width+(x-1)] + data[(y-1)*width+(x+1)] +
          -2*data[y*width+(x-1)] + 2*data[y*width+(x+1)] +
          -data[(y+1)*width+(x-1)] + data[(y+1)*width+(x+1)];
        
        const gy = 
          -data[(y-1)*width+(x-1)] - 2*data[(y-1)*width+x] - data[(y-1)*width+(x+1)] +
          data[(y+1)*width+(x-1)] + 2*data[(y+1)*width+x] + data[(y+1)*width+(x+1)];
        
        edges[idx] = Math.min(255, Math.sqrt(gx*gx + gy*gy));
      }
    }
    return edges;
  }
  
  mergeColinear(peaks) {
    const merged = [];
    const used = new Set();
    
    for (let i = 0; i < peaks.length; i++) {
      if (used.has(i)) continue;
      const p = peaks[i];
      let bestRho = p.rho;
      let bestAngle = p.angle;
      let bestVotes = p.votes;
      
      for (let j = i + 1; j < peaks.length; j++) {
        if (used.has(j)) continue;
        const q = peaks[j];
        if (Math.abs(p.angle - q.angle) <= 2 && Math.abs(p.rho - q.rho) <= 4) {
          if (q.votes > bestVotes) {
            bestVotes = q.votes;
            bestRho = q.rho;
            bestAngle = q.angle;
          }
          used.add(j);
        }
      }
      
      const rad = bestAngle * Math.PI / 180;
      merged.push({
        angle: bestAngle,
        rho: bestRho,
        votes: bestVotes,
        cos: Math.cos(rad),
        sin: Math.sin(rad)
      });
      used.add(i);
    }
    return merged;
  }
  
  lineToSegment(params, width, height) {
    const { angle, rho, cos, sin } = params;
    
    let x1, y1, x2, y2;
    
    if (Math.abs(cos) > Math.abs(sin)) {
      y1 = 0;
      x1 = Math.round((rho - y1 * sin) / cos);
      y2 = height - 1;
      x2 = Math.round((rho - y2 * sin) / cos);
    } else {
      x1 = 0;
      y1 = Math.round((rho - x1 * cos) / sin);
      x2 = width - 1;
      y2 = Math.round((rho - x2 * cos) / sin);
    }
    
    x1 = Math.max(0, Math.min(width - 1, x1));
    y1 = Math.max(0, Math.min(height - 1, y1));
    x2 = Math.max(0, Math.min(width - 1, x2));
    y2 = Math.max(0, Math.min(height - 1, y2));
    
    const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    
    return { x1, y1, x2, y2, angle, length };
  }
}
window.HoughTransform = HoughTransform;
