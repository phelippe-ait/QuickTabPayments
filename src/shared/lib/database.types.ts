/**
 * Database types.
 *
 * Generated from the linked Supabase project:
 *
 *   npx supabase gen types typescript --linked > /tmp/generated.types.ts
 *
 * then POST-FIXED by hand: the generated `Database` object is kept verbatim,
 * while the `PublicSchema` block and shorthand exports below are maintained
 * locally because `gen types` does not emit them.
 *
 * Regenerate whenever a migration changes the schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      menu_categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_modifier_groups: {
        Row: {
          display_order: number
          menu_item_id: string
          modifier_group_id: string
        }
        Insert: {
          display_order?: number
          menu_item_id: string
          modifier_group_id: string
        }
        Update: {
          display_order?: number
          menu_item_id?: string
          modifier_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_modifier_groups_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_modifier_groups_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[]
          category_id: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          prep_time_minutes: number
          price: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          allergens?: string[]
          category_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          prep_time_minutes?: number
          price: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          allergens?: string[]
          category_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          prep_time_minutes?: number
          price?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifier_groups: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          max_selections: number
          min_selections: number
          name: string
          restaurant_id: string
          selection_type: Database["public"]["Enums"]["modifier_selection"]
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name: string
          restaurant_id: string
          selection_type?: Database["public"]["Enums"]["modifier_selection"]
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          max_selections?: number
          min_selections?: number
          name?: string
          restaurant_id?: string
          selection_type?: Database["public"]["Enums"]["modifier_selection"]
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          display_order: number
          id: string
          is_available: boolean
          modifier_group_id: string
          name: string
          price_adjustment: number
        }
        Insert: {
          display_order?: number
          id?: string
          is_available?: boolean
          modifier_group_id: string
          name: string
          price_adjustment?: number
        }
        Update: {
          display_order?: number
          id?: string
          is_available?: boolean
          modifier_group_id?: string
          name?: string
          price_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_modifier_group_id_fkey"
            columns: ["modifier_group_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_modifiers: {
        Row: {
          id: string
          modifier_id: string
          modifier_name_snapshot: string
          order_item_id: string
          price_adjustment_snapshot: number
        }
        Insert: {
          id?: string
          modifier_id: string
          modifier_name_snapshot: string
          order_item_id: string
          price_adjustment_snapshot?: number
        }
        Update: {
          id?: string
          modifier_id?: string
          modifier_name_snapshot?: string
          order_item_id?: string
          price_adjustment_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_modifier_id_fkey"
            columns: ["modifier_id"]
            isOneToOne: false
            referencedRelation: "modifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          item_name_snapshot: string
          menu_item_id: string
          notes: string | null
          order_id: string
          quantity: number
          subtotal: number
          unit_price_snapshot: number
        }
        Insert: {
          id?: string
          item_name_snapshot: string
          menu_item_id: string
          notes?: string | null
          order_id: string
          quantity: number
          subtotal: number
          unit_price_snapshot: number
        }
        Update: {
          id?: string
          item_name_snapshot?: string
          menu_item_id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          subtotal?: number
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          completed_at: string | null
          created_at: string
          customer_id: string | null
          customer_name_snapshot: string | null
          id: string
          notes: string | null
          order_number: string
          pickup_time_estimate: string | null
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          table_id: string | null
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          id?: string
          notes?: string | null
          order_number: string
          pickup_time_estimate?: string | null
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          pickup_time_estimate?: string | null
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          table_id?: string | null
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          order_id: string
          paid_at: string | null
          payment_method_type:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method_type?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      qr_sessions: {
        Row: {
          expires_at: string
          id: string
          last_seen_at: string
          session_token: string
          started_at: string
          table_id: string
        }
        Insert: {
          expires_at?: string
          id?: string
          last_seen_at?: string
          session_token?: string
          started_at?: string
          table_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          last_seen_at?: string
          session_token?: string
          started_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          order_item_id: string | null
          payment_id: string
          quantity: number | null
          reason: string | null
          status: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          payment_id: string
          quantity?: number | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          payment_id?: string
          quantity?: number | null
          reason?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          stripe_refund_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_invites: {
        Row: {
          accepted_at: string | null
          accepted_restaurant_id: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          restaurant_name: string
          restaurant_slug: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_restaurant_id?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_name: string
          restaurant_slug: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_restaurant_id?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_name?: string
          restaurant_slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_invites_accepted_restaurant_id_fkey"
            columns: ["accepted_restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          restaurant_id: string
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          restaurant_id?: string
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_staff_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          tax_rate: number
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          slug: string
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          tax_rate?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          location_label: string | null
          qr_token: string
          restaurant_id: string
          seats: number | null
          table_number: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          location_label?: string | null
          qr_token?: string
          restaurant_id: string
          seats?: number | null
          table_number: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          location_label?: string | null
          qr_token?: string
          restaurant_id?: string
          seats?: number | null
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_staff_by_email: {
        Args: {
          p_email: string
          p_restaurant_id: string
          p_role?: Database["public"]["Enums"]["staff_role"]
        }
        Returns: string
      }
      claim_restaurant_invite: {
        Args: { p_name?: string; p_slug?: string }
        Returns: {
          address: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          tax_rate: number
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_restaurant_with_owner: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          address: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          description: string | null
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          tax_rate: number
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "restaurants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_my_restaurant_invite: {
        Args: never
        Returns: {
          email: string
          expires_at: string
          id: string
          restaurant_name: string
          restaurant_slug: string
        }[]
      }
      is_manager_of: { Args: { p_restaurant_id: string }; Returns: boolean }
      is_owner_of: { Args: { p_restaurant_id: string }; Returns: boolean }
      is_staff_of: { Args: { p_restaurant_id: string }; Returns: boolean }
      list_staff_directory: {
        Args: { p_restaurant_id: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          is_active: boolean
          last_name: string
          role: Database["public"]["Enums"]["staff_role"]
          staff_id: string
          user_id: string
        }[]
      }
      restaurant_daily_stats: {
        Args: { p_restaurant_id: string; p_timezone?: string }
        Returns: {
          avg_order_value: number
          orders_count: number
          period: string
          revenue: number
        }[]
      }
      storage_folder_restaurant_id: {
        Args: { p_name: string }
        Returns: string
      }
    }
    Enums: {
      modifier_selection: "single" | "multiple"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "completed"
        | "cancelled"
      payment_method_type: "card" | "apple_pay" | "google_pay" | "other"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      refund_status: "requested" | "succeeded" | "failed"
      staff_role: "owner" | "manager" | "kitchen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T];

export type Profile = Tables<"profiles">;
export type Restaurant = Tables<"restaurants">;
export type RestaurantStaff = Tables<"restaurant_staff">;
export type StaffRole = Enums<"staff_role">;
export type MenuCategory = Tables<"menu_categories">;
export type MenuItem = Tables<"menu_items">;
export type CafeTable = Tables<"tables">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type Payment = Tables<"payments">;
export type OrderStatus = Enums<"order_status">;
export type PaymentStatus = Enums<"payment_status">;
export type PaymentMethodType = Enums<"payment_method_type">;
export type Refund = Tables<"refunds">;
export type RefundStatus = Enums<"refund_status">;
