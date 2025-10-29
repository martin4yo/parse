const express = require('express');
const { param, validationResult } = require('express-validator');
const { authWithTenant } = require('../middleware/authWithTenant');
const JobProcessor = require('../services/jobProcessor');

const router = express.Router();
const jobProcessor = new JobProcessor();

// GET /jobs - Obtener jobs del usuario actual
router.get('/', authWithTenant, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = req.user.id;

    const jobs = await jobProcessor.getUserJobs(userId, parseInt(limit));
    
    // Filtrar jobs completados para verificar si sus lotes existen
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const validatedJobs = await Promise.all(jobs.map(async (job) => {
      // Solo validar jobs de tipo DKT_IMPORT completados
      if (job.type === 'DKT_IMPORT' && job.status === 'COMPLETED' && job.result?.loteId) {
        // Verificar si el lote existe en resumen_tarjeta
        const loteExists = await prisma.resumen_tarjeta.findFirst({
          where: req.filterByTenant({ loteId: job.result.loteId })
        });
        
        // Si el lote no existe, marcarlo
        if (!loteExists) {
          job.loteDeleted = true;
        }
      }
      return job;
    }));
    
    res.json({ jobs: validatedJobs });
  } catch (error) {
    console.error('Error obteniendo jobs:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /jobs/:id - Obtener estado específico de un job
router.get('/:id', 
  authWithTenant,
  [param('id').isLength({ min: 1 }).withMessage('ID inválido')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const job = await jobProcessor.getJobStatus(id);

      if (!job) {
        return res.status(404).json({ error: 'Job no encontrado' });
      }

      // Verificar que el job pertenece al usuario
      if (job.userId !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permisos para ver este job' });
      }

      res.json(job);
    } catch (error) {
      console.error('Error obteniendo job:', error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
);

// POST /jobs/:id/cancel - Cancelar un job
router.post('/:id/cancel',
  authWithTenant,
  [param('id').isLength({ min: 1 }).withMessage('ID inválido')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const job = await jobProcessor.getJobStatus(id);

      if (!job) {
        return res.status(404).json({ error: 'Job no encontrado' });
      }

      // Verificar que el job pertenece al usuario
      if (job.userId !== req.user.id) {
        return res.status(403).json({ error: 'No tienes permisos para cancelar este job' });
      }

      const result = await jobProcessor.cancelJob(id);
      res.json(result);
    } catch (error) {
      console.error('Error cancelando job:', error);
      res.status(500).json({ 
        error: error.message || 'Error del servidor' 
      });
    }
  }
);

// POST /jobs/dkt-import - Crear job de importación DKT
router.post('/dkt-import', authWithTenant, async (req, res) => {
  try {
    const { filePath, loteId } = req.body;
    const userId = req.user.id;

    if (!filePath || !loteId) {
      return res.status(400).json({ 
        error: 'filePath y loteId son requeridos' 
      });
    }

    // Crear el job
    const job = await jobProcessor.createJob('DKT_IMPORT', userId, {
      filePath,
      loteId
    });

    // Iniciar el procesamiento en background (sin await)
    setImmediate(() => {
      jobProcessor.processJob(job.id).catch(error => {
        console.error(`Error en procesamiento background del job ${job.id}:`, error);
      });
    });

    res.status(201).json({
      job,
      message: 'Job de importación DKT iniciado. Usa el endpoint /jobs/:id para verificar el progreso.'
    });
  } catch (error) {
    console.error('Error creando job DKT:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;