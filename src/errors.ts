export class HebrahApiError extends Error {
  readonly name = 'HebrahApiError'

  constructor(
    message: string,
    readonly status: number,
    readonly detail?: string
  ) {
    super(message)
  }
}
