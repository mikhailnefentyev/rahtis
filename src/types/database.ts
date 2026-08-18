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
    PostgrestVersion: "14.15"
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
      companies: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          bic: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_postal_code: string | null
          billing_reference: string | null
          billing_street: string | null
          business_id: string
          contact_email: string
          country: string
          created_at: string
          einvoice_operator: string | null
          einvoice_ovt: string | null
          iban: string | null
          id: string
          kind: Database["public"]["Enums"]["party_role"]
          legal_city: string | null
          legal_country: string | null
          legal_name: string | null
          legal_postal_code: string | null
          legal_street: string | null
          name: string
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          bic?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          billing_reference?: string | null
          billing_street?: string | null
          business_id: string
          contact_email: string
          country?: string
          created_at?: string
          einvoice_operator?: string | null
          einvoice_ovt?: string | null
          iban?: string | null
          id?: string
          kind: Database["public"]["Enums"]["party_role"]
          legal_city?: string | null
          legal_country?: string | null
          legal_name?: string | null
          legal_postal_code?: string | null
          legal_street?: string | null
          name: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          bic?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_email?: string | null
          billing_postal_code?: string | null
          billing_reference?: string | null
          billing_street?: string | null
          business_id?: string
          contact_email?: string
          country?: string
          created_at?: string
          einvoice_operator?: string | null
          einvoice_ovt?: string | null
          iban?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["party_role"]
          legal_city?: string | null
          legal_country?: string | null
          legal_name?: string | null
          legal_postal_code?: string | null
          legal_street?: string | null
          name?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          company_id: string
          file_name: string
          id: string
          is_current: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          valid_until: string | null
        }
        Insert: {
          company_id: string
          file_name: string
          id?: string
          is_current?: boolean
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          file_name?: string
          id?: string
          is_current?: boolean
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_events: {
        Row: {
          actor_id: string | null
          company_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["company_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["company_status"]
        }
        Insert: {
          actor_id?: string | null
          company_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["company_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["company_status"]
        }
        Update: {
          actor_id?: string | null
          company_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["company_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["company_status"]
        }
        Relationships: [
          {
            foreignKeyName: "company_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_offers: {
        Row: {
          carrier_company_id: string
          created_at: string
          created_by: string | null
          id: string
          order_id: string
          vehicle_id: string
        }
        Insert: {
          carrier_company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          vehicle_id: string
        }
        Update: {
          carrier_company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_offers_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_offers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stops: {
        Row: {
          address: string
          booking_ref: string | null
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          external_ref: string | null
          id: string
          note: string | null
          order_id: string
          place_kind: Database["public"]["Enums"]["place_kind"] | null
          place_name: string | null
          returns_loaded: boolean | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date: string | null
          scheduled_time: string | null
          seal_required: boolean | null
          sequence: number
          updated_at: string
        }
        Insert: {
          address: string
          booking_ref?: string | null
          cargo_weight_kg?: number | null
          city: string
          company_name?: string | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          note?: string | null
          order_id: string
          place_kind?: Database["public"]["Enums"]["place_kind"] | null
          place_name?: string | null
          returns_loaded?: boolean | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date?: string | null
          scheduled_time?: string | null
          seal_required?: boolean | null
          sequence: number
          updated_at?: string
        }
        Update: {
          address?: string
          booking_ref?: string | null
          cargo_weight_kg?: number | null
          city?: string
          company_name?: string | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          note?: string | null
          order_id?: string
          place_kind?: Database["public"]["Enums"]["place_kind"] | null
          place_name?: string | null
          returns_loaded?: boolean | null
          role?: Database["public"]["Enums"]["stop_role"]
          scheduled_date?: string | null
          scheduled_time?: string | null
          seal_required?: boolean | null
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        Insert: {
          assigned_company_id?: string | null
          assigned_vehicle_id?: string | null
          chosen_offer_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          distance_km?: number | null
          id?: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          shipper_company_id: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trailer?: string | null
          updated_at?: string
        }
        Update: {
          assigned_company_id?: string | null
          assigned_vehicle_id?: string | null
          chosen_offer_id?: string | null
          comment?: string | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          distance_km?: number | null
          id?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          shipper_company_id?: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trailer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_company_id_fkey"
            columns: ["assigned_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_chosen_offer_id_fkey"
            columns: ["chosen_offer_id"]
            isOneToOne: false
            referencedRelation: "order_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_fk"
            columns: ["shipper_company_id", "shipper_company_kind"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["party_role"]
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["party_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_matches_role"
            columns: ["company_id", "role"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
      vehicle_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_access: Database["public"]["Enums"]["vehicle_access"] | null
          id: number
          note: string | null
          to_access: Database["public"]["Enums"]["vehicle_access"]
          vehicle_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_access?: Database["public"]["Enums"]["vehicle_access"] | null
          id?: never
          note?: string | null
          to_access: Database["public"]["Enums"]["vehicle_access"]
          vehicle_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_access?: Database["public"]["Enums"]["vehicle_access"] | null
          id?: never
          note?: string | null
          to_access?: Database["public"]["Enums"]["vehicle_access"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          access: Database["public"]["Enums"]["vehicle_access"]
          approved_at: string | null
          axles: number
          base_city: string
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          created_at: string
          driver_name: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          make: string
          plate: string
          rejected_at: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          access?: Database["public"]["Enums"]["vehicle_access"]
          approved_at?: string | null
          axles: number
          base_city: string
          company_id: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          created_at?: string
          driver_name: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          id?: string
          languages?: string[]
          make: string
          plate: string
          rejected_at?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          whatsapp: string
        }
        Update: {
          access?: Database["public"]["Enums"]["vehicle_access"]
          approved_at?: string | null
          axles?: number
          base_city?: string
          company_id?: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          created_at?: string
          driver_name?: string
          euro_class?: Database["public"]["Enums"]["euro_class"]
          id?: string
          languages?: string[]
          make?: string
          plate?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          submitted_at?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_fk"
            columns: ["company_id", "company_kind"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_company: {
        Args: { p_company_id: string }
        Returns: {
          activated_at: string | null
          approved_at: string | null
          bic: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_postal_code: string | null
          billing_reference: string | null
          billing_street: string | null
          business_id: string
          contact_email: string
          country: string
          created_at: string
          einvoice_operator: string | null
          einvoice_ovt: string | null
          iban: string | null
          id: string
          kind: Database["public"]["Enums"]["party_role"]
          legal_city: string | null
          legal_country: string | null
          legal_name: string | null
          legal_postal_code: string | null
          legal_street: string | null
          name: string
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          vat_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      choose_offer: {
        Args: { p_offer_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      company_readiness: {
        Args: { p_company_id: string }
        Returns: {
          approved_vehicles: number
          can_take_orders: boolean
          documents_ok: boolean
          has_insurance: boolean
          has_license: boolean
          insurance_valid_until: string
          license_valid_until: string
        }[]
      }
      confirm_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: { p_order: Json; p_publish?: boolean; p_stops: Json }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_vehicle: {
        Args: {
          p_decision: Database["public"]["Enums"]["vehicle_access"]
          p_note?: string
          p_vehicle_id: string
        }
        Returns: {
          access: Database["public"]["Enums"]["vehicle_access"]
          approved_at: string | null
          axles: number
          base_city: string
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          created_at: string
          driver_name: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          make: string
          plate: string
          rejected_at: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          whatsapp: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      desk_orders: {
        Args: { p_limit?: number; p_region?: string }
        Returns: {
          comment: string
          delivery_city: string
          distance_km: number
          id: string
          offers_count: number
          order_type: Database["public"]["Enums"]["order_type"]
          pickup_city: string
          pickup_date: string
          pickup_time: string
          published_at: string
          rate_cents: number
          ref: string
          shipper_name: string
          stops: Json
          taken_by_me: boolean
          trailer: string
        }[]
      }
      desk_regions: {
        Args: never
        Returns: {
          city: string
          open_orders: number
        }[]
      }
      documents_needing_attention: {
        Args: { p_within_days?: number }
        Returns: {
          approved_vehicles: number
          company_id: string
          company_name: string
          days_left: number
          kind: Database["public"]["Enums"]["document_kind"]
          valid_until: string
        }[]
      }
      expire_order_deadlines: { Args: never; Returns: number }
      moderate_company: {
        Args: {
          p_company_id: string
          p_decision: Database["public"]["Enums"]["company_status"]
          p_note?: string
        }
        Returns: {
          activated_at: string | null
          approved_at: string | null
          bic: string | null
          billing_city: string | null
          billing_country: string | null
          billing_email: string | null
          billing_postal_code: string | null
          billing_reference: string | null
          billing_street: string | null
          business_id: string
          contact_email: string
          country: string
          created_at: string
          einvoice_operator: string | null
          einvoice_ovt: string | null
          iban: string | null
          id: string
          kind: Database["public"]["Enums"]["party_role"]
          legal_city: string | null
          legal_country: string | null
          legal_name: string | null
          legal_postal_code: string | null
          legal_street: string | null
          name: string
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["company_status"]
          updated_at: string
          vat_number: string | null
        }
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      my_assignments: {
        Args: never
        Returns: {
          comment: string
          deadline_at: string
          distance_km: number
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          rate_cents: number
          ref: string
          shipper_name: string
          status: Database["public"]["Enums"]["order_status"]
          stops: Json
          trailer: string
          vehicle_plate: string
        }[]
      }
      offers_for_shipper: {
        Args: { p_order_ids: string[] }
        Returns: {
          axles: number
          base_city: string
          carrier_company_id: string
          carrier_name: string
          created_at: string
          driver_name: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          is_assigned: boolean
          is_chosen: boolean
          languages: string[]
          make: string
          offer_id: string
          order_id: string
          plate: string
          rating: number
          vehicle_id: string
        }[]
      }
      submit_vehicle: {
        Args: { p_vehicle_id: string }
        Returns: {
          access: Database["public"]["Enums"]["vehicle_access"]
          approved_at: string | null
          axles: number
          base_city: string
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          created_at: string
          driver_name: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          make: string
          plate: string
          rejected_at: string | null
          rejection_reason: string | null
          submitted_at: string | null
          updated_at: string
          whatsapp: string
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      take_order: {
        Args: { p_order_id: string; p_vehicle_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          comment: string | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_km: number | null
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      company_status: "PENDING" | "APPROVED" | "ACTIVE" | "REJECTED"
      document_kind: "CARRIER_LICENSE" | "INSURANCE"
      euro_class: "EURO_4" | "EURO_5" | "EURO_6"
      order_status:
        | "DRAFT"
        | "OPEN"
        | "REQUESTED"
        | "AWAIT_DRIVER"
        | "IN_PROGRESS"
        | "DONE"
        | "CANCELLED"
      order_type: "TRAILER_SWAP" | "ROUND_TRIP" | "ONE_WAY"
      party_role: "CARRIER" | "SHIPPER" | "ADMIN"
      place_kind: "PORT" | "TERMINAL" | "PARKING" | "ADDRESS"
      stop_role:
        | "PICKUP"
        | "DELIVERY"
        | "EXTRA_LOAD"
        | "EXTRA_UNLOAD"
        | "CONTINUATION"
        | "TRAILER_RETURN"
      vehicle_access: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
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
      company_status: ["PENDING", "APPROVED", "ACTIVE", "REJECTED"],
      document_kind: ["CARRIER_LICENSE", "INSURANCE"],
      euro_class: ["EURO_4", "EURO_5", "EURO_6"],
      order_status: [
        "DRAFT",
        "OPEN",
        "REQUESTED",
        "AWAIT_DRIVER",
        "IN_PROGRESS",
        "DONE",
        "CANCELLED",
      ],
      order_type: ["TRAILER_SWAP", "ROUND_TRIP", "ONE_WAY"],
      party_role: ["CARRIER", "SHIPPER", "ADMIN"],
      place_kind: ["PORT", "TERMINAL", "PARKING", "ADDRESS"],
      stop_role: [
        "PICKUP",
        "DELIVERY",
        "EXTRA_LOAD",
        "EXTRA_UNLOAD",
        "CONTINUATION",
        "TRAILER_RETURN",
      ],
      vehicle_access: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
    },
  },
} as const
