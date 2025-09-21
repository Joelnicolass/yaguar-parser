# Guía de Uso Seguro para Importación Masiva

## 🛡️ PROCEDIMIENTO SEGURO DE IMPORTACIÓN

### Paso 1: Backup Previo (OBLIGATORIO)
```bash
# Crear backup completo antes de importar
php backup_antes_importacion.php 4 backup

# Esto creará:
# - backup_blog_4_2025-09-21_14-30-00.sql
# - punto_restauracion_blog_4_2025-09-21_14-30-00.json
```

### Paso 2: Importación en Modo Seguro
```bash
# Importar con validaciones automáticas
php importar_masivo_sql.php 4 /ruta/archivo.json

# El script ahora incluye:
# ✅ Backup automático
# ✅ Validaciones de integridad
# ✅ Rollback automático si falla validación
```

### Paso 3: Verificación Post-Importación
```bash
# Validar resultados
php validar_importacion.php 4
```

## 🚨 ESTRATEGIAS DE ROLLBACK

### 1. Rollback por Timestamp (Más Común)
```bash
# Eliminar productos creados después de una fecha/hora específica
php rollback_emergencia.php 4 timestamp "2025-09-21 14:00:00"

# Eliminar productos de la última hora
php rollback_emergencia.php 4 timestamp "$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')"
```

### 2. Rollback por SKUs Específicos
```bash
# Eliminar productos específicos por SKU
php rollback_emergencia.php 4 skus "SKU001,SKU002,SKU003"
```

### 3. Rollback Completo (PELIGROSO)
```bash
# ELIMINA TODOS LOS PRODUCTOS - Solo en emergencias
php rollback_emergencia.php 4 completo
# Requiere confirmación: "ELIMINAR TODO"
```

### 4. Restauración desde Backup
```bash
# Restaurar desde archivo de backup específico
php backup_antes_importacion.php 4 restaurar /ruta/backup_blog_4_2025-09-21_14-30-00.sql
```

## 📋 CHECKLIST DE SEGURIDAD

### Antes de Importar:
- [ ] ✅ Backup de base de datos creado
- [ ] ✅ Archivo JSON validado
- [ ] ✅ Espacio en disco suficiente
- [ ] ✅ Conexión estable a base de datos
- [ ] ✅ Horario de baja actividad elegido

### Durante la Importación:
- [ ] ✅ Monitorear logs de errores
- [ ] ✅ Verificar memoria del servidor
- [ ] ✅ No interrumpir el proceso

### Después de Importar:
- [ ] ✅ Validar integridad de datos
- [ ] ✅ Verificar productos en frontend
- [ ] ✅ Comprobar cache de WooCommerce
- [ ] ✅ Revisar logs de errores

## 🔍 COMANDOS DE VERIFICACIÓN

### Contar Productos
```bash
# Ver estado actual de productos
mysql -e "SELECT COUNT(*) as total_productos FROM EWJW2_4_posts WHERE post_type='product';"
```

### Verificar Últimos Productos
```bash
# Ver últimos 10 productos creados
mysql -e "SELECT ID, post_title, post_date FROM EWJW2_4_posts WHERE post_type='product' ORDER BY post_date DESC LIMIT 10;"
```

### Productos Sin SKU (Problema Común)
```bash
# Detectar productos sin SKU
php -r "
require 'wp-load.php';
global \$wpdb;
\$sin_sku = \$wpdb->get_var('SELECT COUNT(*) FROM EWJW2_4_posts p LEFT JOIN EWJW2_4_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = \"_sku\" WHERE p.post_type = \"product\" AND (pm.meta_value IS NULL OR pm.meta_value = \"\")');
echo \"Productos sin SKU: \$sin_sku\n\";
"
```

## ⚡ COMANDOS DE EMERGENCIA RÁPIDA

### Parar Importación en Proceso
```bash
# Buscar proceso PHP
ps aux | grep importar_masivo

# Terminar proceso (reemplazar PID)
kill -TERM [PID]
```

### Rollback de Últimos 30 Minutos
```bash
php rollback_emergencia.php 4 timestamp "$(date -d '30 minutes ago' '+%Y-%m-%d %H:%M:%S')"
```

### Verificación Rápida de Integridad
```bash
# Contar discrepancias rápidas
mysql -e "
SELECT 
  (SELECT COUNT(*) FROM EWJW2_4_posts WHERE post_type='product') as total_posts,
  (SELECT COUNT(DISTINCT post_id) FROM EWJW2_4_postmeta WHERE meta_key='_sku') as con_sku,
  (SELECT COUNT(*) FROM EWJW2_4_wc_product_meta_lookup) as en_cache;
"
```

## 📞 CONTACTO DE EMERGENCIA

Si algo sale mal:
1. 🛑 **PARAR** inmediatamente la importación
2. 📸 **CAPTURAR** logs de error
3. 🔄 **EJECUTAR** rollback por timestamp
4. 📧 **CONTACTAR** al administrador del sistema

## 💡 MEJORES PRÁCTICAS

1. **Siempre hacer backup antes de importar**
2. **Probar con datasets pequeños primero**
3. **Importar en horarios de baja actividad**
4. **Monitorear uso de recursos durante importación**
5. **Validar datos antes y después**
6. **Mantener logs detallados**
7. **Tener plan de rollback listo**

---
*Recuerda: Es mejor prevenir que curar. Un backup de 5 minutos puede ahorrarte horas de trabajo.*