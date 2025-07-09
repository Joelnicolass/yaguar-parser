# Yaguar Sync - Servicio de Sincronización de Datos

## 📋 Descripción del Proyecto

Servicio automatizado para sincronizar datos entre una base de datos antigua y un sitio WordPress/WooCommerce mediante archivos SFTP y conversión de formatos.

## 🔍 Problemática

- **Origen**: Base de datos antigua que genera respaldos diarios
- **Destino**: Sitio WordPress con WooCommerce
- **Frecuencia**: Backup diario subido a SFTP a las 00:00hs (Argentina)
- **Necesidad**: Sincronización automática de productos y datos

## 🎯 Propuesta de Solución

### Flujo de Trabajo

1. **03:00 AM** - Servicio consulta SFTP para buscar nuevo archivo
2. **Descarga** - Obtiene el respaldo de la base de datos via SFTP
3. **Parsing** - Convierte datos a formato JSON intermedio
4. **Transformación** - Adapta JSON a XML compatible con WooCommerce
5. **Logging** - Registra todo el proceso para auditoría
6. **Limpieza** - Elimina archivos temporales automáticamente

### Arquitectura Técnica

- **Backend**: Node.js + Express + TypeScript
- **Scheduler**: Cron jobs para ejecución automática
- **File Transfer**: Cliente SFTP seguro
- **Process Manager**: PM2 para alta disponibilidad
- **Containerización**: Docker para deployment
- **Hosting**: Railway (inicialmente) o VPS privada

## 🚀 Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Scheduler**: node-cron
- **SFTP Client**: ssh2-sftp-client
- **Process Manager**: PM2
- **Logging**: Winston
- **Testing**: Jest
- **Containerización**: Docker
- **Deployment**: Railway / VPS

## 📁 Estructura del Proyecto

```
yaguar-prod/
├── src/
│   ├── controllers/         # Controladores de la API (snake_case)
│   │   ├── health_controller.ts     # Health check y monitoreo
│   │   ├── sync_controller.ts       # Operaciones de sincronización
│   │   ├── scheduler_controller.ts  # Control de cron jobs
│   │   └── sftp_controller.ts       # Operaciones SFTP
│   ├── services/           # Lógica de negocio
│   │   ├── sftp/          # Cliente SFTP real
│   │   │   └── sftp_service.ts     # Conexión, descarga y limpieza
│   │   ├── parser/        # Conversión de datos
│   │   └── scheduler/     # Tareas programadas
│   │       └── scheduler_service.ts # Sistema de cron jobs
│   ├── models/            # Modelos de datos
│   ├── utils/             # Utilidades y helpers
│   ├── config/            # Configuraciones
│   └── types/             # Definiciones de tipos TS
├── logs/                  # Archivos de log rotativos
├── temp/                  # Archivos descargados temporalmente
├── tests/                 # Tests unitarios e integración
├── docs/                  # Documentación adicional
├── Dockerfile            # Configuración Docker
├── .dockerignore         # Exclusiones para Docker
└── ecosystem.config.js   # Configuración PM2
```

## 📝 Convenciones de Código

### Nomenclatura de Archivos

- **Controladores**: Se utiliza `snake_case` para nombres de archivos
  - ✅ `health_controller.ts`
  - ✅ `sync_controller.ts`
  - ✅ `scheduler_controller.ts`
  - ✅ `sftp_controller.ts`
  - ❌ `HealthController.ts` (camelCase no se usa para archivos)

### Nomenclatura de Clases y Variables

- **Clases**: Se mantiene `PascalCase`
  - ✅ `HealthController`
  - ✅ `SyncController`
  - ✅ `SchedulerService`
  - ✅ `SftpService`
- **Variables y métodos**: Se utiliza `camelCase`
  - ✅ `getCurrentStatus()`
  - ✅ `downloadLatestFile()`

### Estructura de Controladores

Todos los controladores siguen el mismo patrón:

```typescript
/**
 * nombre_controller - Descripción del controlador
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js
 * - ssh2-sftp-client: Cliente SFTP (cuando corresponda)
 */

export class NombreController {
  public static async metodo(req: Request, res: Response): Promise<void> {
    // Implementación
  }
}
```

## 🔧 Características Principales

### 1. Servicio SFTP ✅

- Conexión segura al servidor SFTP
- Descarga automática de archivos de respaldo
- Detección del archivo más reciente por fecha
- Validación de integridad de archivos
- Limpieza automática de archivos temporales
- Manejo robusto de errores y reconexión

### 2. Sistema de Cron Jobs ✅

- Programación automática de sincronizaciones
- Expresiones cron configurables dinámicamente
- Integración real con servicios SFTP
- Control manual via API (start/stop/reschedule)
- Logging detallado de ejecuciones

### 3. Parser de Datos ✅

- Lectura de archivos .asc de base de datos legacy
- Conversión automática a JSON estructurado para WooCommerce
- Validación de datos y manejo de errores
- Soporte para múltiples formatos de salida (JSON/CSV)
- Procesamiento rápido (300+ productos en ~2ms)
- API completa para parsing manual y automático
- Integración directa con descarga SFTP
- Estadísticas detalladas de procesamiento

### 4. Generador XML WooCommerce

- Transformación JSON → XML
- Compatibilidad con formato WooCommerce
- Mapeo de campos personalizados
- Optimización para importación masiva

### 5. Sistema de Logging ✅

- Logs detallados de cada operación
- Niveles de log (error, warn, info, debug)
- Rotación automática de archivos diarios
- Logs separados para errores
- Formato JSON estructurado

