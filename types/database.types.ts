/**
 * Database Types
 * 
 * Generated from Supabase schema.
 * Run: npx supabase gen types typescript --project-id <project-id> > types/database.types.ts
 * 
 * For now, this is a placeholder. Replace with actual generated types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    // NOTE:
    // This file is currently a placeholder (not fully generated from Supabase).
    // To keep Next.js `build` typechecking working across the codebase (which uses many tables & RPCs),
    // we include permissive index signatures for tables/views/functions/enums.
    // Replace this with the actual generated types when ready.
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships?: any[];
      };
      institutes: {
        Row: {
          id: string;
          name: string;
          subdomain: string;
          status: 'active' | 'suspended';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          subdomain: string;
          status?: 'active' | 'suspended';
          created_at?: string;
          updated_at?: string;
          deleted_at?: null;
        };
        Update: {
          id?: string;
          name?: string;
          subdomain?: string;
          status?: 'active' | 'suspended';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          institute_id: string | null;
          must_change_password: boolean;
          is_active: boolean;
          first_name: string | null;
          last_name: string | null;
          email: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          institute_id?: string | null;
          must_change_password?: boolean;
          is_active?: boolean;
          first_name?: string | null;
          last_name?: string | null;
          email: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: null;
        };
        Update: {
          id?: string;
          institute_id?: string | null;
          must_change_password?: boolean;
          is_active?: boolean;
          first_name?: string | null;
          last_name?: string | null;
          email?: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          institute_id: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          institute_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: null;
        };
        Update: {
          id?: string;
          user_id?: string;
          role_id?: string;
          institute_id?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          institute_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          details: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          institute_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          institute_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, any>;
        Returns: any;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: any;
    };
  };
}

