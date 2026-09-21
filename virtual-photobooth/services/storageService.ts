import { getSupabaseClient } from "@/lib/supabase/client";

const STRIPS_BUCKET = "strips";

/**
 * Uploads a generated strip (PNG data URL) to Supabase Storage and returns
 * a public URL both participants can use to view/download it.
 */
export async function uploadStrip(roomId: string, dataUrl: string): Promise<string> {
  const supabase = getSupabaseClient();
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${roomId}/${Date.now()}.png`;

  const { error } = await supabase.storage.from(STRIPS_BUCKET).upload(path, blob, {
    contentType: "image/png",
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload strip: ${error.message}`);
  }

  const { data } = supabase.storage.from(STRIPS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
