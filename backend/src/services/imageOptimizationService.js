const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Image Optimization Service
 *
 * Servicio especializado en optimización de imágenes para mejorar:
 * - Precisión de extracción de IAs (Claude Vision, Gemini, Document AI)
 * - Reducción de costos de API (archivos más pequeños)
 * - Velocidad de procesamiento
 * - Calidad de imágenes de baja calidad (fotos de celular)
 */
class ImageOptimizationService {
  constructor() {
    // Configuración por defecto
    this.config = {
      // Tamaño máximo para IAs (balance entre calidad y tamaño)
      maxWidth: 1920,
      maxHeight: 1920,

      // Tamaño para OCR (más grande para mejor precisión)
      ocrWidth: 2000,
      ocrHeight: 2000,

      // Calidad JPEG
      jpegQuality: 85,
      jpegQualityHigh: 90,

      // Configuración PNG
      pngCompression: 9,

      // DPI para PDFs
      pdfDpi: 150,
      pdfDpiHigh: 200
    };
  }

  /**
   * Analiza la calidad de una imagen
   * Detecta si necesita mejoras (oscura, borrosa, bajo contraste)
   *
   * @param {string} imagePath - Ruta a la imagen
   * @returns {Promise<Object>} - Análisis de calidad
   */
  async analyzeImageQuality(imagePath) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      const stats = await image.stats();

      // Calcular métricas de calidad
      const isLowResolution = metadata.width < 800 || metadata.height < 800;
      const isHighResolution = metadata.width > 3000 || metadata.height > 3000;

      // Analizar canales para detectar problemas
      const channels = stats.channels;
      let isDark = false;
      let isLowContrast = false;

      if (channels && channels.length > 0) {
        // Promedio de brillo (0-255)
        const avgBrightness = channels.reduce((sum, ch) => sum + ch.mean, 0) / channels.length;
        isDark = avgBrightness < 80;

        // Desviación estándar para detectar bajo contraste
        const avgStdDev = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
        isLowContrast = avgStdDev < 40;
      }

      const needsEnhancement = isDark || isLowContrast || isLowResolution;

