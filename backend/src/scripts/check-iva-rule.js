const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const regla = await prisma.reglas_negocio.findFirst({
      where: { 
        OR: [
          { nombre: { contains: 'IVA' } },
          { codigo: { contains: 'IVA' } }
        ]
      }
    });
    
    if (regla) {
      console.log(JSON.stringify(regla, null, 2));
    } else {
      console.log('No se encontró la regla');
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
