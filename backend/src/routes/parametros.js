const express = require('express');
const relacionesRoutes = require('./parametros/relaciones');
const maestrosRoutes = require('./parametros/maestros');
const tiposParametroRoutes = require('./parametros/tiposParametro');

const router = express.Router();

// Montar las sub-rutas
router.use('/relaciones', relacionesRoutes);
router.use('/maestros', maestrosRoutes);
router.use('/tipos', tiposParametroRoutes);

module.exports = router;