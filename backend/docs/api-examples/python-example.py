"""
Parse API Pública - Ejemplo de uso con Python

Este script demuestra cómo autenticarse y consultar documentos
usando la API pública de Parse con OAuth 2.0

Instalación:
    pip install requests

Uso:
    export CLIENT_ID=your_client_id
    export CLIENT_SECRET=your_secret
    python python-example.py
"""

import os
import sys
import requests
from typing import Dict, List, Optional
from datetime import datetime

# Configuración
API_BASE_URL = os.getenv('API_BASE_URL', 'https://api.parsedemo.axiomacloud.com')
CLIENT_ID = os.getenv('CLIENT_ID', 'your_client_id_here')
CLIENT_SECRET = os.getenv('CLIENT_SECRET', 'your_client_secret_here')

class ParseAPIClient:
    """Cliente para la API pública de Parse"""

    def __init__(self, base_url: str, client_id: str, client_secret: str):
        self.base_url = base_url
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = None
        self.refresh_token = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def obtener_token(self, scopes: List[str] = None) -> Dict:
        """
        Paso 1: Obtener access token usando Client Credentials

        Args:
            scopes: Lista de scopes solicitados. Default: ['read:documents', 'write:documents']

        Returns:
            Dict con access_token, refresh_token, expires_in, etc.
        """
        print('📝 Obteniendo access token...')

        if scopes is None:
            scopes = ['read:documents', 'write:documents', 'read:files']

        payload = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': ' '.join(scopes)
        }

        response = requests.post(
            f'{self.base_url}/api/v1/auth/token',
            json=payload
        )

        if response.status_code == 200:
            data = response.json()
            self.access_token = data['access_token']
            self.refresh_token = data.get('refresh_token')

            # Configurar header de autenticación
            self.session.headers.update({
                'Authorization': f"Bearer {self.access_token}"
            })

            print('✅ Token obtenido exitosamente')
            print(f"   Expira en: {data['expires_in']} segundos")
            print(f"   Scopes: {data.get('scope', 'N/A')}")

            return data
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to obtain token: {response.text}")

    def obtener_info_cliente(self) -> Dict:
        """
        Paso 2: Consultar información del cliente autenticado

        Returns:
            Dict con información del cliente, tenant y scopes
        """
        print('\n📊 Consultando información del cliente...')

        response = self.session.get(f'{self.base_url}/api/v1/auth/me')

        if response.status_code == 200:
            info = response.json()
            print('✅ Información del cliente:')
            print(f"   Cliente: {info['nombre']}")
            print(f"   Tenant: {info['tenant']['nombre']}")
            print(f"   Scopes: {', '.join(info['scopes'])}")
            print(f"   Token expira: {info['tokenExpiry']}")
            return info
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to get client info: {response.text}")

    def listar_documentos(
        self,
        status: str = 'completado',
        exportado: Optional[bool] = None,
        fecha_desde: Optional[str] = None,
        fecha_hasta: Optional[str] = None,
        tipo_comprobante: Optional[str] = None,
        cuit: Optional[str] = None,
        limit: int = 10,
        offset: int = 0,
        sort: str = 'fechaProcesamiento',
        order: str = 'desc'
    ) -> Dict:
        """
        Paso 3: Listar documentos con filtros

        Args:
            status: Estado del documento (completado, error, procesando)
            exportado: True/False para filtrar por estado de exportación
            fecha_desde: Fecha inicio en formato YYYY-MM-DD
            fecha_hasta: Fecha fin en formato YYYY-MM-DD
            tipo_comprobante: Tipo de comprobante (FACTURA_A, FACTURA_B, etc.)
            cuit: CUIT del proveedor
            limit: Cantidad de resultados (max 1000)
            offset: Offset para paginación
            sort: Campo de ordenamiento
            order: Orden ascendente (asc) o descendente (desc)

        Returns:
            Dict con documents (list) y pagination (dict)
        """
        print('\n📄 Listando documentos...')

        params = {
            'status': status,
            'limit': limit,
            'offset': offset,
            'sort': sort,
            'order': order
        }

        if exportado is not None:
            params['exportado'] = str(exportado).lower()
        if fecha_desde:
            params['fechaDesde'] = fecha_desde
        if fecha_hasta:
            params['fechaHasta'] = fecha_hasta
        if tipo_comprobante:
            params['tipoComprobante'] = tipo_comprobante
        if cuit:
            params['cuit'] = cuit

        response = self.session.get(
            f'{self.base_url}/api/v1/documents',
            params=params
        )

        if response.status_code == 200:
            data = response.json()['data']
            documents = data['documents']
            pagination = data['pagination']

            print(f"✅ Encontrados {pagination['total']} documentos (mostrando {len(documents)})")

            for idx, doc in enumerate(documents, 1):
                print(f"\n   {idx}. {doc['tipoComprobanteExtraido']} {doc['numeroExtraido']}")
                print(f"      Proveedor: {doc['razonSocialExtraida']} ({doc['cuitExtraido']})")
                print(f"      Fecha: {doc['fechaExtraida']}")
                print(f"      Total: ${doc['totalExtraido']}")
                print(f"      Exportado: {'Sí' if doc['exportado'] else 'No'}")

            return data
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to list documents: {response.text}")

    def obtener_documento(self, documento_id: str) -> Dict:
        """
        Paso 4: Obtener detalle de un documento específico

        Args:
            documento_id: UUID del documento

        Returns:
            Dict con todos los datos del documento
        """
        print(f'\n🔍 Obteniendo detalle del documento {documento_id}...')

        response = self.session.get(
            f'{self.base_url}/api/v1/documents/{documento_id}'
        )

        if response.status_code == 200:
            doc = response.json()['data']

            print('✅ Detalle del documento:')
            print(f"   ID: {doc['id']}")
            print(f"   Tipo: {doc['tipoComprobanteExtraido']}")
            print(f"   Número: {doc['numeroExtraido']}")
            print(f"   Fecha: {doc['fechaExtraida']}")
            print(f"   Proveedor: {doc['razonSocialExtraida']}")
            print(f"   Total: ${doc['totalExtraido']}")

            return doc
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to get document: {response.text}")

    def obtener_lineas_documento(self, documento_id: str) -> List[Dict]:
        """
        Paso 5: Obtener líneas de un documento

        Args:
            documento_id: UUID del documento

        Returns:
            Lista de líneas del documento
        """
        print(f'\n📋 Obteniendo líneas del documento {documento_id}...')

        response = self.session.get(
            f'{self.base_url}/api/v1/documents/{documento_id}/lineas'
        )

        if response.status_code == 200:
            lineas = response.json()['data']

            print(f"✅ {len(lineas)} línea(s) encontradas:")

            for linea in lineas:
                print(f"\n   Línea {linea['numeroLinea']}:")
                print(f"      {linea['descripcion']}")
                print(f"      Cantidad: {linea['cantidad']} x ${linea['precioUnitario']} = ${linea['total']}")
                if linea.get('cuentaContable'):
                    print(f"      Cuenta: {linea['cuentaContable']}")

            return lineas
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to get document lines: {response.text}")

    def obtener_impuestos_documento(self, documento_id: str) -> List[Dict]:
        """
        Paso 6: Obtener impuestos de un documento

        Args:
            documento_id: UUID del documento

        Returns:
            Lista de impuestos del documento
        """
        print(f'\n💰 Obteniendo impuestos del documento {documento_id}...')

        response = self.session.get(
            f'{self.base_url}/api/v1/documents/{documento_id}/impuestos'
        )

        if response.status_code == 200:
            impuestos = response.json()['data']

            print(f"✅ {len(impuestos)} impuesto(s) encontrados:")

            for impuesto in impuestos:
                print(f"\n   {impuesto['tipoImpuesto']} ({impuesto['alicuota']}%):")
                print(f"      Base imponible: ${impuesto['baseImponible']}")
                print(f"      Monto: ${impuesto['monto']}")
                if impuesto.get('cuentaContable'):
                    print(f"      Cuenta: {impuesto['cuentaContable']}")

            return impuestos
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to get document taxes: {response.text}")

    def marcar_como_exportado(
        self,
        documento_id: str,
        external_id: str,
        export_config_id: Optional[str] = None
    ) -> Dict:
        """
        Paso 7: Marcar documento como exportado

        Args:
            documento_id: UUID del documento
            external_id: ID del documento en el sistema externo
            export_config_id: ID opcional de la configuración de exportación

        Returns:
            Dict con resultado de la operación
        """
        print(f'\n✏️  Marcando documento {documento_id} como exportado...')

        payload = {
            'externalSystemId': external_id
        }

        if export_config_id:
            payload['exportConfigId'] = export_config_id

        response = self.session.post(
            f'{self.base_url}/api/v1/documents/{documento_id}/mark-exported',
            json=payload
        )

        if response.status_code == 200:
            data = response.json()
            print('✅ Documento marcado como exportado')
            print(f"   External ID: {external_id}")
            return data
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to mark document as exported: {response.text}")

    def descargar_archivo(self, documento_id: str, ruta_destino: str) -> str:
        """
        Paso 8: Descargar archivo original del documento

        Args:
            documento_id: UUID del documento
            ruta_destino: Ruta donde guardar el archivo

        Returns:
            Ruta del archivo descargado
        """
        print(f'\n💾 Descargando archivo del documento {documento_id}...')

        response = self.session.get(
            f'{self.base_url}/api/v1/documents/{documento_id}/file',
            stream=True
        )

        if response.status_code == 200:
            with open(ruta_destino, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            file_size = os.path.getsize(ruta_destino)
            print(f"✅ Archivo descargado: {ruta_destino}")
            print(f"   Tamaño: {file_size / 1024:.2f} KB")

            return ruta_destino
        else:
            print(f"❌ Error: {response.status_code}")
            raise Exception(f"Failed to download file: {response.text}")

    def refrescar_token(self) -> Dict:
        """
        Paso 9: Refrescar access token usando refresh token

        Returns:
            Dict con nuevo access_token y expires_in
        """
        print('\n🔄 Refrescando access token...')

        if not self.refresh_token:
            raise Exception("No refresh token available")

        payload = {
            'grant_type': 'refresh_token',
            'refresh_token': self.refresh_token
        }

        response = requests.post(
            f'{self.base_url}/api/v1/auth/refresh',
            json=payload
        )

        if response.status_code == 200:
            data = response.json()
            self.access_token = data['access_token']

            # Actualizar header
            self.session.headers.update({
                'Authorization': f"Bearer {self.access_token}"
            })

            print('✅ Token refrescado exitosamente')
            print(f"   Expira en: {data['expires_in']} segundos")

            return data
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.json())
            raise Exception(f"Failed to refresh token: {response.text}")


