const promptManager = require('../services/promptManager');

console.log('🧹 Limpiando cache de prompts...');

// Limpiar el cache
promptManager.clearCache();

console.log('✅ Cache limpiado exitosamente');

// Mostrar estadísticas del cache
const stats = promptManager.getCacheStats();
console.log('📊 Estadísticas del cache:', stats);

process.exit(0);
