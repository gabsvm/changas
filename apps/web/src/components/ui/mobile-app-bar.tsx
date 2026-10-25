import type { ReactNode } from "react";

import { AppHeader } from "@/components/ui/marketplace/app-header";

export function MobileAppBar({
  title,
  backHref,
  backLabel,
  trailing,
}: {
  title: string;
  backHref?: string | undefined;
  backLabel?: string | undefined;
  trailing?: ReactNode;
}) {
  return (
    <AppHeader
      title={title}
      backHref={backHref}
      backLabel={backLabel}
      action={trailing}
      className="sm:hidden"
    />
  );
}
