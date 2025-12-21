// Setup global para todos los tests
require('dotenv').config({ path: '.env.test' });

// Mock de Prisma Client para tests
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    oauth_clients: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    oauth_tokens: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    oauth_api_logs: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    documentos_procesados: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    documento_lineas: {
      findMany: jest.fn(),
    },
    documento_impuestos: {
      findMany: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

// Aumentar timeout global para tests
jest.setTimeout(10000);

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
