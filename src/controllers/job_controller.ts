/**
 * Job Controller - Manejo de trabajos asíncronos
 * Permite ejecutar operaciones de larga duración sin timeouts
 */

import crypto from 'crypto';
import logger from '../utils/logger';

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
  metadata?: any;
}

class JobController {
  private jobs: Map<string, JobStatus> = new Map();

  /**
   * Crear un nuevo job y ejecutarlo en background
   */
  public createJob(
    jobFunction: () => Promise<any>,
    metadata?: any
  ): string {
    const jobId = this.generateJobId();
    
    const job: JobStatus = {
      id: jobId,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      metadata
    };

    this.jobs.set(jobId, job);

    // Ejecutar en background
    this.executeJobInBackground(jobId, jobFunction);

    logger.info('📋 Nuevo job creado', { jobId, metadata });
    return jobId;
  }

  /**
   * Generar ID único para job
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Obtener el estado de un job
   */
  public getJobStatus(jobId: string): JobStatus | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Listar todos los jobs
   */
  public getAllJobs(): JobStatus[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Actualizar el progreso de un job
   */
  public updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.progress = Math.min(100, Math.max(0, progress));
      job.status = progress >= 100 ? 'completed' : 'running';
      this.jobs.set(jobId, job);
    }
  }

  /**
   * Marcar job como completado
   */
  public completeJob(jobId: string, result: any): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.endTime = new Date();
      job.result = result;
      this.jobs.set(jobId, job);
      
      logger.info('✅ Job completado', { 
        jobId, 
        duration: job.endTime.getTime() - job.startTime.getTime() 
      });
    }
  }

  /**
   * Marcar job como fallido
   */
  public failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.endTime = new Date();
      job.error = error;
      this.jobs.set(jobId, job);
      
      logger.error('❌ Job fallido', { jobId, error });
    }
  }

  /**
   * Ejecutar job en background
   */
  private async executeJobInBackground(
    jobId: string,
    jobFunction: () => Promise<any>
  ): Promise<void> {
    try {
      const job = this.jobs.get(jobId);
      if (!job) return;

      job.status = 'running';
      this.jobs.set(jobId, job);

      const result = await jobFunction();
      this.completeJob(jobId, result);
    } catch (error) {
      this.failJob(jobId, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Limpiar jobs antiguos (más de 1 hora)
   */
  public cleanupOldJobs(): number {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.startTime < oneHourAgo && 
          (job.status === 'completed' || job.status === 'failed')) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('🧹 Jobs antiguos limpiados', { count: cleanedCount });
    }

    return cleanedCount;
  }
}

// Singleton instance
export const jobController = new JobController();

// Limpiar jobs antiguos cada hora
setInterval(() => {
  jobController.cleanupOldJobs();
}, 60 * 60 * 1000);

export default jobController;
