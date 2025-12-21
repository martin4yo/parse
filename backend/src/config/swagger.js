const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Parse API Pública - OAuth 2.0',
      version: '1.0.0',
      description: `
# API Pública de Parse - Sistema de Procesamiento de Documentos

Esta API permite acceder programáticamente a los documentos procesados por Parse.

## Autenticación

Esta API utiliza **OAuth 2.0 Client Credentials** para autenticación.

### Flujo de autenticación:

1. Obtén un **access token** usando tus credenciales de cliente
2. Incluye el token en el header \`Authorization: Bearer <token>\` en cada request
3. Cuando el token expire (1 hora), usa el **refresh token** para obtener uno nuevo

### Ejemplo de obtención de token:

\`\`\`bash
curl -X POST https://api.parsedemo.axiomacloud.com/api/v1/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "client_abc123",
    "client_secret": "secret_xyz789",
    "scope": "read:documents write:documents"
  }'
\`\`\`

## Rate Limiting

Todos los clientes tienen límites de tasa configurables:

- **Default**: 60 req/min, 1000 req/hora, 10000 req/día
- **Custom**: Configurable por cliente

Los headers de respuesta incluyen:
- \`X-RateLimit-Limit\`: Límite total
- \`X-RateLimit-Remaining\`: Requests restantes
- \`X-RateLimit-Reset\`: Timestamp de reset

## Scopes Disponibles

- \`read:documents\`: Leer documentos procesados
- \`write:documents\`: Marcar documentos como exportados
- \`read:files\`: Descargar archivos originales

## Errores

La API usa códigos HTTP estándar:

- \`200\`: Success
- \`400\`: Bad Request (parámetros inválidos)
- \`401\`: Unauthorized (token inválido/expirado)
- \`403\`: Forbidden (scope insuficiente)
- \`404\`: Not Found
- \`429\`: Too Many Requests (rate limit)
- \`500\`: Internal Server Error

Formato de error:
\`\`\`json
{
  "success": false,
  "error": "Mensaje de error"
}
\`\`\`
      `,
      contact: {
        name: 'Soporte Parse',
        email: 'soporte@parsedemo.axiomacloud.com',
        url: 'https://parsedemo.axiomacloud.com'
      },
      license: {
        name: 'Privado',
        url: 'https://parsedemo.axiomacloud.com/terms'
      }
    },
    servers: [
      {
        url: 'https://api.parsedemo.axiomacloud.com',
        description: 'Servidor de Producción'
      },
      {
        url: 'http://localhost:5100',
        description: 'Servidor de Desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        OAuth2: {
          type: 'oauth2',
          description: 'OAuth 2.0 Client Credentials flow',
          flows: {
            clientCredentials: {
              tokenUrl: '/api/v1/auth/token',
              refreshUrl: '/api/v1/auth/refresh',
              scopes: {
                'read:documents': 'Leer documentos procesados',
                'write:documents': 'Marcar documentos como exportados',
                'read:files': 'Descargar archivos originales'
              }
            }
          }
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtenido del endpoint /api/v1/auth/token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        OAuthTokenRequest: {
          type: 'object',
          required: ['grant_type', 'client_id', 'client_secret'],
          properties: {
            grant_type: {
              type: 'string',
              enum: ['client_credentials'],
              example: 'client_credentials'
            },
            client_id: {
              type: 'string',
              example: 'client_abc123xyz'
            },
            client_secret: {
              type: 'string',
              example: 'secret_xyz789abc'
            },
            scope: {
              type: 'string',
              example: 'read:documents write:documents',
              description: 'Scopes separados por espacio'
            }
          }
        },
        OAuthTokenResponse: {
          type: 'object',
          properties: {
            access_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            refresh_token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            },
            token_type: {
              type: 'string',
              example: 'Bearer'
            },
            expires_in: {
              type: 'integer',
              example: 3600,
              description: 'Tiempo de expiración en segundos'
            },
            scope: {
              type: 'string',
              example: 'read:documents write:documents'
            }
          }
        },
        Document: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            tenantId: {
              type: 'string',
              format: 'uuid'
            },
            nombreArchivo: {
              type: 'string',
              example: 'factura_001.pdf'
            },
            tipoComprobanteExtraido: {
              type: 'string',
              example: 'FACTURA_A',
              enum: ['FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'NOTA_CREDITO', 'NOTA_DEBITO', 'RECIBO', 'REMITO', 'ORDEN_COMPRA', 'DESPACHO_ADUANA', 'OTRO']
            },
            numeroExtraido: {
              type: 'string',
              example: '0001-00012345'
            },
            fechaExtraida: {
              type: 'string',
              format: 'date',
              example: '2025-01-21'
            },
            cuitExtraido: {
              type: 'string',
              example: '30-12345678-9'
            },
            razonSocialExtraida: {
              type: 'string',
              example: 'Proveedor SA'
            },
            totalExtraido: {
              type: 'number',
              format: 'decimal',
              example: 12500.50
            },
            subtotalExtraido: {
              type: 'number',
              format: 'decimal',
              example: 10000.00
            },
            ivaExtraido: {
              type: 'number',
              format: 'decimal',
              example: 2100.00
            },
            estadoProcesamiento: {
              type: 'string',
              enum: ['pendiente', 'procesando', 'completado', 'error'],
              example: 'completado'
            },
            exportado: {
              type: 'boolean',
              example: false
            },
            externalSystemId: {
              type: 'string',
              nullable: true,
              example: 'ERP-12345'
            },
            lastExportedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2025-01-21T10:30:00.000Z'
            },
            fechaProcesamiento: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-21T09:15:00.000Z'
            },
            fechaCarga: {
              type: 'string',
              format: 'date-time',
              example: '2025-01-21T09:00:00.000Z'
            },
            urls: {
              type: 'object',
              properties: {
                self: {
                  type: 'string',
                  example: '/api/v1/documents/550e8400-e29b-41d4-a716-446655440000'
                },
                file: {
                  type: 'string',
                  example: '/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/file'
                },
                lineas: {
                  type: 'string',
                  example: '/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/lineas'
                },
                impuestos: {
                  type: 'string',
                  example: '/api/v1/documents/550e8400-e29b-41d4-a716-446655440000/impuestos'
                }
              }
            }
          }
        },
        DocumentLinea: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            documentoId: {
              type: 'string',
              format: 'uuid'
            },
            numeroLinea: {
              type: 'integer',
              example: 1
            },
            descripcion: {
              type: 'string',
              example: 'Producto ABC'
            },
            cantidad: {
              type: 'number',
              format: 'decimal',
              example: 5.00
            },
            precioUnitario: {
              type: 'number',
              format: 'decimal',
              example: 1000.00
            },
            total: {
              type: 'number',
              format: 'decimal',
              example: 5000.00
            },
            cuentaContable: {
              type: 'string',
              nullable: true,
              example: '5101020301'
            }
          }
        },
        DocumentImpuesto: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            documentoId: {
              type: 'string',
              format: 'uuid'
            },
            tipoImpuesto: {
              type: 'string',
              example: 'IVA'
            },
            alicuota: {
              type: 'number',
              format: 'decimal',
              example: 21.00
            },
            baseImponible: {
              type: 'number',
              format: 'decimal',
              example: 10000.00
            },
            monto: {
              type: 'number',
              format: 'decimal',
              example: 2100.00
            },
            cuentaContable: {
              type: 'string',
              nullable: true,
              example: '1105020101'
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              example: 156
            },
            limit: {
              type: 'integer',
              example: 100
            },
            offset: {
              type: 'integer',
              example: 0
            },
            hasMore: {
              type: 'boolean',
              example: true
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de autenticación faltante o inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'invalid_token',
                message: 'Invalid or expired access token'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Scope insuficiente',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'insufficient_scope',
                message: 'Required scope: read:documents'
              }
            }
          }
        },
        RateLimitError: {
          description: 'Límite de tasa excedido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Retry after 60 seconds.'
              }
            }
          }
        }
      }
    },
    security: [
      {
        BearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticación OAuth 2.0'
      },
      {
        name: 'Documents',
        description: 'Consulta y gestión de documentos procesados'
      }
    ]
  },
  apis: [
    './src/routes/authApi.js',
    './src/routes/publicApi.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
