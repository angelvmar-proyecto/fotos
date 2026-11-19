class RadarMatcher {
  constructor() { 
    this.name = 'Radar Matcher'; 
    this.color = '#800080';
    this.kernelSize = 6;  // Reducido de 20 a 6 para líneas finas
    this.step = 2;        // Reducido de 3 a 2 para más precisión
    this.threshold = 3;   // Reducido de 4 a 3
    this.minLineLength = 15; // Reducido de 20 a 15
  }
  
  async detect(imageData) {
    logger.info('Iniciando Radar Matcher (kernel pequeño para líneas finas)');
    const start = Date.now();
    
    // Reescalado mínimo (max 1200px en vez de 800px)
    const { data: scaled, width: sw, height: sh, scale } = this.downscale(imageData, 1200);
    logger.info('  Imagen reescalada a ' + sw + 'x' + sh + ' (factor: ' + scale.toFixed(3) + ')');
    
    const preprocessed = preprocessor.process(scaled);
    const preMetrics = preprocessor.getMetrics();
    
    const width = preprocessed.width;
    const height = preprocessed.height;
    const data = preprocessed.data;
    
    const darkPixels = data.reduce((sum, val) => sum + val, 0);
    const density = darkPixels / (width * height);
    
    // Kernel adaptativo basado en densidad
    const kernelSize = density > 0.15 ? 8 : this.kernelSize;
    logger.info('  Densidad: ' + (density * 100).toFixed(1) + '%, Kernel: ' + kernelSize + 'px');
    
    const halfKernel = Math.floor(kernelSize / 2);
    const intersections = [];
    const maxIntersections = 8000; // Aumentado de 5000 a 8000
    
    for (let y = halfKernel; y < height - halfKernel && intersections.length < maxIntersections; y += this.step) {
      for (let x = halfKernel; x < width - halfKernel && intersections.length < maxIntersections; x += this.step) {
        const hasUp = this.checkDirection(data, width, x, y, 0, -1, halfKernel);
        const hasDown = this.checkDirection(data, width, x, y, 0, 1, halfKernel);
        const hasLeft = this.checkDirection(data, width, x, y, -1, 0, halfKernel);
        const hasRight = this.checkDirection(data, width, x, y, 1, 0, halfKernel);
        
        if (hasUp && hasDown && hasLeft && hasRight) {
          intersections.push({ x, y });
        }
      }
    }
    
    logger.info('  Intersecciones detectadas: ' + intersections.length);
    
    const groupedIntersections = this.groupIntersectionsSpatial(intersections, kernelSize);
    logger.info('  Intersecciones tras agrupar: ' + groupedIntersections.length);
    
    const lines = this.generateLines(groupedIntersections, width, height);
    const filteredLines = lines.filter(l => l.length > this.minLineLength);
    
    const finalLines = filteredLines.map(l => ({
      x1: Math.round(l.x1 / scale),
      y1: Math.round(l.y1 / scale),
      x2: Math.round(l.x2 / scale),
      y2: Math.round(l.y2 / scale),
      angle: l.angle,
      length: Math.round(l.length / scale)
    }));
    
    logger.info('  Lineas validas (>' + this.minLineLength + 'px): ' + finalLines.length);
    
    const time = Date.now() - start;
    logger.info('Radar Matcher completado en ' + time + 'ms. Lineas: ' + finalLines.length);
    
    return { 
      algorithm: this.name, 
      color: this.color, 
      lines: finalLines, 
      metrics: { 
        totalLines: finalLines.length, 
        executionTime: time,
        preprocessingTime: preMetrics.preprocessingTime,
        skewAngle: preMetrics.skewAngle,
        intersectionsDetected: intersections.length,
        intersectionsGrouped: groupedIntersections.length,
        kernelSize: kernelSize,
        density: density
      } 
    };
  }
  
  downscale(imageData, maxSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const nw = Math.round(width * scale);
    const nh = Math.round(height * scale);
    
    if (scale === 1) return { data: imageData, width, height, scale: 1 };
    
    const newData = new Uint8ClampedArray(nw * nh * 4);
    for (let y = 0; y < nh; y++) {
      for (let x = 0; x < nw; x++) {
        const sx = Math.round(x / scale);
        const sy = Math.round(y / scale);
        const srcIdx = (sy * width + sx) * 4;
        const dstIdx = (y * nw + x) * 4;
        newData[dstIdx] = data[srcIdx];
        newData[dstIdx + 1] = data[srcIdx + 1];
        newData[dstIdx + 2] = data[srcIdx + 2];
        newData[dstIdx + 3] = data[srcIdx + 3];
      }
    }
    
    return { data: { data: newData, width: nw, height: nh }, width: nw, height: nh, scale };
  }
  
  checkDirection(data, width, startX, startY, dx, dy, maxDistance) {
    let darkCount = 0;
    
    for (let i = 1; i <= maxDistance; i++) {
      const x = startX + dx * i;
      const y = startY + dy * i;
      
      if (x < 0 || x >= width || y < 0 || y >= data.length / width) break;
      
      const idx = y * width + x;
      if (data[idx] === 1) {
        darkCount++;
        if (darkCount >= this.threshold) return true;
      }
    }
    
    return false;
  }
  
  groupIntersectionsSpatial(intersections, minDistance) {
    if (intersections.length === 0) return [];
    
    const cellSize = minDistance;
    const grid = new Map();
    
    for (const p of intersections) {
      const cellX = Math.floor(p.x / cellSize);
      const cellY = Math.floor(p.y / cellSize);
      const key = cellX + ',' + cellY;
      
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(p);
    }
    
    const grouped = [];
    const used = new Set();
    
    for (const [key, points] of grid.entries()) {
      for (const p of points) {
        if (used.has(p)) continue;
        
        const cluster = [p];
        used.add(p);
        
        const [cx, cy] = key.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const neighborKey = (cx + dx) + ',' + (cy + dy);
            const neighborPoints = grid.get(neighborKey);
            if (!neighborPoints) continue;
            
            for (const q of neighborPoints) {
              if (used.has(q)) continue;
              const dist = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
              if (dist < minDistance) {
                cluster.push(q);
                used.add(q);
              }
            }
          }
        }
        
        const centerX = Math.round(cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length);
        const centerY = Math.round(cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length);
        
        grouped.push({ x: centerX, y: centerY });
      }
    }
    
    return grouped;
  }
  
  generateLines(intersections, width, height) {
    const lines = [];
    const rows = new Map();
    const cols = new Map();
    
    for (const p of intersections) {
      let foundRow = false;
      for (const [y, xs] of rows.entries()) {
        if (Math.abs(y - p.y) < 4) {
          xs.push(p.x);
          foundRow = true;
          break;
        }
      }
      if (!foundRow) rows.set(p.y, [p.x]);
      
      let foundCol = false;
      for (const [x, ys] of cols.entries()) {
        if (Math.abs(x - p.x) < 4) {
          ys.push(p.y);
          foundCol = true;
          break;
        }
      }
      if (!foundCol) cols.set(p.x, [p.y]);
    }
    
    for (const [y, xs] of rows.entries()) {
      if (xs.length >= 2) {
        xs.sort((a, b) => a - b);
        const x1 = xs[0];
        const x2 = xs[xs.length - 1];
        lines.push({ x1: x1, y1: y, x2: x2, y2: y, angle: 0, length: x2 - x1 });
      }
    }
    
    for (const [x, ys] of cols.entries()) {
      if (ys.length >= 2) {
        ys.sort((a, b) => a - b);
        const y1 = ys[0];
        const y2 = ys[ys.length - 1];
        lines.push({ x1: x, y1: y1, x2: x, y2: y2, angle: 90, length: y2 - y1 });
      }
    }
    
    return lines;
  }
}
window.RadarMatcher = RadarMatcher;
