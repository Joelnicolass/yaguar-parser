# Imagen base optimizada para Node.js
FROM node:18-alpine

# Configuración de zona horaria Argentina
RUN apk add --no-cache tzdata
ENV TZ=America/Argentina/Buenos_Aires

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && npm cache clean --force

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Crear directorios necesarios
RUN mkdir -p logs temp

# Cambiar ownership de los archivos
RUN chown -R nextjs:nodejs /app
USER nextjs

# Puerto de exposición
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de inicio
CMD ["npm", "run", "start"]