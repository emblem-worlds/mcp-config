declare module '../../env-loader.js' {
  export function loadConfig(path: string): Promise<Record<string, string>>;
}
