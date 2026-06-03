# AI Imagination Board

This Next.js App Router project contains a creative drawing playground. Users can sketch with expressive tools, place editable shapes on a paper board, export the board, and generate an enhanced AI version through a secure server-side route.

## Getting Started

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY=your_key_here
```

Then run the development server:

```bash
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Feature Map

- `app/page.tsx` renders the whiteboard.
- `app/components/WhiteboardLayout.tsx` owns tool state, editable elements, undo/redo history, keyboard shortcuts, and AI generation state.
- `app/components/WhiteboardCanvas.tsx` implements the large creativity canvas, calibrated pointer mapping, pan/zoom, grid modes, textured drawing tools, editable shapes, fill hit testing, export, and board replacement.
- `app/components/CreativeToolbar.tsx` provides the lightweight primary creative toolbar.
- `app/components/ShapeDropdown.tsx` groups all shape tools into one visual dropdown.
- `app/components/BottomCreativeControls.tsx` provides the bottom dock for brush, color, opacity, texture, paper guide, and shape styling.
- `app/components/FloatingActionButtons.tsx` provides compact generate/export/clear/zoom actions.
- `app/components/CreativeShape.tsx` renders movable, resizable, rotatable vector shapes.
- `app/components/AIResultModal.tsx` shows the original and AI result only after generation succeeds.
- `app/api/optimize-drawing/route.ts` keeps the OpenAI API key server-side and calls the image edit endpoint.

## OpenAI Customization

Edit these constants in `app/api/optimize-drawing/route.ts`:

```ts
const OPENAI_IMAGE_MODEL = "gpt-image-1.5";
const IMAGE_OPTIMIZATION_PROMPT =
  "Transform this creative drawing into a polished, imaginative, high-quality visual while preserving the original idea, playful composition, and expressive hand-drawn character.";
```

The canvas exports a PNG data URL in the browser by compositing the drawing layer, editable shapes, and paper background into an offscreen canvas. The API route validates that data URL, converts it to a binary Blob, sends it to OpenAI as multipart form data, and returns the generated image as a displayable data URL.

## Useful Commands

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```

This project intentionally uses `npm.cmd` for Windows shell compatibility.
