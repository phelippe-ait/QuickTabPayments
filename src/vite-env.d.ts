/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL, e.g. https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase publishable (anon) key — safe to expose in the browser. */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Restaurant slug used by the customer checkout. Defaults to quicktab-demo-cafe. */
  readonly VITE_RESTAURANT_SLUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
