// Debug-gated logging. Production paths must never call console.log directly
// (the "why did my key do nothing?" complaints deserve a switch, not a flood).

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

let debugEnabled = false;

/** Enable/disable the debug channel (driven by settings.debug.enabled). */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export function isDebugEnabled(): boolean {
  return debugEnabled;
}

const PREFIX = "[Kestrel]";

/**
 * Create a namespaced logger. `debug`/`info` are silent unless debug mode is
 * on; `warn`/`error` always surface so real problems are never swallowed.
 */
export function createLogger(namespace: string): Logger {
  const tag = `${PREFIX} ${namespace}:`;
  return {
    debug(...args: unknown[]): void {
      if (debugEnabled) console.debug(tag, ...args);
    },
    info(...args: unknown[]): void {
      if (debugEnabled) console.info(tag, ...args);
    },
    warn(...args: unknown[]): void {
      console.warn(tag, ...args);
    },
    error(...args: unknown[]): void {
      console.error(tag, ...args);
    },
  };
}
