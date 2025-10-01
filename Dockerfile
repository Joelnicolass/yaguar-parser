# ============================================
# Yaguar Sync - Dockerfile para Docker Hub
# ============================================

# Etapa 1: Build (compilación)
FROM node:18-alpine AS builder

# Metadatos de la imagen
LABEL maintainer="Joel Sartori"
LABEL description="Servicio automatizado para sincronizar datos entre SFTP y WooCommerce"
LABEL version="1.0.0"

# Instalar dependencias del sistema necesarias para compilación
RUN apk add --no-cache python3 make g++ git

# Configurar directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias primero (mejor cache de Docker)
COPY package*.json ./
COPY tsconfig.json ./

# Instalar TODAS las dependencias (dev + prod) para compilar
RUN npm ci --include=dev --no-audit --no-fund

# Copiar código fuente
COPY src/ ./src/
COPY examples/ ./examples/

# Compilar TypeScript
RUN npm run build

# Limpiar node_modules de dev dependencies
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ============================================
# Etapa 2: Runtime (producción)
FROM node:18-alpine AS runtime

# Metadatos de la imagen
LABEL maintainer="Joel Sartori"
LABEL description="Servicio automatizado para sincronizar datos entre SFTP y WooCommerce"
LABEL version="1.0.0"

# Instalar dependencias del sistema para runtime
RUN apk add --no-cache \
    tzdata \
    curl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Crear grupo y usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S yaguar -u 1001 -G nodejs

# Configurar directorio de trabajo
WORKDIR /app

# Copiar código compilado y dependencias de producción desde builder
COPY --from=builder --chown=yaguar:nodejs /app/dist ./dist
COPY --from=builder --chown=yaguar:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=yaguar:nodejs /app/package*.json ./
COPY --from=builder --chown=yaguar:nodejs /app/examples ./examples

# Crear directorios necesarios con permisos correctos
RUN mkdir -p logs temp temp/parsed temp/examples && \
    chown -R yaguar:nodejs logs temp


# Variables de entorno por defecto (pueden ser sobrescritas en runtime)
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info
ENV TEMP_DIR=/app/temp
ENV LOGS_DIR=/app/logs
ENV TZ=America/Argentina/Buenos_Aires

# Variables de entorno para SFTP
ENV SFTP_HOST=209.46.122.76
ENV SFTP_USER=vd.com.ar_6lq2mbft7aw
ENV SFTP_PASSWORD=gL5&BKsfpf2&sic5
ENV SFTP_PORT=22
ENV SFTP_TIMEOUT=30000

# Variables de entorno para Cron
ENV SYNC_CRON_SCHEDULE="0 3 * * *"

# Variables de entorno para Logging
ENV LOG_MAX_SIZE=10m
ENV LOG_MAX_FILES=5

# Variables de entorno para WooCommerce
ENV WOOCOMMERCE_URL=https://vd.com.ar/
ENV WOOCOMMERCE_CONSUMER_KEY=ack_10cdee11ebf5fcd81e9cd7cbb18628a9670e2278
ENV WOOCOMMERCE_CONSUMER_SECRET=acs_15b094700dd1d9372dae238e2b8cbc8b629d187c
ENV WOOCOMMERCE_VERSION=wc/v3

# ============================================
# VARIABLES DE ENTORNO PARA SUCURSALES
# ============================================

# Sucursal 2 - Tigre
ENV WOOCOMMERCE_TIGRE_SUCURSAL_ID=2
ENV WOOCOMMERCE_TIGRE_NOMBRE=Tigre
ENV WOOCOMMERCE_TIGRE_URL=https://vd.com.ar/tigre/
ENV WOOCOMMERCE_TIGRE_KEY=ck_9294e7c7068fc65103dd1d7c0554f00c5f2c270f
ENV WOOCOMMERCE_TIGRE_SECRET=cs_fd31aa0246360a98f805e6e0e14a2f0de1324b47

# Sucursal 3 - Campana
ENV WOOCOMMERCE_CAMPANA_SUCURSAL_ID=3
ENV WOOCOMMERCE_CAMPANA_NOMBRE=Campana
ENV WOOCOMMERCE_CAMPANA_URL=https://vd.com.ar/campana
ENV WOOCOMMERCE_CAMPANA_KEY=ck_13894b6206f52b2bd6c9ce808a53a69fcd1b7f92
ENV WOOCOMMERCE_CAMPANA_SECRET=cs_5bf8393e59ebeabfd14e9ca92847899cdd78b023

