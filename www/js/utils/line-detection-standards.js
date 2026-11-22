const LineDetectionStandards = {
  edgeDetection: { borderWidth: 3 },
  ghostRemoval: { mergeThreshold: 5 },
  lineCompletion: { minLengthRatio: 0.20 },
  alignment: { maxDrift: 3 },

  imageTypeAdjustments: {
    'TABLA_DENSA_FINA':    { minLengthRatio: 0.18, mergeThreshold: 4 },
    'TABLA_DENSA_GRUESA':  { minLengthRatio: 0.25, mergeThreshold: 6 },
    'TABLA_COMPLEJA':      { minLengthRatio: 0.20, mergeThreshold: 5 },
    'TABLA_PANTALLA_PC':   { minLengthRatio: 0.15, mergeThreshold: 6 },
    'TABLA_ANCHA_OSCURA':  { minLengthRatio: 0.15, mergeThreshold: 6 },
    'TABLA_OSCURA_FINA':   { minLengthRatio: 0.18, mergeThreshold: 4 },
    'TABLA_OSCURA_GRUESA': { minLengthRatio: 0.25, mergeThreshold: 6 },
    'TABLA_SIMPLE':        { minLengthRatio: 0.20, mergeThreshold: 5 },
    'FOTO_NATURAL':        { minLengthRatio: 0.30, mergeThreshold: 6 }
  },

  getParamsForType: function(imageType) {
    const base = {
      edgeDetection: Object.assign({}, this.edgeDetection),
      ghostRemoval:  Object.assign({}, this.ghostRemoval),
      lineCompletion: Object.assign({}, this.lineCompletion),
      alignment:     Object.assign({}, this.alignment)
    };
    const adj = this.imageTypeAdjustments[imageType];
    if (adj) {
      if (adj.minLengthRatio !== undefined) base.lineCompletion.minLengthRatio = adj.minLengthRatio;
      if (adj.mergeThreshold !== undefined) base.ghostRemoval.mergeThreshold = adj.mergeThreshold;
    }
    return base;
  }
};
window.LineDetectionStandards = LineDetectionStandards;
