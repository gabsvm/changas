import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <main className="bg-canvas min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-8">
        <PageSkeleton variant="hero" />
      </div>
    </main>
  );
}
