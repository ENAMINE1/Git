# Phase 1 research log

**Date:** 2026-10-30
**Conditions:** the build sandbox's network policy blocked `instagram.com` and `youtube.com` (both page fetches and API/oEmbed calls). Web search was available. So:

- No video was watched. No frames, transcripts or timestamps were extracted.
- Facts below come from search-result listings and the third-party pages named in each row. Every seeded record carries these sources in the app.
- Anything that could not be confirmed is marked *inferred* or left empty, never filled in.

To finish the research, allow `instagram.com`, `youtube.com` and `i.ytimg.com` in the environment's network settings, or simply inspect the references yourself in the app. Every reference has an inspection checklist.

## The five seed references

| Creator | Reel | Status | Notes |
|---|---|---|---|
| @jordans.archivess | [DeP2abcBrB1](https://www.instagram.com/reel/DeP2abcBrB1/?vrfl=YzAyMDM1MGJkZA==) | Pending inspection | Profile listing: Jordan Watkins, "visual storyteller … intersection of tech and art" |
| @austinwhite711 | [DfC6SMjNbtF](https://www.instagram.com/reel/DfC6SMjNbtF/?exln=YzAyMDM1MGJkZA==) | Pending inspection | Only the profile listing was found |
| @jordans.archivess | [DeKDmkmh_gM](https://www.instagram.com/reel/DeKDmkmh_gM/?cplk=YzAyMDM1MGJkZA==) | Pending inspection | — |
| @yuyenwng | [DdFE-HlRKiB](https://www.instagram.com/reel/DdFE-HlRKiB/?obrf=YzAyMDM1MGJkZA==) | Pending inspection | **Priority:** capture the software interface, timeline, effects panel and layers |
| @yuyenwng | [DehIeijMVjf](https://www.instagram.com/reel/DehIeijMVjf/?dlrf=YzAyMDM1MGJkZA==) | Pending inspection | Same priority |

None of the five is assigned a genre, art direction or technique, because none of them has been seen. Each one stays a separate reference rather than being grouped by creator.

What search did surface about **yuyenwng**: the site [yuyenwng.com](https://yuyenwng.com/) ("coming soon") lists planned products: *wngrade*, node-based PowerGrades for DaVinci Resolve; *wngLUTS*, muted filmic looks; custom SFX; and an editing masterclass. The TikTok bio links a Gumroad assets store. DaVinci Resolve is therefore stored as an **inferred** tool, to be confirmed from interface screenshots.

## Creators

All are stored as **candidates**. The brief says to evaluate actual content before approving anyone, and that couldn't be done here.

| Creator | Main platform | URL found | Software (as reported) | Focus (as reported) |
|---|---|---|---|---|
| Ben Marriott | YouTube | benmarriott.com | After Effects | Motion design, animation principles, frame-by-frame, textures |
| Jake In Motion (Jake Bartlett) | YouTube | youtube.com/jakeinmotion · jakeinmotion.com | After Effects | Effect-by-effect explainers, presets, project files |
| Justin Odisho | YouTube | youtube.com/@JustinOdisho | Premiere Pro, After Effects | Trending transitions and effects, text effects |
| Video Copilot (Andrew Kramer) | Web | videocopilot.net | After Effects, Element 3D | VFX compositing, cinematic titles. ⚠ "VideoCopilotTuts" on YouTube says it is *not* run by Kramer |
| Daniel Schiffer | YouTube | youtube.com/@danielschiffer | Final Cut Pro (per RouteNote) | Product videography, in-camera / whip-pan transitions |
| yuyenwng | Instagram / TikTok | yuyenwng.com | DaVinci Resolve (inferred) | Cinematic edits, grid transitions, travel |
| Jordan Orme | YouTube | youtube.com/@JordanOrme | — | Music-video editor; editor-reaction breakdowns |
| Hayden Hillier-Smith | YouTube | youtube.com/c/HillierSmith | — | YouTube editing, storytelling, sound design |
| This Guy Edits (Sven Pape) | YouTube | youtube.com/svenpape | — | Story, character, emotion; editing notes |
| Film Editing Pro | YouTube | channel UCkePWcrHz4q9y6kg5jvhWOw · filmeditingpro.com | — | Trailer editing, trailer breakdowns |
| Cinecom.net | YouTube | youtube.com/@CinecomCrew | Premiere Pro, After Effects | Practical VFX and transition recreations |
| Ryan Herrick | YouTube | youtube.com/@Ryanherrickk | DaVinci Resolve | Viral / short-form reel workflows |
| Your Editor Friend | YouTube | youtube.com/@Editor_friend | After Effects, Premiere Pro | Matched by name only. The channel describes a freelance editor; tutorial depth unverified |
| Simply Put | Patreon | patreon.com/SimplyPut_ | — | "Make motion graphics and video editing easy". YouTube URL not found |

## Breakdown videos (19)

These are real URLs with their indexed titles. Technique links on them were suggested **from the title only** and are stored as *inferred*. Timeline steps and transcripts are empty until you watch each video.

| Creator | Title | Suggested technique |
|---|---|---|
| Cinecom.net | Custom Transition in Premiere Pro Tutorial | Mask Transition |
| Cinecom.net | INFINITE TRANSITION in AFTER EFFECTS (Chainsmokers – Side Effects) | Infinite Zoom |
| Cinecom.net | Camera THROUGH MIRROR Transition – Premiere Pro Tutorial | In-Camera Movement Transition |
| Cinecom.net | Laptop TRANSITION in Premiere Pro (From CASEY NEISTAT Mega Vlog) | Screen Replacement |
| Justin Odisho | 5 Levels of Video Editing Transitions in 5 Minutes! | — |
| Justin Odisho | How to Make Viral Glitch Transitions in Adobe Premiere Pro with Adobe Stock | Glitch Transition |
| Justin Odisho | Pro-Tips: Mastering Keyframes in Premiere Pro | Easing & the Graph Editor |
| Jake In Motion | Crumbling Particle Effect Tutorial! 100% After Effects! | Particle Systems |
| Jake In Motion | Texture Looper — animate textures in After Effects | Animated Texture |
| Ben Marriott | Adobe Live Episode 41: Custom Textures In After Effects | Animated Texture |
| Ben Marriott | Animate Frame by Frame with Ben Marriott | Frame-by-Frame Animation |
| Daniel Schiffer | I created a new transition, here's how to do it… | — |
| Daniel Schiffer | EPIC HANDHELD B ROLL TRANSITIONS | In-Camera Movement Transition |
| Daniel Schiffer | How I Plan Shots & Transitions | — |
| Daniel Schiffer | My Secret for Dark & Moody Product Videos | Low-Key Lighting |
| Film Editing Pro | How Professional Hollywood Editors Cut a Movie Trailer | — |
| Jordan Orme | Pro Editor Reacts to Transitions in (G)I-DLE 'TOMBOY' | — |
| Hillier-Smith | The One Step You're Neglecting In Your Edits | — (search links it to sound design) |
| Video Copilot | New Tutorial: Shockwaves in After Effects (videocopilot.net) | Displacement Map |

Exact URLs are in `src/db/seed/research.ts` and on each breakdown page.

## First batch of techniques

78 reference entries across 10 categories, with 92 variations. They describe what each technique is and how it is commonly built in After Effects, Premiere Pro, DaVinci Resolve and others. They are domain knowledge, not observations of the seed videos, so they carry the **Reference** badge. Real examples attach to them only when you verify a technique in a video.

Deliberate deduplication: *motion-matched cut* is a variation and alias of **Match Cut**; *bass drop* is an alias of **Impact / Cinematic Hit**; *RGB separation* is an alias of **Chromatic Aberration**; *3D text integration* is an alias of **3D Object Integration**.
