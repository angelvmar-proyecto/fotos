// Estándar unificado para detección de líneas
const LineDetectionStandards = {
  // === PARÁMETROS UNIVERSALES BASE ===
  edgeDetection: {
    borderWidth: 3,
    edgeThreshold: 0.85,
    minEdgeStrength: 0.30
  },
  ghostRemoval: {
    minDistance: 8,
    maxDuplicates: 2,
    mergeThreshold: 4
  },
  lineCompletion: {
    minLengthRatio: 0.40,     // Base: 40% de longitud
    minCoverage: 0.50,
    maxGap: 15
  },
  spacing: {
    minSpacing: 10,
    maxSpacing: 500,          // Base: 500px (suficiente para la mayoría)
    regularityThreshold: 0.30
  },
  alignment: {
    maxDrift: 3,
    straightnessThreshold: 0.95
  },

  // === AJUSTES ESPECÍFICOS POR TIPO DE IMAGEN ===
  imageTypeAdjustments: {
    'TABLA_DENSA_FINA': {
      minLengthRatio: 0.30,   // Más tolerante con líneas cortas/rotas
      minCoverage: 0.40,
      maxGap: 20,
      minSpacing: 8,
      maxSpacing: 300         // En tablas densas, los espacios no son tan grandes
    },
    'TABLA_DENSA_GRUESA': {
      minLengthRatio: 0.50,
      minCoverage: 0.60,
      maxGap: 10,
      minSpacing: 15,
      maxSpacing: 400
    },
    'TABLA_COMPLEJA': {
      minLengthRatio: 0.40,
      minCoverage: 0.50,
      maxGap: 15,
      minSpacing: 12,
      maxSpacing: 600
    },
    'TABLA_PANTALLA_PC': {
      minLengthRatio: 0.35,   // Relajado: permite encabezados o celdas combinadas
      minCoverage: 0.45,
      maxGap: 25,             // Relajado: permite saltos por artefactos de pantalla
      minSpacing: 15,
      maxSpacing: 2000        // CRÍTICO: Las columnas de PC pueden estar muy separadas (ej. 1052px)
    },
    'TABLA_ANCHA_OSCURA': {
      minLengthRatio: 0.35,
      minCoverage: 0.45,
      maxGap: 20,
      minSpacing: 15,
      maxSpacing: 1500        // CRÍTICO: Tablas anchas tienen grandes espacios
    },
    'TABLA_SIMPLE': {
      minLengthRatio: 0.40,
      minCoverage: 0.50,
      maxGap: 15,
      minSpacing: 15,
      maxSpacing: 800
    }
  },

  // Método para obtener parámetros fusionados
  getParamsForType: function(imageType) {
    const base = {
      edgeDetection: {...this.edgeDetection},
      ghostRemoval: {...this.ghostRemoval},
      lineCompletion: {...this.lineCompletion},
      spacing: {...this.spacing},
      alignment: {...this.alignment}
    };

    const adjustments = this.imageTypeAdjustments[imageType];
    if (adjustments) {
      Object.assign(base.lineCompletion, adjustments);
      Object.assign(base.spacing, adjustments);
    }

    return base;
  }
};

window.LineDetectionStandards = LineDetectionStandards;
