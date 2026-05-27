class RetryableError extends Error {
  public readonly retryable = true;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export { RetryableError };
