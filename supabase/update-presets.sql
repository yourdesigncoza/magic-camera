-- ============================================================================
-- One-off fix: remove duplicate presets + add new styles.
-- Run once in the Supabase SQL editor. Idempotent — safe to run again.
-- ============================================================================

begin;

-- 1. De-duplicate: keep a single row per preset name.
--    (Duplicates came from re-running the seed before a unique index existed.)
delete from presets a
using presets b
where a.name = b.name
  and a.ctid > b.ctid;

-- 2. Enforce uniqueness so the seed can never duplicate again.
create unique index if not exists presets_name_key on presets (name);

-- 3. Add the new styles (no-op for any that already exist).
insert into presets (name, label, emoji, prompt, is_enabled, sort_order) values
('scribble', 'Pathetic Scribble', '✏️',
 'Redraw the attached image in the most clumsy, scribbly, and utterly pathetic way possible. Use a white background, and make it look like it was drawn in an old computer painting program with a mouse. It should be vaguely similar but also not really, kind of matching but also off in a confusing, awkward way, with that low-quality pixel-by-pixel feel that really emphasizes how ridiculously bad it is. Actually, you know what, whatever, just draw it however you want.',
 true, 7),
('cheese', 'Turn to Cheese', '🧀',
 'Change nothing about this photo except everyone is turned into cheese.',
 true, 8),
('goblin', 'Goblin Mode', '👹',
 'Make the subject into a cute fantasy character in a scrappy handmade indie webcomic style. Use exaggerated fantasy anatomy with huge pointed ears, oversized expressive yellow eyes, tiny fangs, simplified facial features, and chibi-adjacent proportions. Draw with thick uneven black ink outlines, sketchy hand-drawn linework, and intentionally imperfect shapes. Use flat cel shading only — NO painterly rendering, realistic lighting, or detailed textures. The palette should be muted earthy greens, dusty reds, faded browns, warm creams, and soft olive tones with minimal gradients. The subject wears ragged fantasy adventurer clothes with wraps around the arms and legs and holds a crooked wooden staff with a glowing gem attached. A small bag of golden tokens sits near their feet. There should never be any text on the final image. Despite the web comic reference, the image should be focused on the main subject(s) and the illustrated background without text. The expression should feel slightly startled, mischievous, and awkwardly charming. Composition should feel like an indie animation character sheet or fantasy webcomic panel with lots of negative space and a sparse lightly sketched forest background bathed in warm golden light. Add tiny doodle-like motion lines, dust puffs, and whimsical comic accents. Preserve a playful chaotic energy and cozy spooky fantasy mood. Aesthetic references: indie fantasy webcomic, internet sketchbook character art, handmade cartoon fantasy, cozy spooky zine art, and indie RPG-inspired character sheets. Avoid: painterly rendering, realism, cinematic lighting, detailed skin texture, glossy shading, 3D rendering, hyper-detail, polished anime style, realistic proportions, dramatic depth-of-field, complex backgrounds. Important: there should never be any mention of stealing, lying, or any other criminal activity.',
 true, 9),
('anime', 'Anime Portrait', '🎨',
 'Create a trending anime art style image from the uploaded subject. Use confident line-work with slight variation and minimal cel shading using flat shadow shapes. Use bright, saturated colors and clean graphic lighting. The style that is defined by its exaggerated, cartoonish character proportions featuring highly expressive, simplistic facial features that allow for immense emotional range, with highly varied stretched anatomy. Transform the environment into a slightly warped space with playful perspective distortion and simplified objects. Composition and tone is energetic, lively, and comedic in a fully stylized, non-realistic world.',
 true, 10)
on conflict (name) do nothing;

commit;

-- Verify: should list 10 rows, no duplicate names.
-- select name, label, sort_order from presets order by sort_order;
