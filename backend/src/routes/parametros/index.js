const express = require('express');
const relacionesRoutes = require('./relaciones');
const maestrosRoutes = require('./maestros');
const tiposParametroRoutes = require('./tiposParametro');

const router = express.Router();

// Montar las sub-rutas
router.use('/relaciones', relacionesRoutes);
router.use('/maestros', maestrosRoutes);
router.use('/tipos', tiposParametroRoutes);

module.exports = router;
