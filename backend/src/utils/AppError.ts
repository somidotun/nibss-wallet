class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);

    // Fix for ES Modules — ensures message is set correctly
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? "error" : "fail";
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