# Sucursal 4 - José C. Paz
ENV WOOCOMMERCE_JOSECPAZ_SUCURSAL_ID=4
ENV WOOCOMMERCE_JOSECPAZ_NOMBRE="José C. Paz"
ENV WOOCOMMERCE_JOSECPAZ_URL=https://vd.com.ar/jose-c-paz/
ENV WOOCOMMERCE_JOSECPAZ_KEY=ck_3b4adc412ce83123902912e6e317c269d0b59e10
ENV WOOCOMMERCE_JOSECPAZ_SECRET=cs_7acf1b366b90480e34d307257e57eda9fecb76b7

# Sucursal 5 - Santa Fe
ENV WOOCOMMERCE_SANTAFE_SUCURSAL_ID=5
ENV WOOCOMMERCE_SANTAFE_NOMBRE="Santa Fe"
ENV WOOCOMMERCE_SANTAFE_URL=https://vd.com.ar/santa-fe/
ENV WOOCOMMERCE_SANTAFE_KEY=ck_5474cc902843a8e8a18d0737737d309c89cbf1b2
ENV WOOCOMMERCE_SANTAFE_SECRET=cs_bf8230be432c07e8bae98c745f06f142559e6b31

# Sucursal 6 - Córdoba
ENV WOOCOMMERCE_CORDOBA_SUCURSAL_ID=6
ENV WOOCOMMERCE_CORDOBA_NOMBRE=Córdoba
ENV WOOCOMMERCE_CORDOBA_URL=https://vd.com.ar/cordoba/
ENV WOOCOMMERCE_CORDOBA_KEY=ck_dcdd083f7f155815b52556b64a71d0bf6a47bd6e
ENV WOOCOMMERCE_CORDOBA_SECRET=cs_612e58e6bbe8d6dba92daaafc8a3f773e00928fd

# Sucursal 8 - Neuquén
ENV WOOCOMMERCE_NEUQUEN_SUCURSAL_ID=8
ENV WOOCOMMERCE_NEUQUEN_NOMBRE=Neuquén
ENV WOOCOMMERCE_NEUQUEN_URL=https://vd.com.ar/neuquen/
ENV WOOCOMMERCE_NEUQUEN_KEY=ck_73980afe438290334eb3c1bd278203692c4373a7
ENV WOOCOMMERCE_NEUQUEN_SECRET=cs_89d3bffd1c46be0fda29ca8bd77193b87ad44e2a

# Sucursal 9 - Salta
ENV WOOCOMMERCE_SALTA_SUCURSAL_ID=9
ENV WOOCOMMERCE_SALTA_NOMBRE=Salta
ENV WOOCOMMERCE_SALTA_URL=https://vd.com.ar/salta/
ENV WOOCOMMERCE_SALTA_KEY=ck_5edfc0b25b395f8f5c20a05ab6847996a1d7953d
ENV WOOCOMMERCE_SALTA_SECRET=cs_498ce809e609038990be7737b7dc98c2153e28f2

# Sucursal 10 - Autopista (ACTIVA)
ENV WOOCOMMERCE_AUTOPISTA_SUCURSAL_ID=10
ENV WOOCOMMERCE_AUTOPISTA_NOMBRE=Autopista
ENV WOOCOMMERCE_AUTOPISTA_URL=https://vd.com.ar/autopista/
ENV WOOCOMMERCE_AUTOPISTA_KEY=ck_79f2a1cdb25bfc5daedccefb6d35d5b2fb0694de
ENV WOOCOMMERCE_AUTOPISTA_SECRET=cs_eed7296434db6c5a1978a7078292b17e949b9ca7

# Sucursal 12 - Mar del Plata
ENV WOOCOMMERCE_MARDELPLATA_SUCURSAL_ID=12
ENV WOOCOMMERCE_MARDELPLATA_NOMBRE="Mar del Plata"
ENV WOOCOMMERCE_MARDELPLATA_URL=https://vd.com.ar/mar-del-plata/
ENV WOOCOMMERCE_MARDELPLATA_KEY=ck_d61748a71ef4e244e48db94710950da46fa67d62
ENV WOOCOMMERCE_MARDELPLATA_SECRET=cs_0d63de9bd1767c7ad951891070e64e451b3ab960

