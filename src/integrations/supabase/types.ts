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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          assigned_user_id: string | null
          color: string
          created_at: string
          created_by: string | null
          email: string
          end_time: string | null
          first_name: string
          id: string
          last_name: string
          note: string | null
          phone: string
          public_visible: boolean
          salutation: string
          source: string
          status: Database["public"]["Enums"]["appointment_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          assigned_user_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          email: string
          end_time?: string | null
          first_name: string
          id?: string
          last_name: string
          note?: string | null
          phone: string
          public_visible?: boolean
          salutation: string
          source?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          assigned_user_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          email?: string
          end_time?: string | null
          first_name?: string
          id?: string
          last_name?: string
          note?: string | null
          phone?: string
          public_visible?: boolean
          salutation?: string
          source?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          slot_minutes: number
          start_time: string
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time: string
          id?: string
          slot_minutes?: number
          start_time: string
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          slot_minutes?: number
          start_time?: string
          weekday?: number
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_type_keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_type_keywords_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          split_enabled: boolean | null
          split_regex: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          split_enabled?: boolean | null
          split_regex?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          split_enabled?: boolean | null
          split_regex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_html: boolean
          subject: string
          trigger_key: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_html?: boolean
          subject?: string
          trigger_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_html?: boolean
          subject?: string
          trigger_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_calendars: {
        Row: {
          active: boolean
          assigned_user_id: string | null
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          public_visible: boolean
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          assigned_user_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          public_visible?: boolean
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          assigned_user_id?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          public_visible?: boolean
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      form_fields: {
        Row: {
          conditions: Json
          created_at: string
          field_name: string
          field_type: string
          form_id: string
          html_content: string
          id: string
          label: string
          options: Json
          placeholder: string
          position: number
          required: boolean
          validations: Json
        }
        Insert: {
          conditions?: Json
          created_at?: string
          field_name?: string
          field_type: string
          form_id: string
          html_content?: string
          id?: string
          label?: string
          options?: Json
          placeholder?: string
          position?: number
          required?: boolean
          validations?: Json
        }
        Update: {
          conditions?: Json
          created_at?: string
          field_name?: string
          field_type?: string
          form_id?: string
          html_content?: string
          id?: string
          label?: string
          options?: Json
          placeholder?: string
          position?: number
          required?: boolean
          validations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string | null
          created_at: string
          data: Json
          form_id: string
          id: string
          internal_note: string
          read_at: string | null
          status: Database["public"]["Enums"]["submission_status"]
        }
        Insert: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          created_at?: string
          data?: Json
          form_id: string
          id?: string
          internal_note?: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Update: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          created_at?: string
          data?: Json
          form_id?: string
          id?: string
          internal_note?: string
          read_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          description: string
          id: string
          position: number
          published: boolean
          submit_label: string
          success_message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          published?: boolean
          submit_label?: string
          success_message?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          position?: number
          published?: boolean
          submit_label?: string
          success_message?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_documents: {
        Row: {
          checked_out_at: string | null
          checked_out_by: string | null
          created_at: string
          detected_type_id: string | null
          id: string
          matched_keywords: Json
          name: string
          notes: string
          owner_id: string
          page_order: Json
          storage_path: string
          updated_at: string
        }
        Insert: {
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          detected_type_id?: string | null
          id?: string
          matched_keywords?: Json
          name?: string
          notes?: string
          owner_id: string
          page_order?: Json
          storage_path: string
          updated_at?: string
        }
        Update: {
          checked_out_at?: string | null
          checked_out_by?: string | null
          created_at?: string
          detected_type_id?: string | null
          id?: string
          matched_keywords?: Json
          name?: string
          notes?: string
          owner_id?: string
          page_order?: Json
          storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_pages: {
        Row: {
          created_at: string
          document_id: string
          id: string
          ocr_blocks: Json
          ocr_text: string
          page_index: number
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          ocr_blocks?: Json
          ocr_text?: string
          page_index: number
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          ocr_blocks?: Json
          ocr_text?: string
          page_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdf_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pdf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          booking_enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          booking_enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          booking_enabled?: boolean
          id?: string
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
      can_edit: { Args: { _user_id: string }; Returns: boolean }
      get_taken_slots: {
        Args: { _from: string; _to: string }
        Returns: {
          appointment_date: string
          appointment_time: string
        }[]
      }
      has_any_backend_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "editor" | "guest"
      appointment_status: "pending" | "confirmed" | "cancelled"
      submission_status: "open" | "confirmed" | "cancelled"
      user_status: "new" | "active" | "blocked"
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
  public: {
    Enums: {
      app_role: ["admin", "user", "editor", "guest"],
      appointment_status: ["pending", "confirmed", "cancelled"],
      submission_status: ["open", "confirmed", "cancelled"],
      user_status: ["new", "active", "blocked"],
    },
  },
} as const
