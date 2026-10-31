
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
"build_property_slug":
{ Args: { "locality": string,"title": string }; Returns: string
                           },
"has_role":
{ Args: { "target_role": Database["public"]['Enums']["app_role"],"target_user": string }; Returns: boolean
                           },
"has_verified_phone":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
"owns_property":
{ Args: { "target_property": string }; Returns: boolean
                           },
"reserved_admin_email":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"slugify":
{ Args: { "input": string }; Returns: string
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
