export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // Enhanced Chat System Tables
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_sessions: {
        Row: {
          id: string;
          chat_title: string | null;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chat_title?: string | null;
          user_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          chat_title?: string | null;
          user_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          chat_session_id: string;
          content: string | null;
          is_user_message: boolean;
          reasoning: string | null;
          sources: Json | null;
          tool_invocations: Json | null;
          attachments: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_session_id: string;
          content?: string | null;
          is_user_message: boolean;
          reasoning?: string | null;
          sources?: Json | null;
          tool_invocations?: Json | null;
          attachments?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_session_id?: string;
          content?: string | null;
          is_user_message?: boolean;
          reasoning?: string | null;
          sources?: Json | null;
          tool_invocations?: Json | null;
          attachments?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_chat_session_id_fkey';
            columns: ['chat_session_id'];
            referencedRelation: 'chat_sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      user_documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          filter_tags: string;
          total_pages: number;
          ai_title: string | null;
          ai_description: string | null;
          ai_maintopics: string[] | null;
          ai_keyentities: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          filter_tags: string;
          total_pages: number;
          ai_title?: string | null;
          ai_description?: string | null;
          ai_maintopics?: string[] | null;
          ai_keyentities?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          filter_tags?: string;
          total_pages?: number;
          ai_title?: string | null;
          ai_description?: string | null;
          ai_maintopics?: string[] | null;
          ai_keyentities?: string[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_documents_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_documents_vec: {
        Row: {
          id: string;
          document_id: string;
          page_number: number;
          text_content: string;
          embedding: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          page_number: number;
          text_content: string;
          embedding?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          page_number?: number;
          text_content?: string;
          embedding?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'user_documents_vec_document_id_fkey';
            columns: ['document_id'];
            referencedRelation: 'user_documents';
            referencedColumns: ['id'];
          },
        ];
      };
      error_feedback: {
        Row: {
          id: number;
          feedback: string;
          category: string | null;
          errormessage: string | null;
          errorstack: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          feedback: string;
          category?: string | null;
          errormessage?: string | null;
          errorstack?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          feedback?: string;
          category?: string | null;
          errormessage?: string | null;
          errorstack?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      // Legacy tables (keeping for backward compatibility)
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          subscription_tier?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          stripe_price_id: string | null;
          subscription_status: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          subscription_status?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_price_id?: string | null;
          subscription_status?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      // Vector similarity search function
      match_documents: {
        Args: {
          query_embedding: string;
          match_count: number;
          filter_user_id: string;
          filter_files: string[];
          similarity_threshold?: number;
        };
        Returns: {
          id: string;
          text_content: string;
          title: string;
          doc_timestamp: string;
          ai_title: string;
          ai_description: string;
          ai_maintopics: string[];
          ai_keyentities: string[];
          filter_tags: string;
          page_number: number;
          total_pages: number;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
