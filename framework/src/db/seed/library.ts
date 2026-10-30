// Starter art directions, glossary, moodboards and collections.
//
// Art directions are the starting examples from the brief, not a fixed
// taxonomy. Their mood/characteristics are short working definitions
// (provenance "reference"); palettes are intentionally empty — they fill in
// from the colours extracted from images you add to each moodboard.

import type { ArtDirection, GlossaryTerm } from '../types';

type ADSeed = Pick<ArtDirection, 'id' | 'name' | 'mood' | 'description' | 'characteristics' | 'typography'> & {
  techniques: string[];
};

export const ART_DIRECTIONS: ADSeed[] = [
  {
    id: 'ad_cinematic_documentary',
    name: 'Cinematic documentary',
    mood: 'Observational, intimate, grounded',
    description: 'Real people and places shot with cinematic care: natural light, shallow focus, patient framing and ambient sound.',
    characteristics: ['Natural / available light', 'Shallow depth of field', 'Handheld intimacy', 'Long takes', 'Ambient sound beds', 'Lower-third typography'],
    typography: 'Restrained sans-serif titles and lower thirds.',
    techniques: ['shallow-dof', 'handheld-vs-stabilized', 'slow-pacing', 'ambience', 'j-cut', 'l-cut'],
  },
  {
    id: 'ad_futuristic_digital',
    name: 'Futuristic digital',
    mood: 'Precise, luminous, synthetic',
    description: 'Clean CG, interface graphics and glowing light on dark grounds; motion is fast and exact.',
    characteristics: ['UI / HUD overlays', 'Glow on dark backgrounds', 'Grid and data motifs', 'Exact, snappy easing', 'Glitch accents'],
    typography: 'Geometric or monospaced type, often tracked out.',
    techniques: ['ui-animation', 'glow', 'glitch-transition', 'easing-graph-editor', '3d-object-integration'],
  },
  {
    id: 'ad_minimal_editorial',
    name: 'Minimal editorial',
    mood: 'Calm, considered, refined',
    description: 'Generous negative space, centred compositions, muted colour and confident typography — magazine layouts in motion.',
    characteristics: ['Negative space', 'Symmetry', 'Muted palette', 'Slow, precise moves', 'Type as layout'],
    typography: 'Editorial serif or neo-grotesk, large and sparse.',
    techniques: ['symmetrical-framing', 'muted-filmic', 'text-reveal', 'slow-pacing'],
  },
  {
    id: 'ad_analog_film',
    name: 'Analog film',
    mood: 'Nostalgic, warm, tactile',
    description: 'The look of film stock: grain, halation, soft highlight roll-off, light leaks and gate weave.',
    characteristics: ['Film grain', 'Halation', 'Light leaks', 'Rolled-off highlights', 'Warm colour crosstalk'],
    typography: 'Typewriter, serif or date-stamp type.',
    techniques: ['film-grain', 'halation', 'light-leaks', 'film-emulation'],
  },
  {
    id: 'ad_dark_industrial',
    name: 'Dark industrial',
    mood: 'Heavy, metallic, tense',
    description: 'Low-key light on hard materials, desaturated colour, deep blacks and heavy sound design.',
    characteristics: ['Low-key lighting', 'Metal and concrete textures', 'Desaturated / bleach-bypass colour', 'Impacts and drones'],
    typography: 'Condensed, heavy sans-serif.',
    techniques: ['low-key-lighting', 'bleach-bypass', 'impact-hit', 'macro-product'],
  },
  {
    id: 'ad_high_energy_commercial',
    name: 'High-energy commercial',
    mood: 'Punchy, bright, kinetic',
    description: 'Fast cuts on the beat, speed ramps, whip pans and bold graphics designed to stop the scroll.',
    characteristics: ['Beat-matched cuts', 'Speed ramps', 'Whip pans', 'Bold kinetic type', 'Saturated colour'],
    typography: 'Bold sans-serif, animated kinetically.',
    techniques: ['beat-matched-editing', 'speed-ramp', 'whip-pan', 'kinetic-typography', 'hook-structure', 'rapid-cutting'],
  },
  {
    id: 'ad_retro_futuristic',
    name: 'Retro futuristic',
    mood: 'Playful, nostalgic-forward',
    description: 'The future as imagined in the past: chrome, neon, scanlines, VHS artefacts and synth palettes.',
    characteristics: ['Chrome and neon', 'Scanlines / VHS damage', 'Gradient skies', 'Chromatic aberration'],
    typography: 'Chrome script, wide extended sans.',
    techniques: ['chromatic-aberration', 'glitch-transition', 'glow'],
  },
  {
    id: 'ad_experimental_motion',
    name: 'Experimental motion design',
    mood: 'Inventive, rule-breaking',
    description: 'Mixed media, hand-made textures, frame-by-frame passages and unexpected transitions.',
    characteristics: ['Mixed media', 'Frame-by-frame', 'Texture boil', 'Shape morphs', 'Unusual transitions'],
    typography: 'Expressive, often hand-made or distorted.',
    techniques: ['frame-by-frame', 'animated-texture', 'shape-morphing', 'displacement-transition'],
  },
  {
    id: 'ad_3d_surrealism',
    name: '3D surrealism',
    mood: 'Dreamlike, uncanny',
    description: 'Impossible objects and spaces rendered photo-real or soft-clay, often composited into real footage.',
    characteristics: ['Impossible scale', 'Soft studio light', 'Tracked CG in live action', 'Pastel or monochrome palettes'],
    typography: 'Minimal — the image carries it.',
    techniques: ['3d-object-integration', 'camera-tracking', 'particles'],
  },
  {
    id: 'ad_atmospheric_storytelling',
    name: 'Atmospheric storytelling',
    mood: 'Moody, slow, immersive',
    description: 'Haze, silhouettes and long takes; sound and silence carry as much as picture.',
    characteristics: ['Haze and silhouettes', 'Long takes', 'Silence and contrast', 'Ambient soundscapes'],
    typography: 'Sparse, elegant titles.',
    techniques: ['slow-pacing', 'silence-contrast', 'ambience', 'low-key-lighting'],
  },
];

