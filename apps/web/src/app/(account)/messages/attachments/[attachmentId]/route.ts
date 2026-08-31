import { NextResponse } from "next/server";

import { createConversationAttachmentSignedUrl } from "@/lib/conversations/attachments";
import { ConversationServerError } from "@/lib/conversations/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await params;

  try {
    const attachment = await createConversationAttachmentSignedUrl(attachmentId);
    return NextResponse.redirect(attachment.url, 302);
  } catch (error) {
    if (error instanceof ConversationServerError) {
      if (error.code === "UNAUTHORIZED") {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      if (error.code === "FORBIDDEN") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      if (error.code === "NOT_FOUND" || error.code === "CONFLICT") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
