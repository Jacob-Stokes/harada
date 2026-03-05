import { Response } from 'express';

export function ok(res: Response, data: any, status = 200) {
  return res.status(status).json({ success: true, data, error: null });
}

export function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, data: null, error });
}

export function serverError(res: Response, error: unknown) {
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : (error as Error).message;
  return res.status(500).json({ success: false, data: null, error: message });
}
