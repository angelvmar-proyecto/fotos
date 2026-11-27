const LineDetectionStandards = {
  edgeDetection: { borderWidth: 3 },
  ghostRemoval: { mergeThreshold: 5 },
  lineCompletion: { minLengthRatio: 0.20 },
  alignment: { maxDrift: 3 },

  getParamsForType: function(imageType) {
    return {
      edgeDetection: Object.assign({}, this.edgeDetection),
      ghostRemoval: Object.assign({}, this.ghostRemoval),
      lineCompletion: Object.assign({}, this.lineCompletion),
      alignment: Object.assign({}, this.alignment)
    };
  }
};
window.LineDetectionStandards = LineDetectionStandards;
