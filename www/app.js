


async function processImage() {
    if (!currentImageFile) {
        setStatus('⚠️ Primero sube una imagen', 'error');
        return;
    }

    if (!tesseractReady) {
        setStatus('⏳ Cargando OCR...', 'warning');
        var ready = await initTesseract();
        if (!ready) return;
    }

    if (isProcessing) return;
    isProcessing = true;
    processBtn.disabled = true;

    var text = '';
    var tableDataResult = null;

    try {
        showProgress(true, 5);
        setStatus('🔍 Procesando imagen...', 'info');

        var img = new Image();
        img.src = await fileToBase64(currentImageFile);
        await img.decode();

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // 1. Intentar detectar líneas
        showProgress(true, 25);
        setStatus('📐 Detectando líneas...', 'info');

        var intersections = [];
        var cells = [];

        try {
            var linesResult = detectLines(imageData);
            intersections = linesResult.intersections || [];
        } catch (e) {
            console.warn('⚠️ Error en detectLines:', e);
            intersections = [];
        }

        if (intersections.length >= 4) {
            try {
                showProgress(true, 50);
                setStatus('📊 Identificando celdas por líneas...', 'info');
                cells = detectCells(intersections);
            } catch (e) {
                console.warn('⚠️ Error en detectCells:', e);
                cells = [];
            }

            if (cells && cells.length >= 2) {
                try {
                    showProgress(true, 65);
                    setStatus('🔍 Leyendo cada celda...', 'info');
                    tableDataResult = await extractCellsWithOCR(imageData, cells);
                } catch (e) {
                    console.warn('⚠️ Error en extractCellsWithOCR:', e);
                    tableDataResult = null;
                }
            }
        }

        // 2. Si no hay líneas, usar OCR general
        if (!tableDataResult || tableDataResult.length === 0) {
            showProgress(true, 50);
            setStatus('📄 Usando OCR general...', 'warning');

            try {
                console.log('📸 Enviando imagen a Tesseract...');
                var result = await worker.recognize(imageData);
                text = result.data.text || '';
                console.log('📄 Texto OCR (primeros 200 caracteres):', text.substring(0, 200));
                if (!text || text.length < 5) {
                    console.warn('⚠️ El OCR devolvió muy poco texto:', text);
                    setStatus('⚠️ El OCR devolvió muy poco texto. ¿La imagen tiene texto claro?', 'warning');
                }
            } catch (e) {
                console.error('❌ Error en OCR general:', e);
                text = '';
                setStatus('❌ Error en OCR: ' + (e.message || 'desconocido'), 'error');
            }

            if (text && text.length > 0) {
                showOcrResult(text);
                try {
                    var parsed = parseTable(text);
                    if (parsed && parsed.length > 1) {
                        tableDataResult = parsed;
                        setStatus('✅ Tabla detectada por espacios (' + tableDataResult.length + ' filas)', 'success');
                    }
                } catch (e) {
                    console.warn('⚠️ Error en parseTable:', e);
                    tableDataResult = null;
                }
            } else {
                setStatus('⚠️ No se pudo extraer ningún texto. ¿La imagen tiene texto claro?', 'warning');
            }
        }

        // 3. SIEMPRE mostrar algo (tabla o texto)
        showProgress(true, 90);
        setStatus('📋 Reconstruyendo...', 'info');

        if (tableDataResult && tableDataResult.length > 0) {
            var cleanData = tableDataResult.filter(function(row) {
                return row && row.some(function(cell) { return cell && cell.length > 0; });
            });
            if (cleanData.length > 0) {
                tableData = cleanData;
                renderTable(tableData);
                var cols = tableData[0] ? tableData[0].length : 0;
                setStatus('✅ Tabla extraída (' + tableData.length + ' filas, ' + cols + ' columnas)', 'success');
                downloadBtn.disabled = false;
                copyBtn.disabled = false;
                updateCellCount();
            } else {
                mostrarTextoComoTabla(text);
            }
        } else {
            // Si no hay tableDataResult, usar texto OCR
            if (text && text.length > 0) {
                mostrarTextoComoTabla(text);
            } else {
                setStatus('⚠️ No se pudo extraer ningún texto. ¿La imagen tiene texto claro?', 'warning');
            }
        }

        showProgress(true, 100);
    } catch (error) {
        console.error('❌ Error en processImage:', error);
        setStatus('❌ Error: ' + (error.message || 'undefined'), 'error');
    } finally {
        isProcessing = false;
        processBtn.disabled = false;
        setTimeout(function() { showProgress(false); }, 1500);
    }
}
