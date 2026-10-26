export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }
}

export const notFound = (what: string) => new AppError('not_found', 404, `${what} not found`);
export const badRequest = (message: string) => new AppError('invalid_input', 400, message);
export const forbidden = (message = 'Not allowed') => new AppError('forbidden', 403, message);
export const conflict = (code: string, message: string) => new AppError(code, 409, message);
