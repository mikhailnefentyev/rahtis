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
      email_outbox: {
        Row: {
          id: number
          created_at: string
          template: string
          locale: string
          from_email: string
          reply_to: string | null
          to_email: string
          to_name: string | null
          subject: string
          body_text: string
          body_html: string | null
          attachments: Json
          company_id: string | null
          provider: string
          status: Database["public"]["Enums"]["email_status"]
          attempts: number
          provider_message_id: string | null
          error: string | null
          sent_at: string | null
        }
        Insert: {
          template: string
          locale?: string
          from_email: string
          reply_to?: string | null
          to_email: string
          to_name?: string | null
          subject: string
          body_text: string
          body_html?: string | null
          attachments?: Json
          company_id?: string | null
          provider: string
          status?: Database["public"]["Enums"]["email_status"]
        }
        Update: {
          status?: Database["public"]["Enums"]["email_status"]
          attempts?: number
          provider_message_id?: string | null
          error?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: number
          created_at: string
          company_id: string
          user_id: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          title: string
          body: string | null
          link: string | null
          read_at: string | null
        }
        Insert: {
          company_id: string
          user_id?: string | null
          kind: Database["public"]["Enums"]["notification_kind"]
          title: string
          body?: string | null
          link?: string | null
        }
        Update: { read_at?: string | null }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          at: string
          actor_id: string | null
          actor_email: string | null
          action: string
          subject: string
          detail: Json
        }
        Insert: {
          actor_id?: string | null
          actor_email?: string | null
          action: string
          subject: string
          detail?: Json
        }
        Update: never
        Relationships: []
      }
      companies: {
        Row: {
          activated_at: string | null
          frozen_at: string | null
          frozen_by: string | null
          freeze_reason: string | null
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
          frozen_at?: string | null
          frozen_by?: string | null
          freeze_reason?: string | null
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
          frozen_at?: string | null
          frozen_by?: string | null
          freeze_reason?: string | null
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
      order_amendments: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["amendment_kind"]
          order_id: string
          stop_id: string | null
          stop_label: string
          stop_role: Database["public"]["Enums"]["stop_role"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          changes: Json
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["amendment_kind"]
          order_id: string
          stop_id?: string | null
          stop_label: string
          stop_role: Database["public"]["Enums"]["stop_role"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actor_id?: string | null
          changes?: Json
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["amendment_kind"]
          order_id?: string
          stop_id?: string | null
          stop_label?: string
          stop_role?: Database["public"]["Enums"]["stop_role"]
        }
        Relationships: [
          {
            foreignKeyName: "order_amendments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_amendments_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "order_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["trip_document_kind"]
          mime_type: string
          order_id: string
          size_bytes: number
          stop_id: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["trip_document_kind"]
          mime_type: string
          order_id: string
          size_bytes: number
          stop_id?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["trip_document_kind"]
          mime_type?: string
          order_id?: string
          size_bytes?: number
          stop_id?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_documents_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "order_stops"
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
      order_ratings: {
        Row: {
          carrier_company_id: string
          comment: string | null
          created_at: string
          order_id: string
          rated_by: string | null
          score: number
          shipper_company_id: string
          updated_at: string
        }
        Insert: {
          carrier_company_id: string
          comment?: string | null
          created_at?: string
          order_id: string
          rated_by?: string | null
          score: number
          shipper_company_id: string
          updated_at?: string
        }
        Update: {
          carrier_company_id?: string
          comment?: string | null
          created_at?: string
          order_id?: string
          rated_by?: string | null
          score?: number
          shipper_company_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_ratings_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_ratings_shipper_company_id_fkey"
            columns: ["shipper_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stops: {
        Row: {
          address: string
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_at: string | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          damage_note: string | null
          external_ref: string | null
          geocode_score: number | null
          id: string
          lat: number | null
          leg_distance_m: number | null
          leg_duration_s: number | null
          lon: number | null
          note: string | null
          order_id: string
          place_kind: Database["public"]["Enums"]["place_kind"] | null
          place_name: string | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date: string | null
          scheduled_time: string | null
          seal_required: boolean | null
          sequence: number
          trailer_loaded: boolean | null
          updated_at: string
        }
        Insert: {
          address: string
          cargo_weight_kg?: number | null
          city: string
          company_name?: string | null
          completed_at?: string | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          damage_note?: string | null
          external_ref?: string | null
          geocode_score?: number | null
          id?: string
          lat?: number | null
          leg_distance_m?: number | null
          leg_duration_s?: number | null
          lon?: number | null
          note?: string | null
          order_id: string
          place_kind?: Database["public"]["Enums"]["place_kind"] | null
          place_name?: string | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date?: string | null
          scheduled_time?: string | null
          seal_required?: boolean | null
          sequence: number
          trailer_loaded?: boolean | null
          updated_at?: string
        }
        Update: {
          address?: string
          cargo_weight_kg?: number | null
          city?: string
          company_name?: string | null
          completed_at?: string | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          damage_note?: string | null
          external_ref?: string | null
          geocode_score?: number | null
          id?: string
          lat?: number | null
          leg_distance_m?: number | null
          leg_duration_s?: number | null
          lon?: number | null
          note?: string | null
          order_id?: string
          place_kind?: Database["public"]["Enums"]["place_kind"] | null
          place_name?: string | null
          role?: Database["public"]["Enums"]["stop_role"]
          scheduled_date?: string | null
          scheduled_time?: string | null
          seal_required?: boolean | null
          sequence?: number
          trailer_loaded?: boolean | null
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
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        Insert: {
          assigned_company_id?: string | null
          assigned_vehicle_id?: string | null
          chosen_offer_id?: string | null
          closed_at?: string | null
          comment?: string | null
          commission_bps?: number | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          distance_auto_km?: number | null
          distance_km?: number | null
          distance_source?: Database["public"]["Enums"]["distance_source"]
          id?: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          route_bounds?: Json | null
          route_computed_at?: string | null
          route_fingerprint?: string | null
          route_geometry?: string | null
          shipper_company_id: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trailer?: string | null
          trailer_plate?: string | null
          updated_at?: string
        }
        Update: {
          assigned_company_id?: string | null
          assigned_vehicle_id?: string | null
          chosen_offer_id?: string | null
          closed_at?: string | null
          comment?: string | null
          commission_bps?: number | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          distance_auto_km?: number | null
          distance_km?: number | null
          distance_source?: Database["public"]["Enums"]["distance_source"]
          id?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          route_bounds?: Json | null
          route_computed_at?: string | null
          route_fingerprint?: string | null
          route_geometry?: string | null
          shipper_company_id?: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          trailer?: string | null
          trailer_plate?: string | null
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
          adr: boolean
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
          adr?: boolean
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
          adr?: boolean
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
      acknowledge_amendments: { Args: { p_order_id: string }; Returns: number }
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
      add_stop: {
        Args: { p_before_stop_id: string; p_stop: Json }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["amendment_kind"]
          order_id: string
          stop_id: string | null
          stop_label: string
          stop_role: Database["public"]["Enums"]["stop_role"]
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      amend_stop: {
        Args: { p_patch: Json; p_stop_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["amendment_kind"]
          order_id: string
          stop_id: string | null
          stop_label: string
          stop_role: Database["public"]["Enums"]["stop_role"]
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
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
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      carrier_rating: {
        Args: { p_company_id?: string }
        Returns: {
          ratings_count: number
          score: number
        }[]
      }
      choose_offer: {
        Args: { p_offer_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
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
      complete_stop: {
        Args: { p_damage_note?: string; p_stop_id: string }
        Returns: {
          address: string
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_at: string | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          damage_note: string | null
          external_ref: string | null
          geocode_score: number | null
          id: string
          lat: number | null
          leg_distance_m: number | null
          leg_duration_s: number | null
          lon: number | null
          note: string | null
          order_id: string
          place_kind: Database["public"]["Enums"]["place_kind"] | null
          place_name: string | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date: string | null
          scheduled_time: string | null
          seal_required: boolean | null
          sequence: number
          trailer_loaded: boolean | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_stops"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      completed_orders: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          can_rate: boolean
          carrier_name: string
          closed_at: string
          commission_bps: number
          commission_cents: number
          distance_km: number
          documents: Json
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          payout_cents: number
          rate_cents: number
          rating_comment: string
          rating_score: number
          ref: string
          route_bounds: Json
          route_geometry: string
          shipper_name: string
          shipper_ref: string
          stops: Json
          trailer: string
          trailer_plate: string
          vehicle_plate: string
          week: string
        }[]
      }
      confirm_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
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
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
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
      delete_company: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      desk_orders: {
        Args: { p_limit?: number; p_region?: string }
        Returns: {
          comment: string
          distance_km: number
          finish_city: string
          id: string
          offers_count: number
          order_type: Database["public"]["Enums"]["order_type"]
          pickup_city: string
          pickup_date: string
          pickup_time: string
          published_at: string
          rate_cents: number
          ref: string
          route_bounds: Json
          route_geometry: string
          shipper_name: string
          stops: Json
          taken_by_me: boolean
          trailer: string
          trailer_plate: string
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
      fleet_size: {
        Args: never
        Returns: {
          regions: number
          vehicles: number
        }[]
      }
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
          route_bounds: Json
          route_geometry: string
          shipper_name: string
          status: Database["public"]["Enums"]["order_status"]
          stops: Json
          trailer: string
          trailer_plate: string
          vehicle_plate: string
        }[]
      }
      freeze_company: {
        Args: { p_company_id: string; p_reason?: string }
        Returns: Database["public"]["Tables"]["companies"]["Row"]
      }
      unfreeze_company: {
        Args: { p_company_id: string }
        Returns: Database["public"]["Tables"]["companies"]["Row"]
      }
      notify_company: {
        Args: {
          p_company_id: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_title: string
          p_body?: string
          p_link?: string
        }
        Returns: number
      }
      unread_notifications: { Args: never; Returns: number }
      offers_for_shipper: {
        Args: { p_order_ids: string[] }
        Returns: {
          axles: number
          base_city: string
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
          variant_no: number
        }[]
      }
      partner_totals: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          business_id: string
          commission_cents: number
          company_id: string
          company_name: string
          distance_km: number
          orders_count: number
          party: Database["public"]["Enums"]["party_role"]
          payout_cents: number
          rate_cents: number
          rating: number
          ratings_count: number
        }[]
      }
      rate_order: {
        Args: { p_comment?: string; p_order_id: string; p_score: number }
        Returns: {
          carrier_company_id: string
          comment: string | null
          created_at: string
          order_id: string
          rated_by: string | null
          score: number
          shipper_company_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_stop: {
        Args: { p_stop_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actor_id: string | null
          changes: Json
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["amendment_kind"]
          order_id: string
          stop_id: string | null
          stop_label: string
          stop_role: Database["public"]["Enums"]["stop_role"]
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      store_route: {
        Args: { p_order_id: string; p_route: Json }
        Returns: {
          assigned_company_id: string | null
          assigned_vehicle_id: string | null
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
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
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      uncomplete_stop: {
        Args: { p_stop_id: string }
        Returns: {
          address: string
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_at: string | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          damage_note: string | null
          external_ref: string | null
          geocode_score: number | null
          id: string
          lat: number | null
          leg_distance_m: number | null
          leg_duration_s: number | null
          lon: number | null
          note: string | null
          order_id: string
          place_kind: Database["public"]["Enums"]["place_kind"] | null
          place_name: string | null
          role: Database["public"]["Enums"]["stop_role"]
          scheduled_date: string | null
          scheduled_time: string | null
          seal_required: boolean | null
          sequence: number
          trailer_loaded: boolean | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order_stops"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      weekly_totals: {
        Args: { p_weeks?: number }
        Returns: {
          commission_cents: number
          distance_km: number
          orders_count: number
          payout_cents: number
          rate_cents: number
          week: string
        }[]
      }
    }
    Enums: {
      amendment_kind: "STOP_ADDED" | "STOP_CHANGED" | "STOP_REMOVED"
      company_status: "PENDING" | "APPROVED" | "ACTIVE" | "REJECTED"
      distance_source: "MANUAL" | "AUTO"
      document_kind: "CARRIER_LICENSE" | "INSURANCE"
      email_status: "PENDING" | "SENT" | "FAILED" | "SKIPPED"
      notification_kind:
        | "ORDER"
        | "BILLING"
        | "MODERATION"
        | "REPORT"
        | "ADMIN_MESSAGE"
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
      trip_document_kind:
        | "CMR"
        | "LOADING_PHOTO"
        | "UNLOADING_PHOTO"
        | "DAMAGE_PHOTO"
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
      amendment_kind: ["STOP_ADDED", "STOP_CHANGED", "STOP_REMOVED"],
      company_status: ["PENDING", "APPROVED", "ACTIVE", "REJECTED"],
      distance_source: ["MANUAL", "AUTO"],
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
      trip_document_kind: [
        "CMR",
        "LOADING_PHOTO",
        "UNLOADING_PHOTO",
        "DAMAGE_PHOTO",
      ],
      vehicle_access: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
    },
  },
} as const
