import type { ReactNode } from "react";

import { AppHeader } from "@/components/ui/marketplace/app-header";

export function MobileAppBar({
  title,
  backHref,
  trailing,
}: {
  title: string;
  backHref?: string;
  trailing?: ReactNode;
}) {
  return (
    <AppHeader
      title={title}
      backHref={backHref}
      action={trailing}
      className="sm:hidden"
    />
  );
}