// Personal moodboards and collections named in the brief, created empty.
export const STARTER_MOODBOARDS = [
  { id: 'mb_futuristic_ui', name: 'Futuristic UI' },
  { id: 'mb_motion_typography', name: 'Motion typography' },
  { id: 'mb_game_trailer', name: 'Game trailer references' },
  { id: 'mb_experimental_transitions', name: 'Experimental transitions' },
];

export const STARTER_COLLECTIONS = [
  { id: 'col_recreate', name: 'Effects I want to recreate' },
  { id: 'col_future_transitions', name: 'Transitions for future projects' },
  { id: 'col_fav_aesthetics', name: 'Favorite video aesthetics' },
  { id: 'col_game_trailers', name: 'References for game trailers' },
  { id: 'col_typography', name: 'Typography inspirations' },
];

type TermSeed = Pick<GlossaryTerm, 'term' | 'definition'> & { aliases?: string[]; technique?: string };

export const GLOSSARY: TermSeed[] = [
  { term: 'Keyframe', definition: 'A point in time where a property value is set; the software interpolates between keyframes.' },
  { term: 'Interpolation', definition: 'How values travel between keyframes — linear, Bezier, hold (step), or auto.' },
  { term: 'Easing', definition: 'Acceleration and deceleration between keyframes.', technique: 'easing-graph-editor' },
  { term: 'Graph Editor', definition: 'After Effects view that shows speed or value curves of keyframed properties.', technique: 'easing-graph-editor' },
  { term: 'Shutter angle', definition: 'Exposure time expressed as an angle of a rotating shutter; 180° is a half-frame exposure and gives natural motion blur.', technique: 'motion-blur' },
  { term: 'Frame rate', definition: 'Frames recorded or played per second (24, 25, 30, 60, 120…). Shooting higher than playback enables slow motion.' },
  { term: 'Overcranking', definition: 'Recording at a higher frame rate than playback to produce slow motion.', technique: 'speed-ramp' },
  { term: 'Adjustment layer', definition: 'An empty layer whose effects apply to every layer below it — the usual home for transitions and looks.' },
  { term: 'Pre-compose', aliases: ['precomp', 'nest', 'compound clip'], definition: 'Grouping layers into a nested composition so they can be treated as one layer.' },
  { term: 'Null object', definition: 'An invisible layer used as a parent or a carrier for tracking data.' },
  { term: 'Parenting', definition: 'Linking a layer to another so it inherits its transforms.' },
  { term: 'Track matte', aliases: ['alpha matte', 'luma matte'], definition: 'Using one layer\'s alpha or luminance to define where another layer is visible.', technique: 'mask-transition' },
  { term: 'Alpha channel', definition: 'The transparency channel of an image or video.' },
  { term: 'Mask', definition: 'A path that limits where a layer or effect is visible; can be keyframed and feathered.' },
  { term: 'Feather', definition: 'Softening of a mask edge.' },
  { term: 'Roto', definition: 'Short for rotoscoping — isolating a subject frame by frame.', technique: 'rotoscoping' },
  { term: 'Planar tracking', definition: 'Tracking a flat surface\'s perspective (e.g. a screen) rather than individual points.', technique: 'screen-replacement' },
  { term: 'Matchmove', definition: 'Reconstructing the camera\'s motion so CG can be added in perspective.', technique: 'camera-tracking' },
  { term: 'Corner pin', definition: 'Warping a layer by moving its four corners — the output of a planar track.', technique: 'screen-replacement' },
  { term: 'Optical flow', definition: 'Estimating per-pixel motion to synthesise frames or motion blur.', technique: 'frame-blending' },
  { term: 'Blend mode', aliases: ['composite mode', 'transfer mode'], definition: 'The maths used to combine a layer with what is below it — Screen, Add, Multiply, Overlay…' },
  { term: 'LUT', aliases: ['lookup table'], definition: 'A table that maps input colours to output colours — used for technical conversions or creative looks.' },
  { term: 'Log footage', definition: 'Footage recorded with a flat logarithmic curve to preserve dynamic range; needs a conversion before grading.' },
  { term: 'Color space transform', aliases: ['CST'], definition: 'Converting footage between colour spaces and gammas (e.g. camera log → Rec.709).' },
  { term: 'PowerGrade', definition: 'A saved DaVinci Resolve node tree that can be reapplied as a look.' },
  { term: 'Node', definition: 'In Resolve/Fusion/Nuke, a single operation in a graph; order and connections define the result.' },
  { term: 'Power Window', definition: 'DaVinci Resolve\'s shape-based isolation tool on the Color page.' },
  { term: 'Qualifier', definition: 'Selecting part of an image by hue, saturation or luminance for a targeted correction.' },
  { term: 'B-roll', definition: 'Supplementary footage cut over the main action or voice.' },
  { term: 'Lower third', definition: 'Graphic in the lower part of frame, typically a name or caption.' },
  { term: 'Expression', definition: 'Code attached to a property to drive it procedurally.', technique: 'procedural-animation' },
  { term: 'Hold keyframe', definition: 'A keyframe that holds its value until the next one — creates instant jumps (useful for glitches).' },
  { term: 'Proxy', definition: 'A lightweight copy of footage used for smooth editing, swapped for the original on export.' },
  { term: 'Retime', definition: 'Changing the playback speed of a clip.', technique: 'speed-ramp' },
];
