export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const BadRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const Unauthorized = (m = "Unauthorized") => new HttpError(401, m);
export const Forbidden = (m = "Forbidden") => new HttpError(403, m);
export const NotFound = (m = "Not found") => new HttpError(404, m);
export const Conflict = (m: string) => new HttpError(409, m);
export const TooMany = (m = "Too many requests") => new HttpError(429, m);