      console.log(`📊 Análisis de calidad de imagen:`);
      console.log(`   Resolución: ${metadata.width}x${metadata.height}`);
      console.log(`   Formato: ${metadata.format}`);
      console.log(`   ${isDark ? '⚠️  Imagen oscura' : '✓ Brillo adecuado'}`);
      console.log(`   ${isLowContrast ? '⚠️  Bajo contraste' : '✓ Contraste adecuado'}`);
      console.log(`   ${isLowResolution ? '⚠️  Baja resolución' : '✓ Resolución adecuada'}`);
      console.log(`   Necesita mejora: ${needsEnhancement ? 'SÍ' : 'NO'}`);

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        isDark,
        isLowContrast,
        isLowResolution,
        isHighResolution,
        needsEnhancement,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      };
    } catch (error) {
      console.error('Error analizando calidad de imagen:', error.message);
      return {
        needsEnhancement: false,
        error: error.message
      };
    }
  }

  /**
   * Optimiza imagen para APIs de IA
   * Reduce tamaño manteniendo calidad suficiente para extracción
   *
   * @param {string} imagePath - Ruta a la imagen original
   * @param {string} outputPath - Ruta de salida (opcional)
   * @returns {Promise<Object>} - Buffer de imagen optimizada y metadata
   */
  async optimizeForAI(imagePath, outputPath = null) {
    try {
      console.log(`🔧 Optimizando imagen para IA: ${path.basename(imagePath)}`);
      const startTime = Date.now();

      // Analizar calidad primero
      const quality = await this.analyzeImageQuality(imagePath);

      let pipeline = sharp(imagePath);

      // Auto-rotación según EXIF
      pipeline = pipeline.rotate();

      // Normalizar contraste
      pipeline = pipeline.normalise();

      // Resize inteligente
      pipeline = pipeline.resize(this.config.maxWidth, this.config.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // Comprimir según formato óptimo
      if (quality.hasAlpha) {
        // PNG si tiene transparencia
        pipeline = pipeline.png({
          compression: this.config.pngCompression,
          adaptiveFiltering: true
        });
      } else {
        // JPEG para todo lo demás (mejor compresión)
        pipeline = pipeline.jpeg({
          quality: this.config.jpegQuality,
          progressive: true,
          mozjpeg: true // Mejor compresión
        });
      }

      // Generar output
      let result;
      if (outputPath) {
        await pipeline.toFile(outputPath);
        const stats = fs.statSync(outputPath);
        result = {
          path: outputPath,
          size: stats.size
        };
      } else {
        const buffer = await pipeline.toBuffer({ resolveWithObject: true });
        result = {
          buffer: buffer.data,
          info: buffer.info,
          size: buffer.data.length
        };
      }

      const duration = Date.now() - startTime;
      const originalSize = fs.statSync(imagePath).size;
      const reduction = ((1 - result.size / originalSize) * 100).toFixed(1);

      console.log(`✅ Imagen optimizada en ${duration}ms`);
      console.log(`   Tamaño original: ${(originalSize / 1024).toFixed(1)} KB`);
      console.log(`   Tamaño optimizado: ${(result.size / 1024).toFixed(1)} KB`);
      console.log(`   Reducción: ${reduction}%`);

      return {
        success: true,
        ...result,
        originalSize,
        optimizedSize: result.size,
        reduction: parseFloat(reduction),
        duration
      };

    } catch (error) {
      console.error('❌ Error optimizando imagen para IA:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mejora la calidad de imágenes de baja calidad
   * Especialmente útil para fotos de celular movidas, oscuras, con sombras
   *
   * @param {string} imagePath - Ruta a la imagen
   * @param {string} outputPath - Ruta de salida (opcional)
   * @returns {Promise<Object>} - Imagen mejorada
   */
  async enhanceImage(imagePath, outputPath = null) {
    try {
      console.log(`✨ Mejorando calidad de imagen: ${path.basename(imagePath)}`);
      const startTime = Date.now();

      const quality = await this.analyzeImageQuality(imagePath);

      let pipeline = sharp(imagePath);

      // Auto-rotación
      pipeline = pipeline.rotate();

      // Aplicar mejoras según el análisis
      if (quality.isDark) {
        console.log('   📝 Aplicando corrección de brillo');
        pipeline = pipeline.modulate({
          brightness: 1.15, // +15% brillo
          saturation: 1.0
        });
      }

      if (quality.isLowContrast) {
        console.log('   📝 Aplicando mejora de contraste');
        // Aumentar contraste usando curva lineal
        pipeline = pipeline.linear(1.3, -(128 * 0.3));
      }

      // Normalizar (ajuste automático de histograma)
      pipeline = pipeline.normalise();

      // Afilado para mejorar texto
      console.log('   📝 Aplicando afilado');
      pipeline = pipeline.sharpen({
        sigma: 1.5,
        m1: 1.0,
        m2: 0.5,
        x1: 2,
        y2: 10,
        y3: 20
      });

      // Reducir ruido si es alta resolución
      if (quality.isHighResolution) {
        console.log('   📝 Aplicando reducción de ruido');
        pipeline = pipeline.median(3);
      }

      // Resize a tamaño óptimo
      pipeline = pipeline.resize(this.config.ocrWidth, this.config.ocrHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // Output en PNG para máxima calidad
      pipeline = pipeline.png({
        compression: 6, // Balance entre tamaño y velocidad
        adaptiveFiltering: true
      });

      // Generar output
      let result;
      if (outputPath) {
        await pipeline.toFile(outputPath);
        result = { path: outputPath };
      } else {
        const buffer = await pipeline.toBuffer({ resolveWithObject: true });
        result = {
          buffer: buffer.data,
          info: buffer.info
        };
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Imagen mejorada en ${duration}ms`);

      return {
        success: true,
        ...result,
        duration,
        enhancements: {
          brightnessCorrected: quality.isDark,
          contrastEnhanced: quality.isLowContrast,
          sharpened: true,
          noiseReduced: quality.isHighResolution
        }
      };

    } catch (error) {
      console.error('❌ Error mejorando imagen:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Optimiza imagen específicamente para OCR (Tesseract)
   * Aplica técnicas especializadas para mejorar lectura de texto
   *
   * @param {string} imagePath - Ruta a la imagen
   * @param {string} outputPath - Ruta de salida
   * @returns {Promise<Object>} - Imagen optimizada para OCR
   */
  async optimizeForOCR(imagePath, outputPath) {
    try {
      console.log(`🔍 Optimizando imagen para OCR: ${path.basename(imagePath)}`);
      const startTime = Date.now();

      const quality = await this.analyzeImageQuality(imagePath);

      let pipeline = sharp(imagePath);

      // Auto-rotación
      pipeline = pipeline.rotate();

      // Resize a tamaño óptimo para OCR
      pipeline = pipeline.resize(this.config.ocrWidth, this.config.ocrHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });

      // Convertir a escala de grises (mejor para OCR)
      pipeline = pipeline.greyscale();

      // Normalizar contraste
      pipeline = pipeline.normalise();

      // Afilado agresivo para texto
      pipeline = pipeline.sharpen({
        sigma: 2.0
      });

      // Binarización adaptativa si la imagen es de baja calidad
      if (quality.needsEnhancement) {
        console.log('   📝 Aplicando binarización adaptativa');
        // Threshold adaptativo para mejorar contraste texto/fondo
        pipeline = pipeline
          .linear(1.5, -(128 * 0.5))
          .normalise();
      }

      // Output en PNG para OCR
      pipeline = pipeline.png({
        compression: 6
      });

      await pipeline.toFile(outputPath);

      const duration = Date.now() - startTime;
      console.log(`✅ Imagen optimizada para OCR en ${duration}ms`);

      return {
        success: true,
        path: outputPath,
        duration
      };

    } catch (error) {
      console.error('❌ Error optimizando para OCR:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convierte una página de PDF a imagen optimizada
   * Útil para procesar PDFs página por página
   *
   * @param {string} pdfPath - Ruta al PDF
   * @param {number} page - Número de página (0-indexed)
   * @param {string} outputPath - Ruta de salida
   * @param {boolean} highQuality - Usar alta calidad (DPI más alto)
   * @returns {Promise<Object>} - Imagen generada
   */
  async convertPDFPageToImage(pdfPath, page = 0, outputPath = null, highQuality = false) {
    try {
      console.log(`📄 Convirtiendo PDF a imagen: ${path.basename(pdfPath)} (página ${page + 1})`);

      // Usar pdf2pic para convertir
      const { fromPath } = require('pdf2pic');

      const dpi = highQuality ? this.config.pdfDpiHigh : this.config.pdfDpi;

      const converter = fromPath(pdfPath, {
        density: dpi,
        format: 'png',
        width: this.config.maxWidth,
        height: this.config.maxHeight
      });

      const result = await converter(page + 1, { responseType: 'buffer' });

      if (outputPath) {
        // Optimizar la imagen generada
        await sharp(result.buffer)
          .png({ compression: this.config.pngCompression })
          .toFile(outputPath);

        return {
          success: true,
          path: outputPath
        };
      }

      return {
        success: true,
        buffer: result.buffer
      };

    } catch (error) {
      console.error('❌ Error convirtiendo PDF a imagen:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Procesa automáticamente una imagen detectando el mejor método
   *
   * @param {string} imagePath - Ruta a la imagen
   * @param {string} purpose - Propósito: 'ai', 'ocr', 'enhance'
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async smartProcess(imagePath, purpose = 'ai') {
    try {
      console.log(`🧠 Procesamiento inteligente de imagen (${purpose})`);

      const quality = await this.analyzeImageQuality(imagePath);
      const tempDir = path.dirname(imagePath);
      const baseName = path.basename(imagePath, path.extname(imagePath));

      let outputPath;
      let result;

      if (purpose === 'ai') {
        // Para IAs: optimizar siempre, mejorar si es necesario
        outputPath = path.join(tempDir, `${baseName}_ai_optimized.jpg`);

        if (quality.needsEnhancement) {
          console.log('   ℹ️  Detectada baja calidad, mejorando primero...');
          const enhancedPath = path.join(tempDir, `${baseName}_enhanced.png`);
          await this.enhanceImage(imagePath, enhancedPath);
          result = await this.optimizeForAI(enhancedPath, outputPath);

          // Limpiar archivo temporal mejorado
          if (fs.existsSync(enhancedPath)) {
            fs.unlinkSync(enhancedPath);
          }
        } else {
          result = await this.optimizeForAI(imagePath, outputPath);
        }
      } else if (purpose === 'ocr') {
        // Para OCR: siempre optimizar para texto
        outputPath = path.join(tempDir, `${baseName}_ocr_optimized.png`);
        result = await this.optimizeForOCR(imagePath, outputPath);
      } else if (purpose === 'enhance') {
        // Solo mejorar
        outputPath = path.join(tempDir, `${baseName}_enhanced.png`);
        result = await this.enhanceImage(imagePath, outputPath);
      }

      return {
        success: true,
        ...result,
        quality
      };

    } catch (error) {
      console.error('❌ Error en procesamiento inteligente:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Limpia archivos temporales generados por el servicio
   *
   * @param {string} directory - Directorio a limpiar
   * @param {number} maxAgeMinutes - Edad máxima en minutos
   */
  cleanTempFiles(directory, maxAgeMinutes = 60) {
    try {
      const files = fs.readdirSync(directory);
      const now = Date.now();
      let cleaned = 0;

      files.forEach(file => {
        if (file.includes('_optimized') || file.includes('_enhanced') || file.includes('processed_')) {
          const filePath = path.join(directory, file);
          const stats = fs.statSync(filePath);
          const ageMinutes = (now - stats.mtimeMs) / (1000 * 60);

          if (ageMinutes > maxAgeMinutes) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        }
      });

      if (cleaned > 0) {
        console.log(`🧹 Limpiados ${cleaned} archivos temporales`);
      }

    } catch (error) {
      console.error('Error limpiando archivos temporales:', error.message);
    }
  }
}

module.exports = new ImageOptimizationService();
