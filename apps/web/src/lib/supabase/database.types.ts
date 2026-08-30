import type { JsonValue, ProviderStatus } from "@changas/domain";

export type Json = JsonValue;

export type IdentityDocumentType = "DNI_FRONT" | "DNI_BACK" | "SELFIE";
export type AppRole = "user" | "admin";

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ProfilesRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  public_zone: string | null;
  bio: string | null;
  created_at: string;
  updated_at: string;
};

type ProfilesInsert = {
  id: string;
  display_name?: string;
  avatar_url?: string | null;
  public_zone?: string | null;
  bio?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProfilesUpdate = {
  display_name?: string;
  avatar_url?: string | null;
  public_zone?: string | null;
  bio?: string | null;
  updated_at?: string;
};

type ProfilePrivateRow = {
  user_id: string;
  legal_name: string | null;
  private_phone: string | null;
  date_of_birth: string | null;
  exact_address: string | null;
  dni_number: string | null;
  created_at: string;
  updated_at: string;
};

type ProfilePrivateInsert = {
  user_id: string;
  legal_name?: string | null;
  private_phone?: string | null;
  date_of_birth?: string | null;
  exact_address?: string | null;
  dni_number?: string | null;
  created_at?: string;
  updated_at?: string;
};

type ProfilePrivateUpdate = {
  legal_name?: string | null;
  private_phone?: string | null;
  date_of_birth?: string | null;
  exact_address?: string | null;
  dni_number?: string | null;
  updated_at?: string;
};

type ProviderProfilesRow = {
  user_id: string;
  status: ProviderStatus;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
};

type ProviderProfilesInsert = {
  user_id: string;
  status?: ProviderStatus;
  onboarding_step?: number;
  created_at?: string;
  updated_at?: string;
};

type ProviderProfilesUpdate = {
  status?: ProviderStatus;
  onboarding_step?: number;
  updated_at?: string;
};

type ProviderDocumentsRow = {
  id: string;
  user_id: string;
  document_type: IdentityDocumentType;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
};

type ProviderDocumentsInsert = {
  id?: string;
  user_id: string;
  document_type: IdentityDocumentType;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at?: string;
};

type ProviderDocumentsUpdate = {
  document_type?: IdentityDocumentType;
  storage_path?: string;
  mime_type?: string;
  file_size_bytes?: number;
};

type UserSettingsRow = {
  user_id: string;
  locale: string;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

type UserSettingsInsert = {
  user_id: string;
  locale?: string;
  timezone?: string | null;
  created_at?: string;
  updated_at?: string;
};

type UserSettingsUpdate = {
  locale?: string;
  timezone?: string | null;
  updated_at?: string;
};

type UserRolesRow = {
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

type UserRolesInsert = {
  user_id: string;
  role?: AppRole;
  created_at?: string;
  updated_at?: string;
};

type UserRolesUpdate = {
  role?: AppRole;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<ProfilesRow, ProfilesInsert, ProfilesUpdate>;
      profile_private: TableDefinition<
        ProfilePrivateRow,
        ProfilePrivateInsert,
        ProfilePrivateUpdate
      >;
      provider_profiles: TableDefinition<
        ProviderProfilesRow,
        ProviderProfilesInsert,
        ProviderProfilesUpdate
      >;
      provider_documents: TableDefinition<
        ProviderDocumentsRow,
        ProviderDocumentsInsert,
        ProviderDocumentsUpdate
      >;
      user_settings: TableDefinition<
        UserSettingsRow,
        UserSettingsInsert,
        UserSettingsUpdate
      >;
      user_roles: TableDefinition<
        UserRolesRow,
        UserRolesInsert,
        UserRolesUpdate
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      provider_status: ProviderStatus;
      identity_document_type: IdentityDocumentType;
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
