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
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          at: string
          detail: Json
          id: number
          subject: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          at?: string
          detail?: Json
          id?: never
          subject: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          at?: string
          detail?: Json
          id?: never
          subject?: string
        }
        Relationships: []
      }
      carrier_fee_deductions: {
        Row: {
          amount_cents: number
          created_at: string
          fee_id: string
          id: string
          period_start: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          fee_id: string
          id?: string
          period_start: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          fee_id?: string
          id?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_fee_deductions_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "carrier_subscription_fees"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_shipper_links: {
        Row: {
          carrier_company_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          shipper_company_id: string
          status: Database["public"]["Enums"]["link_status"]
        }
        Insert: {
          carrier_company_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          shipper_company_id: string
          status?: Database["public"]["Enums"]["link_status"]
        }
        Update: {
          carrier_company_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          shipper_company_id?: string
          status?: Database["public"]["Enums"]["link_status"]
        }
        Relationships: [
          {
            foreignKeyName: "carrier_shipper_links_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_shipper_links_shipper_company_id_fkey"
            columns: ["shipper_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_subscription_fees: {
        Row: {
          active_vehicles: number
          carrier_company_id: string
          created_at: string
          gross_cents: number
          id: string
          month: string
          net_cents: number
          unit_cents: number
          vat_bps: number
        }
        Insert: {
          active_vehicles: number
          carrier_company_id: string
          created_at?: string
          gross_cents: number
          id?: string
          month: string
          net_cents: number
          unit_cents: number
          vat_bps: number
        }
        Update: {
          active_vehicles?: number
          carrier_company_id?: string
          created_at?: string
          gross_cents?: number
          id?: string
          month?: string
          net_cents?: number
          unit_cents?: number
          vat_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "carrier_subscription_fees_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_attachments: {
        Row: {
          author_role: Database["public"]["Enums"]["party_role"]
          claim_id: string
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          author_role: Database["public"]["Enums"]["party_role"]
          claim_id: string
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          author_role?: Database["public"]["Enums"]["party_role"]
          claim_id?: string
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_attachments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          attachment_id: string | null
          author_id: string | null
          author_role: Database["public"]["Enums"]["party_role"]
          body: string | null
          claim_id: string
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["claim_event_kind"]
          status_from: Database["public"]["Enums"]["claim_status"] | null
          status_to: Database["public"]["Enums"]["claim_status"] | null
        }
        Insert: {
          attachment_id?: string | null
          author_id?: string | null
          author_role: Database["public"]["Enums"]["party_role"]
          body?: string | null
          claim_id: string
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["claim_event_kind"]
          status_from?: Database["public"]["Enums"]["claim_status"] | null
          status_to?: Database["public"]["Enums"]["claim_status"] | null
        }
        Update: {
          attachment_id?: string | null
          author_id?: string | null
          author_role?: Database["public"]["Enums"]["party_role"]
          body?: string | null
          claim_id?: string
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["claim_event_kind"]
          status_from?: Database["public"]["Enums"]["claim_status"] | null
          status_to?: Database["public"]["Enums"]["claim_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "claim_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          against_company_id: string
          amount_cents: number | null
          created_at: string
          description: string
          filed_by: string | null
          filed_by_company_id: string
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id: string
          kind: Database["public"]["Enums"]["claim_kind"]
          mirrored_at: string | null
          mirrored_to: string | null
          order_id: string
          ref: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          stop_id: string | null
          updated_at: string
        }
        Insert: {
          against_company_id: string
          amount_cents?: number | null
          created_at?: string
          description: string
          filed_by?: string | null
          filed_by_company_id: string
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id?: string
          kind: Database["public"]["Enums"]["claim_kind"]
          mirrored_at?: string | null
          mirrored_to?: string | null
          order_id: string
          ref: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          stop_id?: string | null
          updated_at?: string
        }
        Update: {
          against_company_id?: string
          amount_cents?: number | null
          created_at?: string
          description?: string
          filed_by?: string | null
          filed_by_company_id?: string
          filed_by_role?: Database["public"]["Enums"]["party_role"]
          id?: string
          kind?: Database["public"]["Enums"]["claim_kind"]
          mirrored_at?: string | null
          mirrored_to?: string | null
          order_id?: string
          ref?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          stop_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_against_company_id_fkey"
            columns: ["against_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_filed_by_company_id_fkey"
            columns: ["filed_by_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "order_stops"
            referencedColumns: ["id"]
          },
        ]
      }
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
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          iban: string | null
          id: string
          is_test: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language: string
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
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          iban?: string | null
          id?: string
          is_test?: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language?: string
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
          freeze_reason?: string | null
          frozen_at?: string | null
          frozen_by?: string | null
          iban?: string | null
          id?: string
          is_test?: boolean
          kind?: Database["public"]["Enums"]["party_role"]
          language?: string
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
      conversations: {
        Row: {
          audience: Database["public"]["Enums"]["chat_audience"]
          channel: Database["public"]["Enums"]["chat_channel"]
          company_id: string | null
          created_at: string
          created_by: string | null
          dispatch_token: string | null
          external_ref: string | null
          id: string
          last_message_at: string
          pending_since: string | null
          status: string
          subject: string | null
        }
        Insert: {
          audience: Database["public"]["Enums"]["chat_audience"]
          channel?: Database["public"]["Enums"]["chat_channel"]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_token?: string | null
          external_ref?: string | null
          id?: string
          last_message_at?: string
          pending_since?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["chat_audience"]
          channel?: Database["public"]["Enums"]["chat_channel"]
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          dispatch_token?: string | null
          external_ref?: string | null
          id?: string
          last_message_at?: string
          pending_since?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_app_events: {
        Row: {
          driver_id: string
          id: string
          kind: string
          pressed_at: string | null
          received_at: string
        }
        Insert: {
          driver_id: string
          id: string
          kind: string
          pressed_at?: string | null
          received_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          kind?: string
          pressed_at?: string | null
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_app_events_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_breaks: {
        Row: {
          client_event_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          shift_id: string
          started_at: string
        }
        Insert: {
          client_event_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          shift_id: string
          started_at: string
        }
        Update: {
          client_event_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          shift_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_breaks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "driver_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invites: {
        Row: {
          code_hash: string | null
          created_at: string
          created_by: string | null
          driver_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          driver_id: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_invites_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notifications: {
        Row: {
          code: string
          created_at: string
          driver_id: string
          id: number
          order_id: string | null
          params: Json
          read_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          driver_id: string
          id?: never
          order_id?: string | null
          params?: Json
          read_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          driver_id?: string
          id?: never
          order_id?: string | null
          params?: Json
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_pay_profiles: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string
          hourly_cents: number | null
          id: string
          model: Database["public"]["Enums"]["pay_model"]
          per_km_cents: number | null
          tes_experience_since: string | null
          tes_grade: string | null
          tes_rule_set_id: string | null
          trip_bps: number | null
          valid_from: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id: string
          hourly_cents?: number | null
          id?: string
          model: Database["public"]["Enums"]["pay_model"]
          per_km_cents?: number | null
          tes_experience_since?: string | null
          tes_grade?: string | null
          tes_rule_set_id?: string | null
          trip_bps?: number | null
          valid_from: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string
          hourly_cents?: number | null
          id?: string
          model?: Database["public"]["Enums"]["pay_model"]
          per_km_cents?: number | null
          tes_experience_since?: string | null
          tes_grade?: string | null
          tes_rule_set_id?: string | null
          trip_bps?: number | null
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_pay_profiles_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_pay_profiles_tes_rule_set_id_fkey"
            columns: ["tes_rule_set_id"]
            isOneToOne: false
            referencedRelation: "tes_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_places: {
        Row: {
          address: string | null
          approx: boolean
          country: string
          details: Json
          free: boolean
          hours_en: string | null
          hours_fi: string | null
          id: string
          kinds: string[]
          lat: number
          lon: number
          name_en: string
          name_fi: string
          network: string | null
          phone: string | null
          sauna: boolean
          secured: boolean
          updated_at: string
          warning: boolean
        }
        Insert: {
          address?: string | null
          approx?: boolean
          country: string
          details?: Json
          free?: boolean
          hours_en?: string | null
          hours_fi?: string | null
          id: string
          kinds: string[]
          lat: number
          lon: number
          name_en: string
          name_fi: string
          network?: string | null
          phone?: string | null
          sauna?: boolean
          secured?: boolean
          updated_at?: string
          warning?: boolean
        }
        Update: {
          address?: string | null
          approx?: boolean
          country?: string
          details?: Json
          free?: boolean
          hours_en?: string | null
          hours_fi?: string | null
          id?: string
          kinds?: string[]
          lat?: number
          lon?: number
          name_en?: string
          name_fi?: string
          network?: string | null
          phone?: string | null
          sauna?: boolean
          secured?: boolean
          updated_at?: string
          warning?: boolean
        }
        Relationships: []
      }
      driver_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          driver_id: string
          endpoint: string
          id: string
          last_sent_at: string | null
          locale: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string
          driver_id: string
          endpoint: string
          id?: string
          last_sent_at?: string | null
          locale?: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string
          driver_id?: string
          endpoint?: string
          id?: string
          last_sent_at?: string | null
          locale?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shift_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          driver_id: string
          id: number
          shift_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          driver_id: string
          id?: never
          shift_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          driver_id?: string
          id?: never
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_shift_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_shifts: {
        Row: {
          client_event_id: string | null
          created_at: string
          created_by: string | null
          driver_id: string
          end_lat: number | null
          end_lon: number | null
          ended_at: string | null
          id: string
          note: string | null
          odometer_end: number | null
          odometer_start: number | null
          source: Database["public"]["Enums"]["shift_source"]
          start_lat: number | null
          start_lon: number | null
          started_at: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          client_event_id?: string | null
          created_at?: string
          created_by?: string | null
          driver_id: string
          end_lat?: number | null
          end_lon?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          source?: Database["public"]["Enums"]["shift_source"]
          start_lat?: number | null
          start_lon?: number | null
          started_at: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          client_event_id?: string | null
          created_at?: string
          created_by?: string | null
          driver_id?: string
          end_lat?: number | null
          end_lon?: number | null
          ended_at?: string | null
          id?: string
          note?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          source?: Database["public"]["Enums"]["shift_source"]
          start_lat?: number | null
          start_lon?: number | null
          started_at?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_shifts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          archived_at: string | null
          auth_user_id: string | null
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          languages: string[]
          needs_review: boolean
          phone: string
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          auth_user_id?: string | null
          company_id: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          languages?: string[]
          needs_review?: boolean
          phone: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          auth_user_id?: string | null
          company_id?: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          languages?: string[]
          needs_review?: boolean
          phone?: string
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_company_fk"
            columns: ["company_id", "company_kind"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "kind"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attachments: Json
          attempts: number
          body_html: string | null
          body_text: string
          company_id: string | null
          created_at: string
          error: string | null
          from_email: string
          id: number
          locale: string
          provider: string
          provider_message_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
          to_name: string | null
        }
        Insert: {
          attachments?: Json
          attempts?: number
          body_html?: string | null
          body_text: string
          company_id?: string | null
          created_at?: string
          error?: string | null
          from_email: string
          id?: never
          locale?: string
          provider: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
          to_name?: string | null
        }
        Update: {
          attachments?: Json
          attempts?: number
          body_html?: string | null
          body_text?: string
          company_id?: string | null
          created_at?: string
          error?: string | null
          from_email?: string
          id?: never
          locale?: string
          provider?: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template?: string
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          fingerprint: string
          first_seen: string
          id: number
          kind: string
          last_seen: string
          message: string
          note: string | null
          path: string | null
          resolved_at: string | null
          seen_count: number
          severity: Database["public"]["Enums"]["incident_severity"]
          source: string
          sqlstate: string | null
          status: Database["public"]["Enums"]["incident_status"]
        }
        Insert: {
          fingerprint: string
          first_seen?: string
          id?: never
          kind: string
          last_seen?: string
          message: string
          note?: string | null
          path?: string | null
          resolved_at?: string | null
          seen_count?: number
          severity?: Database["public"]["Enums"]["incident_severity"]
          source: string
          sqlstate?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Update: {
          fingerprint?: string
          first_seen?: string
          id?: never
          kind?: string
          last_seen?: string
          message?: string
          note?: string | null
          path?: string | null
          resolved_at?: string | null
          seen_count?: number
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string
          sqlstate?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
        }
        Relationships: []
      }
      invoices: {
        Row: {
          company_id: string
          created_at: string
          id: string
          issued_on: string
          number: string
          period_start: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          issued_on?: string
          number: string
          period_start: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          issued_on?: string
          number?: string
          period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          accepted_by: string | null
          company_id: string
          document_id: string
          id: number
          source: string
        }
        Insert: {
          accepted_at?: string
          accepted_by?: string | null
          company_id: string
          document_id: string
          id?: never
          source?: string
        }
        Update: {
          accepted_at?: string
          accepted_by?: string | null
          company_id?: string
          document_id?: string
          id?: never
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_clauses: {
        Row: {
          body: string | null
          document_id: string
          id: string
          locale: string
          number: string | null
          path: number[]
          title: string | null
        }
        Insert: {
          body?: string | null
          document_id: string
          id?: string
          locale: string
          number?: string | null
          path: number[]
          title?: string | null
        }
        Update: {
          body?: string | null
          document_id?: string
          id?: string
          locale?: string
          number?: string | null
          path?: number[]
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_clauses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          activated_at: string | null
          created_at: string
          effective_from: string
          id: string
          kind: Database["public"]["Enums"]["legal_kind"]
          status: Database["public"]["Enums"]["legal_status"]
          version: number
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          kind: Database["public"]["Enums"]["legal_kind"]
          status?: Database["public"]["Enums"]["legal_status"]
          version: number
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          effective_from?: string
          id?: string
          kind?: Database["public"]["Enums"]["legal_kind"]
          status?: Database["public"]["Enums"]["legal_status"]
          version?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender: Database["public"]["Enums"]["chat_sender"]
          sender_user_id: string | null
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: Database["public"]["Enums"]["chat_sender"]
          sender_user_id?: string | null
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: Database["public"]["Enums"]["chat_sender"]
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          code: string | null
          company_id: string
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          params: Json
          read_at: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          params?: Json
          read_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          params?: Json
          read_at?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_profile: {
        Row: {
          bank_name: string | null
          bic: string | null
          brand: string
          business_id: string
          city: string
          country: string
          einvoice_operator: string | null
          einvoice_ovt: string | null
          email: string
          iban: string | null
          legal_name: string
          phone: string | null
          postal_code: string
          singleton: boolean
          street: string
          updated_at: string
          updated_by: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          bank_name?: string | null
          bic?: string | null
          brand?: string
          business_id: string
          city: string
          country?: string
          einvoice_operator?: string | null
          einvoice_ovt?: string | null
          email: string
          iban?: string | null
          legal_name: string
          phone?: string | null
          postal_code: string
          singleton?: boolean
          street: string
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          bank_name?: string | null
          bic?: string | null
          brand?: string
          business_id?: string
          city?: string
          country?: string
          einvoice_operator?: string | null
          einvoice_ovt?: string | null
          email?: string
          iban?: string | null
          legal_name?: string
          phone?: string | null
          postal_code?: string
          singleton?: boolean
          street?: string
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
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
          stop_label: string | null
          stop_role: Database["public"]["Enums"]["stop_role"] | null
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
          stop_label?: string | null
          stop_role?: Database["public"]["Enums"]["stop_role"] | null
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
          stop_label?: string | null
          stop_role?: Database["public"]["Enums"]["stop_role"] | null
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
      order_direct_requests: {
        Row: {
          carrier_company_id: string
          decided_at: string | null
          id: number
          order_id: string
          outcome: Database["public"]["Enums"]["direct_outcome"]
          sent_at: string
          sent_by: string | null
          vehicle_id: string
        }
        Insert: {
          carrier_company_id: string
          decided_at?: string | null
          id?: never
          order_id: string
          outcome?: Database["public"]["Enums"]["direct_outcome"]
          sent_at?: string
          sent_by?: string | null
          vehicle_id: string
        }
        Update: {
          carrier_company_id?: string
          decided_at?: string | null
          id?: never
          order_id?: string
          outcome?: Database["public"]["Enums"]["direct_outcome"]
          sent_at?: string
          sent_by?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_direct_requests_carrier_company_id_fkey"
            columns: ["carrier_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_direct_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_direct_requests_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_documents: {
        Row: {
          angle: string | null
          captured_at: string | null
          captured_lat: number | null
          captured_lon: number | null
          created_at: string
          external_id: string | null
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["trip_document_kind"]
          mime_type: string
          order_id: string
          phase: Database["public"]["Enums"]["trip_phase"] | null
          signer_name: string | null
          size_bytes: number
          source: Database["public"]["Enums"]["trip_document_source"]
          stop_id: string | null
          storage_path: string
          subject: Database["public"]["Enums"]["photo_subject"] | null
          uploaded_by: string | null
        }
        Insert: {
          angle?: string | null
          captured_at?: string | null
          captured_lat?: number | null
          captured_lon?: number | null
          created_at?: string
          external_id?: string | null
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["trip_document_kind"]
          mime_type: string
          order_id: string
          phase?: Database["public"]["Enums"]["trip_phase"] | null
          signer_name?: string | null
          size_bytes: number
          source?: Database["public"]["Enums"]["trip_document_source"]
          stop_id?: string | null
          storage_path: string
          subject?: Database["public"]["Enums"]["photo_subject"] | null
          uploaded_by?: string | null
        }
        Update: {
          angle?: string | null
          captured_at?: string | null
          captured_lat?: number | null
          captured_lon?: number | null
          created_at?: string
          external_id?: string | null
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["trip_document_kind"]
          mime_type?: string
          order_id?: string
          phase?: Database["public"]["Enums"]["trip_phase"] | null
          signer_name?: string | null
          size_bytes?: number
          source?: Database["public"]["Enums"]["trip_document_source"]
          stop_id?: string | null
          storage_path?: string
          subject?: Database["public"]["Enums"]["photo_subject"] | null
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
          origin: Database["public"]["Enums"]["offer_origin"]
          vehicle_id: string
        }
        Insert: {
          carrier_company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id: string
          origin?: Database["public"]["Enums"]["offer_origin"]
          vehicle_id: string
        }
        Update: {
          carrier_company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string
          origin?: Database["public"]["Enums"]["offer_origin"]
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
          arrived_at: string | null
          arrived_lat: number | null
          arrived_lon: number | null
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_accuracy_m: number | null
          completed_at: string | null
          completed_lat: number | null
          completed_lon: number | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
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
          arrived_at?: string | null
          arrived_lat?: number | null
          arrived_lon?: number | null
          cargo_weight_kg?: number | null
          city: string
          company_name?: string | null
          completed_accuracy_m?: number | null
          completed_at?: string | null
          completed_lat?: number | null
          completed_lon?: number | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
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
          arrived_at?: string | null
          arrived_lat?: number | null
          arrived_lon?: number | null
          cargo_weight_kg?: number | null
          city?: string
          company_name?: string | null
          completed_accuracy_m?: number | null
          completed_at?: string | null
          completed_lat?: number | null
          completed_lon?: number | null
          consignee?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
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
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
          trailer: string | null
          trailer_plate: string | null
          updated_at: string
        }
        Insert: {
          assigned_company_id?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          billing?: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id?: string | null
          closed_at?: string | null
          comment?: string | null
          commission_bps?: number | null
          container_feet?: number | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          dispatch_mode?: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km?: number | null
          distance_km?: number | null
          distance_source?: Database["public"]["Enums"]["distance_source"]
          haul_kind?: Database["public"]["Enums"]["haul_kind"]
          id?: string
          invoice_ref?: string | null
          invoiced_at?: string | null
          ldm?: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          route_bounds?: Json | null
          route_computed_at?: string | null
          route_fingerprint?: string | null
          route_geometry?: string | null
          settled_at?: string | null
          shipper_company_id: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps?: number | null
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          terms_document_id?: string | null
          trailer?: string | null
          trailer_plate?: string | null
          updated_at?: string
        }
        Update: {
          assigned_company_id?: string | null
          assigned_driver_id?: string | null
          assigned_vehicle_id?: string | null
          billing?: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id?: string | null
          closed_at?: string | null
          comment?: string | null
          commission_bps?: number | null
          container_feet?: number | null
          created_at?: string
          created_by?: string | null
          deadline_at?: string | null
          dispatch_mode?: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km?: number | null
          distance_km?: number | null
          distance_source?: Database["public"]["Enums"]["distance_source"]
          haul_kind?: Database["public"]["Enums"]["haul_kind"]
          id?: string
          invoice_ref?: string | null
          invoiced_at?: string | null
          ldm?: number | null
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          published_at?: string | null
          rate_cents?: number | null
          ref?: string
          route_bounds?: Json | null
          route_computed_at?: string | null
          route_fingerprint?: string | null
          route_geometry?: string | null
          settled_at?: string | null
          shipper_company_id?: string
          shipper_company_kind?: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps?: number | null
          shipper_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          terms_document_id?: string | null
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
            foreignKeyName: "orders_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
          {
            foreignKeyName: "orders_terms_document_id_fkey"
            columns: ["terms_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      place_guides: {
        Row: {
          body: string
          company_id: string | null
          id: string
          lat: number | null
          locale: string
          lon: number | null
          place_key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          company_id?: string | null
          id?: string
          lat?: number | null
          locale?: string
          lon?: number | null
          place_key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          company_id?: string | null
          id?: string
          lat?: number | null
          locale?: string
          lon?: number | null
          place_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_guides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
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
      shipper_vehicle_pool: {
        Row: {
          added_at: string
          added_by: string | null
          shipper_company_id: string
          vehicle_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          shipper_company_id: string
          vehicle_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          shipper_company_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipper_vehicle_pool_shipper_company_id_fkey"
            columns: ["shipper_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipper_vehicle_pool_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          from_email: string
          handled_at: string | null
          handled_by: string | null
          id: number
          role: Database["public"]["Enums"]["party_role"]
          subject: string
          user_id: string | null
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          from_email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: never
          role: Database["public"]["Enums"]["party_role"]
          subject: string
          user_id?: string | null
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          from_email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: never
          role?: Database["public"]["Enums"]["party_role"]
          subject?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tes_rule_sets: {
        Row: {
          base_hourly_cents: number
          based_on: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          daily_regular_minutes: number
          evening_bps: number
          evening_cents: number
          evening_end: string | null
          evening_start: string | null
          holidays_as_sunday: boolean
          id: string
          min_paid_minutes: number
          name: string
          night_bps: number
          night_cents: number
          night_end: string | null
          night_start: string | null
          note: string | null
          overtime_basis: string
          overtime1_bps: number
          overtime1_minutes: number
          overtime2_bps: number
          period_anchor: string
          period_regular_minutes: number
          saturday_bps: number
          sunday_bps: number
          updated_at: string
          valid_from: string
        }
        Insert: {
          base_hourly_cents: number
          based_on?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_regular_minutes?: number
          evening_bps?: number
          evening_cents?: number
          evening_end?: string | null
          evening_start?: string | null
          holidays_as_sunday?: boolean
          id?: string
          min_paid_minutes?: number
          name: string
          night_bps?: number
          night_cents?: number
          night_end?: string | null
          night_start?: string | null
          note?: string | null
          overtime_basis?: string
          overtime1_bps?: number
          overtime1_minutes?: number
          overtime2_bps?: number
          period_anchor?: string
          period_regular_minutes?: number
          saturday_bps?: number
          sunday_bps?: number
          updated_at?: string
          valid_from: string
        }
        Update: {
          base_hourly_cents?: number
          based_on?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          daily_regular_minutes?: number
          evening_bps?: number
          evening_cents?: number
          evening_end?: string | null
          evening_start?: string | null
          holidays_as_sunday?: boolean
          id?: string
          min_paid_minutes?: number
          name?: string
          night_bps?: number
          night_cents?: number
          night_end?: string | null
          night_start?: string | null
          note?: string | null
          overtime_basis?: string
          overtime1_bps?: number
          overtime1_minutes?: number
          overtime2_bps?: number
          period_anchor?: string
          period_regular_minutes?: number
          saturday_bps?: number
          sunday_bps?: number
          updated_at?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "tes_rule_sets_based_on_fkey"
            columns: ["based_on"]
            isOneToOne: false
            referencedRelation: "tes_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tes_rule_sets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tes_wage_rates: {
        Row: {
          grade: string
          hourly_cents: number
          id: string
          label: string
          rule_set_id: string
          sort: number
          valid_from: string
        }
        Insert: {
          grade: string
          hourly_cents: number
          id?: string
          label: string
          rule_set_id: string
          sort?: number
          valid_from: string
        }
        Update: {
          grade?: string
          hourly_cents?: number
          id?: string
          label?: string
          rule_set_id?: string
          sort?: number
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "tes_wage_rates_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "tes_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_drivers: {
        Row: {
          assigned_by: string | null
          created_at: string
          driver_id: string
          during: unknown
          id: number
          vehicle_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          driver_id: string
          during: unknown
          id?: never
          vehicle_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          driver_id?: string
          during?: unknown
          id?: never
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
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
          base_country: string | null
          base_lat: number | null
          base_lon: number | null
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          container_feet: number[]
          created_at: string
          driver_name: string | null
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          ldm: number | null
          make: string
          payload_kg: number | null
          plate: string
          reefer: boolean
          reefer_inspection_until: string | null
          rejected_at: string | null
          rejection_reason: string | null
          side_loading: boolean
          submitted_at: string | null
          tail_lift: boolean
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          whatsapp: string | null
        }
        Insert: {
          access?: Database["public"]["Enums"]["vehicle_access"]
          adr?: boolean
          approved_at?: string | null
          axles: number
          base_city: string
          base_country?: string | null
          base_lat?: number | null
          base_lon?: number | null
          company_id: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          container_feet?: number[]
          created_at?: string
          driver_name?: string | null
          euro_class: Database["public"]["Enums"]["euro_class"]
          id?: string
          languages?: string[]
          ldm?: number | null
          make: string
          payload_kg?: number | null
          plate: string
          reefer?: boolean
          reefer_inspection_until?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          side_loading?: boolean
          submitted_at?: string | null
          tail_lift?: boolean
          updated_at?: string
          vehicle_class?: Database["public"]["Enums"]["vehicle_class"]
          whatsapp?: string | null
        }
        Update: {
          access?: Database["public"]["Enums"]["vehicle_access"]
          adr?: boolean
          approved_at?: string | null
          axles?: number
          base_city?: string
          base_country?: string | null
          base_lat?: number | null
          base_lon?: number | null
          company_id?: string
          company_kind?: Database["public"]["Enums"]["party_role"]
          container_feet?: number[]
          created_at?: string
          driver_name?: string | null
          euro_class?: Database["public"]["Enums"]["euro_class"]
          id?: string
          languages?: string[]
          ldm?: number | null
          make?: string
          payload_kg?: number | null
          plate?: string
          reefer?: boolean
          reefer_inspection_until?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          side_loading?: boolean
          submitted_at?: string | null
          tail_lift?: boolean
          updated_at?: string
          vehicle_class?: Database["public"]["Enums"]["vehicle_class"]
          whatsapp?: string | null
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
      weekly_reports: {
        Row: {
          bytes: number | null
          commission_bps: number | null
          commission_cents: number | null
          company_id: string | null
          due_date: string | null
          emailed_at: string | null
          file_path: string
          generated_at: string
          gross_cents: number
          id: string
          kind: Database["public"]["Enums"]["report_kind"]
          orders_count: number
          payout_cents: number | null
          role: Database["public"]["Enums"]["party_role"]
          vat_bps: number
          week: string
        }
        Insert: {
          bytes?: number | null
          commission_bps?: number | null
          commission_cents?: number | null
          company_id?: string | null
          due_date?: string | null
          emailed_at?: string | null
          file_path: string
          generated_at?: string
          gross_cents?: number
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          orders_count?: number
          payout_cents?: number | null
          role: Database["public"]["Enums"]["party_role"]
          vat_bps: number
          week: string
        }
        Update: {
          bytes?: number | null
          commission_bps?: number | null
          commission_cents?: number | null
          company_id?: string | null
          due_date?: string | null
          emailed_at?: string | null
          file_path?: string
          generated_at?: string
          gross_cents?: number
          id?: string
          kind?: Database["public"]["Enums"]["report_kind"]
          orders_count?: number
          payout_cents?: number | null
          role?: Database["public"]["Enums"]["party_role"]
          vat_bps?: number
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      incident_feed: {
        Row: {
          fingerprint: string | null
          first_seen: string | null
          id: number | null
          kind: string | null
          last_seen: string | null
          message: string | null
          path: string | null
          seen_count: number | null
          severity: Database["public"]["Enums"]["incident_severity"] | null
          source: string | null
          sqlstate: string | null
          status: Database["public"]["Enums"]["incident_status"] | null
        }
        Insert: {
          fingerprint?: string | null
          first_seen?: string | null
          id?: number | null
          kind?: string | null
          last_seen?: string | null
          message?: string | null
          path?: string | null
          seen_count?: number | null
          severity?: Database["public"]["Enums"]["incident_severity"] | null
          source?: string | null
          sqlstate?: string | null
          status?: Database["public"]["Enums"]["incident_status"] | null
        }
        Update: {
          fingerprint?: string | null
          first_seen?: string | null
          id?: number | null
          kind?: string | null
          last_seen?: string | null
          message?: string | null
          path?: string | null
          seen_count?: number | null
          severity?: Database["public"]["Enums"]["incident_severity"] | null
          source?: string | null
          sqlstate?: string | null
          status?: Database["public"]["Enums"]["incident_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      abandon_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      accept_legal: { Args: { p_source?: string }; Returns: number }
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
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          iban: string | null
          id: string
          is_test: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language: string
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
      activate_legal_version: {
        Args: { p_document_id: string }
        Returns: {
          activated_at: string | null
          created_at: string
          effective_from: string
          id: string
          kind: Database["public"]["Enums"]["legal_kind"]
          status: Database["public"]["Enums"]["legal_status"]
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "legal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      active_legal_document: {
        Args: { p_kind: Database["public"]["Enums"]["legal_kind"] }
        Returns: string
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
          stop_label: string | null
          stop_role: Database["public"]["Enums"]["stop_role"] | null
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_company_orders: {
        Args: { p_company_id: string }
        Returns: {
          as_carrier: number
          as_shipper: number
        }[]
      }
      admin_disposable_orders: {
        Args: { p_limit?: number }
        Returns: {
          created_at: string
          distance_km: number
          id: string
          rate_cents: number
          ref: string
          shipper_name: string
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      agent_ask_operator: {
        Args: {
          p_conversation_id: string
          p_question: string
          p_subject?: string
          p_token: string
        }
        Returns: Json
      }
      agent_claim: {
        Args: { p_conversation_id: string; p_ref: string; p_token: string }
        Returns: {
          amount_eur: number
          carrier_name: string
          created_at: string
          description: string
          filed_by: string
          filed_by_you: boolean
          forwarded_to_counterparty_at: string
          kind: Database["public"]["Enums"]["claim_kind"]
          last_operator_message: string
          messages_count: number
          order_ref: string
          ref: string
          resolution: string
          resolved_at: string
          shipper_name: string
          status: Database["public"]["Enums"]["claim_status"]
        }[]
      }
      agent_company_money: {
        Args: { p_conversation_id: string; p_token: string; p_weeks?: number }
        Returns: {
          commission_cents: number
          gross_cents: number
          orders_count: number
          payout_cents: number
          week: string
        }[]
      }
      agent_legal_clause: {
        Args: {
          p_conversation_id: string
          p_kind?: Database["public"]["Enums"]["legal_kind"]
          p_locale?: string
          p_number: string
          p_token: string
        }
        Returns: {
          body: string
          number: string
          section_title: string
          title: string
          version: number
        }[]
      }
      agent_order_by_ref: {
        Args: { p_conversation_id: string; p_ref: string; p_token: string }
        Returns: {
          closed_at: string
          container_feet: number
          counterparty: string
          distance_km: number
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          order_type: Database["public"]["Enums"]["order_type"]
          payout_due: string
          payout_period_start: string
          published_at: string
          rate_cents: number
          ref: string
          status: Database["public"]["Enums"]["order_status"]
          trailer: string
          trailer_plate: string
        }[]
      }
      agent_payout_schedule: {
        Args: { p_conversation_id: string; p_periods?: number; p_token: string }
        Returns: {
          days_left: number
          gross_cents: number
          invoice_due: string
          orders_count: number
          payout_cents: number
          payout_due: string
          period_end: string
          period_start: string
        }[]
      }
      agent_place_guide: {
        Args: {
          p_conversation_id: string
          p_locale?: string
          p_query: string
          p_token: string
        }
        Returns: {
          body: string
          place_key: string
          title: string
        }[]
      }
      agent_privileges: {
        Args: never
        Returns: {
          object: string
          privilege: string
        }[]
      }
      agent_sql: {
        Args: {
          p_conversation_id: string
          p_limit?: number
          p_query: string
          p_token: string
        }
        Returns: Json
      }
      agent_trip_documents: {
        Args: { p_conversation_id: string; p_ref: string; p_token: string }
        Returns: {
          kind: Database["public"]["Enums"]["trip_document_kind"]
          ref: string
          uploaded_at: string
        }[]
      }
      agent_trip_status: {
        Args: { p_conversation_id: string; p_ref: string; p_token: string }
        Returns: {
          city: string
          completed_at: string
          damage: string
          place_name: string
          ref: string
          scheduled_date: string
          scheduled_time: string
          sequence: number
          status: Database["public"]["Enums"]["order_status"]
          stop_role: Database["public"]["Enums"]["stop_role"]
        }[]
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
          stop_label: string | null
          stop_role: Database["public"]["Enums"]["stop_role"] | null
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_carrier_fees: {
        Args: {
          p_available_cents: number
          p_company_id: string
          p_period_start: string
        }
        Returns: {
          active_vehicles: number
          amount_cents: number
          month: string
          unit_cents: number
          vat_bps: number
        }[]
      }
      archive_driver: { Args: { p_driver_id: string }; Returns: undefined }
      assign_vehicle_driver: {
        Args: { p_driver_id: string; p_vehicle_id: string }
        Returns: undefined
      }
      attach_to_claim: {
        Args: {
          p_claim_id: string
          p_file_name: string
          p_mime_type: string
          p_note?: string
          p_size_bytes: number
          p_storage_path: string
        }
        Returns: string
      }
      auth_throttle_hit: {
        Args: { p_key_hash: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      billing_overview: {
        Args: never
        Returns: {
          billing: Database["public"]["Enums"]["billing_status"]
          carrier_bic: string
          carrier_business_id: string
          carrier_country: string
          carrier_iban: string
          carrier_id: string
          carrier_name: string
          closed_at: string
          commission_cents: number
          id: string
          invoice_due: string
          invoice_ref: string
          invoiced_at: string
          paid_at: string
          payout_cents: number
          payout_due: string
          period_end: string
          period_start: string
          rate_cents: number
          ref: string
          route_from: string
          route_to: string
          settled_at: string
          shipper_billing_email: string
          shipper_business_id: string
          shipper_country: string
          shipper_fee_cents: number
          shipper_id: string
          shipper_name: string
          shipper_ref: string
        }[]
      }
      billing_queue: {
        Args: { p_limit?: number }
        Returns: {
          billing: Database["public"]["Enums"]["billing_status"]
          carrier_name: string
          closed_at: string
          commission_bps: number
          id: string
          invoice_ref: string
          rate_cents: number
          ref: string
          shipper_name: string
        }[]
      }
      cancel_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      carrier_partners: {
        Args: never
        Returns: {
          decided_at: string
          last_route: string
          last_trip_at: string
          shipper_id: string
          shipper_name: string
          status: Database["public"]["Enums"]["link_status"]
          trips: number
        }[]
      }
      carrier_presence: {
        Args: never
        Returns: {
          city: string
          country: string
          lat: number
          lon: number
          tractors: number
          trucks: number
          vans: number
        }[]
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
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      claim_detail: { Args: { p_claim_id: string }; Returns: Json }
      claim_driver_invite: {
        Args: { p_invite_id: string; p_user_id: string }
        Returns: string
      }
      claims_open_count: { Args: never; Returns: number }
      close_order: {
        Args: { p_order_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      comment_claim: {
        Args: { p_body: string; p_claim_id: string }
        Returns: number
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
        Args: {
          p_accuracy_m?: number
          p_damage_note?: string
          p_lat?: number
          p_lon?: number
          p_stop_id: string
        }
        Returns: {
          address: string
          arrived_at: string | null
          arrived_lat: number | null
          arrived_lon: number | null
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_accuracy_m: number | null
          completed_at: string | null
          completed_lat: number | null
          completed_lon: number | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
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
          container_feet: number
          distance_km: number
          documents: Json
          haul_kind: Database["public"]["Enums"]["haul_kind"]
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
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      copy_tes_template: { Args: { p_template_id: string }; Returns: string }
      create_driver_invite: {
        Args: { p_driver_id: string }
        Returns: {
          code: string
          token: string
        }[]
      }
      create_order: {
        Args: { p_order: Json; p_publish?: boolean; p_stops: Json }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
          adr: boolean
          approved_at: string | null
          axles: number
          base_city: string
          base_country: string | null
          base_lat: number | null
          base_lon: number | null
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          container_feet: number[]
          created_at: string
          driver_name: string | null
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          ldm: number | null
          make: string
          payload_kg: number | null
          plate: string
          reefer: boolean
          reefer_inspection_until: string | null
          rejected_at: string | null
          rejection_reason: string | null
          side_loading: boolean
          submitted_at: string | null
          tail_lift: boolean
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_company: { Args: { p_company_id: string }; Returns: string[] }
      delete_conversation: {
        Args: { p_conversation_id: string }
        Returns: string
      }
      delete_order: { Args: { p_order_id: string }; Returns: string }
      desk_orders: {
        Args: { p_limit?: number; p_region?: string }
        Returns: {
          comment: string
          container_feet: number
          distance_km: number
          finish_city: string
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          ldm: number
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
      detach_driver_login: { Args: { p_driver_id: string }; Returns: string }
      direct_assign_order: {
        Args: { p_order_id: string; p_vehicle_id: string }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      driver_arrive_stop: {
        Args: {
          p_at?: string
          p_event_id?: string
          p_lat?: number
          p_lon?: number
          p_stop_id: string
        }
        Returns: undefined
      }
      driver_complete_stop: {
        Args: {
          p_accuracy_m?: number
          p_at?: string
          p_damage_note?: string
          p_event_id?: string
          p_lat?: number
          p_lon?: number
          p_stop_id: string
        }
        Returns: undefined
      }
      driver_earnings: { Args: { p_from: string; p_to: string }; Returns: Json }
      driver_invite_lookup: {
        Args: { p_code?: string; p_phone?: string; p_token?: string }
        Returns: {
          auth_user_id: string
          company_name: string
          driver_id: string
          full_name: string
          invite_id: string
        }[]
      }
      driver_me: { Args: never; Returns: Json }
      driver_push_subscribe: {
        Args: {
          p_auth: string
          p_endpoint: string
          p_locale?: string
          p_p256dh: string
        }
        Returns: undefined
      }
      driver_push_unsubscribe: {
        Args: { p_endpoint: string }
        Returns: undefined
      }
      driver_register_photo: {
        Args: {
          p_angle?: string
          p_captured_at?: string
          p_cmr?: boolean
          p_damage?: boolean
          p_external_id?: string
          p_lat?: number
          p_lon?: number
          p_mime_type: string
          p_order_id: string
          p_signer_name?: string
          p_size_bytes: number
          p_stop_id: string
          p_storage_path: string
          p_subject: Database["public"]["Enums"]["photo_subject"]
        }
        Returns: string
      }
      driver_report_problem: {
        Args: { p_order_id: string; p_text: string }
        Returns: undefined
      }
      driver_shift_action: {
        Args: {
          p_action: string
          p_at?: string
          p_event_id?: string
          p_lat?: number
          p_lon?: number
        }
        Returns: undefined
      }
      driver_tasks: {
        Args: never
        Returns: {
          closed_at: string
          comment: string
          container_feet: number
          deadline_at: string
          direct: boolean
          distance_km: number
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          ldm: number
          order_type: Database["public"]["Enums"]["order_type"]
          plate: string
          ref: string
          shipper_name: string
          status: Database["public"]["Enums"]["order_status"]
          stops: Json
          trailer: string
          trailer_plate: string
        }[]
      }
      driver_trip_photos: {
        Args: { p_order_id: string }
        Returns: {
          angle: string
          captured_at: string
          id: string
          kind: Database["public"]["Enums"]["trip_document_kind"]
          phase: Database["public"]["Enums"]["trip_phase"]
          signer_name: string
          stop_id: string
          storage_path: string
          subject: Database["public"]["Enums"]["photo_subject"]
        }[]
      }
      driver_trips: {
        Args: { p_from: string; p_to: string }
        Returns: {
          closed_at: string
          distance_km: number
          driver_id: string
          order_id: string
          payout_cents: number
          plate: string
          ref: string
          started_at: string
          stops_done: number
        }[]
      }
      expire_order_deadlines: { Args: never; Returns: number }
      file_claim: {
        Args: {
          p_amount_cents?: number
          p_description: string
          p_kind: Database["public"]["Enums"]["claim_kind"]
          p_order_id: string
          p_stop_id?: string
        }
        Returns: {
          against_company_id: string
          amount_cents: number | null
          created_at: string
          description: string
          filed_by: string | null
          filed_by_company_id: string
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id: string
          kind: Database["public"]["Enums"]["claim_kind"]
          mirrored_at: string | null
          mirrored_to: string | null
          order_id: string
          ref: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          stop_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fleet_size: {
        Args: never
        Returns: {
          regions: number
          vehicles: number
        }[]
      }
      freeze_company: {
        Args: { p_company_id: string; p_reason?: string }
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
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          iban: string | null
          id: string
          is_test: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language: string
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
      handle_support_message: { Args: { p_id: number }; Returns: undefined }
      issue_monthly_subscriptions: {
        Args: { p_month: string }
        Returns: number
      }
      known_vehicles_for_shipper: {
        Args: never
        Returns: {
          available: boolean
          axles: number
          busy: boolean
          container_feet: number[]
          driver_email: string
          driver_name: string
          driver_phone: string
          euro_class: Database["public"]["Enums"]["euro_class"]
          in_pool: boolean
          last_trip_at: string
          ldm: number
          make: string
          payload_kg: number
          plate: string
          rating: number
          trips: number
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          vehicle_id: string
        }[]
      }
      legal_clause: {
        Args: {
          p_kind: Database["public"]["Enums"]["legal_kind"]
          p_locale: string
          p_number: string
        }
        Returns: {
          body: string
          number: string
          section_title: string
          title: string
          version: number
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
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          iban: string | null
          id: string
          is_test: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language: string
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
          container_feet: number
          deadline_at: string
          distance_km: number
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          ldm: number
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
      my_claims: {
        Args: { p_status?: Database["public"]["Enums"]["claim_status"] }
        Returns: {
          amount_cents: number
          carrier_name: string
          created_at: string
          events_count: number
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id: string
          kind: Database["public"]["Enums"]["claim_kind"]
          last_event_at: string
          mine: boolean
          order_id: string
          order_ref: string
          ref: string
          route_from: string
          route_to: string
          shipper_name: string
          status: Database["public"]["Enums"]["claim_status"]
          updated_at: string
          vehicle_plate: string
        }[]
      }
      new_legal_version: {
        Args: { p_kind: Database["public"]["Enums"]["legal_kind"] }
        Returns: {
          activated_at: string | null
          created_at: string
          effective_from: string
          id: string
          kind: Database["public"]["Enums"]["legal_kind"]
          status: Database["public"]["Enums"]["legal_status"]
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "legal_documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      notify_company: {
        Args: {
          p_body?: string
          p_company_id: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_link?: string
          p_title: string
        }
        Returns: number
      }
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
      order_dispatch_card: { Args: { p_order_id: string }; Returns: Json }
      order_dispatch_recipients: {
        Args: { p_order_id: string }
        Returns: {
          company_id: string
          company_name: string
          contact_email: string
          language: string
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
      period_claims: {
        Args: { p_company?: string; p_from: string; p_to: string }
        Returns: {
          amount_cents: number
          carrier_name: string
          created_at: string
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id: string
          kind: Database["public"]["Enums"]["claim_kind"]
          mine: boolean
          order_ref: string
          ref: string
          resolution: string
          resolved_at: string
          shipper_name: string
          status: Database["public"]["Enums"]["claim_status"]
        }[]
      }
      period_invoice: {
        Args: { p_company_id: string; p_period_start: string }
        Returns: {
          company_id: string
          created_at: string
          id: string
          issued_on: string
          number: string
          period_start: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      period_report: {
        Args: { p_company?: string; p_from: string; p_to: string }
        Returns: {
          carrier_country: string
          carrier_id: string
          carrier_name: string
          claims: Json
          closed_at: string
          closed_on: string
          cmr_count: number
          commission_bps: number
          commission_cents: number
          container_feet: number
          distance_km: number
          documents_count: number
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          order_type: Database["public"]["Enums"]["order_type"]
          payout_cents: number
          photos_count: number
          rate_cents: number
          ref: string
          route: string
          shipper_country: string
          shipper_fee_cents: number
          shipper_id: string
          shipper_name: string
          shipper_ref: string
          stops_count: number
          trailer: string
          trailer_plate: string
          vehicle_plate: string
        }[]
      }
      platform_pulse: {
        Args: never
        Returns: {
          metric: string
          threshold: number
          value: number
        }[]
      }
      pool_add_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      pool_remove_vehicle: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      prune_auth_throttle: { Args: never; Returns: number }
      prune_incidents: { Args: { p_keep_days?: number }; Returns: number }
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
      reconcile_scheduler_calls: { Args: never; Returns: number }
      record_incident: {
        Args: {
          p_fingerprint: string
          p_kind: string
          p_message: string
          p_path?: string
          p_severity: Database["public"]["Enums"]["incident_severity"]
          p_source: string
          p_sqlstate?: string
        }
        Returns: number
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
          stop_label: string | null
          stop_role: Database["public"]["Enums"]["stop_role"] | null
        }
        SetofOptions: {
          from: "*"
          to: "order_amendments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reprice_order: {
        Args: {
          p_distance_km: number
          p_order_id: string
          p_rate_cents: number
        }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      restore_driver: { Args: { p_driver_id: string }; Returns: undefined }
      role_privileges: {
        Args: { p_role: string }
        Returns: {
          object: string
          privilege: string
        }[]
      }
      run_scheduled_job: { Args: { p_job: string }; Returns: Json }
      scheduler_health: { Args: never; Returns: Json }
      set_billing: {
        Args: {
          p_invoice_ref?: string
          p_next: Database["public"]["Enums"]["billing_status"]
          p_order_id: string
        }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      set_claim_status: {
        Args: {
          p_claim_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["claim_status"]
        }
        Returns: {
          against_company_id: string
          amount_cents: number | null
          created_at: string
          description: string
          filed_by: string | null
          filed_by_company_id: string
          filed_by_role: Database["public"]["Enums"]["party_role"]
          id: string
          kind: Database["public"]["Enums"]["claim_kind"]
          mirrored_at: string | null
          mirrored_to: string | null
          order_id: string
          ref: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          stop_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_company_test: {
        Args: { p_company_id: string; p_test: boolean }
        Returns: undefined
      }
      set_runtime_config: {
        Args: { p_key: string; p_note?: string; p_value: string }
        Returns: Json
      }
      set_shipper_link: {
        Args: { p_allow: boolean; p_shipper_id: string }
        Returns: undefined
      }
      settlement_period: {
        Args: { p_moment?: string }
        Returns: {
          invoice_due: string
          payout_due: string
          period_end: string
          period_start: string
        }[]
      }
      store_route: {
        Args: { p_order_id: string; p_route: Json }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
      submit_support_message: {
        Args: { p_body: string; p_subject: string }
        Returns: number
      }
      submit_vehicle: {
        Args: { p_vehicle_id: string }
        Returns: {
          access: Database["public"]["Enums"]["vehicle_access"]
          adr: boolean
          approved_at: string | null
          axles: number
          base_city: string
          base_country: string | null
          base_lat: number | null
          base_lon: number | null
          company_id: string
          company_kind: Database["public"]["Enums"]["party_role"]
          container_feet: number[]
          created_at: string
          driver_name: string | null
          euro_class: Database["public"]["Enums"]["euro_class"]
          id: string
          languages: string[]
          ldm: number | null
          make: string
          payload_kg: number | null
          plate: string
          reefer: boolean
          reefer_inspection_until: string | null
          rejected_at: string | null
          rejection_reason: string | null
          side_loading: boolean
          submitted_at: string | null
          tail_lift: boolean
          updated_at: string
          vehicle_class: Database["public"]["Enums"]["vehicle_class"]
          whatsapp: string | null
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
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
          arrived_at: string | null
          arrived_lat: number | null
          arrived_lon: number | null
          cargo_weight_kg: number | null
          city: string
          company_name: string | null
          completed_accuracy_m: number | null
          completed_at: string | null
          completed_lat: number | null
          completed_lon: number | null
          consignee: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
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
      unfreeze_company: {
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
          freeze_reason: string | null
          frozen_at: string | null
          frozen_by: string | null
          iban: string | null
          id: string
          is_test: boolean
          kind: Database["public"]["Enums"]["party_role"]
          language: string
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
      unread_notifications: { Args: never; Returns: number }
      update_operator_profile: {
        Args: { p: Json }
        Returns: {
          bank_name: string | null
          bic: string | null
          brand: string
          business_id: string
          city: string
          country: string
          einvoice_operator: string | null
          einvoice_ovt: string | null
          email: string
          iban: string | null
          legal_name: string
          phone: string | null
          postal_code: string
          singleton: boolean
          street: string
          updated_at: string
          updated_by: string | null
          vat_number: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "operator_profile"
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
      withdraw_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: {
          assigned_company_id: string | null
          assigned_driver_id: string | null
          assigned_vehicle_id: string | null
          billing: Database["public"]["Enums"]["billing_status"]
          chosen_offer_id: string | null
          closed_at: string | null
          comment: string | null
          commission_bps: number | null
          container_feet: number | null
          created_at: string
          created_by: string | null
          deadline_at: string | null
          dispatch_mode: Database["public"]["Enums"]["dispatch_mode"]
          distance_auto_km: number | null
          distance_km: number | null
          distance_source: Database["public"]["Enums"]["distance_source"]
          haul_kind: Database["public"]["Enums"]["haul_kind"]
          id: string
          invoice_ref: string | null
          invoiced_at: string | null
          ldm: number | null
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          published_at: string | null
          rate_cents: number | null
          ref: string
          route_bounds: Json | null
          route_computed_at: string | null
          route_fingerprint: string | null
          route_geometry: string | null
          settled_at: string | null
          shipper_company_id: string
          shipper_company_kind: Database["public"]["Enums"]["party_role"]
          shipper_fee_bps: number | null
          shipper_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          terms_document_id: string | null
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
    }
    Enums: {
      amendment_kind:
        | "STOP_ADDED"
        | "STOP_CHANGED"
        | "STOP_REMOVED"
        | "ORDER_REPRICED"
        | "ORDER_CANCELLED"
        | "ORDER_RELEASED"
      billing_status: "PENDING" | "INVOICED" | "PAID" | "SETTLED"
      chat_audience: "DRIVER" | "CARRIER" | "SHIPPER" | "ADMIN"
      chat_channel: "WEB" | "WHATSAPP"
      chat_sender: "USER" | "AGENT" | "OPERATOR"
      claim_event_kind: "CREATED" | "COMMENT" | "STATUS" | "ATTACHMENT"
      claim_kind:
        | "CARGO_DAMAGE"
        | "SHORTAGE"
        | "DOWNTIME"
        | "DEVIATION"
        | "OTHER"
      claim_status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED"
      company_status: "PENDING" | "APPROVED" | "ACTIVE" | "REJECTED"
      direct_outcome: "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN"
      dispatch_mode: "DESK" | "DIRECT"
      distance_source: "MANUAL" | "AUTO"
      document_kind: "CARRIER_LICENSE" | "INSURANCE"
      driver_status: "ACTIVE" | "ARCHIVED"
      email_status: "PENDING" | "SENT" | "FAILED" | "SKIPPED"
      euro_class: "EURO_4" | "EURO_5" | "EURO_6"
      haul_branch: "UNIT" | "EXPRESS"
      haul_kind: "TRAILER" | "CONTAINER" | "VAN" | "TRUCK"
      incident_severity: "WARN" | "ERROR" | "FATAL"
      incident_status: "OPEN" | "ACKED" | "RESOLVED"
      legal_kind:
        | "TERMS"
        | "PRIVACY"
        | "CARRIER_AGREEMENT"
        | "SHIPPER_AGREEMENT"
      legal_status: "DRAFT" | "ACTIVE" | "ARCHIVED"
      link_status: "OFFERED" | "ACTIVE" | "REVOKED"
      notification_kind:
        | "ORDER"
        | "BILLING"
        | "MODERATION"
        | "REPORT"
        | "ADMIN_MESSAGE"
        | "CLAIM"
      offer_origin: "DESK" | "DIRECT"
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
      pay_model: "PER_KM" | "TRIP_PERCENT" | "FLAT_HOURLY" | "TES"
      photo_subject:
        | "TRAILER"
        | "CARGO"
        | "SEAL"
        | "DOCUMENT"
        | "OTHER"
        | "SIGNATURE"
      place_kind: "PORT" | "TERMINAL" | "PARKING" | "ADDRESS"
      report_kind: "WEEK" | "PERIOD"
      shift_source: "APP" | "MANUAL"
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
      trip_document_source: "CABINET" | "DRIVER_APP"
      trip_phase: "PICKUP" | "DELIVERY"
      vehicle_access: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED"
      vehicle_class: "TRACTOR" | "VAN" | "TRUCK"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      amendment_kind: [
        "STOP_ADDED",
        "STOP_CHANGED",
        "STOP_REMOVED",
        "ORDER_REPRICED",
        "ORDER_CANCELLED",
        "ORDER_RELEASED",
      ],
      billing_status: ["PENDING", "INVOICED", "PAID", "SETTLED"],
      chat_audience: ["DRIVER", "CARRIER", "SHIPPER", "ADMIN"],
      chat_channel: ["WEB", "WHATSAPP"],
      chat_sender: ["USER", "AGENT", "OPERATOR"],
      claim_event_kind: ["CREATED", "COMMENT", "STATUS", "ATTACHMENT"],
      claim_kind: [
        "CARGO_DAMAGE",
        "SHORTAGE",
        "DOWNTIME",
        "DEVIATION",
        "OTHER",
      ],
      claim_status: ["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"],
      company_status: ["PENDING", "APPROVED", "ACTIVE", "REJECTED"],
      direct_outcome: ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"],
      dispatch_mode: ["DESK", "DIRECT"],
      distance_source: ["MANUAL", "AUTO"],
      document_kind: ["CARRIER_LICENSE", "INSURANCE"],
      driver_status: ["ACTIVE", "ARCHIVED"],
      email_status: ["PENDING", "SENT", "FAILED", "SKIPPED"],
      euro_class: ["EURO_4", "EURO_5", "EURO_6"],
      haul_branch: ["UNIT", "EXPRESS"],
      haul_kind: ["TRAILER", "CONTAINER", "VAN", "TRUCK"],
      incident_severity: ["WARN", "ERROR", "FATAL"],
      incident_status: ["OPEN", "ACKED", "RESOLVED"],
      legal_kind: [
        "TERMS",
        "PRIVACY",
        "CARRIER_AGREEMENT",
        "SHIPPER_AGREEMENT",
      ],
      legal_status: ["DRAFT", "ACTIVE", "ARCHIVED"],
      link_status: ["OFFERED", "ACTIVE", "REVOKED"],
      notification_kind: [
        "ORDER",
        "BILLING",
        "MODERATION",
        "REPORT",
        "ADMIN_MESSAGE",
        "CLAIM",
      ],
      offer_origin: ["DESK", "DIRECT"],
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
      pay_model: ["PER_KM", "TRIP_PERCENT", "FLAT_HOURLY", "TES"],
      photo_subject: [
        "TRAILER",
        "CARGO",
        "SEAL",
        "DOCUMENT",
        "OTHER",
        "SIGNATURE",
      ],
      place_kind: ["PORT", "TERMINAL", "PARKING", "ADDRESS"],
      report_kind: ["WEEK", "PERIOD"],
      shift_source: ["APP", "MANUAL"],
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
      trip_document_source: ["CABINET", "DRIVER_APP"],
      trip_phase: ["PICKUP", "DELIVERY"],
      vehicle_access: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      vehicle_class: ["TRACTOR", "VAN", "TRUCK"],
    },
  },
} as const
