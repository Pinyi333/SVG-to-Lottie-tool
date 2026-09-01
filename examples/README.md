# Examples

`generate.mjs` uses the `svgmotion` package the way a build script would: it
reads the SVGs in `icons/`, applies an effect, and writes every export format
to `generated/`.

It is also the only place the Node path gets exercised end to end. Node has no
global `DOMParser`, so this is what proves the `domParser` option works for
callers who are not in a browser.

```bash
pnpm build              # the script imports the built package
node examples/generate.mjs
```

Outputs land in `generated/`, which is not committed — run the script to see
them.
