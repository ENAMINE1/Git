import type { Category, Genre, Niche, Software } from '../types';

// Technique categories. The first nine follow the brief's technique pages;
// "Motion graphics" is split from "Animation" to match the library tabs.
export const CATEGORIES: Category[] = [
  { id: 'cat_transition', slug: 'transitions', name: 'Transitions', order: 1, description: 'Ways of moving from one shot to the next — cuts disguised, bridged or celebrated.' },
  { id: 'cat_effect', slug: 'effects', name: 'Effects', order: 2, description: 'Optical and digital treatments applied to the image: blur, grain, glow, distortion, compositing.' },
  { id: 'cat_motion', slug: 'motion-graphics', name: 'Motion graphics', order: 3, description: 'Designed graphic elements in motion: type, shapes, UI, 3D objects integrated with footage.' },
  { id: 'cat_animation', slug: 'animation', name: 'Animation', order: 4, description: 'Principles and keyframe craft — easing, overshoot, stagger, procedural motion.' },
  { id: 'cat_camera', slug: 'camera-movement', name: 'Camera movement', order: 5, description: 'How the camera (real or virtual) travels through space.' },
  { id: 'cat_cinematography', slug: 'cinematography', name: 'Cinematography', order: 6, description: 'Framing, lensing, lighting and depth — the shot itself.' },
  { id: 'cat_typography', slug: 'typography', name: 'Typography', order: 7, description: 'Type as image: layout, reveals, integration with the scene.' },
  { id: 'cat_sound', slug: 'sound-design', name: 'Sound design', order: 8, description: 'Whooshes, risers, hits, foley, ambience, silence and sync.' },
  { id: 'cat_grammar', slug: 'editing-grammar', name: 'Editing grammar', order: 9, description: 'Cut types, pacing and structure — the language of the edit.' },
  { id: 'cat_color', slug: 'color-grading', name: 'Color grading', order: 10, description: 'Looks, contrast and colour relationships.' },
];

export const SOFTWARE: Software[] = [
  { id: 'sw_ae', name: 'After Effects', vendor: 'Adobe', kind: 'compositor' },
  { id: 'sw_pr', name: 'Premiere Pro', vendor: 'Adobe', kind: 'editor' },
  { id: 'sw_resolve', name: 'DaVinci Resolve', vendor: 'Blackmagic Design', kind: 'editor' },
  { id: 'sw_fcp', name: 'Final Cut Pro', vendor: 'Apple', kind: 'editor' },
  { id: 'sw_capcut', name: 'CapCut', vendor: 'ByteDance', kind: 'mobile' },
  { id: 'sw_blender', name: 'Blender', vendor: 'Blender Foundation', kind: '3d' },
  { id: 'sw_c4d', name: 'Cinema 4D', vendor: 'Maxon', kind: '3d' },
  { id: 'sw_ps', name: 'Photoshop', vendor: 'Adobe', kind: 'design' },
  { id: 'sw_ai', name: 'Illustrator', vendor: 'Adobe', kind: 'design' },
  { id: 'sw_nuke', name: 'Nuke', vendor: 'Foundry', kind: 'compositor' },
  { id: 'sw_mocha', name: 'Mocha Pro', vendor: 'Boris FX', kind: 'plugin' },
  { id: 'sw_e3d', name: 'Element 3D', vendor: 'Video Copilot', kind: 'plugin' },
  { id: 'sw_audition', name: 'Audition', vendor: 'Adobe', kind: 'audio' },
  { id: 'sw_unreal', name: 'Unreal Engine', vendor: 'Epic Games', kind: '3d' },
  { id: 'sw_figma', name: 'Figma', vendor: 'Figma', kind: 'design' },
  { id: 'sw_animate', name: 'Adobe Animate', vendor: 'Adobe', kind: 'design' },
];

// Genre = what kind of video it is. Kept separate from art direction.
export const GENRES: Genre[] = [
  { id: 'gen_tech_ad', name: 'Technology advertisement' },
  { id: 'gen_product', name: 'Product commercial' },
  { id: 'gen_brand', name: 'Brand film' },
  { id: 'gen_music_video', name: 'Music video' },
  { id: 'gen_short_film', name: 'Short film' },
  { id: 'gen_documentary', name: 'Documentary' },
  { id: 'gen_social', name: 'Social media reel' },
  { id: 'gen_tutorial', name: 'Tutorial / education' },
  { id: 'gen_game_trailer', name: 'Game trailer' },
  { id: 'gen_movie_trailer', name: 'Movie trailer' },
  { id: 'gen_fashion', name: 'Fashion film' },
  { id: 'gen_travel', name: 'Travel film' },
  { id: 'gen_vlog', name: 'Vlog' },
  { id: 'gen_title', name: 'Title sequence' },
  { id: 'gen_motion_piece', name: 'Motion design piece' },
  { id: 'gen_fan_edit', name: 'Fan edit' },
];

export const NICHES: Niche[] = [
  { id: 'nic_tech', name: 'Technology' },
  { id: 'nic_sports', name: 'Sports' },
  { id: 'nic_fashion', name: 'Fashion' },
  { id: 'nic_food', name: 'Food & drink' },
  { id: 'nic_travel', name: 'Travel' },
  { id: 'nic_auto', name: 'Automotive' },
  { id: 'nic_gaming', name: 'Gaming' },
  { id: 'nic_anime', name: 'Anime & animation' },
  { id: 'nic_music', name: 'Music' },
  { id: 'nic_beauty', name: 'Beauty' },
  { id: 'nic_art', name: 'Art & design' },
  { id: 'nic_editing', name: 'Video editing education' },
];
