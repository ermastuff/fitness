import { z } from 'zod';

export const HealthCheckSchema = z.object({
  status: z.literal('ok'),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;
