# Yaguar Sync - Servicio de Sincronización de Datos

## 📋 Descripción del Proyecto

Servicio automatizado para sincronizar datos entre una base de datos antigua y un sitio WordPress/WooCommerce mediante archivos FTP y conversión de formatos.

## 🔍 Problemática

- **Origen**: Base de datos antigua que genera respaldos diarios
- **Destino**: Sitio WordPress con WooCommerce
- **Frecuencia**: Backup diario subido a FTP a las 00:00hs (Argentina)
- **Necesidad**: Sincronización automática de productos y datos

## 🎯 Propuesta de Solución

### Flujo de Trabajo

1. **03:00 AM** - Servicio consulta FTP para buscar nuevo archivo
2. **Descarga** - Obtiene el respaldo de la base de datos
3. **Parsing** - Convierte datos a formato JSON intermedio
4. **Transformación** - Adapta JSON a XML compatible con WooCommerce
5. **Logging** - Registra todo el proceso para auditoría

### Arquitectura Técnica

- **Backend**: Node.js + Express + TypeScript
- **Scheduler**: Cron jobs para ejecución automática
- **Process Manager**: PM2 para alta disponibilidad
- **Containerización**: Docker para deployment
- **Hosting**: Railway (inicialmente) o VPS privada

## 🚀 Stack Tecnológico

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Lenguaje**: TypeScript
- **Scheduler**: node-cron
- **Process Manager**: PM2
- **FTP Client**: basic-ftp
- **Logging**: Winston
- **Testing**: Jest
- **Containerización**: Docker
- **Deployment**: Railway / VPS

## 📁 Estructura del Proyecto

```
yaguar-prod/
├── src/
│   ├── controllers/         # Controladores de la API (snake_case)
│   │   ├── health_controller.ts    # Health check y monitoreo
│   │   └── sync_controller.ts      # Operaciones de sincronización
│   ├── services/           # Lógica de negocio
│   │   ├── ftp/           # Manejo de FTP
│   │   ├── parser/        # Conversión de datos
│   │   └── scheduler/     # Tareas programadas
│   ├── models/            # Modelos de datos
│   ├── utils/             # Utilidades y helpers
│   ├── config/            # Configuraciones
│   └── types/             # Definiciones de tipos TS
├── logs/                  # Archivos de log
├── temp/                  # Archivos temporales
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
  - ❌ `HealthController.ts` (camelCase no se usa para archivos)

### Nomenclatura de Clases y Variables

- **Clases**: Se mantiene `PascalCase`
  - ✅ `HealthController`
  - ✅ `SyncController`
- **Variables y métodos**: Se utiliza `camelCase`
  - ✅ `getCurrentStatus()`
  - ✅ `syncHistory`

### Estructura de Controladores

Todos los controladores siguen el mismo patrón:

```typescript
/**
 * nombre_controller - Descripción del controlador
 *
 * Librerías utilizadas:
 * - express: Framework web para Node.js
 * - dayjs: Manejo de fechas (cuando corresponda)
 */

export class NombreController {
  public static async metodo(req: Request, res: Response): Promise<void> {
    // Implementación
  }
}
```

## 🔧 Características Principales

### 1. Servicio FTP

- Conexión automática al servidor FTP
- Descarga de archivos de respaldo
- Validación de integridad de archivos
- Limpieza de archivos temporales

### 2. Parser de Datos

- Lectura de formatos de base de datos legacy
- Conversión a JSON estructurado
- Validación de datos
- Manejo de errores y datos corruptos

### 3. Generador XML WooCommerce

- Transformación JSON → XML
- Compatibilidad con formato WooCommerce
- Mapeo de campos personalizados
- Optimización para importación masiva

### 4. Sistema de Logging

- Logs detallados de cada operación
- Niveles de log (error, warn, info, debug)
- Rotación automática de archivos
- Notificaciones de errores críticos

### 5. API REST

- Endpoints para monitoreo
- Trigger manual de sincronización
- Consulta de status y logs
- Configuración dinámica

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

### Fase 2 - Core Services

- [ ] Servicio FTP con datos dummy
- [ ] Parser básico (simulado)
- [ ] Generador XML básico
- [x] Sistema de cron jobs

### Fase 3 - API y Monitoreo

- [ ] Endpoints de la API
- [ ] Dashboard de monitoreo
- [ ] Sistema de notificaciones
- [ ] Manejo de errores

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

# FTP Configuration
FTP_HOST=
FTP_USER=
FTP_PASSWORD=
FTP_PORT=21
FTP_SECURE=false

# Cron Schedule
SYNC_CRON_SCHEDULE=0 3 * * *  # 3:00 AM diario

# Logging
LOG_LEVEL=info
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# Timezone
TZ=America/Argentina/Buenos_Aires
```

## 🚦 Estados del Servicio

- **IDLE**: Esperando próxima ejecución
- **CONNECTING**: Conectando al FTP
- **DOWNLOADING**: Descargando archivo
- **PARSING**: Procesando datos
- **GENERATING**: Creando XML
- **COMPLETED**: Proceso finalizado exitosamente
- **ERROR**: Error en algún paso del proceso

## 📊 Métricas y Monitoreo

- Tiempo de ejecución de cada sincronización
- Cantidad de registros procesados
- Errores por tipo y frecuencia
- Tamaño de archivos procesados
- Status de salud del servicio

## 🔄 Flujo de Datos

```
FTP Server → Download → Parse DB → JSON → Transform → XML → WooCommerce
     ↓           ↓         ↓        ↓        ↓        ↓         ↓
   Backup    Temp File   Raw Data  Clean   Product  Import   Update
   Daily      Local      Extract   Data     Data    Ready    Store
```

## 🐳 Docker

### Construcción y Ejecución

```bash
# Construir imagen
docker build -t yaguar-sync .

# Ejecutar contenedor
docker run -p 3000:3000 --env-file .env yaguar-sync

# Ejecutar en modo detached
docker run -d -p 3000:3000 --name yaguar-sync-container --env-file .env yaguar-sync

# Ver logs del contenedor
docker logs yaguar-sync-container

# Health check manual
docker exec yaguar-sync-container curl -f http://localhost:3000/health
```

### Características del Dockerfile

- **Imagen base**: `node:18-alpine` (ligera y segura)
- **Zona horaria**: Configurada para Argentina
- **Usuario no-root**: Mayor seguridad
- **Health check**: Monitoreo automático del servicio
- **Multi-stage**: Optimizado para producción
- **Cache layers**: Build eficiente

## 🚀 Comandos de Desarrollo

```bash
# Instalación
npm install

# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm run start

# Producción con PM2
npm run start:prod

# Tests
npm test

# Linting
npm run lint

# Docker local
docker build -t yaguar-sync .
docker run -p 3000:3000 yaguar-sync
```

## 📝 Próximos Pasos

1. **Servicio de Estado**: Implementar endpoints de monitoreo
2. **Datos dummy**: Crear estructura de datos de prueba
3. **Servicio FTP**: Implementar cliente FTP básico
4. **Parser**: Desarrollar lógica de conversión
5. **Cron jobs**: Implementar scheduler
6. **API**: Crear endpoints de monitoreo
7. **Testing**: Agregar tests completos
8. **Deploy**: Subir a Railway
