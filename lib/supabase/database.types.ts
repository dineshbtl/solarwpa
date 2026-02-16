/**
 * Supabase Database types for Solar EPC (matches db/migrations).
 * Regenerate with: npx supabase gen types typescript --db-url "postgresql://..." > lib/supabase/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'admin' | 'manager' | 'engineer' | 'surveyor' | 'government'
export type UserStatus = 'active' | 'inactive'
export type SurveyStatus = 'pending' | 'approved' | 'rejected' | 'completed'
export type DiscomName = 'APSPDCL' | 'APCPDCL' | 'APEPDCL'
export type TotalRoofs = 'G' | 'G+1' | 'G+2' | 'G+3'
export type RoofType = 'RCC' | 'Metal Shed' | 'Cement Shed' | 'Ground Mount'
export type InstallationStatus = 'pending' | 'in_progress' | 'completed' | 'inspection_pending'
export type InspectionStatus = 'pending' | 'approved' | 'rejected' | 'reopened'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          auth_user_id: string | null
          name: string
          email: string
          role: AppRole
          status: UserStatus
          phone: string | null
          aadhar_no: string | null
          city: string | null
          state: string | null
          district: string | null
          full_address: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          auth_user_id?: string | null
          name: string
          email: string
          role?: AppRole
          status?: UserStatus
          phone?: string | null
          aadhar_no?: string | null
          city?: string | null
          state?: string | null
          district?: string | null
          full_address?: string | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']> & { updated_at?: string }
      }
      projects: {
        Row: {
          id: string
          project_name: string
          description: string | null
          state: string | null
          city: string | null
          district: string | null
          pincode: string | null
          address: string | null
          additional_info: string | null
          assignments: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_name: string
          description?: string | null
          state?: string | null
          city?: string | null
          district?: string | null
          pincode?: string | null
          address?: string | null
          additional_info?: string | null
          assignments?: Json
        }
        Update: Partial<Database['public']['Tables']['projects']['Insert']> & { updated_at?: string }
      }
      surveys: {
        Row: {
          id: string
          project_id: string | null
          beneficiary_name: string
          service_no: string
          aadhar_no: string
          mobile: string | null
          pan_no: string | null
          contracted_load: number | null
          status: SurveyStatus
          upload_date: string
          approved_date: string | null
          submitted_by_id: string | null
          submitted_at: string
          installer_id: string | null
          discom_name: DiscomName
          plant_type: string
          building_height: number | null
          total_roofs: TotalRoofs
          roof_type: RoofType
          site_details: Json | null
          site_location: Json
          bank_details: Json | null
          uploads: Json
          remarks: string | null
          activity: Json
          created_at: string
          updated_at: string
        }
        Insert: { [K in keyof Database['public']['Tables']['surveys']['Row']]?: Database['public']['Tables']['surveys']['Row'][K] }
        Update: Partial<Database['public']['Tables']['surveys']['Insert']> & { updated_at?: string }
      }
      installations: {
        Row: {
          id: string
          project_id: string | null
          survey_id: string | null
          customer_name: string
          address: string
          engineer_name: string | null
          engineer_id: string | null
          status: InstallationStatus
          started_at: string | null
          completed_at: string | null
          materials: Json
          photos: Json
          created_at: string
          updated_at: string
        }
        Insert: { [K in keyof Database['public']['Tables']['installations']['Row']]?: Database['public']['Tables']['installations']['Row'][K] }
        Update: Partial<Database['public']['Tables']['installations']['Insert']> & { updated_at?: string }
      }
      inspections: {
        Row: {
          id: string
          installation_id: string
          project_id: string | null
          survey_id: string | null
          customer_name: string
          address: string
          status: InspectionStatus
          inspector_id: string | null
          manager_approval: Json
          government_inspection: Json | null
          activity: Json
          created_at: string
          updated_at: string
        }
        Insert: { [K in keyof Database['public']['Tables']['inspections']['Row']]?: Database['public']['Tables']['inspections']['Row'][K] }
        Update: Partial<Database['public']['Tables']['inspections']['Insert']> & { updated_at?: string }
      }
    }
    Views: Record<string, never>
    Functions: {
      current_profile_id: { Args: Record<string, never>; Returns: string | null }
    }
    Enums: {
      app_role: AppRole
      user_status: UserStatus
      survey_status: SurveyStatus
      discom_name: DiscomName
      total_roofs: TotalRoofs
      roof_type: RoofType
      installation_status: InstallationStatus
      inspection_status: InspectionStatus
    }
  }
}
