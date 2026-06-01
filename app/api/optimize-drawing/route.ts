export const runtime = "nodejs";
export const maxDuration = 121;

const OPENAI_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/edits";

// Customize the model here. GPT Image models return base64 image data by default.
const OPENAI_IMAGE_MODEL = "gpt-image-1.5";

// Customize the image optimization instruction here.
const IMAGE_OPTIMIZATION_PROMPT =
  "Transform this creative drawing into a polished, imaginative, high-quality visual while preserving the original idea, playful composition, and expressive hand-drawn character.";

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
          responseJson?.error?.message ||
          `OpenAI image request failed with status ${openAiResponse.status}.`,
      },
      { status: openAiResponse.status },
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
