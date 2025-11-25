/**
 * apiResponse Middleware - Estandariza respuestas de API
 *
 * Agrega métodos helper a res para respuestas consistentes:
 * - res.success(data, message)
 * - res.error(message, statusCode)
 * - res.paginated(data, page, limit, total)
 *
 * Todas las respuestas siguen el formato:
 * {
 *   success: boolean,
 *   data?: any,
 *   message?: string,
 *   error?: string,
 *   pagination?: { page, limit, total, totalPages }
 * }
 */

/**
 * Formato de respuesta exitosa
 * @param {any} data - Datos a devolver
 * @param {string} message - Mensaje opcional de éxito
 */
function success(data, message = null) {
  const response = {
    success: true,
    data,
  };

  if (message) {
    response.message = message;
  }

  this.json(response);
}

/**
 * Formato de respuesta de error
 * @param {string} message - Mensaje de error
 * @param {number} statusCode - Código HTTP (default: 500)
 */
function error(message, statusCode = 500) {
  this.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Formato de respuesta paginada
 * @param {any[]} data - Array de datos
 * @param {number} page - Página actual
 * @param {number} limit - Límite por página
 * @param {number} total - Total de registros
 */
function paginated(data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  this.json({
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: parseInt(total),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}

/**
 * Formato de respuesta sin contenido
 * @param {string} message - Mensaje opcional
 */
function noContent(message = null) {
  if (message) {
    this.status(204).json({
      success: true,
      message,
    });
  } else {
    this.status(204).end();
  }
}

/**
 * Formato de respuesta creada
 * @param {any} data - Datos del recurso creado
 * @param {string} message - Mensaje opcional
 */
function created(data, message = 'Recurso creado exitosamente') {
  this.status(201).json({
    success: true,
    data,
    message,
  });
}

/**
 * Middleware que agrega los métodos helper a res
 */
function apiResponse(req, res, next) {
  // Agregar métodos a res
  res.success = success.bind(res);
  res.error = error.bind(res);
  res.paginated = paginated.bind(res);
  res.noContent = noContent.bind(res);
  res.created = created.bind(res);

  next();
}

module.exports = apiResponse;
