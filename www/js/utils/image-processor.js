class ImageProcessor {
  static toGrayscale(imageData) {
    const data = imageData.data;
    const gray = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const val = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      gray[i] = gray[i+1] = gray[i+2] = val;
      gray[i+3] = 255;
    }
    return new ImageData(gray, imageData.width, imageData.height);
  }
}
