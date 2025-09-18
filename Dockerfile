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
ENV SFTP_PASSWORD=aB6_o?kc2JlcSu5ol
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

# Sucursal 3 - Campana
ENV WOOCOMMERCE_CAMPANA_SUCURSAL_ID=3
ENV WOOCOMMERCE_CAMPANA_NOMBRE=Campana
ENV WOOCOMMERCE_CAMPANA_URL=https://campana.example.com
ENV WOOCOMMERCE_CAMPANA_KEY=ck_campana_key
ENV WOOCOMMERCE_CAMPANA_SECRET=cs_campana_secret

# Sucursal 4 - José C. Paz
ENV WOOCOMMERCE_JOSECPAZ_SUCURSAL_ID=4
ENV WOOCOMMERCE_JOSECPAZ_NOMBRE="José C. Paz"
ENV WOOCOMMERCE_JOSECPAZ_URL=https://josecpaz.example.com
ENV WOOCOMMERCE_JOSECPAZ_KEY=ck_josecpaz_key
ENV WOOCOMMERCE_JOSECPAZ_SECRET=cs_josecpaz_secret

# Sucursal 5 - Santa Fe
ENV WOOCOMMERCE_SANTAFE_SUCURSAL_ID=5
ENV WOOCOMMERCE_SANTAFE_NOMBRE="Santa Fe"
ENV WOOCOMMERCE_SANTAFE_URL=https://santafe.example.com
ENV WOOCOMMERCE_SANTAFE_KEY=ck_santafe_key
ENV WOOCOMMERCE_SANTAFE_SECRET=cs_santafe_secret

# Sucursal 6 - Córdoba
ENV WOOCOMMERCE_CORDOBA_SUCURSAL_ID=6
ENV WOOCOMMERCE_CORDOBA_NOMBRE=Córdoba
ENV WOOCOMMERCE_CORDOBA_URL=https://cordoba.example.com
ENV WOOCOMMERCE_CORDOBA_KEY=ck_cordoba_key
ENV WOOCOMMERCE_CORDOBA_SECRET=cs_cordoba_secret

# Sucursal 8 - Neuquén
ENV WOOCOMMERCE_NEUQUEN_SUCURSAL_ID=8
ENV WOOCOMMERCE_NEUQUEN_NOMBRE=Neuquén
ENV WOOCOMMERCE_NEUQUEN_URL=https://neuquen.example.com
ENV WOOCOMMERCE_NEUQUEN_KEY=ck_neuquen_key
ENV WOOCOMMERCE_NEUQUEN_SECRET=cs_neuquen_secret

# Sucursal 9 - Salta
ENV WOOCOMMERCE_SALTA_SUCURSAL_ID=9
ENV WOOCOMMERCE_SALTA_NOMBRE=Salta
ENV WOOCOMMERCE_SALTA_URL=https://salta.example.com
ENV WOOCOMMERCE_SALTA_KEY=ck_salta_key
ENV WOOCOMMERCE_SALTA_SECRET=cs_salta_secret

# Sucursal 10 - Autopista (ACTIVA)
ENV WOOCOMMERCE_AUTOPISTA_SUCURSAL_ID=10
ENV WOOCOMMERCE_AUTOPISTA_NOMBRE=Autopista
ENV WOOCOMMERCE_AUTOPISTA_URL=https://vd.com.ar/autopista/
ENV WOOCOMMERCE_AUTOPISTA_KEY=ck_b8b7f2a38e22994892730e89183dffa93e2b5ce8
ENV WOOCOMMERCE_AUTOPISTA_SECRET=cs_4d33915c9a51648c93ef33a25f6e7cc8a205537b

# Sucursal 12 - Mar del Plata
ENV WOOCOMMERCE_MARDELPLATA_SUCURSAL_ID=12
ENV WOOCOMMERCE_MARDELPLATA_NOMBRE="Mar del Plata"
ENV WOOCOMMERCE_MARDELPLATA_URL=https://mardelplata.example.com
ENV WOOCOMMERCE_MARDELPLATA_KEY=ck_mardelplata_key
ENV WOOCOMMERCE_MARDELPLATA_SECRET=cs_mardelplata_secret

# Sucursal 13 - Bahía Blanca
ENV WOOCOMMERCE_BAHIABLANCA_SUCURSAL_ID=13
ENV WOOCOMMERCE_BAHIABLANCA_NOMBRE="Bahía Blanca"
ENV WOOCOMMERCE_BAHIABLANCA_URL=https://bahiablanca.example.com
ENV WOOCOMMERCE_BAHIABLANCA_KEY=ck_bahiablanca_key
ENV WOOCOMMERCE_BAHIABLANCA_SECRET=cs_bahiablanca_secret

