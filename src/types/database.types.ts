
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
            "app_config": {
                  Row: {
                    "description": string | null,"key": string,"updated_at": string,"value": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"key": string,"updated_at"?: string,"value": string
                  }
                  Update: {
                    "description"?: string | null,"key"?: string,"updated_at"?: string,"value"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"at": string,"diff": NonNullable<Json>,"entity_id": string | null,"entity_type": string,"id": number,"ip_hash": string | null,"request_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role": string,"at"?: string,"diff"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type": string,"id"?: never,"ip_hash"?: string | null,"request_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string,"at"?: string,"diff"?: NonNullable<Json>,"entity_id"?: string | null,"entity_type"?: string,"id"?: never,"ip_hash"?: string | null,"request_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"builders": {
                  Row: {
                    "active": boolean,"contact_person": string | null,"created_at": string,"description": string | null,"email": string,"id": string,"invited_at": string | null,"kind": string,"logo_url": string | null,"name": string,"onboarded_at": string | null,"phone": string | null,"updated_at": string,"user_id": string | null,"website": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"contact_person"?: string | null,"created_at"?: string,"description"?: string | null,"email": string,"id"?: string,"invited_at"?: string | null,"kind"?: string,"logo_url"?: string | null,"name": string,"onboarded_at"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id"?: string | null,"website"?: string | null
                  }
                  Update: {
                    "active"?: boolean,"contact_person"?: string | null,"created_at"?: string,"description"?: string | null,"email"?: string,"id"?: string,"invited_at"?: string | null,"kind"?: string,"logo_url"?: string | null,"name"?: string,"onboarded_at"?: string | null,"phone"?: string | null,"updated_at"?: string,"user_id"?: string | null,"website"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"crm_api_logs": {
                  Row: {
                    "attempt": number,"created_at": string,"form_name": string | null,"http_status": number | null,"id": string,"integration_id": string | null,"integration_name": string,"outcome": string,"response_snippet": string | null,"submission_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"created_at"?: string,"form_name"?: string | null,"http_status"?: number | null,"id"?: string,"integration_id"?: string | null,"integration_name": string,"outcome": string,"response_snippet"?: string | null,"submission_id"?: string | null
                  }
                  Update: {
                    "attempt"?: number,"created_at"?: string,"form_name"?: string | null,"http_status"?: number | null,"id"?: string,"integration_id"?: string | null,"integration_name"?: string,"outcome"?: string,"response_snippet"?: string | null,"submission_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crm_api_logs_integration_id_fkey"
      columns: ["integration_id"]
isOneToOne: false
      referencedRelation: "crm_integrations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crm_api_logs_submission_id_fkey"
      columns: ["submission_id"]
isOneToOne: false
      referencedRelation: "form_submissions"
      referencedColumns: ["id"]
    }
                  ]
                },"crm_integration_secrets": {
                  Row: {
                    "access_token": string | null,"api_key": string | null,"api_secret": string | null,"integration_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "access_token"?: string | null,"api_key"?: string | null,"api_secret"?: string | null,"integration_id": string,"updated_at"?: string
                  }
                  Update: {
                    "access_token"?: string | null,"api_key"?: string | null,"api_secret"?: string | null,"integration_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crm_integration_secrets_integration_id_fkey"
      columns: ["integration_id"]
isOneToOne: true
      referencedRelation: "crm_integrations"
      referencedColumns: ["id"]
    }
                  ]
                },"crm_integrations": {
                  Row: {
                    "active": boolean,"base_url": string,"body_mapping": NonNullable<Json>,"created_at": string,"endpoint": string | null,"headers": NonNullable<Json>,"id": string,"lead_id_path": string | null,"lead_source": string | null,"method": string,"name": string,"project_codes": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"base_url": string,"body_mapping"?: NonNullable<Json>,"created_at"?: string,"endpoint"?: string | null,"headers"?: NonNullable<Json>,"id"?: string,"lead_id_path"?: string | null,"lead_source"?: string | null,"method"?: string,"name": string,"project_codes"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"base_url"?: string,"body_mapping"?: NonNullable<Json>,"created_at"?: string,"endpoint"?: string | null,"headers"?: NonNullable<Json>,"id"?: string,"lead_id_path"?: string | null,"lead_source"?: string | null,"method"?: string,"name"?: string,"project_codes"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enquiries": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"message": string | null,"name": string,"phone": string,"property_id": string,"status": string,"status_changed_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"message"?: string | null,"name": string,"phone": string,"property_id": string,"status"?: string,"status_changed_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"message"?: string | null,"name"?: string,"phone"?: string,"property_id"?: string,"status"?: string,"status_changed_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "enquiries_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"form_submissions": {
                  Row: {
                    "created_at": string,"crm_attempts": number,"crm_http_status": number | null,"crm_integration_id": string | null,"crm_lead_id": string | null,"crm_status": string,"data": NonNullable<Json>,"email": string | null,"files": NonNullable<Json>,"form_id": string | null,"form_name": string,"id": string,"idempotency_key": string | null,"last_error": string | null,"mobile": string | null,"name": string | null,"next_retry_at": string | null,"project_id": string | null,"project_lead_id": string | null,"source": string | null,"visitor_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crm_attempts"?: number,"crm_http_status"?: number | null,"crm_integration_id"?: string | null,"crm_lead_id"?: string | null,"crm_status"?: string,"data"?: NonNullable<Json>,"email"?: string | null,"files"?: NonNullable<Json>,"form_id"?: string | null,"form_name": string,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"mobile"?: string | null,"name"?: string | null,"next_retry_at"?: string | null,"project_id"?: string | null,"project_lead_id"?: string | null,"source"?: string | null,"visitor_hash"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"crm_attempts"?: number,"crm_http_status"?: number | null,"crm_integration_id"?: string | null,"crm_lead_id"?: string | null,"crm_status"?: string,"data"?: NonNullable<Json>,"email"?: string | null,"files"?: NonNullable<Json>,"form_id"?: string | null,"form_name"?: string,"id"?: string,"idempotency_key"?: string | null,"last_error"?: string | null,"mobile"?: string | null,"name"?: string | null,"next_retry_at"?: string | null,"project_id"?: string | null,"project_lead_id"?: string | null,"source"?: string | null,"visitor_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "form_submissions_crm_integration_id_fkey"
      columns: ["crm_integration_id"]
isOneToOne: false
      referencedRelation: "crm_integrations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_form_id_fkey"
      columns: ["form_id"]
isOneToOne: false
      referencedRelation: "forms"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "form_submissions_project_lead_id_fkey"
      columns: ["project_lead_id"]
isOneToOne: false
      referencedRelation: "project_leads"
      referencedColumns: ["id"]
    }
                  ]
                },"forms": {
                  Row: {
                    "active": boolean,"button_text": string | null,"created_at": string,"crm_integration_id": string | null,"fields": NonNullable<Json>,"id": string,"kind": string,"name": string,"placement": string,"project_id": string | null,"slug": string,"success_message": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"button_text"?: string | null,"created_at"?: string,"crm_integration_id"?: string | null,"fields"?: NonNullable<Json>,"id"?: string,"kind": string,"name": string,"placement"?: string,"project_id"?: string | null,"slug": string,"success_message"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "active"?: boolean,"button_text"?: string | null,"created_at"?: string,"crm_integration_id"?: string | null,"fields"?: NonNullable<Json>,"id"?: string,"kind"?: string,"name"?: string,"placement"?: string,"project_id"?: string | null,"slug"?: string,"success_message"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "forms_crm_integration_id_fkey"
      columns: ["crm_integration_id"]
isOneToOne: false
      referencedRelation: "crm_integrations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "forms_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"idempotency_keys": {
                  Row: {
                    "created_at": string,"key": string,"result": Json | null,"scope": string,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"key": string,"result"?: Json | null,"scope": string,"subject": string
                  }
                  Update: {
                    "created_at"?: string,"key"?: string,"result"?: Json | null,"scope"?: string,"subject"?: string
                  }
                  Relationships: [
                    
                  ]
                },"internal_cron_tokens": {
                  Row: {
                    "created_at": string,"name": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"name": string,"token": string
                  }
                  Update: {
                    "created_at"?: string,"name"?: string,"token"?: string
                  }
                  Relationships: [
                    
                  ]
                },"listing_media": {
                  Row: {
                    "alt_text": string | null,"bytes": number,"created_at": string,"height": number,"id": string,"is_cover": boolean,"listing_id": string,"mime": string,"position": number,"storage_path": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text"?: string | null,"bytes": number,"created_at"?: string,"height": number,"id"?: string,"is_cover"?: boolean,"listing_id": string,"mime": string,"position"?: number,"storage_path": string,"width": number
                  }
                  Update: {
                    "alt_text"?: string | null,"bytes"?: number,"created_at"?: string,"height"?: number,"id"?: string,"is_cover"?: boolean,"listing_id"?: string,"mime"?: string,"position"?: number,"storage_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_media_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email_verified_at": string | null,"full_name": string | null,"id": string,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_verified_at"?: string | null,"full_name"?: string | null,"id": string,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email_verified_at"?: string | null,"full_name"?: string | null,"id"?: string,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_events": {
                  Row: {
                    "created_at": string,"event_type": string,"id": string,"project_id": string,"visitor_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_type": string,"id"?: string,"project_id": string,"visitor_hash"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_type"?: string,"id"?: string,"project_id"?: string,"visitor_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_leads": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"kind": string,"message": string | null,"name": string,"phone": string,"project_id": string,"status": string,"updated_at": string,"visit_date": string | null,"visitor_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"kind": string,"message"?: string | null,"name": string,"phone": string,"project_id": string,"status"?: string,"updated_at"?: string,"visit_date"?: string | null,"visitor_hash"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"kind"?: string,"message"?: string | null,"name"?: string,"phone"?: string,"project_id"?: string,"status"?: string,"updated_at"?: string,"visit_date"?: string | null,"visitor_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_leads_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_price_trends": {
                  Row: {
                    "created_at": string,"id": string,"month": string,"price_per_sqft": number,"project_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"month": string,"price_per_sqft": number,"project_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"month"?: string,"price_per_sqft"?: number,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_price_trends_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_units": {
                  Row: {
                    "area_sqft": number | null,"available_from": string | null,"bhk": number | null,"created_at": string,"facing": string | null,"floor_number": number | null,"floor_plan_path": string | null,"id": string,"price": number | null,"project_id": string,"status": string,"unit_number": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area_sqft"?: number | null,"available_from"?: string | null,"bhk"?: number | null,"created_at"?: string,"facing"?: string | null,"floor_number"?: number | null,"floor_plan_path"?: string | null,"id"?: string,"price"?: number | null,"project_id": string,"status"?: string,"unit_number": string,"updated_at"?: string
                  }
                  Update: {
                    "area_sqft"?: number | null,"available_from"?: string | null,"bhk"?: number | null,"created_at"?: string,"facing"?: string | null,"floor_number"?: number | null,"floor_plan_path"?: string | null,"id"?: string,"price"?: number | null,"project_id"?: string,"status"?: string,"unit_number"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_units_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "address": string | null,"advantages": (string)[],"amenities": (string)[],"bhk_options": (number)[],"brochure_path": string | null,"builder_id": string,"contact_phone": string | null,"created_at": string,"description": string | null,"elevations": (string)[],"featured": boolean,"floor_plans": (string)[],"form_id": string | null,"id": string,"images": (string)[],"land_area_acres": number | null,"latitude": number | null,"locality": string,"location": unknown,"longitude": number | null,"moderated_at": string | null,"moderated_by": string | null,"moderation": string,"name": string,"nearby": (string)[],"plot_images": (string)[],"possession_date": string | null,"price_max": number | null,"price_min": number | null,"project_status": string | null,"project_type": string | null,"property_type": string | null,"published": boolean,"rejection_reason": string | null,"rera_applicable": boolean,"rera_number": string | null,"seo_description": string | null,"seo_title": string | null,"slug": string,"specifications": string | null,"total_units": number | null,"updated_at": string,"videos": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"advantages"?: (string)[],"amenities"?: (string)[],"bhk_options"?: (number)[],"brochure_path"?: string | null,"builder_id"?: string,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"elevations"?: (string)[],"featured"?: boolean,"floor_plans"?: (string)[],"form_id"?: string | null,"id"?: string,"images"?: (string)[],"land_area_acres"?: number | null,"latitude"?: number | null,"locality": string,"location"?: never,"longitude"?: number | null,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation"?: string,"name": string,"nearby"?: (string)[],"plot_images"?: (string)[],"possession_date"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"project_status"?: string | null,"project_type"?: string | null,"property_type"?: string | null,"published"?: boolean,"rejection_reason"?: string | null,"rera_applicable"?: boolean,"rera_number"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug": string,"specifications"?: string | null,"total_units"?: number | null,"updated_at"?: string,"videos"?: (string)[]
                  }
                  Update: {
                    "address"?: string | null,"advantages"?: (string)[],"amenities"?: (string)[],"bhk_options"?: (number)[],"brochure_path"?: string | null,"builder_id"?: string,"contact_phone"?: string | null,"created_at"?: string,"description"?: string | null,"elevations"?: (string)[],"featured"?: boolean,"floor_plans"?: (string)[],"form_id"?: string | null,"id"?: string,"images"?: (string)[],"land_area_acres"?: number | null,"latitude"?: number | null,"locality"?: string,"location"?: never,"longitude"?: number | null,"moderated_at"?: string | null,"moderated_by"?: string | null,"moderation"?: string,"name"?: string,"nearby"?: (string)[],"plot_images"?: (string)[],"possession_date"?: string | null,"price_max"?: number | null,"price_min"?: number | null,"project_status"?: string | null,"project_type"?: string | null,"property_type"?: string | null,"published"?: boolean,"rejection_reason"?: string | null,"rera_applicable"?: boolean,"rera_number"?: string | null,"seo_description"?: string | null,"seo_title"?: string | null,"slug"?: string,"specifications"?: string | null,"total_units"?: number | null,"updated_at"?: string,"videos"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_builder_id_fkey"
      columns: ["builder_id"]
isOneToOne: false
      referencedRelation: "builders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_form_id_fkey"
      columns: ["form_id"]
isOneToOne: false
      referencedRelation: "forms"
      referencedColumns: ["id"]
    }
                  ]
                },"properties": {
                  Row: {
                    "address": string | null,"amenities": (string)[],"area_sqft": number | null,"available_from": string | null,"bathrooms": number | null,"bhk": number | null,"city": string | null,"closed_at": string | null,"created_at": string,"description": string | null,"featured": boolean,"furnishing": string | null,"id": string,"listing_type": string | null,"locality": string | null,"location": unknown,"moderated_at": string | null,"moderated_by": string | null,"owner_id": string,"pincode": string | null,"price": number | null,"property_type": string | null,"public_location": unknown,"published_at": string | null,"rejection_reason": string | null,"search_vector": unknown,"short_id": string,"slug": string,"state": string | null,"status": string,"submitted_at": string | null,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"amenities"?: (string)[],"area_sqft"?: number | null,"available_from"?: string | null,"bathrooms"?: number | null,"bhk"?: number | null,"city"?: string | null,"closed_at"?: string | null,"created_at"?: string,"description"?: string | null,"featured"?: boolean,"furnishing"?: string | null,"id"?: string,"listing_type"?: string | null,"locality"?: string | null,"location"?: unknown,"moderated_at"?: string | null,"moderated_by"?: string | null,"owner_id"?: string,"pincode"?: string | null,"price"?: number | null,"property_type"?: string | null,"public_location"?: never,"published_at"?: string | null,"rejection_reason"?: string | null,"search_vector"?: never,"short_id": string,"slug": string,"state"?: string | null,"status"?: string,"submitted_at"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"amenities"?: (string)[],"area_sqft"?: number | null,"available_from"?: string | null,"bathrooms"?: number | null,"bhk"?: number | null,"city"?: string | null,"closed_at"?: string | null,"created_at"?: string,"description"?: string | null,"featured"?: boolean,"furnishing"?: string | null,"id"?: string,"listing_type"?: string | null,"locality"?: string | null,"location"?: unknown,"moderated_at"?: string | null,"moderated_by"?: string | null,"owner_id"?: string,"pincode"?: string | null,"price"?: number | null,"property_type"?: string | null,"public_location"?: never,"published_at"?: string | null,"rejection_reason"?: string | null,"search_vector"?: never,"short_id"?: string,"slug"?: string,"state"?: string | null,"status"?: string,"submitted_at"?: string | null,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"public_rate_limits": {
                  Row: {
                    "hits": number,"scope": string,"subject_hash": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "hits"?: number,"scope": string,"subject_hash": string,"window_start": string
                  }
                  Update: {
                    "hits"?: number,"scope"?: string,"subject_hash"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_properties": {
                  Row: {
                    "created_at": string,"id": string,"property_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"property_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"property_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_properties_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"site_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_builders":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,
"contact_person": string | null,
"created_at": string,
"description": string | null,
"email": string,
"id": string,
"invited_at": string | null,
"kind": string,
"logo_url": string | null,
"name": string,
"onboarded_at": string | null,
"phone": string | null,
"updated_at": string,
"user_id": string | null,
"website": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "builders"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_forms":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,
"button_text": string | null,
"created_at": string,
"crm_integration_id": string | null,
"fields": NonNullable<Json>,
"id": string,
"kind": string,
"name": string,
"placement": string,
"project_id": string | null,
"slug": string,
"success_message": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "forms"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_projects":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string | null,
"advantages": (string)[],
"amenities": (string)[],
"bhk_options": (number)[],
"brochure_path": string | null,
"builder_id": string,
"contact_phone": string | null,
"created_at": string,
"description": string | null,
"elevations": (string)[],
"featured": boolean,
"floor_plans": (string)[],
"form_id": string | null,
"id": string,
"images": (string)[],
"land_area_acres": number | null,
"latitude": number | null,
"locality": string,
"location": unknown,
"longitude": number | null,
"moderated_at": string | null,
"moderated_by": string | null,
"moderation": string,
"name": string,
"nearby": (string)[],
"plot_images": (string)[],
"possession_date": string | null,
"price_max": number | null,
"price_min": number | null,
"project_status": string | null,
"project_type": string | null,
"property_type": string | null,
"published": boolean,
"rejection_reason": string | null,
"rera_applicable": boolean,
"rera_number": string | null,
"seo_description": string | null,
"seo_title": string | null,
"slug": string,
"specifications": string | null,
"total_units": number | null,
"updated_at": string,
"videos": (string)[]
            }[]
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: false
        isSetofReturn: true
      } },
"admin_properties":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string | null,
"amenities": (string)[],
"area_sqft": number | null,
"available_from": string | null,
"bathrooms": number | null,
"bhk": number | null,
"city": string | null,
"closed_at": string | null,
"created_at": string,
"description": string | null,
"featured": boolean,
"furnishing": string | null,
"id": string,
"listing_type": string | null,
"locality": string | null,
"location": unknown,
"moderated_at": string | null,
"moderated_by": string | null,
"owner_id": string,
"pincode": string | null,
"price": number | null,
"property_type": string | null,
"public_location": unknown,
"published_at": string | null,
"rejection_reason": string | null,
"search_vector": unknown,
"short_id": string,
"slug": string,
"state": string | null,
"status": string,
"submitted_at": string | null,
"title": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "properties"
        isOneToOne: false
        isSetofReturn: true
      } },
"arm_crm_retry":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"arm_media_sweep":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"assert_open_listing_room":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"audit_actor_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"audit_record":
{ Args: { "action_name": string,"actor": string,"actor_kind": string,"change": Json,"entity_key": string,"entity_kind": string,"ip_digest": string,"request_key": string }; Returns: undefined
                           },
"audit_request_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"audit_write":
{ Args: { "action_name": string,"change": Json,"entity_key": string,"entity_kind": string }; Returns: undefined
                           },
"build_property_slug":
{ Args: { "locality": string,"title": string }; Returns: string
                           },
"changed_columns":
{ Args: { "new_row": Json,"old_row": Json }; Returns: Json
                           },
"current_builder_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"disarm_crm_retry":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"disarm_media_sweep":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"finalize_listing_media":
{ Args: { "p_bytes": number,"p_height": number,"p_listing": string,"p_mime": string,"p_owner": string,"p_path": string,"p_width": number }; Returns: string
                           },
"has_role":
{ Args: { "target_role": Database["public"]['Enums']["app_role"],"target_user": string }; Returns: boolean
                           },
"has_verified_phone":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"hook_before_user_created":
{ Args: { "event": Json }; Returns: Json
                           },
"is_reserved_admin_email":
{ Args: { "candidate": string }; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"listing_is_editable":
{ Args: { "target_property": string }; Returns: boolean
                           },
"listing_is_public":
{ Args: { "target_property": string }; Returns: boolean
                           },
"listing_label":
{ Args: { "is_featured": boolean,"listing_kind": string,"listing_price": number }; Returns: string
                           },
"my_builder":
{ Args: Record<PropertyKey, never>; Returns: {
              "active": boolean,
"contact_person": string | null,
"created_at": string,
"description": string | null,
"email": string,
"id": string,
"invited_at": string | null,
"kind": string,
"logo_url": string | null,
"name": string,
"onboarded_at": string | null,
"phone": string | null,
"updated_at": string,
"user_id": string | null,
"website": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "builders"
        isOneToOne: false
        isSetofReturn: true
      } },
"my_projects":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string | null,
"advantages": (string)[],
"amenities": (string)[],
"bhk_options": (number)[],
"brochure_path": string | null,
"builder_id": string,
"contact_phone": string | null,
"created_at": string,
"description": string | null,
"elevations": (string)[],
"featured": boolean,
"floor_plans": (string)[],
"form_id": string | null,
"id": string,
"images": (string)[],
"land_area_acres": number | null,
"latitude": number | null,
"locality": string,
"location": unknown,
"longitude": number | null,
"moderated_at": string | null,
"moderated_by": string | null,
"moderation": string,
"name": string,
"nearby": (string)[],
"plot_images": (string)[],
"possession_date": string | null,
"price_max": number | null,
"price_min": number | null,
"project_status": string | null,
"project_type": string | null,
"property_type": string | null,
"published": boolean,
"rejection_reason": string | null,
"rera_applicable": boolean,
"rera_number": string | null,
"seo_description": string | null,
"seo_title": string | null,
"slug": string,
"specifications": string | null,
"total_units": number | null,
"updated_at": string,
"videos": (string)[]
            }[]
                          SetofOptions: {
        from: "*"
        to: "projects"
        isOneToOne: false
        isSetofReturn: true
      } },
"my_properties":
{ Args: Record<PropertyKey, never>; Returns: {
              "address": string | null,
"amenities": (string)[],
"area_sqft": number | null,
"available_from": string | null,
"bathrooms": number | null,
"bhk": number | null,
"city": string | null,
"closed_at": string | null,
"created_at": string,
"description": string | null,
"featured": boolean,
"furnishing": string | null,
"id": string,
"listing_type": string | null,
"locality": string | null,
"location": unknown,
"moderated_at": string | null,
"moderated_by": string | null,
"owner_id": string,
"pincode": string | null,
"price": number | null,
"property_type": string | null,
"public_location": unknown,
"published_at": string | null,
"rejection_reason": string | null,
"search_vector": unknown,
"short_id": string,
"slug": string,
"state": string | null,
"status": string,
"submitted_at": string | null,
"title": string | null,
"updated_at": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "properties"
        isOneToOne: false
        isSetofReturn: true
      } },
"normalise_phone":
{ Args: { "raw_phone": string }; Returns: string
                           },
"orphan_listing_photos":
{ Args: { "p_limit"?: number,"p_older_than_hours"?: number }; Returns: {
              "name": string
            }[]
                           },
"owns_property":
{ Args: { "target_property": string }; Returns: boolean
                           },
"project_is_live":
{ Args: { "target_project": string }; Returns: boolean
                           },
"project_is_mine":
{ Args: { "target_project": string }; Returns: boolean
                           },
"public_project_form":
{ Args: { "p_project_slug": string }; Returns: {
              "button_text": string,"fields": Json,"kind": string,"name": string,"placement": string,"project_id": string,"slug": string,"success_message": string
            }[]
                           },
"public_project_id":
{ Args: { "project_slug": string }; Returns: string
                           },
"rate_limit_hit":
{ Args: { "limit_scope": string,"limit_subject": string,"max_hits": number,"window_seconds": number }; Returns: {
              "allowed": boolean,"retry_after": number
            }[]
                           },
"record_form_submission":
{ Args: { "p_data"?: Json,"p_email"?: string,"p_files"?: Json,"p_form_slug": string,"p_idempotency_key"?: string,"p_mobile"?: string,"p_name"?: string,"p_project_slug"?: string,"p_source"?: string,"p_visitor_hash": string }; Returns: string
                           },
"reserved_admin_emails":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"search_properties":
{ Args: { "p_bhk"?: number,"p_east"?: number,"p_label"?: string,"p_lat"?: number,"p_limit"?: number,"p_listing_type"?: string,"p_lng"?: number,"p_locality"?: string,"p_max_price"?: number,"p_min_price"?: number,"p_north"?: number,"p_property_type"?: string,"p_q"?: string,"p_radius_km"?: number,"p_sort"?: string,"p_south"?: number,"p_west"?: number }; Returns: {
              "area_sqft": number,"bathrooms": number,"bhk": number,"city": string,"cover_alt": string,"cover_path": string,"featured": boolean,"furnishing": string,"id": string,"label": string,"latitude": number,"listing_type": string,"locality": string,"longitude": number,"price": number,"property_type": string,"published_at": string,"short_id": string,"slug": string,"state": string,"title": string,"total_count": number
            }[]
                           },
"slugify":
{ Args: { "input": string }; Returns: string
                           },
"storage_listing_path_ok":
{ Args: { "object_name": string }; Returns: boolean
                           },
"storage_project_path_ok":
{ Args: { "object_name": string }; Returns: boolean
                           },
"submit_enquiry":
{ Args: { "p_email"?: string,"p_message"?: string,"p_name": string,"p_phone": string,"p_short_id": string,"p_user_id": string }; Returns: string
                           },
"submit_listing":
{ Args: { "p_listing": string }; Returns: string
                           },
"submit_project_lead":
{ Args: { "p_email"?: string,"p_kind": string,"p_message"?: string,"p_name": string,"p_phone": string,"p_slug": string,"p_visit_date"?: string,"p_visitor_hash": string }; Returns: string
                           },
"track_project_event":
{ Args: { "p_event_type": string,"p_slug": string,"p_visitor_hash": string }; Returns: boolean
                           }
          }
          Enums: {
            "app_role": "super_admin"|"agent"|"builder"|"customer"
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
            "app_role": ["super_admin", "agent", "builder", "customer"]
          }
        }
} as const
