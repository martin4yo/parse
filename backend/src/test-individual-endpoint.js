const fetch = require('node-fetch');

async function testIndividualEndpoint() {
  try {
    console.log('🧪 Testing /asociar-automatico-individual endpoint...');
    
    const response = await fetch('http://localhost:5100/api/documentos/asociar-automatico-individual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWY1eGxidGswMDAxNXg4ZDdpMWo3MThmIiwiaWF0IjoxNzMzNzU0NTg3LCJleHAiOjE3MzM4NDA5ODd9.Zh_kUlh92lCmhB9oX5dqOKU7Nb2xBAy52WJBHl7Fmlo'
      },
      body: JSON.stringify({
        documentoId: 'cmfcn1tey0001jh3wapcnutqh'
      })
    });
    
    const data = await response.json();
    console.log('📊 Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testIndividualEndpoint();