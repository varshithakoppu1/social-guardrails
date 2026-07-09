// lib/validation.ts
//
// Validates incoming requests BEFORE they ever reach the NVIDIA API.
// Rejecting bad input early saves API calls, money, and latency.

const MAX_CAPTION_LENGTH = 2000;
const MAX_IMAGE_BASE64_BYTES = 4 * 1024 * 1024; // ~4MB base64 (~3MB decoded)
const ALLOWED_IMAGE_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
];

export interface CheckSafetyRequestBody {
  caption?: string;
  imageBase64?: string;
}

export type ValidationResult =
  | { valid: true; data: { caption: string; imageBase64?: string } }
  | { valid: false; error: string };

export function validateCheckSafetyRequest(
  body: unknown
): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { caption, imageBase64 } = body as CheckSafetyRequestBody;

  if (!caption && !imageBase64) {
    return { valid: false, error: "Provide at least a caption or an image" };
  }

  if (caption !== undefined) {
    if (typeof caption !== "string") {
      return { valid: false, error: "caption must be a string" };
    }
    if (caption.length > MAX_CAPTION_LENGTH) {
      return {
        valid: false,
        error: `caption exceeds max length of ${MAX_CAPTION_LENGTH} characters`,
      };
    }
  }

  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== "string") {
      return { valid: false, error: "imageBase64 must be a string" };
    }

    const hasValidPrefix = ALLOWED_IMAGE_PREFIXES.some((prefix) =>
      imageBase64.startsWith(prefix)
    );
    if (!hasValidPrefix) {
      return {
        valid: false,
        error: "imageBase64 must be a data URL of type jpeg, png, or webp",
      };
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_BYTES) {
      return {
        valid: false,
        error: "Image is too large (max ~3MB decoded)",
      };
    }
  }

  return {
    valid: true,
    data: {
      caption: caption ?? "",
      imageBase64,
    },
  };
}
