# How an SVG becomes Lottie

Notes on the conversion, both as a record of why the code does what it does and
as a reference for anyone doing this elsewhere. The Lottie format is documented
at [docs.lottiefiles.com](https://docs.lottiefiles.com/en/format/lottie-json/specification);
this covers the parts that are easy to get subtly wrong.

## Paths are cubic beziers, and only cubic beziers

Lottie has no arc primitive, no quadratic, and no line command. Every path is a
list of vertices with two tangent handles each. So the conversion has to happen
during parsing, not at export:

```
SVG:     M20 6 9 17 l-5 -5          arcs, quadratics, relative commands, Z
Lottie:  { i: [...], o: [...], v: [...], c: true }
```

`v` holds the vertices. `i` and `o` hold the incoming and outgoing tangent
handles, **relative to their own vertex** rather than in absolute coordinates —
this is the single most common mistake, and it produces shapes that look
plausible near the origin and increasingly wrong away from it.

For a cubic segment running from vertex A to vertex B, the first control point
is A's _outgoing_ handle and the second is B's _incoming_ handle:

```
segment:   A ---c1        c2--- B
becomes:   o[A] = c1 - A
           i[B] = c2 - B
```

### Closed paths

When `c: true`, the segment from the last vertex back to the first is implicit.
The duplicated final vertex must be dropped, and its handles moved: the closing
segment's first control point becomes the last vertex's `o`, and its second
becomes the first vertex's `i`.

There is a trap here. Converting `d` to cubics with a general-purpose library
turns `Z` into an explicit curve. If the path already ended at its start point
before the `Z`, that curve has zero length — leaving it in duplicates a vertex
and contributes `[0, 0]` tangents. Circles built by most shape-to-path
converters hit this every time.

### Circles deserve special treatment

The usual arc-to-cubic conversion splits at 120°, which leaves a radial error
around 0.15% of the radius. Building an ellipse directly from four 90° segments
with the constant `4/3 × (√2 − 1) ≈ 0.5523` drops that to about 0.005%. Circles
and ellipses are the most common curved primitive in icon artwork, so this is
worth the special case.

## Transforms have to pivot on the shape

A Lottie layer transform rotates and scales about its **anchor point**, and the
anchor defaults to the composition origin. Left alone, "rotate this icon" spins
it around the top-left corner of the canvas.

The fix is a pair:

1. Put the anchor `a` at the shape's own bounding-box centre.
2. Re-express the path vertices relative to that centre.
3. Put the position `p` at the same centre, which returns the shape to where it
   belongs on the canvas.

The bounding box has to be the real one. Taking the extremes of the control
points overestimates it on curves, which pushes the pivot off-centre; solving
for the curve's actual extrema is what makes a rotating circle look like it is
spinning rather than orbiting.

## Stroke draw is Trim Paths, not a dash trick

CSS draws a stroke on by animating `stroke-dashoffset` against a dash as long
as the outline. Lottie has a first-class equivalent: the `tm` modifier, with
`s` and `e` as the start and end of the visible span in percent.

Order inside the group matters. The trim has to come _after_ the stroke it
modifies:

```
{ ty: 'gr', it: [ path(sh), stroke(st), trim(tm), transform(tr) ] }
```

Put it before, and players apply it to nothing — with no error.

The `m` field chooses between trimming all subpaths as one continuous outline
(`1`) or each independently (`2`). Continuous is what makes a multi-part icon
draw as a single pen stroke.

## Easing is split across two keyframes

CSS writes one curve per segment: `cubic-bezier(x1, y1, x2, y2)`. Lottie stores
the same curve distributed across the two keyframes it spans — the outgoing
handle `o` on the earlier one, the incoming handle `i` on the later one. Taking
both from the same source curve is what keeps CSS and Lottie output visually
identical.

Two constraints:

- Handle coordinates are clamped to 0..1. Easings that overshoot, like
  `easeOutBack` with `y1 = 1.56`, lose their overshoot in Lottie. Clamping
  deliberately beats emitting a file players reject.
- Handles sitting exactly on 0 or 1 are treated by some players as a degenerate
  curve and silently fall back to linear, so the x components are nudged inside
  the bounds.

## Looping is the player's job

Lottie JSON has no loop field. A player is told whether to loop. That shapes
how repetition is exported:

| Case           | Approach                                |
| -------------- | --------------------------------------- |
| Play once      | Keyframes once                          |
| Loop _n_ times | Bake _n_ repetitions into the timeline  |
| Loop forever   | Bake one cycle, tell the player to loop |
| Ping-pong      | Bake the return leg into the cycle      |

Ping-pong is the interesting one. Lottie has no alternating playback mode, so
"forever, back and forth" only works if one baked cycle already contains the
journey out and back — then ordinary looping produces the effect. Keyframes
landing on the seam are deduplicated, since two keyframes at the same frame
leave players to choose between them arbitrarily.

## Layer order is reversed

SVG paints in document order: the last element is on top. Lottie paints its
first layer on top. Emitting layers in source order silently inverts the
stacking of every overlapping icon.

## What has no equivalent

Gradients, patterns, masks, `clipPath`, filters, text, images, `use`, and blend
modes. Some of these have Lottie representations that are out of scope here;
others have none. Either way they are reported as warnings rather than dropped,
because an export tool that quietly discards half a drawing is worse than one
that refuses.

Hover and scroll animations are a different category: Lottie has no model for
input events at all, so they are not a gap to be filled later.
