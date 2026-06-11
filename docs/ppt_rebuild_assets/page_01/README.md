# PPT Page 01 Rebuild Assets

Canvas: 1672 x 941 px, origin at top-left.

Files:

- `reference.png`: full-page bitmap reference.
- `manifest.json`: complete layer list, with SVG and text assets in original relative position.
- `text_spec.json`: editable text content, font, size, color, position, alignment, and layer.
- `text_spec.md`: readable text table.
- `vectors/`: one SVG file per graphic shape, color block, line, or arrow.
- `page_01_shapes_only.svg`: composition preview using only vector graphics, no text.
- `page_01_rebuild_preview.svg`: composition preview with live SVG text.

Notes:

- Text is not rasterized. Rebuild from `text_spec.json` or copy text from `text_spec.md`.
- Each vector element is kept as an independent SVG asset and referenced separately in `manifest.json`.
- No transparent PNG assets were needed because the page contains no complex photo or texture background.
- Coordinates were traced from the supplied bitmap reference and may require small manual adjustment in PowerPoint.
