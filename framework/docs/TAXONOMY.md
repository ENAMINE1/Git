# Phase 2 taxonomy

Three dimensions are kept apart on purpose:

| Dimension | Question it answers | Stored as | Example |
|---|---|---|---|
| **Genre** | What kind of video is it? | `VideoReference.genreIds` | Technology advertisement |
| **Art direction** | How does it look and feel? | `VideoReference.artDirectionIds` + the direction's moodboard | Futuristic industrial |
| **Technique** | How is it built? | `TechniqueUsage` rows | Whip pan, speed ramp, 3D text integration |

## Genres (starter)
Technology advertisement · Product commercial · Brand film · Music video · Short film · Documentary · Social media reel · Tutorial / education · Game trailer · Movie trailer · Fashion film · Travel film · Vlog · Title sequence · Motion design piece · Fan edit

Niches (subject matter) are a separate, lighter list: Technology, Sports, Fashion, Food & drink, Travel, Automotive, Gaming, Anime & animation, Music, Beauty, Art & design, Video editing education.

## Art directions (starter, from the brief)
Cinematic documentary · Futuristic digital · Minimal editorial · Analog film · Dark industrial · High-energy commercial · Retro futuristic · Experimental motion design · 3D surrealism · Atmospheric storytelling

These are starting points, not a fixed taxonomy. Rules of thumb:
- Create a direction only for a recurring look you can describe in a few characteristics, never for a single video.
- Collect first in a **personal moodboard**. Use **Promote to art direction** once the look is clear.
- Each direction's palette is pinned from colours extracted from its own images, not invented.

## Technique categories
Transitions · Effects · Motion graphics · Animation · Camera movement · Cinematography · Typography · Sound design · Editing grammar · Color grading

(Categories are editable under *Library & backup → Taxonomy*.)

## Naming conventions
- **Technique names** use the common English name in Title Case, adding the category word only where the bare name is ambiguous ("Whip Pan Transition", but "Film Grain").
- **Aliases** hold every other name (swish pan, whip transition). Search and duplicate detection both use them.
- **Variations** are kinds of one technique (horizontal / vertical / digital whip pan). They are not separate techniques.
- **Merge** two entries rather than keeping near-duplicates. The merged name becomes an alias.
- **Video titles** for unwatched references use `@handle — reel <shortcode>`. Rename once you know what the video is.
- **Provenance**: *Verified* means seen in the source; *Inferred* means interpreted or suggested; *Reference* means general knowledge; *Yours* means entered by you without a claim either way.
