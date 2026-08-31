import type {
  JsonValue,
  PriceModel,
  ProviderStatus,
  ScheduleType,
  ServiceModality,
} from "@changas/domain";

export type Json = JsonValue;

export type IdentityDocumentType = "DNI_FRONT" | "DNI_BACK" | "SELFIE";
export type AppRole = "user" | "admin";
export type ServiceModalityType = ServiceModality;
export type PriceModelType = PriceModel;
export type ScheduleTypeValue = ScheduleType;

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
  public_slug: string;
  public_headline: string | null;
  marketplace_paused: boolean;
  availability_paused: boolean;
  created_at: string;
  updated_at: string;
};

type ProviderProfilesInsert = {
  user_id: string;
  status?: ProviderStatus;
  onboarding_step?: number;
  public_slug?: string;
  public_headline?: string | null;
  marketplace_paused?: boolean;
  availability_paused?: boolean;
  created_at?: string;
  updated_at?: string;
};

type ProviderProfilesUpdate = {
  status?: ProviderStatus;
  onboarding_step?: number;
  public_slug?: string;
  public_headline?: string | null;
  marketplace_paused?: boolean;
  availability_paused?: boolean;
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

type CategoriesRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type CategoriesInsert = Omit<
  CategoriesRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type CategoriesUpdate = Partial<CategoriesInsert>;

type SkillsRow = CategoriesRow & { category_id: string };
type SkillsInsert = Omit<SkillsRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type SkillsUpdate = Partial<SkillsInsert>;

type SkillSynonymsRow = {
  id: string;
  skill_id: string;
  phrase: string;
  normalized_phrase: string;
  created_at: string;
};
type SkillSynonymsInsert = Omit<SkillSynonymsRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
type SkillSynonymsUpdate = Partial<SkillSynonymsInsert>;

type ProviderSkillsRow = {
  provider_user_id: string;
  skill_id: string;
  sort_order: number;
  is_featured: boolean;
  created_at: string;
};
type ProviderSkillsInsert = Omit<ProviderSkillsRow, "created_at"> & {
  sort_order?: number;
  is_featured?: boolean;
  created_at?: string;
};
type ProviderSkillsUpdate = Partial<
  Omit<ProviderSkillsInsert, "provider_user_id" | "skill_id">
>;

type ServicesRow = {
  id: string;
  provider_user_id: string;
  skill_id: string;
  public_slug: string;
  title: string;
  description: string;
  modality: ServiceModalityType;
  price_model: PriceModelType;
  price_amount: number | null;
  currency_code: string;
  price_unit: string | null;
  accepts_offers: boolean;
  expected_duration_minutes: number | null;
  schedule_type: ScheduleTypeValue;
  includes: string | null;
  excludes: string | null;
  materials_notes: string | null;
  is_published: boolean;
  is_paused: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type ServicesInsert = Omit<
  ServicesRow,
  "id" | "created_at" | "updated_at" | "public_slug"
> & {
  id?: string;
  public_slug?: string;
  created_at?: string;
  updated_at?: string;
};
type ServicesUpdate = Partial<Omit<ServicesInsert, "provider_user_id">>;

type ServiceTagsRow = {
  service_id: string;
  tag: string;
  normalized_tag: string;
  created_at: string;
};
type ServiceTagsInsert = Omit<
  ServiceTagsRow,
  "normalized_tag" | "created_at"
> & { created_at?: string };
type ServiceTagsUpdate = Partial<Pick<ServiceTagsInsert, "tag">>;

type ExperiencesRow = {
  id: string;
  provider_user_id: string;
  title: string;
  organization: string | null;
  description: string | null;
  started_on: string;
  ended_on: string | null;
  is_current: boolean;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type ExperiencesInsert = Omit<
  ExperiencesRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type ExperiencesUpdate = Partial<Omit<ExperiencesInsert, "provider_user_id">>;

type EducationRow = {
  id: string;
  provider_user_id: string;
  institution: string;
  field_of_study: string | null;
  description: string | null;
  started_on: string;
  ended_on: string | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type EducationInsert = Omit<
  EducationRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type EducationUpdate = Partial<Omit<EducationInsert, "provider_user_id">>;

type CertificationsRow = {
  id: string;
  provider_user_id: string;
  title: string;
  issuer: string | null;
  description: string | null;
  issued_on: string | null;
  expires_on: string | null;
  evidence_path: string | null;
  evidence_mime_type: string | null;
  evidence_file_size_bytes: number | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type CertificationsInsert = Omit<
  CertificationsRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type CertificationsUpdate = Partial<
  Omit<CertificationsInsert, "provider_user_id">
>;

type PortfolioItemsRow = {
  id: string;
  provider_user_id: string;
  title: string;
  description: string | null;
  media_path: string | null;
  media_mime_type: string | null;
  media_file_size_bytes: number | null;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type PortfolioItemsInsert = Omit<
  PortfolioItemsRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type PortfolioItemsUpdate = Partial<
  Omit<PortfolioItemsInsert, "provider_user_id">
>;

type ServiceAreasRow = {
  id: string;
  provider_user_id: string;
  label: string;
  center: Json;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type ServiceAreasInsert = Omit<
  ServiceAreasRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type ServiceAreasUpdate = Partial<Omit<ServiceAreasInsert, "provider_user_id">>;

type AvailabilityRulesRow = {
  id: string;
  provider_user_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
type AvailabilityRulesInsert = Omit<
  AvailabilityRulesRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type AvailabilityRulesUpdate = Partial<
  Omit<AvailabilityRulesInsert, "provider_user_id">
>;

type AvailabilityBlocksRow = {
  id: string;
  provider_user_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};
type AvailabilityBlocksInsert = Omit<
  AvailabilityBlocksRow,
  "id" | "created_at" | "updated_at"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type AvailabilityBlocksUpdate = Partial<
  Omit<AvailabilityBlocksInsert, "provider_user_id">
>;

type PublicProviderProfilesRow = {
  public_slug: string;
  display_name: string;
  avatar_url: string | null;
  public_zone: string | null;
  bio: string | null;
  public_headline: string | null;
};
type PublicProviderSkillsRow = {
  provider_slug: string;
  skill_slug: string;
  skill_name: string;
  category_slug: string;
  category_name: string;
  is_featured: boolean;
  sort_order: number;
};
type PublicProviderServicesRow = Omit<
  ServicesRow,
  | "id"
  | "provider_user_id"
  | "public_slug"
  | "created_at"
  | "updated_at"
  | "is_published"
  | "is_paused"
> & {
  provider_slug: string;
  public_slug: string;
  skill_slug: string;
  skill_name: string;
};
type PublicServiceTagsRow = {
  provider_slug: string;
  service_public_slug: string;
  tag: string;
};
type PublicProviderExperiencesRow = Omit<
  ExperiencesRow,
  "id" | "provider_user_id" | "created_at" | "updated_at" | "is_public"
> & { provider_slug: string };
type PublicProviderEducationRow = Omit<
  EducationRow,
  "id" | "provider_user_id" | "created_at" | "updated_at" | "is_public"
> & { provider_slug: string };
type PublicProviderCertificationsRow = Omit<
  CertificationsRow,
  | "id"
  | "provider_user_id"
  | "created_at"
  | "updated_at"
  | "is_public"
  | "evidence_path"
  | "evidence_mime_type"
  | "evidence_file_size_bytes"
> & { provider_slug: string };
type PublicProviderPortfolioRow = Omit<
  PortfolioItemsRow,
  "provider_user_id" | "created_at" | "updated_at" | "is_public"
> & { provider_slug: string };
type PublicProviderServiceAreasRow = {
  provider_slug: string;
  label: string;
  radius_meters: number;
};

export type DiscoveryServiceRow = {
  provider_display_name: string;
  provider_avatar_url: string | null;
  provider_slug: string;
  provider_zone: string | null;
  service_title: string;
  service_slug: string;
  category_slug: string;
  category_name: string;
  skill_slug: string;
  skill_name: string;
  modality: ServiceModalityType;
  price_model: PriceModelType;
  price_amount: number | null;
  currency_code: string;
  price_unit: string | null;
  accepts_offers: boolean;
  distance_meters: number | null;
  relevance: number;
};

type ProviderFavoritesRow = {
  user_id: string;
  provider_user_id: string;
  created_at: string;
};
type ProviderFavoritesInsert = Omit<ProviderFavoritesRow, "created_at"> & {
  created_at?: string;
};
type ProviderFavoritesUpdate = Partial<ProviderFavoritesInsert>;

type ViewDefinition<Row> = { Row: Row; Relationships: [] };

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
      categories: TableDefinition<
        CategoriesRow,
        CategoriesInsert,
        CategoriesUpdate
      >;
      skills: TableDefinition<SkillsRow, SkillsInsert, SkillsUpdate>;
      skill_synonyms: TableDefinition<
        SkillSynonymsRow,
        SkillSynonymsInsert,
        SkillSynonymsUpdate
      >;
      provider_skills: TableDefinition<
        ProviderSkillsRow,
        ProviderSkillsInsert,
        ProviderSkillsUpdate
      >;
      services: TableDefinition<ServicesRow, ServicesInsert, ServicesUpdate>;
      service_tags: TableDefinition<
        ServiceTagsRow,
        ServiceTagsInsert,
        ServiceTagsUpdate
      >;
      experiences: TableDefinition<
        ExperiencesRow,
        ExperiencesInsert,
        ExperiencesUpdate
      >;
      education: TableDefinition<
        EducationRow,
        EducationInsert,
        EducationUpdate
      >;
      certifications: TableDefinition<
        CertificationsRow,
        CertificationsInsert,
        CertificationsUpdate
      >;
      portfolio_items: TableDefinition<
        PortfolioItemsRow,
        PortfolioItemsInsert,
        PortfolioItemsUpdate
      >;
      service_areas: TableDefinition<
        ServiceAreasRow,
        ServiceAreasInsert,
        ServiceAreasUpdate
      >;
      availability_rules: TableDefinition<
        AvailabilityRulesRow,
        AvailabilityRulesInsert,
        AvailabilityRulesUpdate
      >;
      availability_blocks: TableDefinition<
        AvailabilityBlocksRow,
        AvailabilityBlocksInsert,
        AvailabilityBlocksUpdate
      >;
      provider_favorites: TableDefinition<
        ProviderFavoritesRow,
        ProviderFavoritesInsert,
        ProviderFavoritesUpdate
      >;
    };
    Views: {
      public_provider_profiles: ViewDefinition<PublicProviderProfilesRow>;
      public_provider_skills: ViewDefinition<PublicProviderSkillsRow>;
      public_provider_services: ViewDefinition<PublicProviderServicesRow>;
      public_service_tags: ViewDefinition<PublicServiceTagsRow>;
      public_provider_experiences: ViewDefinition<PublicProviderExperiencesRow>;
      public_provider_education: ViewDefinition<PublicProviderEducationRow>;
      public_provider_certifications: ViewDefinition<PublicProviderCertificationsRow>;
      public_provider_portfolio: ViewDefinition<PublicProviderPortfolioRow>;
      public_provider_service_areas: ViewDefinition<PublicProviderServiceAreasRow>;
    };
    Functions: {
      is_public_portfolio_media: {
        Args: { object_path: string };
        Returns: boolean;
      };
      replace_service_tags: {
        Args: { requested_tags: string[]; target_service_id: string };
        Returns: undefined;
      };
      normalize_search_text: {
        Args: { input: string };
        Returns: string;
      };
      search_discovery_services: {
        Args: {
          accepts_offers_filter?: boolean;
          category_slug?: string;
          max_price?: number;
          min_price?: number;
          modality_filter?: ServiceModalityType;
          origin_lat?: number;
          origin_lng?: number;
          page_number?: number;
          page_size?: number;
          price_model_filter?: PriceModelType;
          query_text?: string;
          radius_meters?: number;
          skill_slug?: string;
          sort_key?: string;
        };
        Returns: DiscoveryServiceRow[];
      };
      set_provider_favorite: {
        Args: { should_favorite: boolean; target_provider_slug: string };
        Returns: boolean;
      };
      list_my_favorite_providers: {
        Args: Record<string, never>;
        Returns: Array<{
          provider_slug: string;
          display_name: string;
          avatar_url: string | null;
          public_zone: string | null;
          public_headline: string | null;
          bio: string | null;
        }>;
      };
    };
    Enums: {
      provider_status: ProviderStatus;
      identity_document_type: IdentityDocumentType;
      app_role: AppRole;
      service_modality: ServiceModalityType;
      price_model: PriceModelType;
      schedule_type: ScheduleTypeValue;
    };
    CompositeTypes: Record<string, never>;
  };
};
