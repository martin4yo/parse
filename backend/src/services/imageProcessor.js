const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class ImageProcessor {
  constructor() {
    // Configuración por defecto
    this.config = {
      // Optimización general
      maxWidth: parseInt(process.env.IMAGE_MAX_WIDTH) || 2000,
      maxHeight: parseInt(process.env.IMAGE_MAX_HEIGHT) || 2000,
      quality: parseInt(process.env.IMAGE_QUALITY) || 85,

      // Pre-procesamiento para OCR
      enableOCRPreprocessing: process.env.ENABLE_OCR_PREPROCESSING !== 'false', // true por defecto
      sharpenAmount: parseFloat(process.env.IMAGE_SHARPEN_AMOUNT) || 1.5,
      contrastAmount: parseFloat(process.env.IMAGE_CONTRAST_AMOUNT) || 1.2,

      // Formato de salida
      outputFormat: process.env.IMAGE_OUTPUT_FORMAT || 'jpeg', // jpeg o png
    };

    console.log('📸 ImageProcessor configurado:', this.config);
  }

  /**
   * Procesa una imagen para optimizar su tamaño y mejorar OCR
   * @param {string} inputPath - Ruta al archivo de entrada
   * @param {Object} options - Opciones de procesamiento
   * @returns {Promise<Object>} - Resultado con información del procesamiento
   */
  async processImage(inputPath, options = {}) {
    try {
      const startTime = Date.now();
      console.log('🖼️  Procesando imagen:', inputPath);

      // Verificar que el archivo existe
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Archivo no encontrado: ${inputPath}`);
      }

      // Obtener metadata de la imagen original
      const metadata = await sharp(inputPath).metadata();
      const originalSize = fs.statSync(inputPath).size;

      console.log('📊 Imagen original:', {
        formato: metadata.format,
        dimensiones: `${metadata.width}x${metadata.height}`,
        tamano: `${(originalSize / 1024).toFixed(2)} KB`,
        espacioColor: metadata.space
      });

      // Construir pipeline de sharp
      let pipeline = sharp(inputPath);

      // 1. Rotación automática según EXIF (importante para fotos de celular)
      pipeline = pipeline.rotate();

      // 2. Redimensionar si es necesario (mantener aspect ratio)
      if (metadata.width > this.config.maxWidth || metadata.height > this.config.maxHeight) {
        console.log('🔄 Redimensionando imagen...');
        pipeline = pipeline.resize(this.config.maxWidth, this.config.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // 3. Pre-procesamiento para mejorar OCR
      if (this.config.enableOCRPreprocessing) {
        console.log('🔍 Aplicando mejoras para OCR...');

        // Aumentar contraste (ayuda a diferenciar texto del fondo)
        pipeline = pipeline.linear(this.config.contrastAmount, -(128 * this.config.contrastAmount) + 128);

        // Aplicar sharpening (mejora bordes del texto)
        pipeline = pipeline.sharpen({
          sigma: this.config.sharpenAmount,
          m1: 0.5,
          m2: 0.5
        });

        // Normalizar (distribuir mejor los niveles de gris)
        pipeline = pipeline.normalize();
      }

      // 4. Configurar formato de salida y compresión
      const outputFormat = options.format || this.config.outputFormat;

      if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
        pipeline = pipeline.jpeg({
          quality: this.config.quality,
          progressive: true,
          mozjpeg: true // Usa mozjpeg para mejor compresión
        });
      } else if (outputFormat === 'png') {
        pipeline = pipeline.png({
          quality: this.config.quality,
          compressionLevel: 9,
          adaptiveFiltering: true
        });
      }

      // 5. Crear archivo temporal para comparación
      const tempPath = inputPath + '.processing';
      await pipeline.toFile(tempPath);

      // Obtener información del archivo procesado
      const processedSize = fs.statSync(tempPath).size;
      const processedMetadata = await sharp(tempPath).metadata();

      // 6. Decidir si usar imagen procesada o mantener original
      const sizeReduction = ((originalSize - processedSize) / originalSize * 100).toFixed(2);

      // Si el procesamiento aumentó el tamaño más de 10%, mantener original
      if (processedSize > originalSize * 1.1) {
        console.log('⚠️  Imagen procesada es más grande, manteniendo original');
        fs.unlinkSync(tempPath);
        return {
          success: true,
          processed: false,
          reason: 'Original size better',
          originalSize,
          processedSize: originalSize,
          dimensions: {
            width: metadata.width,
            height: metadata.height
          },
          processingTime: Date.now() - startTime
        };
      }

      // Reemplazar archivo original con el procesado
      fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, inputPath);

      console.log('✅ Imagen procesada exitosamente:', {
        reduccion: `${sizeReduction}%`,
        dimensiones: `${processedMetadata.width}x${processedMetadata.height}`,
        tamanoFinal: `${(processedSize / 1024).toFixed(2)} KB`,
        tiempo: `${Date.now() - startTime}ms`
      });

      return {
        success: true,
        processed: true,
        originalSize,
        processedSize,
        sizeReduction: parseFloat(sizeReduction),
        dimensions: {
          width: processedMetadata.width,
          height: processedMetadata.height
        },
        format: processedMetadata.format,
        processingTime: Date.now() - startTime,
        ocrEnhanced: this.config.enableOCRPreprocessing
      };

    } catch (error) {
      console.error('❌ Error procesando imagen:', error);
      throw new Error(`Error en ImageProcessor: ${error.message}`);
    }
  }

  /**
   * Procesa múltiples imágenes en batch
   * @param {Array<string>} imagePaths - Array de rutas de archivos
   * @param {Object} options - Opciones de procesamiento
   * @returns {Promise<Array>} - Array de resultados
   */
  async processBatch(imagePaths, options = {}) {
    console.log(`📦 Procesando batch de ${imagePaths.length} imágenes...`);

    const results = [];
    for (const imagePath of imagePaths) {
      try {
        const result = await this.processImage(imagePath, options);
        results.push({ path: imagePath, ...result });
      } catch (error) {
        results.push({
          path: imagePath,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Genera thumbnail de una imagen
   * @param {string} inputPath - Ruta al archivo de entrada
   * @param {string} outputPath - Ruta al archivo de salida
   * @param {Object} options - Opciones de thumbnail
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async generateThumbnail(inputPath, outputPath, options = {}) {
    try {
      const width = options.width || 300;
      const height = options.height || 300;
      const fit = options.fit || 'cover';

      await sharp(inputPath)
        .rotate()
        .resize(width, height, { fit, position: 'center' })
        .jpeg({ quality: 80 })
        .toFile(outputPath);

      return {
        success: true,
        thumbnailPath: outputPath,
        size: fs.statSync(outputPath).size
      };

    } catch (error) {
      console.error('❌ Error generando thumbnail:', error);
      throw new Error(`Error generando thumbnail: ${error.message}`);
    }
  }

  /**
   * Convierte imagen a escala de grises (útil para documentos de texto)
   * @param {string} inputPath - Ruta al archivo de entrada
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async convertToGrayscale(inputPath) {
    try {
      console.log('⚫⚪ Convirtiendo a escala de grises:', inputPath);

      const tempPath = inputPath + '.gray';

      await sharp(inputPath)
        .rotate()
        .grayscale()
        .normalize()
        .sharpen()
        .jpeg({ quality: this.config.quality })
        .toFile(tempPath);

      // Reemplazar original
      fs.unlinkSync(inputPath);
      fs.renameSync(tempPath, inputPath);

      return {
        success: true,
        grayscale: true
      };

    } catch (error) {
      console.error('❌ Error convirtiendo a escala de grises:', error);
      throw new Error(`Error en conversión grayscale: ${error.message}`);
    }
  }

  /**
   * Obtiene información de una imagen sin procesarla
   * @param {string} imagePath - Ruta al archivo
   * @returns {Promise<Object>} - Metadata de la imagen
   */
  async getImageInfo(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      const stats = fs.statSync(imagePath);

      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        space: metadata.space,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation,
        size: stats.size,
        sizeKB: (stats.size / 1024).toFixed(2),
        sizeMB: (stats.size / 1024 / 1024).toFixed(2)
      };

    } catch (error) {
      console.error('❌ Error obteniendo info de imagen:', error);
      throw new Error(`Error obteniendo información: ${error.message}`);
    }
  }
}

module.exports = ImageProcessor;
