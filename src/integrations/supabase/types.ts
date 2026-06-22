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
  public: {
    Tables: {
      channel_prompts: {
        Row: {
          channel: Database["public"]["Enums"]["pillar_channel"]
          created_at: string
          id: string
          prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["pillar_channel"]
          created_at?: string
          id?: string
          prompt?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["pillar_channel"]
          created_at?: string
          id?: string
          prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      competitor_metrics: {
        Row: {
          competitor_id: string
          fetched_at: string
          metrics: Json
          user_id: string
        }
        Insert: {
          competitor_id: string
          fetched_at?: string
          metrics?: Json
          user_id: string
        }
        Update: {
          competitor_id?: string
          fetched_at?: string
          metrics?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_metrics_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: true
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          channel: string
          created_at: string
          handle: string
          id: string
          name: string
          notes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          handle: string
          id?: string
          name: string
          notes?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          handle?: string
          id?: string
          name?: string
          notes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_pillars: {
        Row: {
          channel: Database["public"]["Enums"]["pillar_channel"]
          color: string
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["pillar_channel"]
          color?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["pillar_channel"]
          color?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ideas: {
        Row: {
          channel: Database["public"]["Enums"]["pillar_channel"] | null
          created_at: string
          id: string
          note: string
          pillar_id: string | null
          status: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          created_at?: string
          id?: string
          note?: string
          pillar_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          created_at?: string
          id?: string
          note?: string
          pillar_id?: string | null
          status?: Database["public"]["Enums"]["idea_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel: Database["public"]["Enums"]["pillar_channel"] | null
          content: string
          created_at: string
          id: string
          idea_id: string | null
          metricool_id: string | null
          pillar_id: string | null
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          content?: string
          created_at?: string
          id?: string
          idea_id?: string | null
          metricool_id?: string | null
          pillar_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          content?: string
          created_at?: string
          id?: string
          idea_id?: string | null
          metricool_id?: string | null
          pillar_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          channel: Database["public"]["Enums"]["pillar_channel"] | null
          created_at: string
          id: string
          original_video_path: string | null
          pillar_id: string | null
          status: Database["public"]["Enums"]["reel_status"]
          subtitles: string
          title: string
          transcription: string
          updated_at: string
          user_id: string
          video_path: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          created_at?: string
          id?: string
          original_video_path?: string | null
          pillar_id?: string | null
          status?: Database["public"]["Enums"]["reel_status"]
          subtitles?: string
          title?: string
          transcription?: string
          updated_at?: string
          user_id: string
          video_path: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["pillar_channel"] | null
          created_at?: string
          id?: string
          original_video_path?: string | null
          pillar_id?: string | null
          status?: Database["public"]["Enums"]["reel_status"]
          subtitles?: string
          title?: string
          transcription?: string
          updated_at?: string
          user_id?: string
          video_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "reels_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_documents: {
        Row: {
          content: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_metrics_snapshot: {
        Row: {
          fetched_at: string
          metrics: Json
          user_id: string
        }
        Insert: {
          fetched_at?: string
          metrics?: Json
          user_id: string
        }
        Update: {
          fetched_at?: string
          metrics?: Json
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_channels: string[]
          created_at: string
          metricool_plan: string
          updated_at: string
          user_id: string
          webhook_competitors: string
          webhook_competitors_content: string
          webhook_publish: string
          webhook_stats: string
          webhook_subtitles: string
          webhook_transcription: string
        }
        Insert: {
          active_channels?: string[]
          created_at?: string
          metricool_plan?: string
          updated_at?: string
          user_id: string
          webhook_competitors?: string
          webhook_competitors_content?: string
          webhook_publish?: string
          webhook_stats?: string
          webhook_subtitles?: string
          webhook_transcription?: string
        }
        Update: {
          active_channels?: string[]
          created_at?: string
          metricool_plan?: string
          updated_at?: string
          user_id?: string
          webhook_competitors?: string
          webhook_competitors_content?: string
          webhook_publish?: string
          webhook_stats?: string
          webhook_subtitles?: string
          webhook_transcription?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      idea_status: "brouillon" | "a_developper" | "prete"
      pillar_channel:
        | "linkedin"
        | "instagram_coaching"
        | "instagram_chroniques_cosmiques"
        | "podcast"
        | "substack"
      post_status: "idee" | "en_redaction" | "pret" | "programme" | "publie"
      reel_status: "a_sous_titrer" | "sous_titre" | "publie"
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
      idea_status: ["brouillon", "a_developper", "prete"],
      pillar_channel: [
        "linkedin",
        "instagram_coaching",
        "instagram_chroniques_cosmiques",
        "podcast",
        "substack",
      ],
      post_status: ["idee", "en_redaction", "pret", "programme", "publie"],
      reel_status: ["a_sous_titrer", "sous_titre", "publie"],
    },
  },
} as const