### 6. API REST Completa ✅

- Endpoints para monitoreo y control
- Trigger manual de sincronización
- Control completo del scheduler
- Operaciones SFTP manuales
- Consulta de status y logs

## 📅 Roadmap de Desarrollo

### Fase 1 - Setup Inicial ✅

- [x] Estructura del proyecto
- [x] README y documentación
- [x] Configuración TypeScript
- [x] Setup Express básico
- [x] Configuración de logging
- [x] Dockerfile optimizado
- [x] Controladores con nomenclatura snake_case
- [x] Corrección de errores de tipos

### Fase 2 - Core Services ✅

- [x] Sistema de cron jobs completo
- [x] Servicio SFTP real con test.rebex.net
- [x] Integración scheduler + SFTP
- [x] API REST para control manual
- [x] Parser completo para datos legacy (.asc → JSON)
- [ ] Generador XML básico

### Fase 3 - API y Monitoreo ✅

- [x] Endpoints de monitoreo completos
- [x] Control del scheduler via API
- [x] Operaciones SFTP via API
- [x] Sistema de logging avanzado
- [ ] Dashboard de monitoreo web
- [ ] Sistema de notificaciones

### Fase 4 - Testing y Optimización

- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Optimización de performance
- [ ] Documentación de API

### Fase 5 - Deployment

- [ ] Configuración PM2
- [ ] Deploy a Railway
- [ ] Monitoreo en producción

## 🔐 Variables de Entorno

```env
# Servidor
PORT=3000
NODE_ENV=development

# SFTP Configuration
SFTP_HOST=test.rebex.net
SFTP_USER=demo
SFTP_PASSWORD=password
SFTP_PORT=22
SFTP_REMOTE_PATH=/
SFTP_FILE_PATTERN=*.sql
SFTP_TIMEOUT=30000

# Cron Schedule
SYNC_CRON_SCHEDULE=0 3 * * *  # 3:00 AM diario

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Paths
TEMP_DIR=./temp
LOGS_DIR=./logs

# Timezone
TZ=America/Argentina/Buenos_Aires
```

## 🚦 Estados del Servicio

- **IDLE**: Esperando próxima ejecución
- **CONNECTING**: Conectando al SFTP
- **DOWNLOADING**: Descargando archivo desde SFTP
- **PARSING**: Procesando datos
- **GENERATING**: Creando XML
- **COMPLETED**: Proceso finalizado exitosamente
- **ERROR**: Error en algún paso del proceso

## 📊 Métricas y Monitoreo

- Tiempo de ejecución de cada sincronización
- Cantidad de registros procesados
- Errores por tipo y frecuencia
- Tamaño de archivos descargados
- Velocidad de descarga SFTP
- Status de salud del servicio

## 🔄 Flujo de Datos Actualizado

```
SFTP Server → Download → Parse DB → JSON → Transform → XML → WooCommerce
     ↓           ↓         ↓        ↓        ↓        ↓         ↓
   Backup    Real Download Raw Data  Clean   Product  Import   Update
   Daily     via SFTP     Extract   Data     Data    Ready    Store
```

## 🌐 API Endpoints

### Health & Info

- `GET /api/health` - Health check del servicio
- `GET /api/health/info` - Información detallada del servicio

### Sincronización

- `GET /api/sync/status` - Estado de sincronización
- `POST /api/sync/trigger` - Sincronización manual
- `GET /api/sync/logs` - Logs de sincronización

### Scheduler

- `GET /api/scheduler/status` - Estado del scheduler
- `POST /api/scheduler/start` - Iniciar scheduler
- `POST /api/scheduler/stop` - Detener scheduler
- `POST /api/scheduler/reschedule` - Reprogramar horarios

### SFTP ✅

- `GET /api/sftp/status` - Estado de conexión SFTP
- `POST /api/sftp/test-connection` - Probar conexión
- `GET /api/sftp/list-files` - Listar archivos remotos
- `POST /api/sftp/download-latest` - Descargar archivo más reciente
- `POST /api/sftp/download/:fileName` - Descargar archivo específico
- `POST /api/sftp/cleanup` - Limpiar archivos temporales

### Parser ✅

- `GET /api/parser/parse-example` - Parsear archivo de ejemplo incluido
- `POST /api/parser/parse-file` - Parsear archivo específico subido
- `GET /api/parser/parse-from-sftp/:fileName` - Descargar desde SFTP y parsear
- `GET /api/parser/stats/:fileName` - Estadísticas de archivo parseado
- `POST /api/parser/cleanup` - Limpiar archivos de parser
- `GET /api/parser/config` - Configuración del parser

---

**Fecha de inicio**: Julio 2025  
**Estado**: SFTP, Scheduler y Parser completamente funcionales  
**Versión**: 0.3.0  
**Última actualización**: 9 de Julio 2025

---

## 🧪 Testing y Desarrollo

### TESTING RAPIDO DEL CORE

```bash
# Verificar estado del servicio
curl -X GET http://localhost:3000/api/scheduler/status
# Parar el scheduler automatico
curl -X POST http://localhost:3000/api/scheduler/stop
# Configurar el scheduler automatico con 1 minuto de espera
curl -X POST http://localhost:3000/api/scheduler/reschedule -H "Content-Type: application/json" -d '{"schedule": "*/1 * * * *"}'
# Iniciar el scheduler automatico
curl -X POST http://localhost:3000/api/scheduler/start
# Verificar estado de sincronización
curl -X GET http://localhost:3000/api/scheduler/status
```