def main():
    """Función principal - Ejecuta todos los ejemplos"""

    print('🚀 Parse API Pública - Ejemplo de uso con Python\n')
    print(f"API URL: {API_BASE_URL}")
    print(f"Cliente: {CLIENT_ID}\n")
    print('─' * 60)

    try:
        # Crear cliente
        client = ParseAPIClient(API_BASE_URL, CLIENT_ID, CLIENT_SECRET)

        # 1. Obtener token
        client.obtener_token()

        # 2. Verificar autenticación
        client.obtener_info_cliente()

        # 3. Listar documentos recientes
        resultado = client.listar_documentos(status='completado', limit=5)
        documents = resultado['documents']

        # 4. Si hay documentos, obtener detalle del primero
        if len(documents) > 0:
            primer_documento = documents[0]

            client.obtener_documento(primer_documento['id'])
            client.obtener_lineas_documento(primer_documento['id'])
            client.obtener_impuestos_documento(primer_documento['id'])

            # Descomentar para marcar como exportado
            # client.marcar_como_exportado(primer_documento['id'], 'ERP-12345')

            # Descomentar para descargar archivo
            # client.descargar_archivo(primer_documento['id'], './documento.pdf')

        # 5. Ejemplo de refresh token
        # import time
        # time.sleep(2)
        # client.refrescar_token()

        print('\n' + '─' * 60)
        print('✅ Todos los ejemplos ejecutados exitosamente')

    except Exception as e:
        print(f'\n❌ Error en la ejecución: {str(e)}')
        sys.exit(1)


if __name__ == '__main__':
    main()
