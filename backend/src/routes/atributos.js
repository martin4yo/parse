const express = require('express');
const atributosRoutes = require('./atributos/atributos');
const valoresRoutes = require('./atributos/valores');
const userAtributosRoutes = require('./atributos/user-atributos');

const router = express.Router();

// Montar las sub-rutas - IMPORTANTE: las rutas específicas deben ir ANTES que las rutas con parámetros
router.use('/valores-atributo', valoresRoutes);
router.use('/user-atributos', userAtributosRoutes);
router.use('/', atributosRoutes);

module.exports = router;
