import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handlePing(slug: string) {
  if (!slug || slug.length > 100) {
    return NextResponse.json({ error: "Invalid heartbeat slug" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("heartbeat_monitors")
    .update({
      last_ping_at: now,
      status: "up",
    })
    .eq("slug", slug)
    .select("id, name, status, last_ping_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Heartbeat monitor not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    name: data.name,
    status: data.status,
    receivedAt: data.last_ping_at,
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  return handlePing(slug);
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  return handlePing(slug);
}
