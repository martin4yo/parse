const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;
    
    // Primero intentar obtener el token del header
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
    
    // Si no hay token en header, buscar en query params
    if (!token && req.query.token) {
      token = req.query.token;
      console.log('Token obtenido de query params para:', req.url);
    }
    
    if (!token) {
      console.log('No se encontró token en:', req.url);
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado, userId:', decoded.userId);
    
    // Verificar que el usuario existe y está activo
    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: { profiles: true }
    });

    if (!user || !user.activo) {
      console.log('Usuario no encontrado o inactivo:', decoded.userId);
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      console.log('Token inválido:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      console.log('Token expirado');
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = authMiddleware;