# Sucursal 14 - Mendoza
ENV WOOCOMMERCE_MENDOZA_SUCURSAL_ID=14
ENV WOOCOMMERCE_MENDOZA_NOMBRE=Mendoza
ENV WOOCOMMERCE_MENDOZA_URL=https://mendoza.example.com
ENV WOOCOMMERCE_MENDOZA_KEY=ck_mendoza_key
ENV WOOCOMMERCE_MENDOZA_SECRET=cs_mendoza_secret

# Sucursal 15 - Chaco
ENV WOOCOMMERCE_CHACO_SUCURSAL_ID=15
ENV WOOCOMMERCE_CHACO_NOMBRE=Chaco
ENV WOOCOMMERCE_CHACO_URL=https://chaco.example.com
ENV WOOCOMMERCE_CHACO_KEY=ck_chaco_key
ENV WOOCOMMERCE_CHACO_SECRET=cs_chaco_secret

# Sucursal 16 - San Juan
ENV WOOCOMMERCE_SANJUAN_SUCURSAL_ID=16
ENV WOOCOMMERCE_SANJUAN_NOMBRE="San Juan"
ENV WOOCOMMERCE_SANJUAN_URL=https://sanjuan.example.com
ENV WOOCOMMERCE_SANJUAN_KEY=ck_sanjuan_key
ENV WOOCOMMERCE_SANJUAN_SECRET=cs_sanjuan_secret

# Sucursal 18 - Moreno
ENV WOOCOMMERCE_MORENO_SUCURSAL_ID=18
ENV WOOCOMMERCE_MORENO_NOMBRE=Moreno
ENV WOOCOMMERCE_MORENO_URL=https://moreno.example.com
ENV WOOCOMMERCE_MORENO_KEY=ck_moreno_key
ENV WOOCOMMERCE_MORENO_SECRET=cs_moreno_secret

# Sucursal 19 - Maschwitz
ENV WOOCOMMERCE_MASCHWITZ_SUCURSAL_ID=19
ENV WOOCOMMERCE_MASCHWITZ_NOMBRE=Maschwitz
ENV WOOCOMMERCE_MASCHWITZ_URL=https://maschwitz.example.com
ENV WOOCOMMERCE_MASCHWITZ_KEY=ck_maschwitz_key
ENV WOOCOMMERCE_MASCHWITZ_SECRET=cs_maschwitz_secret

# Sucursal 20 - General Roca
ENV WOOCOMMERCE_GRALROCA_SUCURSAL_ID=20
ENV WOOCOMMERCE_GRALROCA_NOMBRE="General Roca"
ENV WOOCOMMERCE_GRALROCA_URL=https://gralroca.example.com
ENV WOOCOMMERCE_GRALROCA_KEY=ck_gralroca_key
ENV WOOCOMMERCE_GRALROCA_SECRET=cs_gralroca_secret

# Sucursal 21 - Posadas
ENV WOOCOMMERCE_POSADAS_SUCURSAL_ID=21
ENV WOOCOMMERCE_POSADAS_NOMBRE=Posadas
ENV WOOCOMMERCE_POSADAS_URL=https://posadas.example.com
ENV WOOCOMMERCE_POSADAS_KEY=ck_posadas_key
ENV WOOCOMMERCE_POSADAS_SECRET=cs_posadas_secret

# Sucursal 22 - Trelew
ENV WOOCOMMERCE_TRELEW_SUCURSAL_ID=22
ENV WOOCOMMERCE_TRELEW_NOMBRE=Trelew
ENV WOOCOMMERCE_TRELEW_URL=https://trelew.example.com
ENV WOOCOMMERCE_TRELEW_KEY=ck_trelew_key
ENV WOOCOMMERCE_TRELEW_SECRET=cs_trelew_secret

# Sucursal 23 - Jujuy
ENV WOOCOMMERCE_JUJUY_SUCURSAL_ID=23
ENV WOOCOMMERCE_JUJUY_NOMBRE=Jujuy
ENV WOOCOMMERCE_JUJUY_URL=https://jujuy.example.com
ENV WOOCOMMERCE_JUJUY_KEY=ck_jujuy_key
ENV WOOCOMMERCE_JUJUY_SECRET=cs_jujuy_secret

# Sucursal 24 - Chacabuco (ACTIVA)
ENV WOOCOMMERCE_CHACABUCO_SUCURSAL_ID=24
ENV WOOCOMMERCE_CHACABUCO_NOMBRE=Chacabuco
ENV WOOCOMMERCE_CHACABUCO_URL=https://vd.com.ar/
ENV WOOCOMMERCE_CHACABUCO_KEY=ck_2ebb13760100741f2da793984ae114e2cf588114
ENV WOOCOMMERCE_CHACABUCO_SECRET=cs_b808157442282d9aa1b023f2052e7c48285f516f

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