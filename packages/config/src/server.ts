import "server-only";

export type ServiceRoleEnv = {
  url: string;
  serviceRoleKey: string;
};

export function getServiceRoleEnv(): ServiceRoleEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "Missing required server environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Missing required server-only environment variable: SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return { url, serviceRoleKey };
}
