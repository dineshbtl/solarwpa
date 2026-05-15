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

export type AppRole =
  | 'admin'
  | 'manager'
  | 'store_manager'
  | 'supervisor'
  | 'engineer'
  | 'installer'
  | 'surveyor'
  | 'government'
  | 'state_store_officer'
  | 'district_store_incharge'
  | 'village_supervisor'
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
        Update: {
          auth_user_id?: string | null
          name?: string
          email?: string
          role?: AppRole
          status?: UserStatus
          phone?: string | null
          aadhar_no?: string | null
          city?: string | null
          state?: string | null
          district?: string | null
          full_address?: string | null
          updated_at?: string
        }
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
        Update: {
          project_name?: string
          description?: string | null
          state?: string | null
          city?: string | null
          district?: string | null
          pincode?: string | null
          address?: string | null
          additional_info?: string | null
          assignments?: Json
          updated_at?: string
        }
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
        Insert: { id?: string; project_id?: string | null; beneficiary_name?: string; service_no?: string; aadhar_no?: string; mobile?: string | null; pan_no?: string | null; contracted_load?: number | null; status?: SurveyStatus; upload_date?: string; approved_date?: string | null; submitted_by_id?: string | null; submitted_at?: string; installer_id?: string | null; discom_name?: DiscomName; plant_type?: string; building_height?: number | null; total_roofs?: TotalRoofs; roof_type?: RoofType; site_details?: Json | null; site_location?: Json; bank_details?: Json | null; uploads?: Json; remarks?: string | null; activity?: Json }
        Update: { id?: string; project_id?: string | null; beneficiary_name?: string; service_no?: string; aadhar_no?: string; mobile?: string | null; pan_no?: string | null; contracted_load?: number | null; status?: SurveyStatus; upload_date?: string; approved_date?: string | null; submitted_by_id?: string | null; submitted_at?: string; installer_id?: string | null; discom_name?: DiscomName; plant_type?: string; building_height?: number | null; total_roofs?: TotalRoofs; roof_type?: RoofType; site_details?: Json | null; site_location?: Json; bank_details?: Json | null; uploads?: Json; remarks?: string | null; activity?: Json; updated_at?: string }
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
          visit_type: string | null
          arrival_time: string | null
          departure_time: string | null
          site_accessible: boolean | null
          site_gps: Json | null
          installation_checklist: Json | null
          commissioning_data: Json | null
          quality_check: Json | null
          fault_report: Json | null
          signature_url: string | null
          declaration_confirmed: boolean | null
          submitted_at: string | null
          activity: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          project_id?: string | null
          survey_id?: string | null
          customer_name: string
          address: string
          engineer_name?: string | null
          engineer_id?: string | null
          status?: InstallationStatus
          started_at?: string | null
          completed_at?: string | null
          materials?: Json
          photos?: Json
          visit_type?: string | null
          arrival_time?: string | null
          departure_time?: string | null
          site_accessible?: boolean | null
          site_gps?: Json | null
          installation_checklist?: Json | null
          commissioning_data?: Json | null
          quality_check?: Json | null
          fault_report?: Json | null
          signature_url?: string | null
          declaration_confirmed?: boolean | null
          submitted_at?: string | null
          activity?: Json
        }
        Update: {
          project_id?: string | null
          survey_id?: string | null
          customer_name?: string
          address?: string
          engineer_name?: string | null
          engineer_id?: string | null
          status?: InstallationStatus
          started_at?: string | null
          completed_at?: string | null
          materials?: Json
          photos?: Json
          visit_type?: string | null
          arrival_time?: string | null
          departure_time?: string | null
          site_accessible?: boolean | null
          site_gps?: Json | null
          installation_checklist?: Json | null
          commissioning_data?: Json | null
          quality_check?: Json | null
          fault_report?: Json | null
          signature_url?: string | null
          declaration_confirmed?: boolean | null
          submitted_at?: string | null
          activity?: Json
          updated_at?: string
        }
      }
      warehouses: {
        Row: { id: string; name: string; warehouse_type: string; location: string | null; in_charge_id: string | null; created_at: string }
        Insert: { id: string; name: string; warehouse_type: string; location?: string | null; in_charge_id?: string | null }
        Update: { name?: string; warehouse_type?: string; location?: string | null; in_charge_id?: string | null }
      }
      material_dispatch: {
        Row: { id: string; from_warehouse_id: string | null; to_warehouse_id: string | null; dc_number: string; dispatch_date: string; vehicle_no: string | null; driver_name: string | null; vehicle_type: string | null; from_location: string | null; to_location: string | null; dispatched_by: string | null; items: Json; notes: string | null; status: string; created_at: string; updated_at: string }
        Insert: { id: string; dc_number: string; dispatch_date: string; from_warehouse_id?: string | null; to_warehouse_id?: string | null; vehicle_no?: string | null; driver_name?: string | null; vehicle_type?: string | null; from_location?: string | null; to_location?: string | null; dispatched_by?: string | null; items?: Json; notes?: string | null; status?: string }
        Update: { dc_number?: string; dispatch_date?: string; from_warehouse_id?: string | null; to_warehouse_id?: string | null; vehicle_no?: string | null; driver_name?: string | null; vehicle_type?: string | null; from_location?: string | null; to_location?: string | null; dispatched_by?: string | null; items?: Json; notes?: string | null; status?: string; updated_at?: string }
      }
      material_receipt: {
        Row: { id: string; dispatch_id: string | null; received_by: string | null; received_date: string; receipt_status: string; items_received: Json; shortage_notes: string | null; created_at: string }
        Insert: { id: string; received_date: string; receipt_status: string; dispatch_id?: string | null; received_by?: string | null; items_received?: Json; shortage_notes?: string | null }
        Update: { received_date?: string; receipt_status?: string; dispatch_id?: string | null; received_by?: string | null; items_received?: Json; shortage_notes?: string | null }
      }
      material_issue_village: {
        Row: { id: string; project_id: string | null; from_warehouse_id: string | null; mandal: string; village_name: string; households_approved: number; issue_challan_no: string; issue_date: string; issued_by: string | null; items: Json; notes: string | null; created_at: string }
        Insert: { id: string; mandal: string; village_name: string; households_approved: number; issue_challan_no: string; project_id?: string | null; from_warehouse_id?: string | null; issue_date?: string; issued_by?: string | null; items?: Json; notes?: string | null }
        Update: { mandal?: string; village_name?: string; households_approved?: number; issue_challan_no?: string; project_id?: string | null; from_warehouse_id?: string | null; issue_date?: string; issued_by?: string | null; items?: Json; notes?: string | null }
      }
      village_allotments: {
        Row: { id: string; project_id: string | null; mandal: string; village_name: string; engineer_id: string | null; households_allotted: number | null; allotted_date: string | null; notes: string | null; created_at: string }
        Insert: { id: string; mandal: string; village_name: string; project_id?: string | null; engineer_id?: string | null; households_allotted?: number | null; allotted_date?: string | null; notes?: string | null }
        Update: { mandal?: string; village_name?: string; project_id?: string | null; engineer_id?: string | null; households_allotted?: number | null; allotted_date?: string | null; notes?: string | null }
      }
      material_returns: {
        Row: { id: string; project_id: string | null; from_village: string | null; to_warehouse_id: string | null; return_date: string; return_reason: string; returned_by: string | null; items: Json; notes: string | null; created_at: string }
        Insert: { id: string; return_date: string; return_reason: string; project_id?: string | null; from_village?: string | null; to_warehouse_id?: string | null; returned_by?: string | null; items?: Json; notes?: string | null }
        Update: { return_date?: string; return_reason?: string; project_id?: string | null; from_village?: string | null; to_warehouse_id?: string | null; returned_by?: string | null; items?: Json; notes?: string | null }
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
        Insert: {
          id: string
          installation_id: string
          project_id?: string | null
          survey_id?: string | null
          customer_name: string
          address: string
          status?: InspectionStatus
          inspector_id?: string | null
          manager_approval?: Json
          government_inspection?: Json | null
          activity?: Json
        }
        Update: {
          installation_id?: string
          project_id?: string | null
          survey_id?: string | null
          customer_name?: string
          address?: string
          status?: InspectionStatus
          inspector_id?: string | null
          manager_approval?: Json
          government_inspection?: Json | null
          activity?: Json
          updated_at?: string
        }
      }
      role_permissions: {
        Row: {
          role: AppRole
          permissions: string[]
          updated_at: string
        }
        Insert: {
          role: AppRole
          permissions: string[]
        }
        Update: {
          permissions?: string[]
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      current_profile_id: { Args: Record<string, never>; Returns: string | null }
      installation_kpi_counts: { Args: { p_project_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | 'admin'
        | 'manager'
        | 'store_manager'
        | 'supervisor'
        | 'engineer'
        | 'installer'
        | 'surveyor'
        | 'government'
        | 'state_store_officer'
        | 'district_store_incharge'
        | 'village_supervisor'
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
