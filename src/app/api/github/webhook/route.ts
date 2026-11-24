import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyGitHubWebhookSignature } from "@/lib/github/app";

export async function POST(request: Request) {
  const deliveryId = request.headers.get("x-github-delivery");
  const eventType = request.headers.get("x-github-event");
  const signature = request.headers.get("x-hub-signature-256");

  if (!deliveryId || !eventType) {
    return NextResponse.json(
      { error: "Missing required GitHub webhook headers." },
      { status: 400 }
    );
  }

  // 1. Read raw body text for cryptographic HMAC verification
  const rawBody = await request.text();

  // 2. Verify HMAC SHA-256 signature
  const isValid = verifyGitHubWebhookSignature(rawBody, signature);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // 3. Duplicate event protection (Idempotency check via delivery_id)
  const { data: existingEvent } = await supabase
    .from("github_webhook_events")
    .select("id")
    .eq("delivery_id", deliveryId)
    .maybeSingle();

  if (existingEvent) {
    return NextResponse.json(
      { message: "Duplicate event already processed.", delivery_id: deliveryId },
      { status: 200 }
    );
  }

  const action = (payload.action as string) || null;
  const installation = payload.installation as { id?: number } | undefined;
  const installationId = installation?.id || null;

  // 4. Record event receipt
  await supabase.from("github_webhook_events").insert({
    delivery_id: deliveryId,
    event_type: eventType,
    action,
    installation_id: installationId,
    payload,
    processed: false,
  });

  // 5. Safe event processing
  try {
    if (eventType === "installation") {
      if (action === "deleted" && installationId) {
        // App was uninstalled from GitHub: remove installation record (cascade removes repos)
        await supabase
          .from("github_installations")
          .delete()
          .eq("installation_id", installationId);
      }
    } else if (eventType === "installation_repositories") {
      if (installationId) {
        // Get user_id for this installation
        const { data: inst } = await supabase
          .from("github_installations")
          .select("user_id")
          .eq("installation_id", installationId)
          .maybeSingle();

        if (inst) {
          const reposAdded = (payload.repositories_added as Array<{
            id: number;
            name: string;
            full_name: string;
            private: boolean;
            default_branch?: string;
            html_url?: string;
          }>) || [];

          const reposRemoved = (payload.repositories_removed as Array<{ id: number }>) || [];

          // Add newly authorized repositories
          if (reposAdded.length > 0) {
            const rows = reposAdded.map((r) => ({
              installation_id: installationId,
              user_id: inst.user_id,
              repo_id: r.id,
              name: r.name,
              full_name: r.full_name,
              owner_login: r.full_name.split("/")[0] || "",
              default_branch: r.default_branch || "main",
              is_private: r.private,
              html_url: r.html_url || `https://github.com/${r.full_name}`,
              last_synchronized_at: new Date().toISOString(),
            }));

            await supabase
              .from("github_repositories")
              .upsert(rows, { onConflict: "installation_id,repo_id" });
          }

          // Remove unshared repositories
          if (reposRemoved.length > 0) {
            const removedIds = reposRemoved.map((r) => r.id);
            await supabase
              .from("github_repositories")
              .delete()
              .eq("installation_id", installationId)
              .in("repo_id", removedIds);
          }
        }
      }
    } else if (eventType === "push") {
      const repository = payload.repository as { id?: number } | undefined;
      if (repository?.id) {
        // Update last_synchronized_at timestamp for tracking future scan triggers
        await supabase
          .from("github_repositories")
          .update({ last_synchronized_at: new Date().toISOString() })
          .eq("repo_id", repository.id);
      }
    }

    // Mark event as successfully processed
    await supabase
      .from("github_webhook_events")
      .update({ processed: true })
      .eq("delivery_id", deliveryId);

    return NextResponse.json({ success: true, processed: true }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error processing webhook event";
    await supabase
      .from("github_webhook_events")
      .update({ error: errorMsg })
      .eq("delivery_id", deliveryId);

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
