class NonRetryableError extends Error {
  public readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export { NonRetryableError };
