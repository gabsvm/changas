export type PushCapability =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export type PushCapabilityInput = {
  notificationSupported: boolean;
  serviceWorkerSupported: boolean;
  permission: NotificationPermission;
};

export function resolvePushCapability({
  notificationSupported,
  serviceWorkerSupported,
  permission,
}: PushCapabilityInput): PushCapability {
  if (!notificationSupported || !serviceWorkerSupported) {
    return "unsupported";
  }

  return permission;
}
