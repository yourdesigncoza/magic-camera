import OpenAI, { toFile } from 'openai';

let cached: OpenAI | null = null;

function client(): OpenAI {
  if (cached) return cached;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  cached = new OpenAI({ apiKey });
  return cached;
}

const MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

// A universal safety wrapper appended to every preset prompt. Child mode never
// sends freeform text, but this is a second guardrail at the model boundary.
const SAFETY_SUFFIX =
  ' The result must be child-friendly, warm, and playful, and safe for a 4-year-old. ' +
  'No horror, no violence, no weapons, no adult themes, no realistic injuries, and no disturbing elements.';

export interface GenerateResult {
  bytes: Buffer;
  contentType: string;
}

// Edit/transform the original photo using the preset prompt and return PNG bytes.
export async function generateFromImage(
  original: Buffer,
  originalContentType: string,
  prompt: string,
): Promise<GenerateResult> {
  const ext = originalContentType.includes('png')
    ? 'png'
    : originalContentType.includes('webp')
      ? 'webp'
      : 'jpg';

  const imageFile = await toFile(original, `original.${ext}`, {
    type: originalContentType || 'image/jpeg',
  });

  const response = await client().images.edit({
    model: MODEL,
    image: imageFile,
    prompt: prompt + SAFETY_SUFFIX,
    size: '1024x1024',
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI returned no image data');
  }
  return { bytes: Buffer.from(b64, 'base64'), contentType: 'image/png' };
}
