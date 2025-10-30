const express = require('express');
const atributosRoutes = require('./atributos/atributos');
const valoresRoutes = require('./atributos/valores');
const userAtributosRoutes = require('./atributos/user-atributos');

const router = express.Router();

// Montar las sub-rutas
router.use('/', atributosRoutes);
router.use('/valores-atributo', valoresRoutes);
router.use('/user-atributos', userAtributosRoutes);

module.exports = router;
