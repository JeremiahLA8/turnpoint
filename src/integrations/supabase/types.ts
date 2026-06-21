export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      checklist_items: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          section: string
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position?: number
          section: string
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          section?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_dwolla: {
        Row: {
          bank_last4: string | null
          cleaner_id: string
          created_at: string
          customer_id: string
          funding_source_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bank_last4?: string | null
          cleaner_id: string
          created_at?: string
          customer_id: string
          funding_source_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bank_last4?: string | null
          cleaner_id?: string
          created_at?: string
          customer_id?: string
          funding_source_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_dwolla_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_payouts: {
        Row: {
          amount_cents: number
          cleaner_id: string
          created_at: string
          dwolla_status: string | null
          dwolla_synced_at: string | null
          dwolla_transfer_id: string | null
          id: string
          job_id: string
          method: string | null
          note: string | null
          paid_at: string
          property_id: string | null
          qb_purchase_id: string | null
          qb_sync_error: string | null
          qb_synced_at: string | null
          recorded_by: string | null
        }
        Insert: {
          amount_cents: number
          cleaner_id: string
          created_at?: string
          dwolla_status?: string | null
          dwolla_synced_at?: string | null
          dwolla_transfer_id?: string | null
          id?: string
          job_id: string
          method?: string | null
          note?: string | null
          paid_at?: string
          property_id?: string | null
          qb_purchase_id?: string | null
          qb_sync_error?: string | null
          qb_synced_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount_cents?: number
          cleaner_id?: string
          created_at?: string
          dwolla_status?: string | null
          dwolla_synced_at?: string | null
          dwolla_transfer_id?: string | null
          id?: string
          job_id?: string
          method?: string | null
          note?: string | null
          paid_at?: string
          property_id?: string | null
          qb_purchase_id?: string | null
          qb_sync_error?: string | null
          qb_synced_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_payouts_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "cleaning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_jobs: {
        Row: {
          amount_cents: number | null
          approved_at: string | null
          check_in: string | null
          check_out: string | null
          cleaner_id: string | null
          cleaner_notes: string | null
          completed_at: string | null
          created_at: string
          guest_name: string | null
          hostaway_reservation_id: string | null
          id: string
          issue_flagged: boolean
          issue_note: string | null
          notes: string | null
          property_id: string
          scheduled_end: string | null
          scheduled_start: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          approved_at?: string | null
          check_in?: string | null
          check_out?: string | null
          cleaner_id?: string | null
          cleaner_notes?: string | null
          completed_at?: string | null
          created_at?: string
          guest_name?: string | null
          hostaway_reservation_id?: string | null
          id?: string
          issue_flagged?: boolean
          issue_note?: string | null
          notes?: string | null
          property_id: string
          scheduled_end?: string | null
          scheduled_start: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          approved_at?: string | null
          check_in?: string | null
          check_out?: string | null
          cleaner_id?: string | null
          cleaner_notes?: string | null
          completed_at?: string | null
          created_at?: string
          guest_name?: string | null
          hostaway_reservation_id?: string | null
          id?: string
          issue_flagged?: boolean
          issue_note?: string | null
          notes?: string | null
          property_id?: string
          scheduled_end?: string | null
          scheduled_start?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_jobs_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      dwolla_config: {
        Row: {
          customer_id: string | null
          environment: string
          funding_source_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          customer_id?: string | null
          environment?: string
          funding_source_id?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          customer_id?: string | null
          environment?: string
          funding_source_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      hostaway_config: {
        Row: {
          account_id: string
          api_key: string
          connected_at: string
          id: string
          last_sync_at: string | null
          status: string
        }
        Insert: {
          account_id: string
          api_key: string
          connected_at?: string
          id?: string
          last_sync_at?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          api_key?: string
          connected_at?: string
          id?: string
          last_sync_at?: string | null
          status?: string
        }
        Relationships: []
      }
      job_checklist_completions: {
        Row: {
          completed_at: string
          completed_by: string | null
          id: string
          item_id: string
          job_id: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_id: string
          job_id: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          id?: string
          item_id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_checklist_completions_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklist_completions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklist_completions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cleaning_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photo_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          issues: Json
          job_id: string
          score: number | null
          summary: string | null
          verdict: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          issues?: Json
          job_id: string
          score?: number | null
          summary?: string | null
          verdict: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          issues?: Json
          job_id?: string
          score?: number | null
          summary?: string | null
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photo_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photo_assessments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "cleaning_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          id: string
          job_id: string
          storage_path: string
          type: Database["public"]["Enums"]["photo_type"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          job_id: string
          storage_path: string
          type: Database["public"]["Enums"]["photo_type"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          storage_path?: string
          type?: Database["public"]["Enums"]["photo_type"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cleaning_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_log: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["job_status"] | null
          id: string
          job_id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["job_status"] | null
          id?: string
          job_id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_status_log_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "cleaning_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          sms_consent_at: string | null
          sms_consent_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          sms_consent_at?: string | null
          sms_consent_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          sms_consent_at?: string | null
          sms_consent_text?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          access_notes: string | null
          address: string
          baths: number
          beds: number
          checklist_template_id: string | null
          color: string
          completion: number
          created_at: string
          default_cleaner_id: string | null
          guests: number
          hostaway_listing_id: string | null
          id: string
          name: string
          nickname: string | null
          region: string | null
          sqft: number
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          address?: string
          baths?: number
          beds?: number
          checklist_template_id?: string | null
          color?: string
          completion?: number
          created_at?: string
          default_cleaner_id?: string | null
          guests?: number
          hostaway_listing_id?: string | null
          id?: string
          name: string
          nickname?: string | null
          region?: string | null
          sqft?: number
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          address?: string
          baths?: number
          beds?: number
          checklist_template_id?: string | null
          color?: string
          completion?: number
          created_at?: string
          default_cleaner_id?: string | null
          guests?: number
          hostaway_listing_id?: string | null
          id?: string
          name?: string
          nickname?: string | null
          region?: string | null
          sqft?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_checklist_template_id_fkey"
            columns: ["checklist_template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      property_cleaner_rates: {
        Row: {
          amount_cents: number
          cleaner_id: string
          created_at: string
          id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          cleaner_id: string
          created_at?: string
          id?: string
          property_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          cleaner_id?: string
          created_at?: string
          id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_cleaner_rates_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_cleaner_rates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      qb_connection: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          id: string
          realm_id: string
          refresh_token: string
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          id?: string
          realm_id: string
          refresh_token: string
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          id?: string
          realm_id?: string
          refresh_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "technician" | "client"
      job_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "pending"
        | "assigned"
        | "acknowledged"
        | "approved"
      photo_type: "before" | "after"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "manager", "technician", "client"],
      job_status: [
        "scheduled",
        "in_progress",
        "completed",
        "cancelled",
        "pending",
        "assigned",
        "acknowledged",
        "approved",
      ],
      photo_type: ["before", "after"],
    },
  },
} as const
