const express = require('express');
const relacionesRoutes = require('./relaciones');
const maestrosRoutes = require('./maestros');

const router = express.Router();

// Montar las sub-rutas
router.use('/relaciones', relacionesRoutes);
router.use('/maestros', maestrosRoutes);

module.exports = router;