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
ENV SFTP_HOST=test.rebex.net
ENV SFTP_USER=demo
ENV SFTP_PASSWORD=password
ENV SFTP_PORT=22
ENV SFTP_TIMEOUT=30000

# Variables de entorno para Cron
ENV SYNC_CRON_SCHEDULE="0 3 * * *"

# Variables de entorno para Logging
ENV LOG_MAX_SIZE=10m
ENV LOG_MAX_FILES=5

# Variables de entorno para WooCommerce
ENV WOOCOMMERCE_URL=""
ENV WOOCOMMERCE_CONSUMER_KEY=""
ENV WOOCOMMERCE_CONSUMER_SECRET=""
ENV WOOCOMMERCE_VERSION=wc/v3

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
# docker tag yaguar-sync joelsartori/yaguar-sync:latest

# Iniciar sesión en Docker Hub (ejecutar en terminal)
# docker login
# Subir la imagen a Docker Hub (ejecutar en terminal)
# docker push joelsartori/yaguar-sync:latest
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
# docker pull usuario/repositorio

# Correr el contenedor
# docker run -d --name nombre-servidor -p 3000:3000 usuario/repositorio

# Verificar y seguir logs
# docker ps
# docker logs -f nombre-servidor


# Detener y eliminar contenedor e imagen (si es necesario)
# docker stop nombre-servidora
# docker rm nombre-servidor
# docker rmi usuario/repositorio:latest

# Eliminar todos los contenedores detenidos
# docker rm $(docker ps -a -q)

# Eliminar todas las imágenes
# docker rmi $(docker images -a -q)