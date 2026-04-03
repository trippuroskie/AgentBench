/// <reference types="vite/client" />

declare namespace process {
  interface Env {
    OPENROUTER_API_KEY: string;
    LANGFUSE_PUBLIC_KEY: string;
    LANGFUSE_SECRET_KEY: string;
    LANGFUSE_HOST: string;
    OLLAMA_BASE_URL: string;
  }
  const env: Env;
}
