export interface AppError extends Error {
  statusCode?: number
}

export class IntegrationDisabledError extends Error implements AppError {
  statusCode: number

  constructor(message: string) {
    super(message)
    this.statusCode = 410
  }
}
