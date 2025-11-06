// Configuración de PM2 para Parse
// Los puertos se configuran desde los archivos .env de cada servicio
module.exports = {
  apps: [
    {
      name: 'parse-backend',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // El puerto se lee del backend/.env (por defecto: 5100)
        // Si no existe, usa 5100 como fallback
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    },
    {
      name: 'parse-frontend',
      cwd: './frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 8087',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // El API URL se lee del frontend/.env
        // NEXT_PUBLIC_API_URL debe apuntar al backend (por defecto: http://localhost:5100)
      },
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '1G',
      watch: false
    }
  ]
};