# Sucursal 13 - Bahía Blanca
ENV WOOCOMMERCE_BAHIABLANCA_SUCURSAL_ID=13
ENV WOOCOMMERCE_BAHIABLANCA_NOMBRE="Bahía Blanca"
ENV WOOCOMMERCE_BAHIABLANCA_URL=https://vd.com.ar/bahia-blanca/
ENV WOOCOMMERCE_BAHIABLANCA_KEY=ck_f69a7bb3acbd3b886e4fda5b6280216bcf39bc5f
ENV WOOCOMMERCE_BAHIABLANCA_SECRET=cs_509bb1913a0a15eb8d154c38e9d8c41ab2774acd

# Sucursal 14 - Mendoza
ENV WOOCOMMERCE_MENDOZA_SUCURSAL_ID=14
ENV WOOCOMMERCE_MENDOZA_NOMBRE=Mendoza
ENV WOOCOMMERCE_MENDOZA_URL=https://vd.com.ar/mendoza/
ENV WOOCOMMERCE_MENDOZA_KEY=ck_fddee01ab8630943df93af54d0bb52ca10ccfe9e
ENV WOOCOMMERCE_MENDOZA_SECRET=cs_6cf42ab790fde28d59150822cf206e49090a243c

# Sucursal 15 - Chaco
ENV WOOCOMMERCE_CHACO_SUCURSAL_ID=15
ENV WOOCOMMERCE_CHACO_NOMBRE=Chaco
ENV WOOCOMMERCE_CHACO_URL=https://vd.com.ar/chaco/
ENV WOOCOMMERCE_CHACO_KEY=ck_49f2184af15c1c2302c0f83ae7eeb6339df21717
ENV WOOCOMMERCE_CHACO_SECRET=cs_06ba04ae0e2f95fe28dfee2fa9374154cdc2434d

# Sucursal 16 - San Juan
ENV WOOCOMMERCE_SANJUAN_SUCURSAL_ID=16
ENV WOOCOMMERCE_SANJUAN_NOMBRE="San Juan"
ENV WOOCOMMERCE_SANJUAN_URL=https://vd.com.ar/san-juan/
ENV WOOCOMMERCE_SANJUAN_KEY=ck_24d080e874ee0532f96bba986b0af34b005cac3e
ENV WOOCOMMERCE_SANJUAN_SECRET=cs_4177769196a5c658ad9bf25af04e21a375e917ea

# Sucursal 18 - Moreno
ENV WOOCOMMERCE_MORENO_SUCURSAL_ID=18
ENV WOOCOMMERCE_MORENO_NOMBRE=Moreno
ENV WOOCOMMERCE_MORENO_URL=https://vd.com.ar/moreno/
ENV WOOCOMMERCE_MORENO_KEY=ck_952836ebe719b248e1f19ab91dd262c351067a02
ENV WOOCOMMERCE_MORENO_SECRET=cs_91078f1077667a7d75d6f9b610bd88de7a95e35e

# Sucursal 19 - Maschwitz
ENV WOOCOMMERCE_MASCHWITZ_SUCURSAL_ID=19
ENV WOOCOMMERCE_MASCHWITZ_NOMBRE=Maschwitz
ENV WOOCOMMERCE_MASCHWITZ_URL=https://vd.com.ar/ingeniero-maschwitz/
ENV WOOCOMMERCE_MASCHWITZ_KEY=ck_810b9f4596d339b16c4ef1c89da0f15fe9939c57
ENV WOOCOMMERCE_MASCHWITZ_SECRET=cs_683b0fdcf48623fa3ddb6044bdf9e46d26c7dc4a

# Sucursal 20 - General Roca
ENV WOOCOMMERCE_GRALROCA_SUCURSAL_ID=20
ENV WOOCOMMERCE_GRALROCA_NOMBRE="General Roca"
ENV WOOCOMMERCE_GRALROCA_URL=https://vd.com.ar/general-roca/
ENV WOOCOMMERCE_GRALROCA_KEY=ck_4f64a68d59e68597368a891842b83f1dfd818c05
ENV WOOCOMMERCE_GRALROCA_SECRET=cs_4013d3287a1c0b8d988e4c02f2188adc9e00a100

