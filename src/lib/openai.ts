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
// Low quality is plenty for a toy camera and dramatically cheaper (PRD §15).
const QUALITY = process.env.OPENAI_IMAGE_QUALITY || 'low';
// Small vision model that invents a custom "surprise" style from a photo.
const MAGIC_MODEL = process.env.MAGIC_PROMPT_MODEL || 'gpt-4.1-mini';

// Frame every prompt with the source-photo context (more coherent edits), then
// append a hard child-safety guardrail at the model boundary.
const SOURCE_FRAMING =
  'Use the attached camera photo as the source image. Transform it according to the ' +
  'request while keeping the result coherent and the main subject recognisable. Request: ';
const SAFETY_SUFFIX =
  ' The result must be child-friendly, warm, and playful, and safe for a 4-year-old. ' +
  'No horror, no violence, no weapons, no adult themes, no realistic injuries, and no disturbing elements.';

export interface GenerateResult {
  bytes: Buffer;
  contentType: string;
}

// Edit/transform an image using a prompt. Output is compressed WebP (small files
// → cheaper storage, faster gallery + on-device cache).
export async function generateFromImage(
  source: Buffer,
  sourceContentType: string,
  prompt: string,
  opts: { size?: string } = {},
): Promise<GenerateResult> {
  const ext = sourceContentType.includes('png')
    ? 'png'
    : sourceContentType.includes('webp')
      ? 'webp'
      : 'jpg';

  const imageFile = await toFile(source, `source.${ext}`, {
    type: sourceContentType || 'image/jpeg',
  });

  // output_format/output_compression are valid for gpt-image-1 at runtime but
  // missing from this SDK version's edit param types, so assert the shape.
  const params = {
    model: MODEL,
    image: imageFile,
    prompt: SOURCE_FRAMING + prompt + SAFETY_SUFFIX,
    size: opts.size || '1024x1024',
    quality: QUALITY,
    output_format: 'webp',
    output_compression: 85,
    n: 1,
  } as unknown as OpenAI.Images.ImageEditParams;

  const response = await client().images.edit(params);

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');
  return { bytes: Buffer.from(b64, 'base64'), contentType: 'image/webp' };
}

export interface SurprisePrompt {
  title: string;
  prompt: string;
}

// "Surprise Me": a vision model looks at the child's photo and invents one fun,
// child-safe transformation idea (title + edit instruction). The prompt is never
// shown to or typed by the child — child mode stays prompt-free (PRD §14).
export async function planSurprisePrompt(
  source: Buffer,
  sourceContentType: string,
): Promise<SurprisePrompt> {
  const dataUrl = `data:${sourceContentType || 'image/jpeg'};base64,${source.toString('base64')}`;

  const response = await client().responses.create({
    model: MAGIC_MODEL,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              "Look at this child's camera photo and invent ONE fun, silly, child-friendly " +
              'transformation idea — a playful motif, costume, friendly creature, or magical scene. ' +
              'Return JSON with: `title` = a punchy 1-3 word name, max 22 characters; ' +
              '`prompt` = one concise image-edit instruction telling an image model how to apply that ' +
              'idea to the photo while keeping the main subject recognisable and coherent. ' +
              'It MUST be delightful and safe for a 4-year-old: no scary, violent, sad, or adult themes. ' +
              'Do not mention JSON or cameras.',
          },
          { type: 'input_image', image_url: dataUrl, detail: 'low' },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'surprise_prompt',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            prompt: { type: 'string' },
          },
          required: ['title', 'prompt'],
        },
      },
    },
  });

  const raw = (response.output_text || '').trim();
  if (!raw) throw new Error('OpenAI returned no surprise prompt');

  let payload: { title?: string; prompt?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error('OpenAI returned invalid surprise prompt JSON');
  }
  const title = String(payload.title || '').trim().slice(0, 22) || 'Surprise';
  const prompt = String(payload.prompt || '').trim();
  if (!prompt) throw new Error('OpenAI returned an incomplete surprise prompt');
  return { title, prompt };
}
