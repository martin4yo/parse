const express = require('express');
const relacionesRoutes = require('./parametros/relaciones');
const maestrosRoutes = require('./parametros/maestros');

const router = express.Router();

// Montar las sub-rutas
router.use('/relaciones', relacionesRoutes);
router.use('/maestros', maestrosRoutes);

module.exports = router;