# Sucursal 21 - Posadas
ENV WOOCOMMERCE_POSADAS_SUCURSAL_ID=21
ENV WOOCOMMERCE_POSADAS_NOMBRE=Posadas
ENV WOOCOMMERCE_POSADAS_URL=https://vd.com.ar/posadas/
ENV WOOCOMMERCE_POSADAS_KEY=ck_16ac68f8e7e14b3f3b60cf9c3e9ece7952b5af1e
ENV WOOCOMMERCE_POSADAS_SECRET=cs_a9c1f6e41314e71337b181fa9d521922885cc0a0

# Sucursal 22 - Trelew
ENV WOOCOMMERCE_TRELEW_SUCURSAL_ID=22
ENV WOOCOMMERCE_TRELEW_NOMBRE=Trelew
ENV WOOCOMMERCE_TRELEW_URL=https://vd.com.ar/trelew/
ENV WOOCOMMERCE_TRELEW_KEY=ck_151bd04d6cc4147be15fea20e9fba399a558172b
ENV WOOCOMMERCE_TRELEW_SECRET=cs_2636aa207b33d5d5ff834bae5ec4173503c0c0fa

# Sucursal 23 - Jujuy
ENV WOOCOMMERCE_JUJUY_SUCURSAL_ID=23
ENV WOOCOMMERCE_JUJUY_NOMBRE=Jujuy
ENV WOOCOMMERCE_JUJUY_URL=https://vd.com.ar/jujuy/
ENV WOOCOMMERCE_JUJUY_KEY=ck_52e00943c1f64c99f483c0b3fb74f0cf6d866645
ENV WOOCOMMERCE_JUJUY_SECRET=cs_ed630f6f86763503ac2c0a3775683e506c8748cd

# Sucursal 24 - Chacabuco (ACTIVA)
ENV WOOCOMMERCE_CHACABUCO_SUCURSAL_ID=24
ENV WOOCOMMERCE_CHACABUCO_NOMBRE=Chacabuco
ENV WOOCOMMERCE_CHACABUCO_URL=https://vd.com.ar/
ENV WOOCOMMERCE_CHACABUCO_KEY=ck_2ebb13760100741f2da793984ae114e2cf588114
ENV WOOCOMMERCE_CHACABUCO_SECRET=cs_b808157442282d9aa1b023f2052e7c48285f516f

# ============================================
# CONFIGURACIÓN CENTRALIZADA DE PERFORMANCE
# ============================================

# Configuración de concurrencia y paralelismo
ENV CONFIG_SUCURSALES_PARALELAS=10
ENV CONFIG_BATCHES_PARALELOS_POR_SUCURSAL=6
ENV CONFIG_IMAGENES_PARALELAS=1000
ENV CONFIG_BUSQUEDAS_PARALELAS_UPDATES=5

# Configuración de tamaños de batch
ENV CONFIG_BATCH_SIZE_CREACION=50
ENV CONFIG_BATCH_SIZE_ACTUALIZACION=25
ENV CONFIG_BATCH_SIZE_ELIMINACION=100
ENV CONFIG_BATCH_SIZE_PAGINACION_SKUS=100
ENV CONFIG_BATCH_SIZE_RETRY=20

# Configuración de timeouts y delays (en milisegundos)
ENV CONFIG_WOOCOMMERCE_TIMEOUT=300000
ENV CONFIG_IMAGE_VERIFICATION_TIMEOUT=5000
ENV CONFIG_RETRY_BASE_DELAY=2000
ENV CONFIG_CHUNKS_DELAY_SUCURSALES=2000
ENV CONFIG_SKU_FETCH_DELAY=100
ENV CONFIG_UPDATE_SEARCH_CHUNK_DELAY=100
ENV CONFIG_DELETE_BATCH_DELAY=300
ENV CONFIG_SERVER_OVERLOAD_DELAY=10000
ENV CONFIG_RATE_LIMIT_DELAY=5000

# Configuración de reintentos y límites
ENV CONFIG_MAX_RETRIES=3
ENV CONFIG_MAX_RESPONSE_TIMES_TRACKED=5
ENV CONFIG_MAX_RETRIES_SERVER_ERROR=5
ENV CONFIG_BACKOFF_MULTIPLIER=1.5
ENV CONFIG_AXIOS_RETRY_ATTEMPTS=4
ENV CONFIG_AXIOS_RETRY_DELAY=2000

