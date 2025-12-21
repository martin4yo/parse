#!/bin/bash

###############################################################################
# Parse API Pública - Ejemplos con cURL
#
# Este script demuestra cómo usar la API pública de Parse con cURL
#
# Uso:
#   export CLIENT_ID=your_client_id
#   export CLIENT_SECRET=your_secret
#   bash curl-examples.sh
###############################################################################

# Configuración
API_BASE_URL="${API_BASE_URL:-https://api.parsedemo.axiomacloud.com}"
CLIENT_ID="${CLIENT_ID:-your_client_id_here}"
CLIENT_SECRET="${CLIENT_SECRET:-your_client_secret_here}"

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables globales
ACCESS_TOKEN=""
REFRESH_TOKEN=""

###############################################################################
# Funciones auxiliares
###############################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}📝 $1${NC}"
}

###############################################################################
# Paso 1: Obtener Access Token
###############################################################################

obtener_token() {
    print_header "Paso 1: Obtener Access Token"

    print_info "Solicitando token con Client Credentials..."

    RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/v1/auth/token" \
        -H "Content-Type: application/json" \
        -d "{
            \"grant_type\": \"client_credentials\",
            \"client_id\": \"${CLIENT_ID}\",
            \"client_secret\": \"${CLIENT_SECRET}\",
            \"scope\": \"read:documents write:documents read:files\"
        }")

    # Extraer tokens
    ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$RESPONSE" | grep -o '"refresh_token":"[^"]*' | cut -d'"' -f4)
    EXPIRES_IN=$(echo "$RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No se pudo obtener el token"
        echo "$RESPONSE"
        exit 1
    fi

    print_success "Token obtenido exitosamente"
    echo "   Expira en: ${EXPIRES_IN} segundos"
    echo "   Token (primeros 50 caracteres): ${ACCESS_TOKEN:0:50}..."

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X POST '${API_BASE_URL}/api/v1/auth/token' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{"
    echo "    \"grant_type\": \"client_credentials\","
    echo "    \"client_id\": \"${CLIENT_ID}\","
    echo "    \"client_secret\": \"${CLIENT_SECRET}\","
    echo "    \"scope\": \"read:documents write:documents read:files\""
    echo "  }'"
}

###############################################################################
# Paso 2: Obtener información del cliente
###############################################################################

obtener_info_cliente() {
    print_header "Paso 2: Obtener información del cliente"

    print_info "Consultando /api/v1/auth/me..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/auth/me" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    print_success "Información obtenida"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/auth/me' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Paso 3: Listar documentos
###############################################################################

listar_documentos() {
    print_header "Paso 3: Listar documentos"

    print_info "Listando últimos 5 documentos completados..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/documents?status=completado&limit=5&sort=fechaProcesamiento&order=desc" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    print_success "Documentos obtenidos"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    # Guardar primer documento ID para ejemplos siguientes
    FIRST_DOC_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?status=completado&limit=5' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Paso 4: Obtener detalle de un documento
###############################################################################

obtener_documento() {
    if [ -z "$FIRST_DOC_ID" ]; then
        print_error "No hay documento ID disponible. Ejecuta listar_documentos primero."
        return
    fi

    print_header "Paso 4: Obtener detalle de documento"

    print_info "Consultando documento ${FIRST_DOC_ID}..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    print_success "Detalle obtenido"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Paso 5: Obtener líneas de un documento
###############################################################################

obtener_lineas() {
    if [ -z "$FIRST_DOC_ID" ]; then
        print_error "No hay documento ID disponible"
        return
    fi

    print_header "Paso 5: Obtener líneas del documento"

    print_info "Consultando líneas del documento ${FIRST_DOC_ID}..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/lineas" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    print_success "Líneas obtenidas"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/lineas' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Paso 6: Obtener impuestos de un documento
###############################################################################

obtener_impuestos() {
    if [ -z "$FIRST_DOC_ID" ]; then
        print_error "No hay documento ID disponible"
        return
    fi

    print_header "Paso 6: Obtener impuestos del documento"

    print_info "Consultando impuestos del documento ${FIRST_DOC_ID}..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/impuestos" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}")

    print_success "Impuestos obtenidos"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/impuestos' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Paso 7: Marcar documento como exportado
###############################################################################

marcar_exportado() {
    if [ -z "$FIRST_DOC_ID" ]; then
        print_error "No hay documento ID disponible"
        return
    fi

    print_header "Paso 7: Marcar documento como exportado"

    print_info "Marcando documento ${FIRST_DOC_ID} como exportado..."

    RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/mark-exported" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{
            \"externalSystemId\": \"ERP-12345\",
            \"exportConfigId\": \"mi-sistema-erp\"
        }")

    print_success "Documento marcado como exportado"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X POST '${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/mark-exported' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{"
    echo "    \"externalSystemId\": \"ERP-12345\","
    echo "    \"exportConfigId\": \"mi-sistema-erp\""
    echo "  }'"
}

###############################################################################
# Paso 8: Descargar archivo original
###############################################################################

descargar_archivo() {
    if [ -z "$FIRST_DOC_ID" ]; then
        print_error "No hay documento ID disponible"
        return
    fi

    print_header "Paso 8: Descargar archivo original"

    print_info "Descargando archivo del documento ${FIRST_DOC_ID}..."

    OUTPUT_FILE="./documento_${FIRST_DOC_ID}.pdf"

    curl -s -X GET "${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/file" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -o "$OUTPUT_FILE"

    if [ -f "$OUTPUT_FILE" ]; then
        FILE_SIZE=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
        print_success "Archivo descargado: ${OUTPUT_FILE}"
        echo "   Tamaño: $((FILE_SIZE / 1024)) KB"
    else
        print_error "No se pudo descargar el archivo"
    fi

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents/${FIRST_DOC_ID}/file' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}' \\"
    echo "  -o './documento.pdf'"
}

###############################################################################
# Paso 9: Refrescar token
###############################################################################

refrescar_token() {
    print_header "Paso 9: Refrescar Access Token"

    if [ -z "$REFRESH_TOKEN" ]; then
        print_error "No hay refresh token disponible"
        return
    fi

    print_info "Refrescando token con refresh_token..."

    RESPONSE=$(curl -s -X POST "${API_BASE_URL}/api/v1/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{
            \"grant_type\": \"refresh_token\",
            \"refresh_token\": \"${REFRESH_TOKEN}\"
        }")

    # Extraer nuevo access token
    NEW_ACCESS_TOKEN=$(echo "$RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    EXPIRES_IN=$(echo "$RESPONSE" | grep -o '"expires_in":[0-9]*' | cut -d':' -f2)

    if [ -z "$NEW_ACCESS_TOKEN" ]; then
        print_error "No se pudo refrescar el token"
        echo "$RESPONSE"
        return
    fi

    ACCESS_TOKEN="$NEW_ACCESS_TOKEN"

    print_success "Token refrescado exitosamente"
    echo "   Expira en: ${EXPIRES_IN} segundos"
    echo "   Nuevo token (primeros 50 caracteres): ${ACCESS_TOKEN:0:50}..."

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X POST '${API_BASE_URL}/api/v1/auth/refresh' \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{"
    echo "    \"grant_type\": \"refresh_token\","
    echo "    \"refresh_token\": \"\${REFRESH_TOKEN}\""
    echo "  }'"
}

###############################################################################
# Paso 10: Health Check
###############################################################################

health_check() {
    print_header "Paso 10: Health Check"

    print_info "Verificando estado del servicio..."

    RESPONSE=$(curl -s -X GET "${API_BASE_URL}/api/v1/auth/health")

    print_success "Health check completado"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

    echo ""
    echo "Comando ejecutado:"
    echo "curl -X GET '${API_BASE_URL}/api/v1/auth/health'"
}

###############################################################################
# Ejemplos adicionales con filtros avanzados
###############################################################################

ejemplos_filtros() {
    print_header "Ejemplos adicionales: Filtros avanzados"

    echo "# Filtrar por rango de fechas"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?fechaDesde=2025-01-01&fechaHasta=2025-01-31&limit=10' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
    echo ""

    echo "# Filtrar por tipo de comprobante"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?tipoComprobante=FACTURA_A&limit=10' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
    echo ""

    echo "# Filtrar por CUIT del proveedor"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?cuit=30-12345678-9&limit=10' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
    echo ""

    echo "# Filtrar solo documentos no exportados"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?exportado=false&limit=10' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
    echo ""

    echo "# Combinar múltiples filtros con paginación"
    echo "curl -X GET '${API_BASE_URL}/api/v1/documents?status=completado&exportado=false&limit=20&offset=40&sort=totalExtraido&order=desc' \\"
    echo "  -H 'Authorization: Bearer \${ACCESS_TOKEN}'"
}

###############################################################################
# Main - Ejecutar todos los ejemplos
###############################################################################

main() {
    echo "🚀 Parse API Pública - Ejemplos con cURL"
    echo ""
    echo "API URL: ${API_BASE_URL}"
    echo "Cliente: ${CLIENT_ID}"
    echo ""

    # Verificar que jq está instalado (opcional pero recomendado)
    if ! command -v jq &> /dev/null; then
        print_info "Tip: Instala 'jq' para mejor formateo del JSON"
        echo "   Ubuntu/Debian: sudo apt-get install jq"
        echo "   MacOS: brew install jq"
        echo ""
    fi

    # Ejecutar ejemplos paso a paso
    obtener_token
    sleep 1

    obtener_info_cliente
    sleep 1

    listar_documentos
    sleep 1

    if [ -n "$FIRST_DOC_ID" ]; then
        obtener_documento
        sleep 1

        obtener_lineas
        sleep 1

        obtener_impuestos
        sleep 1

        # Descomentar para ejecutar estos ejemplos:
        # marcar_exportado
        # descargar_archivo
    fi

    # refrescar_token
    # health_check

    ejemplos_filtros

    echo ""
    print_header "Resumen"
    print_success "Todos los ejemplos ejecutados exitosamente"
    echo ""
    echo "Para más información, consulta la documentación interactiva:"
    echo "${API_BASE_URL}/api/v1/docs"
}

# Ejecutar main si se llama directamente
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main
fi
