--- MANEJO DE EFECTIVO

Nuevo Sidebar : 

DASHBOARD
	Reportes
	
COMPROBANTES 
	Nueva tabla de cajas que se asignan a usuarios.
		La caja tiene un parametro que diga si es fondo fijo.
		Si es fondo fijo pide un importe limite.
		
	Efectivo (Lista de cajas)
	    - Propio
		- Delegado 1
		- Delegado 2
		- Fondo Fijo 1
		- Fondo Fijo 2
		
		Agregar una opcion para generar rendiciones arrastrando comprobantes. Arrastra a la rendicion abierta y si no crea una.
			Sin validar si se supera el saldo de cuenta corriente.
			
	Tarjeta 

EFECTIVO
    Tesoreria
	    - Solicitar adelanto (Ver si se puede incorporar en la pantalla de autorizaciones)
			Genera una cuenta corriente que se va descontando con las entregas.
			
		- Entrega efectivo (Generan en Softland EF0001) 
			Recupera pendientes de las solicitudes de adelanto y de las rendiciones autorizadas.
			
		- Devolucion de efectivo. (Generan en Softland DV0001)
			Recupera los pendientes de devolucion de las rendiciones autorizadas.
			
		Los saldos se van armando con las entregas de efectivo, devoluciones
		
    Rendiciones 
	    La rendicion se finaliza.
		Para el caso de fondo fijo, antes de finalizar la rendicion validar que no supere el saldo. 
				sino tiene que sacar comprobantes de la rendicion.
		
	Autorizacion 
        Chequea el saldo de la caja :
			Si adelanto - rendicion es negativo genera la entrega de efectivo.
			Si adelanto - rendicion es 0 no hago nada.
			Si adelanto - rendicion es positivo genera la devolucion de efectivo.
			
		Chequea el saldo del fondo fijo : 
			Genera la entrega de efectivo para reponer.
		
		Tesoreria puede ver la rendicion finalizada 
		para entregar el efectivo si no es un fondo fijo 
		o reponer la diferencia o tambien puede tener un adelanto.
		
	Estado
	
	
TARJETA
    Importar Resumen
	Rendiciones
	Tarjetas 

AUTORIZACIONES
EXPORTAR
CONFIGURACION
	Usuarios
	Parametros


2 - Ampliar comprobantes para asociar a las cajas -- Necesitamos que en comprobantes se pueda elegir "asociar/llevar" para ir armando una rendición de caja. Obviamente no se asocian a cupones porque no hay nada para comparar

3 - Que exportar tome las rendiciones de caja tambien -- tienen que tomarse como rendiciones pendientes, así como las tarjetas.

4 - Subir otros tipos de dkt, pdfs o lo que sea de otras tarjetas -- Pedir otros dkts o pdfs de otros resumenes para armar otras tarjetas

5 - Integracion con softland para subir comprobantes --  planificar los uploads de comprobantes al ERP, con el esquema actual + NPS (ordenes de compra) + comprobantes de entrga y devolucion de efectivo.


6 - Upload desde softland de maestros (desde cliente con los maestros volcados ahi) -- definir la importación de los maestros a utilizar, por ej. proveedores, TIPPRO, ARTCOD, etc.

7 - Rendir sin comprobante! --  dar la posibilidad en una línea de tarjeta de rendirla sin comprobante. Botón ubicado dentro del box de "asociar comprobante individual" en cada línea de tarjeta. **PRIORIDAD ALTA - SALIDA URGENTE**

8 - Ver cuit del exterior usar el de persona juridica y ver como leerlo -- definir que para los gastos del exterior el proveedor sea el generico PERO de alguna manera se levante el país y ponga el CUIT que pertenece a la persona jurídica del exterior.

9 - Ver de armar el objeto de liquidación (y por ende el pago en el banco). Para terminar con la estanqueidad del sistemas vs. ERP tener la liquidación y pagos de la tarjeta disponibles como opciones dentro del sistema y migrar al ERP los comprobantes necesarios.

10 - fueras de oficina -- Activar esta función para delegar (se llama a la delegación si no hizo previamente) en caso de que un usuario se ausente.

11- dos comprobantes con sus lineas homologas en rendiciones -- Definir los casos de uso para la rendición de tarjeta que lleve dos comprobantes. Asociar a 1 solo cupon desde comprobantes o bien vincularlos al abrir las lineas desde rendicion.

12 - autorizacion por niveles --  armar las reglas de validacion para las autorizaciones niveladas (ej. usuario 1 autoriza rendiciones de 1000 y se le suma usuario 2 si excede) Tener en cuenta los usuarios que NO requieren autorizacion (se autorizan por atras automaticamente)

13 - reglas para ver pantallas segun atributos del usuario -- poder determinar que campos son visibles y obligatorios en la grilla simplificada segun atributos del usuario.

14 - eliminaciones masivas en parametros -- agregar botones o funcionalidades para hacer eliminaciones masivas de datos en la sección de parámetros (eliminar múltiples registros DKT, limpiar datos de prueba, etc.)

15 - selector tarjeta/efectivo en comprobantes -- implementar pantalla de selección previa al módulo comprobantes para elegir entre "Tarjeta" o "Efectivo". La pantalla actual sirve para tarjetas, crear nueva pantalla más sencilla para efectivo. **PRIORIDAD ALTA - SALIDA URGENTE**

---

## VERSION 1.1 - MEJORAS IDENTIFICADAS EN PRUEBAS FUNCIONALES

### FUNCIONALIDADES PRIORITARIAS
- **Rendir sin comprobante**: Implementar opción para crear rendiciones sin adjuntar comprobantes - botón dentro del box de "asociar comprobante individual" en tarjeta - SALIDA URGENTE

- **Selector de tipo en comprobantes**: Implementar pantalla de selección "Tarjeta" o "Efectivo" antes de acceder al módulo comprobantes. La pantalla actual es para tarjetas, falta crear pantalla más sencilla para efectivo - SALIDA URGENTE

### BUGS CRÍTICOS A CORREGIR
- **Sistema de rendiciones**: Corregir botones guardar, limpiar campos y subir Excel que no funcionan
- **Asociación de comprobantes**: Corregir sistema de asociación de comprobantes a rendiciones (tanto masiva como individual)
- **Campo búsqueda parámetros**: Corregir que solo permite 1 carácter y se recarga la pantalla
- **Eliminación DKT**: Permitir eliminación de registros DKT que no tienen rendiciones asociadas
- **Reportes faltantes**: Implementar reportes de avance de rendiciones por usuario y resumen DKT

### SIMPLIFICACIÓN DE INTERFAZ
- **Campos de rendición**: Remover campos innecesarios (Concepto Módulo, Tipo, Código, Módulo/Tipo Comprobante, Tipo de Registro) - mantener solo en backend para ERP
- **Campos de comprobantes**: Remover campos CAE y Estado que no aportan valor funcional

### FUNCIONALIDADES DE GESTIÓN
- **Eliminaciones masivas**: Botones para eliminación masiva en parámetros y datos DKT
- **Limpieza de datos**: Herramientas para limpiar datos de prueba y registros obsoletos