const express = require('express');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

// Test route
app.get('/test', async (req, res) => {
  try {
    console.log('Testing database connection...');

    // Test basic connection
    const userCount = await prisma.users.count();
    console.log(`Users count: ${userCount}`);

    // Test users query similar to what's failing
    const users = await prisma.users.findMany({
      include: {
        profiles: {
          select: {
            id: true,
            codigo: true,
            descripcion: true
          }
        }
      },
      take: 1
    });

    res.json({
      success: true,
      userCount,
      sampleUser: users[0] || null
    });

  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

const PORT = 5051; // Different port to avoid conflicts
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});