declare module './env-loader.js' {
  export const loadConfig: (path: string) => Promise<Record<string, any>>;
}
