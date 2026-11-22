// Estándar unificado para detección de líneas
const LineDetectionStandards = {
  // === PARÁMETROS UNIVERSALES ===
  edgeDetection: {
    // Detección de bordes de la imagen
    borderWidth: 3,           // Píxeles de margen para considerar "borde"
    edgeThreshold: 0.85,      // 85% de la longitud esperada para considerar borde
    minEdgeStrength: 0.30     // Fuerza mínima para considerar un borde
  },

  ghostRemoval: {
    // Eliminación de líneas fantasma
    minDistance: 8,           // Distancia mínima entre líneas válidas
    maxDuplicates: 2,         // Máximo de duplicados permitidos antes de fusionar
    mergeThreshold: 4         // Fusionar líneas si están a menos de 4px
  },

  lineCompletion: {
    // Completitud de líneas
    minLengthRatio: 0.40,     // Línea debe cubrir al menos 40% del eje
    minCoverage: 0.50,        // 50% de píxeles deben estar presentes
    maxGap: 15                // Gap máximo permitido dentro de una línea
  },

  spacing: {
    // Espaciado entre líneas
    minSpacing: 10,           // Espacio mínimo entre líneas paralelas
    maxSpacing: 200,          // Espacio máximo (más allá es probablemente error)
    regularityThreshold: 0.30 // 30% de variación permitida en espaciado regular
  },

  alignment: {
    // Alineación y desfase
    maxDrift: 3,              // Desviación máxima permitida en píxeles
    straightnessThreshold: 0.95 // 95% de rectitud requerida
  },

  // === PARÁMETROS ESPECÍFICOS POR TIPO DE IMAGEN ===
  imageTypeAdjustments: {
    'TABLA_DENSA_FINA': {
      minLengthRatio: 0.30,   // Más tolerante con líneas cortas
      minCoverage: 0.40,      // Menos exigente en cobertura
      maxGap: 20,             // Permite más gaps
      minSpacing: 8           // Espaciado más ajustado
    },
    'TABLA_DENSA_GRUESA': {
      minLengthRatio: 0.50,
      minCoverage: 0.60,
      maxGap: 10,
      minSpacing: 15
    },
    'TABLA_COMPLEJA': {
      minLengthRatio: 0.45,
      minCoverage: 0.55,
      maxGap: 12,
      minSpacing: 12
    },
    'TABLA_PANTALLA_PC': {
      minLengthRatio: 0.60,   // Más exigente (líneas más definidas)
      minCoverage: 0.70,
      maxGap: 8,
      minSpacing: 20
    },
    'TABLA_SIMPLE': {
      minLengthRatio: 0.50,
      minCoverage: 0.60,
      maxGap: 10,
      minSpacing: 15
    }
  },

  // Método para obtener parámetros según tipo de imagen
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
