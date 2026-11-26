import Link from "next/link";
import { ProtectionLevelsView } from "@/components/code-health/protection-levels-view";
import { ArrowLeft } from "lucide-react";

export default async function AppProtectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-border/60 pb-4">
        <Link
          href={`/dashboard/applications/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to application
        </Link>
      </div>
      <ProtectionLevelsView applicationId={id} />
    </div>
  );
}
