const promptManager = require('./services/promptManager');

console.log('🧹 Limpiando cache de prompts...');

promptManager.clearCache();

console.log('✅ Cache limpiado correctamente');
console.log('\n💡 Ahora el sistema usará el prompt clasificador actualizado');
console.log('   con mejores indicadores para diferenciar Facturas A y B');
