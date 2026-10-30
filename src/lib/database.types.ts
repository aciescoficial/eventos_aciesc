
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "absences": {
                  Row: {
                    "created_at": string,"event_date_id": string,"id": number,"person_id": string,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_date_id": string,"id"?: never,"person_id": string,"ticket_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_date_id"?: string,"id"?: never,"person_id"?: string,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absences_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: true
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"updated_by": string | null,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"updated_by"?: string | null,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_user_id": string | null,"created_at": string,"data": NonNullable<Json>,"entity": string,"entity_id": string | null,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity": string,"entity_id"?: string | null,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor_user_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"entity"?: string,"entity_id"?: string | null,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "code": string,"event_date": string,"event_title": string,"hours": number,"id": string,"issued_at": string,"person_name": string,"revoked_at": string | null,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code"?: string,"event_date": string,"event_title": string,"hours": number,"id"?: string,"issued_at"?: string,"person_name": string,"revoked_at"?: string | null,"ticket_id": string
                  }
                  Update: {
                    "code"?: string,"event_date"?: string,"event_title"?: string,"hours"?: number,"id"?: string,"issued_at"?: string,"person_name"?: string,"revoked_at"?: string | null,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: true
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "at": string,"by_user_id": string | null,"device_id": string | null,"id": number,"kind": Database["public"]['Enums']["checkin_kind"],"offline": boolean,"ticket_id": string,"undone_at": string | null,"undone_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"by_user_id"?: string | null,"device_id"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["checkin_kind"],"offline"?: boolean,"ticket_id": string,"undone_at"?: string | null,"undone_by"?: string | null
                  }
                  Update: {
                    "at"?: string,"by_user_id"?: string | null,"device_id"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["checkin_kind"],"offline"?: boolean,"ticket_id"?: string,"undone_at"?: string | null,"undone_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"coupons": {
                  Row: {
                    "active": boolean,"code": string,"event_id": string,"id": string,"kind": Database["public"]['Enums']["coupon_kind"],"max_uses": number | null,"used": number,"valid_until": string | null,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"code": string,"event_id": string,"id"?: string,"kind": Database["public"]['Enums']["coupon_kind"],"max_uses"?: number | null,"used"?: number,"valid_until"?: string | null,"value": number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"event_id"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["coupon_kind"],"max_uses"?: number | null,"used"?: number,"valid_until"?: string | null,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "coupons_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_dates": {
                  Row: {
                    "absences_processed_at": string | null,"capacity": number,"certificates_processed_at": string | null,"ends_at": string,"event_id": string,"id": string,"label": string | null,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "absences_processed_at"?: string | null,"capacity": number,"certificates_processed_at"?: string | null,"ends_at": string,"event_id": string,"id"?: string,"label"?: string | null,"starts_at": string
                  }
                  Update: {
                    "absences_processed_at"?: string | null,"capacity"?: number,"certificates_processed_at"?: string | null,"ends_at"?: string,"event_id"?: string,"id"?: string,"label"?: string | null,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_dates_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_secrets": {
                  Row: {
                    "attendee_instructions": string | null,"event_id": string,"online_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attendee_instructions"?: string | null,"event_id": string,"online_url"?: string | null
                  }
                  Update: {
                    "attendee_instructions"?: string | null,"event_id"?: string,"online_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_secrets_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "auto_messages": NonNullable<Json>,"category": string | null,"certificate_background_url": string | null,"certificate_hours": number,"cover_url": string | null,"created_at": string,"created_by": string | null,"description": string | null,"featured": boolean,"format": Database["public"]['Enums']["event_format"],"id": string,"kind": Database["public"]['Enums']["event_kind"],"published_at": string | null,"rules": NonNullable<Json>,"slug": string,"status": Database["public"]['Enums']["event_status"],"summary": string | null,"title": string,"updated_at": string,"venue_id": string | null,"visibility": Database["public"]['Enums']["event_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_messages"?: NonNullable<Json>,"category"?: string | null,"certificate_background_url"?: string | null,"certificate_hours"?: number,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"featured"?: boolean,"format"?: Database["public"]['Enums']["event_format"],"id"?: string,"kind"?: Database["public"]['Enums']["event_kind"],"published_at"?: string | null,"rules"?: NonNullable<Json>,"slug": string,"status"?: Database["public"]['Enums']["event_status"],"summary"?: string | null,"title": string,"updated_at"?: string,"venue_id"?: string | null,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Update: {
                    "auto_messages"?: NonNullable<Json>,"category"?: string | null,"certificate_background_url"?: string | null,"certificate_hours"?: number,"cover_url"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string | null,"featured"?: boolean,"format"?: Database["public"]['Enums']["event_format"],"id"?: string,"kind"?: Database["public"]['Enums']["event_kind"],"published_at"?: string | null,"rules"?: NonNullable<Json>,"slug"?: string,"status"?: Database["public"]['Enums']["event_status"],"summary"?: string | null,"title"?: string,"updated_at"?: string,"venue_id"?: string | null,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_venue_id_fkey"
      columns: ["venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["id"]
    }
                  ]
                },"form_answers": {
                  Row: {
                    "question_id": string,"ticket_id": string,"value": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "question_id": string,"ticket_id": string,"value"?: string | null
                  }
                  Update: {
                    "question_id"?: string,"ticket_id"?: string,"value"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "form_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_answers_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"form_questions": {
                  Row: {
                    "event_id": string,"id": string,"label": string,"options": NonNullable<Json>,"required": boolean,"sort": number,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"id"?: string,"label": string,"options"?: NonNullable<Json>,"required"?: boolean,"sort"?: number,"type"?: string
                  }
                  Update: {
                    "event_id"?: string,"id"?: string,"label"?: string,"options"?: NonNullable<Json>,"required"?: boolean,"sort"?: number,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_questions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"lots": {
                  Row: {
                    "activated_at": string | null,"base_price": number,"closed_at": string | null,"event_date_id": string,"id": string,"name": string,"quantity": number,"sort": number,"status": Database["public"]['Enums']["lot_status"],"ticket_type_id": string,"trigger": Database["public"]['Enums']["lot_trigger"],"trigger_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "activated_at"?: string | null,"base_price"?: number,"closed_at"?: string | null,"event_date_id": string,"id"?: string,"name": string,"quantity": number,"sort"?: number,"status"?: Database["public"]['Enums']["lot_status"],"ticket_type_id": string,"trigger"?: Database["public"]['Enums']["lot_trigger"],"trigger_at"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"base_price"?: number,"closed_at"?: string | null,"event_date_id"?: string,"id"?: string,"name"?: string,"quantity"?: number,"sort"?: number,"status"?: Database["public"]['Enums']["lot_status"],"ticket_type_id"?: string,"trigger"?: Database["public"]['Enums']["lot_trigger"],"trigger_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lots_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lots_ticket_type_id_fkey"
      columns: ["ticket_type_id"]
isOneToOne: false
      referencedRelation: "ticket_types"
      referencedColumns: ["id"]
    }
                  ]
                },"membership_events": {
                  Row: {
                    "actor_user_id": string | null,"created_at": string,"from_status": Database["public"]['Enums']["membership_status"] | null,"from_tier": Database["public"]['Enums']["membership_tier"] | null,"id": number,"person_id": string,"reason": string,"to_status": Database["public"]['Enums']["membership_status"],"to_tier": Database["public"]['Enums']["membership_tier"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["membership_status"] | null,"from_tier"?: Database["public"]['Enums']["membership_tier"] | null,"id"?: never,"person_id": string,"reason": string,"to_status": Database["public"]['Enums']["membership_status"],"to_tier": Database["public"]['Enums']["membership_tier"]
                  }
                  Update: {
                    "actor_user_id"?: string | null,"created_at"?: string,"from_status"?: Database["public"]['Enums']["membership_status"] | null,"from_tier"?: Database["public"]['Enums']["membership_tier"] | null,"id"?: never,"person_id"?: string,"reason"?: string,"to_status"?: Database["public"]['Enums']["membership_status"],"to_tier"?: Database["public"]['Enums']["membership_tier"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "membership_events_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "adept_since": string | null,"last_synced_at": string | null,"person_id": string,"source": Database["public"]['Enums']["membership_source"],"status": Database["public"]['Enums']["membership_status"],"terms_accepted_at": string | null,"terms_ip": string | null,"terms_version": string | null,"tier": Database["public"]['Enums']["membership_tier"],"updated_at": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adept_since"?: string | null,"last_synced_at"?: string | null,"person_id": string,"source"?: Database["public"]['Enums']["membership_source"],"status"?: Database["public"]['Enums']["membership_status"],"terms_accepted_at"?: string | null,"terms_ip"?: string | null,"terms_version"?: string | null,"tier"?: Database["public"]['Enums']["membership_tier"],"updated_at"?: string,"valid_until"?: string | null
                  }
                  Update: {
                    "adept_since"?: string | null,"last_synced_at"?: string | null,"person_id"?: string,"source"?: Database["public"]['Enums']["membership_source"],"status"?: Database["public"]['Enums']["membership_status"],"terms_accepted_at"?: string | null,"terms_ip"?: string | null,"terms_version"?: string | null,"tier"?: Database["public"]['Enums']["membership_tier"],"updated_at"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"messages_log": {
                  Row: {
                    "attempts": number,"channel": Database["public"]['Enums']["message_channel"],"created_at": string,"created_by": string | null,"dedupe_key": string | null,"error": string | null,"event_id": string | null,"id": number,"payload": NonNullable<Json>,"person_id": string | null,"sent_at": string | null,"status": Database["public"]['Enums']["message_status"],"template": string,"ticket_id": string | null,"to_address": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"channel": Database["public"]['Enums']["message_channel"],"created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"error"?: string | null,"event_id"?: string | null,"id"?: never,"payload"?: NonNullable<Json>,"person_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"template": string,"ticket_id"?: string | null,"to_address": string
                  }
                  Update: {
                    "attempts"?: number,"channel"?: Database["public"]['Enums']["message_channel"],"created_at"?: string,"created_by"?: string | null,"dedupe_key"?: string | null,"error"?: string | null,"event_id"?: string | null,"id"?: never,"payload"?: NonNullable<Json>,"person_id"?: string | null,"sent_at"?: string | null,"status"?: Database["public"]['Enums']["message_status"],"template"?: string,"ticket_id"?: string | null,"to_address"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_log_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_log_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "base_price": number,"id": string,"lot_id": string,"order_id": string,"quantity": number,"ticket_type_id": string,"tier_applied": Database["public"]['Enums']["membership_tier"],"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "base_price": number,"id"?: string,"lot_id": string,"order_id": string,"quantity"?: number,"ticket_type_id": string,"tier_applied": Database["public"]['Enums']["membership_tier"],"unit_price": number
                  }
                  Update: {
                    "base_price"?: number,"id"?: string,"lot_id"?: string,"order_id"?: string,"quantity"?: number,"ticket_type_id"?: string,"tier_applied"?: Database["public"]['Enums']["membership_tier"],"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_ticket_type_id_fkey"
      columns: ["ticket_type_id"]
isOneToOne: false
      referencedRelation: "ticket_types"
      referencedColumns: ["id"]
    }
                  ]
                },"order_payments": {
                  Row: {
                    "checkout_url": string | null,"expires_at": string | null,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"pix_copy_paste": string | null,"pix_qr_image": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checkout_url"?: string | null,"expires_at"?: string | null,"method": Database["public"]['Enums']["payment_method"],"order_id": string,"pix_copy_paste"?: string | null,"pix_qr_image"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "checkout_url"?: string | null,"expires_at"?: string | null,"method"?: Database["public"]['Enums']["payment_method"],"order_id"?: string,"pix_copy_paste"?: string | null,"pix_qr_image"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "buyer_email": string,"buyer_person_id": string,"cancelled_at": string | null,"coupon_id": string | null,"created_at": string,"device": string | null,"event_date_id": string,"event_id": string,"expires_at": string | null,"id": string,"installments": number,"paid_at": string | null,"payment_method": Database["public"]['Enums']["payment_method"],"provider": string | null,"provider_ref": string | null,"reservation_id": string | null,"status": Database["public"]['Enums']["order_status"],"total": number,"utm_campaign": string | null,"utm_medium": string | null,"utm_source": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_email": string,"buyer_person_id": string,"cancelled_at"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"device"?: string | null,"event_date_id": string,"event_id": string,"expires_at"?: string | null,"id"?: string,"installments"?: number,"paid_at"?: string | null,"payment_method": Database["public"]['Enums']["payment_method"],"provider"?: string | null,"provider_ref"?: string | null,"reservation_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"total": number,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null
                  }
                  Update: {
                    "buyer_email"?: string,"buyer_person_id"?: string,"cancelled_at"?: string | null,"coupon_id"?: string | null,"created_at"?: string,"device"?: string | null,"event_date_id"?: string,"event_id"?: string,"expires_at"?: string | null,"id"?: string,"installments"?: number,"paid_at"?: string | null,"payment_method"?: Database["public"]['Enums']["payment_method"],"provider"?: string | null,"provider_ref"?: string | null,"reservation_id"?: string | null,"status"?: Database["public"]['Enums']["order_status"],"total"?: number,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_person_id_fkey"
      columns: ["buyer_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_coupon_id_fkey"
      columns: ["coupon_id"]
isOneToOne: false
      referencedRelation: "coupons"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: true
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_events": {
                  Row: {
                    "event_id": string,"id": number,"order_id": string | null,"payload": Json | null,"provider": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"id"?: never,"order_id"?: string | null,"payload"?: Json | null,"provider": string,"received_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"id"?: never,"order_id"?: string | null,"payload"?: Json | null,"provider"?: string,"received_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_events_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"people": {
                  Row: {
                    "city": string | null,"company": string | null,"cpf": string,"created_at": string,"creci": string | null,"email": string | null,"full_name": string,"id": string,"notes": string | null,"phone": string | null,"source": string,"updated_at": string,"user_id": string | null,"whatsapp_opt_in": boolean,"whatsapp_opt_in_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "city"?: string | null,"company"?: string | null,"cpf": string,"created_at"?: string,"creci"?: string | null,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"source"?: string,"updated_at"?: string,"user_id"?: string | null,"whatsapp_opt_in"?: boolean,"whatsapp_opt_in_at"?: string | null
                  }
                  Update: {
                    "city"?: string | null,"company"?: string | null,"cpf"?: string,"created_at"?: string,"creci"?: string | null,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"phone"?: string | null,"source"?: string,"updated_at"?: string,"user_id"?: string | null,"whatsapp_opt_in"?: boolean,"whatsapp_opt_in_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"reservation_items": {
                  Row: {
                    "id": string,"lot_id": string,"quantity": number,"reservation_id": string,"ticket_type_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"lot_id": string,"quantity": number,"reservation_id": string,"ticket_type_id": string
                  }
                  Update: {
                    "id"?: string,"lot_id"?: string,"quantity"?: number,"reservation_id"?: string,"ticket_type_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservation_items_lot_id_fkey"
      columns: ["lot_id"]
isOneToOne: false
      referencedRelation: "lots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservation_items_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservation_items_ticket_type_id_fkey"
      columns: ["ticket_type_id"]
isOneToOne: false
      referencedRelation: "ticket_types"
      referencedColumns: ["id"]
    }
                  ]
                },"reservations": {
                  Row: {
                    "created_at": string,"device": string | null,"event_date_id": string,"expires_at": string,"id": string,"status": Database["public"]['Enums']["reservation_status"],"user_id": string | null,"utm_campaign": string | null,"utm_medium": string | null,"utm_source": string | null,"waitlist_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"device"?: string | null,"event_date_id": string,"expires_at": string,"id"?: string,"status"?: Database["public"]['Enums']["reservation_status"],"user_id"?: string | null,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"waitlist_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"device"?: string | null,"event_date_id"?: string,"expires_at"?: string,"id"?: string,"status"?: Database["public"]['Enums']["reservation_status"],"user_id"?: string | null,"utm_campaign"?: string | null,"utm_medium"?: string | null,"utm_source"?: string | null,"waitlist_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reservations_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reservations_waitlist_fk"
      columns: ["waitlist_id"]
isOneToOne: false
      referencedRelation: "waitlist"
      referencedColumns: ["id"]
    }
                  ]
                },"speakers": {
                  Row: {
                    "bio": string | null,"event_id": string,"id": string,"name": string,"photo_url": string | null,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"event_id": string,"id"?: string,"name": string,"photo_url"?: string | null,"sort"?: number
                  }
                  Update: {
                    "bio"?: string | null,"event_id"?: string,"id"?: string,"name"?: string,"photo_url"?: string | null,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "speakers_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"ticket_types": {
                  Row: {
                    "description": string | null,"event_id": string,"id": string,"max_per_order": number,"name": string,"people_per_ticket": number,"sort": number,"visible": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"event_id": string,"id"?: string,"max_per_order"?: number,"name": string,"people_per_ticket"?: number,"sort"?: number,"visible"?: boolean
                  }
                  Update: {
                    "description"?: string | null,"event_id"?: string,"id"?: string,"max_per_order"?: number,"name"?: string,"people_per_ticket"?: number,"sort"?: number,"visible"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_types_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "attendee_name": string,"attendee_person_id": string,"cancel_reason": string | null,"code": string,"created_at": string,"event_date_id": string,"event_id": string,"id": string,"order_id": string,"order_item_id": string,"presence_confirmed": boolean | null,"presence_requested_at": string | null,"presence_token": string,"reminder_sent_at": string | null,"status": Database["public"]['Enums']["ticket_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "attendee_name": string,"attendee_person_id": string,"cancel_reason"?: string | null,"code"?: string,"created_at"?: string,"event_date_id": string,"event_id": string,"id"?: string,"order_id": string,"order_item_id": string,"presence_confirmed"?: boolean | null,"presence_requested_at"?: string | null,"presence_token"?: string,"reminder_sent_at"?: string | null,"status"?: Database["public"]['Enums']["ticket_status"]
                  }
                  Update: {
                    "attendee_name"?: string,"attendee_person_id"?: string,"cancel_reason"?: string | null,"code"?: string,"created_at"?: string,"event_date_id"?: string,"event_id"?: string,"id"?: string,"order_id"?: string,"order_item_id"?: string,"presence_confirmed"?: boolean | null,"presence_requested_at"?: string | null,"presence_token"?: string,"reminder_sent_at"?: string | null,"status"?: Database["public"]['Enums']["ticket_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_attendee_person_id_fkey"
      columns: ["attendee_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tickets_order_item_id_fkey"
      columns: ["order_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    }
                  ]
                },"tier_rules": {
                  Row: {
                    "id": string,"mode": Database["public"]['Enums']["price_mode"],"reserved_seats": number,"ticket_type_id": string,"tier": Database["public"]['Enums']["membership_tier"],"value": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"mode": Database["public"]['Enums']["price_mode"],"reserved_seats"?: number,"ticket_type_id": string,"tier": Database["public"]['Enums']["membership_tier"],"value"?: number | null
                  }
                  Update: {
                    "id"?: string,"mode"?: Database["public"]['Enums']["price_mode"],"reserved_seats"?: number,"ticket_type_id"?: string,"tier"?: Database["public"]['Enums']["membership_tier"],"value"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tier_rules_ticket_type_id_fkey"
      columns: ["ticket_type_id"]
isOneToOne: false
      referencedRelation: "ticket_types"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string | null,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string | null,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"venues": {
                  Row: {
                    "address": string,"city": string,"created_at": string,"id": string,"lat": number | null,"lng": number | null,"maps_url": string | null,"name": string,"parking_info": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address": string,"city": string,"created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"maps_url"?: string | null,"name": string,"parking_info"?: string | null
                  }
                  Update: {
                    "address"?: string,"city"?: string,"created_at"?: string,"id"?: string,"lat"?: number | null,"lng"?: number | null,"maps_url"?: string | null,"name"?: string,"parking_info"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"waitlist": {
                  Row: {
                    "created_at": string,"event_date_id": string,"expires_at": string | null,"id": string,"offered_at": string | null,"person_id": string,"reservation_id": string | null,"status": Database["public"]['Enums']["waitlist_status"],"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_date_id": string,"expires_at"?: string | null,"id"?: string,"offered_at"?: string | null,"person_id": string,"reservation_id"?: string | null,"status"?: Database["public"]['Enums']["waitlist_status"],"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_date_id"?: string,"expires_at"?: string | null,"id"?: string,"offered_at"?: string | null,"person_id"?: string,"reservation_id"?: string | null,"status"?: Database["public"]['Enums']["waitlist_status"],"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "waitlist_event_date_id_fkey"
      columns: ["event_date_id"]
isOneToOne: false
      referencedRelation: "event_dates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlist_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "waitlist_reservation_id_fkey"
      columns: ["reservation_id"]
isOneToOne: false
      referencedRelation: "reservations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_dashboard":
{ Args: { "p_from": string,"p_to": string }; Returns: Json
                           },
"admin_events":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"anonymize_person":
{ Args: { "p_person_id": string }; Returns: undefined
                           },
"base_people":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_participation"?: string,"p_search"?: string,"p_tier"?: string }; Returns: Json
                           },
"cancel_order":
{ Args: { "p_order_id": string,"p_reason": string }; Returns: undefined
                           },
"certificate_document":
{ Args: { "p_code": string }; Returns: Json
                           },
"check_coupon":
{ Args: { "p_code": string,"p_event_id": string }; Returns: {
              "kind": Database["public"]['Enums']["coupon_kind"],"valid": boolean,"value": number
            }[]
                           },
"checkin":
{ Args: { "p_at"?: string,"p_device_id"?: string,"p_event_date_id": string,"p_kind"?: Database["public"]['Enums']["checkin_kind"],"p_payload": string }; Returns: Json
                           },
"checkout":
{ Args: { "p_data": Json,"p_reservation_id": string }; Returns: Json
                           },
"claim_outbox":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,
"channel": Database["public"]['Enums']["message_channel"],
"created_at": string,
"created_by": string | null,
"dedupe_key": string | null,
"error": string | null,
"event_id": string | null,
"id": number,
"payload": NonNullable<Json>,
"person_id": string | null,
"sent_at": string | null,
"status": Database["public"]['Enums']["message_status"],
"template": string,
"ticket_id": string | null,
"to_address": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "messages_log"
        isOneToOne: false
        isSetofReturn: true
      } },
"claim_person":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"compute_price":
{ Args: { "p_coupon_code"?: string,"p_lot_id": string,"p_ticket_type_id": string,"p_tier": Database["public"]['Enums']["membership_tier"] }; Returns: {
              "base_price": number,"blocked": boolean,"coupon_applied": boolean,"coupon_id": string,"tier_price": number,"unit_price": number
            }[]
                           },
"confirm_presence":
{ Args: { "p_going": boolean,"p_token": string }; Returns: string
                           },
"create_reservation":
{ Args: { "p_event_date_id": string,"p_items": Json,"p_utm"?: Json }; Returns: string
                           },
"door_events":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"door_list":
{ Args: { "p_event_date_id": string }; Returns: Json
                           },
"event_finance":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"event_offer":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"event_overview":
{ Args: { "p_event_id": string }; Returns: Json
                           },
"get_order":
{ Args: { "p_order_id": string }; Returns: Json
                           },
"get_reservation":
{ Args: { "p_reservation_id": string }; Returns: Json
                           },
"grant_role_by_email":
{ Args: { "p_email": string,"p_event_id"?: string,"p_role": Database["public"]['Enums']["app_role"] }; Returns: undefined
                           },
"import_members":
{ Args: { "p_dry_run"?: boolean,"p_rows": Json,"p_source"?: Database["public"]['Enums']["membership_source"] }; Returns: Json
                           },
"import_sympla":
{ Args: { "p_event": Json,"p_rows": Json }; Returns: Json
                           },
"issue_certificates":
{ Args: { "p_event_date_id": string }; Returns: number
                           },
"join_waitlist":
{ Args: { "p_event_date_id": string,"p_person": Json }; Returns: Json
                           },
"list_roles":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"event_id": string,"id": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"lookup_tier":
{ Args: { "p_cpf": string }; Returns: {
              "registered": boolean,"tier": Database["public"]['Enums']["membership_tier"]
            }[]
                           },
"mark_message":
{ Args: { "p_error"?: string,"p_id": number,"p_status": Database["public"]['Enums']["message_status"] }; Returns: undefined
                           },
"my_profile":
{ Args: Record<PropertyKey, never>; Returns: {
              "cpf_masked": string,"email": string,"full_name": string,"membership_status": Database["public"]['Enums']["membership_status"],"person_id": string,"tier": Database["public"]['Enums']["membership_tier"],"valid_until": string
            }[]
                           },
"my_roles":
{ Args: Record<PropertyKey, never>; Returns: {
              "event_id": string,"role": Database["public"]['Enums']["app_role"]
            }[]
                           },
"my_tickets":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"offer_waitlist_seat":
{ Args: { "p_event_date_id": string }; Returns: number
                           },
"payment_confirm":
{ Args: { "p_event_id": string,"p_order_id": string,"p_payload": Json,"p_provider": string,"p_provider_ref": string,"p_status": string }; Returns: string
                           },
"person_detail":
{ Args: { "p_person_id": string }; Returns: Json
                           },
"presence_info":
{ Args: { "p_token": string }; Returns: Json
                           },
"publish_event":
{ Args: { "p_event_id": string }; Returns: undefined
                           },
"send_base_message":
{ Args: { "p_channels": (Database["public"]['Enums']["message_channel"])[],"p_person_ids": (string)[],"p_template": string }; Returns: number
                           },
"send_segment_message":
{ Args: { "p_body": string,"p_channels": (Database["public"]['Enums']["message_channel"])[],"p_event_date_id": string,"p_segment": string,"p_subject": string }; Returns: number
                           },
"set_membership":
{ Args: { "p_person_id": string,"p_reason": string,"p_status": Database["public"]['Enums']["membership_status"],"p_tier": Database["public"]['Enums']["membership_tier"],"p_valid_until": string }; Returns: undefined
                           },
"turn_lot":
{ Args: { "p_lot_id": string }; Returns: string
                           },
"undo_checkin":
{ Args: { "p_kind"?: Database["public"]['Enums']["checkin_kind"],"p_ticket_id": string }; Returns: undefined
                           },
"validate_certificate":
{ Args: { "p_code": string }; Returns: Json
                           },
"waitlist_list":
{ Args: { "p_event_date_id": string }; Returns: Json
                           },
"waitlist_offer":
{ Args: { "p_token": string }; Returns: Json
                           }
          }
          Enums: {
            "app_role": "admin"|"organizer"|"door"|"finance","checkin_kind": "in"|"out","coupon_kind": "percent"|"fixed","event_format": "in_person"|"online"|"hybrid","event_kind": "free_course"|"paid"|"open_free","event_status": "draft"|"published"|"closed"|"cancelled","event_visibility": "public"|"associates"|"associates_adepts"|"private","lot_status": "scheduled"|"active"|"closed","lot_trigger": "quantity"|"date"|"manual","membership_source": "higestor"|"platform"|"import","membership_status": "active"|"expired"|"none","membership_tier": "associate"|"adept"|"other","message_channel": "email"|"whatsapp","message_status": "queued"|"sent"|"failed"|"skipped","order_status": "pending"|"paid"|"failed"|"refunded"|"cancelled","payment_method": "pix"|"card"|"free","price_mode": "free"|"percent"|"fixed"|"full"|"blocked","reservation_status": "open"|"converted"|"expired"|"cancelled","ticket_status": "pending"|"valid"|"used"|"cancelled"|"transferred","waitlist_status": "waiting"|"offered"|"accepted"|"expired"|"removed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "organizer", "door", "finance"],"checkin_kind": ["in", "out"],"coupon_kind": ["percent", "fixed"],"event_format": ["in_person", "online", "hybrid"],"event_kind": ["free_course", "paid", "open_free"],"event_status": ["draft", "published", "closed", "cancelled"],"event_visibility": ["public", "associates", "associates_adepts", "private"],"lot_status": ["scheduled", "active", "closed"],"lot_trigger": ["quantity", "date", "manual"],"membership_source": ["higestor", "platform", "import"],"membership_status": ["active", "expired", "none"],"membership_tier": ["associate", "adept", "other"],"message_channel": ["email", "whatsapp"],"message_status": ["queued", "sent", "failed", "skipped"],"order_status": ["pending", "paid", "failed", "refunded", "cancelled"],"payment_method": ["pix", "card", "free"],"price_mode": ["free", "percent", "fixed", "full", "blocked"],"reservation_status": ["open", "converted", "expired", "cancelled"],"ticket_status": ["pending", "valid", "used", "cancelled", "transferred"],"waitlist_status": ["waiting", "offered", "accepted", "expired", "removed"]
          }
        }
} as const
