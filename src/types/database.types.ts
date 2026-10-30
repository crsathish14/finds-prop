// Placeholder until Stage 3. Replace by running `npm run gen:types` against the local stack once
// the migrations exist. The file is generated: do not edit it by hand (CI diffs it, gate G-07).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
