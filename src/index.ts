import startServer from "./app";
import logger from "./utils/logger";

// Iniciar el servidor
logger.info("🎯 Iniciando Yaguar Sync Service...");

startServer().catch((error) => {
  logger.error("Error fatal al iniciar la aplicación:", error);
  process.exit(1);
});
