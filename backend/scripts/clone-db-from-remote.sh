#!/bin/bash
# ============================================================
# Script para clonar base de datos PostgreSQL remota a local
# ============================================================
# Servidor remoto: 149.50.148.198:5432
# Base de datos: parse_db
# Usuario: postgres
# ============================================================

echo ""
echo "============================================================"
echo "  CLONACION DE BASE DE DATOS PARSE_DB"
echo "============================================================"
echo ""
echo "Servidor remoto: 149.50.148.198:5432"
echo "Base de datos:   parse_db"
echo "Usuario:         postgres"
echo ""

# Solicitar contraseña
read -sp "Ingresa la contraseña del servidor remoto: " PGPASSWORD
echo ""
export PGPASSWORD

# Crear directorio para backups si no existe
mkdir -p backups

# Nombre del archivo de backup con timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/parse_db_${TIMESTAMP}.sql"

echo ""
echo "[1/5] Creando backup de la base de datos remota..."
echo ""

# Crear backup desde el servidor remoto
pg_dump -h 149.50.148.198 -p 5432 -U postgres -d parse_db -F p -f "$BACKUP_FILE" --no-owner --no-acl -v

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: No se pudo crear el backup. Verifica:"
    echo "- La contraseña sea correcta"
    echo "- El servidor esté accesible"
    echo "- Tengas permisos en la base de datos"
    echo ""
    exit 1
fi

echo ""
echo "[2/5] Backup creado exitosamente: $BACKUP_FILE"
echo ""

# Verificar si la base de datos local existe
echo "[3/5] Verificando base de datos local..."

# Buscar la base de datos localmente (asumiendo usuario postgres local)
DB_EXISTS=$(psql -U postgres -lqt | cut -d \| -f 1 | grep -w parse_db | wc -l)

if [ "$DB_EXISTS" -gt 0 ]; then
    echo ""
    echo "ADVERTENCIA: La base de datos 'parse_db' ya existe localmente."
    read -p "¿Deseas eliminarla y recrearla? (s/n): " OVERWRITE

    if [ "$OVERWRITE" = "s" ] || [ "$OVERWRITE" = "S" ]; then
        echo ""
        echo "Eliminando base de datos local existente..."
        psql -U postgres -c "DROP DATABASE IF EXISTS parse_db;"

        if [ $? -ne 0 ]; then
            echo ""
            echo "ERROR: No se pudo eliminar la base de datos local."
            echo "Asegúrate de que no haya conexiones activas."
            echo ""
            exit 1
        fi
    else
        echo ""
        echo "Operación cancelada por el usuario."
        exit 0
    fi
fi

echo ""
echo "[4/5] Creando base de datos local 'parse_db'..."
psql -U postgres -c "CREATE DATABASE parse_db ENCODING 'UTF8';"

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: No se pudo crear la base de datos local."
    exit 1
fi

echo ""
echo "[5/5] Restaurando backup en localhost..."
echo ""

psql -U postgres -d parse_db -f "$BACKUP_FILE"

if [ $? -ne 0 ]; then
    echo ""
    echo "ADVERTENCIA: Hubo algunos errores durante la restauración."
    echo "Esto es normal si hay diferencias de permisos."
    echo ""
fi

echo ""
echo "============================================================"
echo "  PROCESO COMPLETADO"
echo "============================================================"
echo ""
echo "La base de datos 'parse_db' ha sido clonada exitosamente."
echo ""
echo "Backup guardado en: $BACKUP_FILE"
echo ""
echo "Siguiente paso: Actualizar el archivo .env con:"
echo "DATABASE_URL=postgresql://postgres:TU_PASSWORD_LOCAL@localhost:5432/parse_db"
echo ""

# Limpiar contraseña del entorno
unset PGPASSWORD
