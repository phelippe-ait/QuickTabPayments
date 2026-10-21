/**
 * Database types.
 *
 * Hand-maintained for now; once tables stabilise regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/shared/lib/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: { id: string; slug: string; name: string; is_active: boolean };
        Insert: { id?: string; slug: string; name: string; is_active?: boolean };
        Update: { id?: string; slug?: string; name?: string; is_active?: boolean };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          role: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          role?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["name"];
          },
        ];
      };
      roles: {
        Row: {
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          table_id: string | null;
          customer_id: string | null;
          order_number: string;
          status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          subtotal: number;
          tax: number;
          total: number;
          notes: string | null;
          pickup_time_estimate: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          table_id?: string | null;
          customer_id?: string | null;
          order_number: string;
          status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          subtotal?: number;
          tax?: number;
          total?: number;
          notes?: string | null;
          pickup_time_estimate?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          table_id?: string | null;
          customer_id?: string | null;
          order_number?: string;
          status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
          subtotal?: number;
          tax?: number;
          total?: number;
          notes?: string | null;
          pickup_time_estimate?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
