export const runtime = "nodejs";
export const maxDuration = 120;

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/edits";

// Customize the model here. GPT Image models return base64 image data by default.
const OPENAI_IMAGE_MODEL = "gpt-image-1.5";

// Edit this prompt to change how drawings are transformed by AI.
const IMAGE_OPTIMIZATION_PROMPT =
  "Transform the user's drawing into a realistic real-life image of the represented element. Preserve the original element, composition, orientation, and perspective from the drawing. Make it look as realistic as possible, like a high-quality photograph or lifelike object captured in the real world. Do not change the core idea of the drawing. Do not turn it into a cartoon or illustration. Keep the same point of view and recognizable shape while adding realistic materials, lighting, depth, texture, and detail.";

type OptimizeDrawingRequest = {
  image?: string;
};

type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
};

export function GET() {
  return Response.json(
    {
      error:
        "This endpoint is available. Send a POST request with a canvas image data URL to optimize a drawing.",
    },
    { status: 405 },
  );
}

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u,
  );

  if (!match) {
    return null;
  }

  return {
    base64: match[2],
    mimeType: match[1],
  };
}

export async function POST(request: Request) {
  let body: OptimizeDrawingRequest;
  try {
    body = (await request.json()) as OptimizeDrawingRequest;
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.image || typeof body.image !== "string") {
    return Response.json(
      { error: "A canvas image data URL is required." },
      { status: 400 },
    );
  }

  const parsedImage = parseImageDataUrl(body.image);
  if (!parsedImage) {
    return Response.json(
      { error: "Image must be a PNG, JPEG, or WebP base64 data URL." },
      { status: 400 },
    );
  }

  const imageBuffer = Buffer.from(parsedImage.base64, "base64");
  if (!imageBuffer.length) {
    return Response.json({ error: "The provided image is empty." }, { status: 400 });
  }

  if (imageBuffer.byteLength > 50 * 1024 * 1024) {
    return Response.json(
      { error: "Image must be smaller than 50MB." },
      { status: 413 },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const imageBytes = Uint8Array.from(imageBuffer);
  const imageBlob = new Blob([imageBytes], { type: parsedImage.mimeType });
  const fileExtension =
    parsedImage.mimeType === "image/jpeg"
      ? "jpg"
      : parsedImage.mimeType.replace("image/", "");

  const formData = new FormData();
  formData.append("model", OPENAI_IMAGE_MODEL);
  formData.append("prompt", IMAGE_OPTIMIZATION_PROMPT);
  formData.append("image", imageBlob, `drawing.${fileExtension}`);
  formData.append("input_fidelity", "high");
  formData.append("n", "1");
  formData.append("size", "auto");
  formData.append("quality", "high");
  formData.append("output_format", "png");

  const openAiResponse = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  const responseText = await openAiResponse.text();
  let responseJson: OpenAIImageResponse | null = null;

  try {
    responseJson = JSON.parse(responseText) as OpenAIImageResponse;
  } catch {
    responseJson = null;
  }

  if (!openAiResponse.ok) {
    return Response.json(
      {
        error:
          responseJson?.error?.message
            ? `OpenAI image request failed with upstream status ${openAiResponse.status}: ${responseJson.error.message}`
            : `OpenAI image request failed with upstream status ${openAiResponse.status}.`,
        upstreamStatus: openAiResponse.status,
      },
      { status: 502 },
    );
  }

  const generatedImage = responseJson?.data?.[0];
  const imageUrl = generatedImage?.b64_json
    ? `data:image/png;base64,${generatedImage.b64_json}`
    : generatedImage?.url;

  if (!imageUrl) {
    return Response.json(
      { error: "OpenAI did not return an image." },
      { status: 502 },
    );
  }

  return Response.json({ imageUrl });
}
