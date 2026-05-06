abstract class AbstractQueueWorker {
  protected printExecId(): string {
    const execId: string = crypto.randomUUID();
    console.log('Worker Execution ID:', execId);
    return execId;
  }

  public async queue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void> {
    this.printExecId();
    console.log('Worker triggered by Queue batch');
    try {
      await this.onQueue(batch, env, ctx);
    } catch (err: unknown) {
      console.error('Unhandled error in queue():', err);
      throw err;
    }
  }

  protected abstract onQueue(batch: MessageBatch<unknown>, env: Env, ctx: ExecutionContext): Promise<void>;
}

export { AbstractQueueWorker };
