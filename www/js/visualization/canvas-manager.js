class CanvasManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.layers = new Map();
    
    // Estado de transformacion
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.minScale = 0.5;
    this.maxScale = 10;
    
    // Estado de imagen
    this.imageData = null;
    this.imgWidth = 0;
    this.imgHeight = 0;
    
    // Estado de gestos
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.lastPinchDist = 0;
    this.lastPinchCenter = null;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Rueda del mouse (PC)
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAt(mouseX, mouseY, delta);
    }, { passive: false });
    
    // Mouse (PC)
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    });
    
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.render();
    });
    
    this.canvas.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });
    
    this.canvas.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    });
    
    // Tactil (movil)
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        this.lastPinchDist = this.getPinchDistance(e.touches);
        this.lastPinchCenter = this.getPinchCenter(e.touches);
      }
    }, { passive: false });
    
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastX;
        const dy = e.touches[0].clientY - this.lastY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
        this.render();
      } else if (e.touches.length === 2) {
        const newDist = this.getPinchDistance(e.touches);
        const newCenter = this.getPinchCenter(e.touches);
        
        if (this.lastPinchDist > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const centerX = newCenter.x - rect.left;
          const centerY = newCenter.y - rect.top;
          
          const zoomFactor = newDist / this.lastPinchDist;
          this.zoomAt(centerX, centerY, zoomFactor);
          
          // Pan durante pinch
          if (this.lastPinchCenter) {
            this.offsetX += newCenter.x - this.lastPinchCenter.x;
            this.offsetY += newCenter.y - this.lastPinchCenter.y;
          }
          
          this.render();
        }
        
        this.lastPinchDist = newDist;
        this.lastPinchCenter = newCenter;
      }
    }, { passive: false });
    
    this.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        this.lastPinchDist = 0;
        this.lastPinchCenter = null;
      }
      if (e.touches.length === 0) {
        this.isDragging = false;
      } else if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      }
    });
    
    this.canvas.style.cursor = 'grab';
  }
  
  getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  getPinchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }
  
  zoomAt(centerX, centerY, factor) {
    const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    const actualFactor = newScale / this.scale;
    
    // Ajustar offset para que el zoom se centre en el punto
    this.offsetX = centerX - (centerX - this.offsetX) * actualFactor;
    this.offsetY = centerY - (centerY - this.offsetY) * actualFactor;
    
    this.scale = newScale;
    this.render();
  }
  
  loadImage(imageData) {
    this.imageData = imageData;
    this.imgWidth = imageData.width;
    this.imgHeight = imageData.height;
    
    // Ajustar canvas al contenedor manteniendo proporcion
    const container = this.canvas.parentElement;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    const imgAspect = this.imgWidth / this.imgHeight;
    const containerAspect = containerWidth / containerHeight;
    
    if (imgAspect > containerAspect) {
      this.canvas.width = containerWidth;
      this.canvas.height = containerWidth / imgAspect;
    } else {
      this.canvas.height = containerHeight;
      this.canvas.width = containerHeight * imgAspect;
    }
    
    // Calcular escala inicial para que la imagen quepa
    const fitScale = Math.min(
      this.canvas.width / this.imgWidth,
      this.canvas.height / this.imgHeight
    );
    
    this.scale = fitScale;
    this.offsetX = (this.canvas.width - this.imgWidth * fitScale) / 2;
    this.offsetY = (this.canvas.height - this.imgHeight * fitScale) / 2;
    
    this.render();
    logger.info(`Canvas ajustado: ${this.canvas.width}x${this.canvas.height}, escala inicial: ${fitScale.toFixed(3)}`);
  }
  
  addLayer(name, drawFn) { 
    this.layers.set(name, { drawFn, visible: true }); 
    this.render(); 
  }
  
  toggleLayer(name) { 
    const l = this.layers.get(name); 
    if (l) { 
      l.visible = !l.visible; 
      this.render(); 
    } 
  }
  
  removeLayer(name) {
    this.layers.delete(name);
    this.render();
  }
  
  clearLayers() {
    this.layers.clear();
    this.render();
  }
  
  reset() {
    if (!this.imageData) return;
    
    const fitScale = Math.min(
      this.canvas.width / this.imgWidth,
      this.canvas.height / this.imgHeight
    );
    
    this.scale = fitScale;
    this.offsetX = (this.canvas.width - this.imgWidth * fitScale) / 2;
    this.offsetY = (this.canvas.height - this.imgHeight * fitScale) / 2;
    this.render();
    logger.info('Vista reseteada');
  }
  
  zoomIn() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.zoomAt(centerX, centerY, 1.3);
  }
  
  zoomOut() {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.zoomAt(centerX, centerY, 0.77);
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Fondo
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    
    // Dibujar imagen
    if (this.imageData) {
      const temp = document.createElement('canvas');
      temp.width = this.imgWidth;
      temp.height = this.imgHeight;
      temp.getContext('2d').putImageData(this.imageData, 0, 0);
      this.ctx.drawImage(temp, 0, 0);
    }
    
    // Dibujar capas (lineas de algoritmos)
    this.layers.forEach((layer, name) => {
      if (layer.visible) {
        layer.drawFn(this.ctx);
      }
    });
    
    this.ctx.restore();
    
    // Dibujar info de zoom
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.ctx.fillRect(5, 5, 150, 25);
    this.ctx.fillStyle = '#4CAF50';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`Zoom: ${(this.scale * 100).toFixed(0)}%`, 10, 22);
  }
}
