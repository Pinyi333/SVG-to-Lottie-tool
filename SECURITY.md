# Security Policy

## Supported versions

The latest published version of `svgmotion` receives security fixes.

## Reporting a vulnerability

Please report privately through
[GitHub's security advisory form](https://github.com/Pinyi333/SVG-to-Lottie-tool/security/advisories/new)
rather than opening a public issue. You should get an initial response within a
week.

## What this project treats as a vulnerability

The interesting surface is that **an SVG file is untrusted input that gets
rendered into a page**. Anything along these lines is in scope:

- Markup that survives `parseSvg` and can execute script, reach the network, or
  read the embedding page.
- A way for the generated CSS or markup to escape the preview iframe, or for
  class names derived from a source file's element ids to affect the
  surrounding application.
- Output that, when pasted into a consumer's page or component, introduces
  script execution there — for example an SVG element id that breaks out of the
  generated template literal in the React exporter.
- Input that makes parsing hang or exhaust memory, given that this all runs on
  the visitor's own machine.

Reports about the hosted demo page itself are welcome too.

## What this project does already

`parseSvg` removes `<script>`, `<foreignObject>` and equivalents, every `on*`
attribute, and any URL reference that is not a local fragment or an inline data
image. It works over the parsed DOM rather than over markup with a regular
expression, since regex sanitizers on SVG are routinely defeated by entity and
namespace tricks the parser has already resolved.

The in-app preview renders inside a `sandbox=""` iframe: no script, no network,
no access to the parent document.
