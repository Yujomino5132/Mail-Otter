class EnvParser {
  public static positiveInt(env: unknown, key: string, defaultValue: string): number {
    const value = EnvParser.readString(env, key);
    const parsed = Number(value ?? defaultValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : Number(defaultValue);
  }

  public static nonNegativeInt(env: unknown, key: string, defaultValue: string): number {
    const value = EnvParser.readString(env, key);
    const parsed = Number(value ?? defaultValue);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : Number(defaultValue);
  }

  public static string(env: unknown, key: string, defaultValue: string): string {
    return EnvParser.readString(env, key) ?? defaultValue;
  }

  public static boolean(env: unknown, key: string, defaultValue: string): boolean {
    return (EnvParser.readString(env, key) ?? defaultValue) === 'true';
  }

  private static readString(env: unknown, key: string): string | undefined {
    return (env as Record<string, string | undefined>)[key];
  }
}

export { EnvParser };
