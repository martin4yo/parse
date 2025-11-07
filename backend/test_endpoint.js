// Script para probar el endpoint corregido
const fetch = require('node-fetch');

async function testEndpoint() {
  try {
    console.log('🧪 Probando endpoint corregido...');

    // Simular token de superuser para tenant IDEA
    const token = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjZGRlNjZmMy03NjI2LTQ3MjMtODcxMy1jYjJmODNlZTFhMWQiLCJ0ZW5hbnRJZCI6ImRlZmF1bHQtdGVuYW50LWlkIiwiaWF0IjoxNzI3MDQ3MzU5LCJleHAiOjE3MjcxMzM3NTl9.EyqQUWF4e5OvwGE6qR5TW8ZMYfgO_5Kt6Q_lW30S7ng';

    const response = await fetch('http://localhost:5100/api/rendiciones/items/4937028000411984/2507', {
      method: 'GET',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('❌ Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();

    console.log('✅ Resultado del endpoint:');
    console.log(`📊 Total items devueltos: ${data.length}`);

    if (data.length > 0) {
      console.log('📝 Primer item:');
      console.log('   - ID:', data[0].id);
      console.log('   - Tenant:', data[0].tenantId);
      console.log('   - Resumen ID:', data[0].resumenTarjetaId);
      console.log('   - Tarjeta:', data[0].resumenTarjeta?.numeroTarjeta);
      console.log('   - Período:', data[0].resumenTarjeta?.periodo);
    }

    // Verificar distribución por resumen
    const resumenIds = [...new Set(data.map(item => item.resumenTarjetaId))];
    console.log(`📊 Items distribuidos en ${resumenIds.length} registros de resumen_tarjeta`);

    if (data.length === 54) {
      console.log('🎉 ¡CORRECCIÓN EXITOSA! Ahora muestra todos los 54 registros.');
    } else if (data.length === 6) {
      console.log('⚠️  Todavía muestra solo 6 registros. La corrección no funcionó.');
    } else {
      console.log(`⚠️  Muestra ${data.length} registros. Revisar lógica.`);
    }

  } catch (error) {
    console.error('💥 Error probando endpoint:', error.message);
  }
}

testEndpoint();