# Configuración de delays adaptativos
ENV CONFIG_MIN_DELAY=500
ENV CONFIG_MAX_DELAY=3000
ENV CONFIG_RESPONSE_TIME_MULTIPLIER=0.3
ENV CONFIG_CHUNK_DELAY_MULTIPLIER=0.2
ENV CONFIG_CHUNK_MIN_DELAY=300
ENV CONFIG_CHUNK_MAX_DELAY=1500
ENV CONFIG_UPDATE_DELAY_DIVISOR=2
ENV CONFIG_OVERLOAD_MULTIPLIER=2

# URLs y rutas
ENV CONFIG_FALLBACK_IMAGE=https://vd.com.ar/images/0000.png
ENV CONFIG_IMAGE_BASE_URL=https://vd.com.ar/images/

# Configuración de archivos y extensiones
ENV CONFIG_JSON_EXTENSION=.json

# Configuración de campos WooCommerce
ENV CONFIG_WOOCOMMERCE_VERSION=wc/v3
ENV CONFIG_PRODUCT_TYPE=simple
ENV CONFIG_PRODUCT_STATUS=publish
ENV CONFIG_STOCK_STATUS=instock
ENV CONFIG_SKU_FIELD_ONLY=sku
ENV CONFIG_HTTP_METHOD_HEAD=HEAD
ENV CONFIG_DELETE_PAGE=1

# Patrones de error (separados por comas)
ENV CONFIG_CONNECTION_ERRORS="socket hang up,ECONNRESET,timeout"
ENV CONFIG_SERVER_OVERLOAD_ERRORS="503,502,504,500"
ENV CONFIG_RATE_LIMIT_ERRORS="429"

# Configurar zona horaria
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Cambiar a usuario no-root
USER yaguar

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "dist/index.js"]





# ============================================
# SUBIR A DOCKER HUB
# ============================================
# Construir la imagen (ejecutar en terminal)
# docker build -t yaguar-sync .

# Etiquetar la imagen (reemplazar USERNAME por tu usuario de Docker Hub)
# docker tag yaguar-sync joelnicolass/yaguar-sync:latest

# Iniciar sesión en Docker Hub (ejecutar en terminal)
# docker login
# Subir la imagen a Docker Hub (ejecutar en terminal)
# docker push joelnicolass/yaguar-sync:latest
# ============================================

# ============================================
# EJECUTAR LOCALMENTE
# ============================================
# Ejecutar el contenedor (ejecutar en terminal)
# docker run -d --name yaguar-sync -p 3000:3000 \
# Usando las variables por defecto del Dockerfile
# docker run -p 3000:3000 yaguar-sync

# O sobrescribiendo variables específicas
#docker run -p 3000:3000 \
#  -e WOOCOMMERCE_URL="https://tu-tienda.com" \
#  -e WOOCOMMERCE_CONSUMER_KEY="tu_key" \
#  -e WOOCOMMERCE_CONSUMER_SECRET="tu_secret" \
#  yaguar-sync

# O usando tu archivo .env actual
# docker run -p 3000:3000 --env-file .env yaguar-sync



# Conexión SSH al servidor
# ssh root@IP_DEL_SERVIDOR

# Verificar Docker instalado
# docker --version

# (Si no está instalado)
# apt update && apt install -y docker.io

# Descargar imagen de Godot desde Docker Hub
# docker pull joelnicolass/yaguar-sync:latest

# Correr el contenedor
# docker run -d --name nombre-servidor -p 3000:3000 usuario/repositorio

# Verificar y seguir logs
# docker ps
# docker logs -f nombre-servidor


# Detener y eliminar contenedor e imagen (si es necesario)
# docker stop nombre-servidora
# correr el contenedor nuevamente
# docker run -d --name nombre-servidor -p 3000:3000

# descargar archivo de imagen de docker para subir a servidor sin internet
# docker save -o yaguar-sync.tar joelnicolass/yaguar-sync

# amd64
# docker buildx build --platform linux/amd64 -t yaguar-sync:amd64 --load .
# docker save -o yaguar-sync_amd64.tar yaguar-sync:amd64

# arm64
# docker buildx build --platform linux/arm64 -t yaguar-sync:arm64 --load .
# docker save -o yaguar-sync_arm64.tar yaguar-sync:arm64