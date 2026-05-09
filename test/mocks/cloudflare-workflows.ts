class NonRetryableError extends Error {
  constructor(message: string, name?: string | undefined) {
    super(message);
    this.name = name || 'NonRetryableError';
  }
}

export { NonRetryableError };
