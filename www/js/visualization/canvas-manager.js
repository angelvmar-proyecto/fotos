class CanvasManager {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.layers = new Map();
    this.scale = 1; this.offsetX = 0; this.offsetY = 0; this.isDragging = false;
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.scale *= e.deltaY > 0 ? 0.9 : 1.1; this.render(); });
    this.canvas.addEventListener('mousedown', e => { this.isDragging = true; this.lastX = e.clientX; this.lastY = e.clientY; });
    this.canvas.addEventListener('mousemove', e => { if(!this.isDragging) return; this.offsetX += e.clientX - this.lastX; this.offsetY += e.clientY - this.lastY; this.lastX = e.clientX; this.lastY = e.clientY; this.render(); });
    this.canvas.addEventListener('mouseup', () => this.isDragging = false);
  }
  loadImage(imageData) {
    this.imageData = imageData;
    this.canvas.width = imageData.width;
    this.canvas.height = imageData.height;
    this.render();
  }
  addLayer(name, drawFn) { this.layers.set(name, { drawFn, visible: true }); this.render(); }
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    if (this.imageData) {
      const temp = document.createElement('canvas');
      temp.width = this.imageData.width; temp.height = this.imageData.height;
      temp.getContext('2d').putImageData(this.imageData, 0, 0);
      this.ctx.drawImage(temp, 0, 0);
    }
    this.layers.forEach(layer => { if(layer.visible) layer.drawFn(this.ctx); });
    this.ctx.restore();
  }
}
