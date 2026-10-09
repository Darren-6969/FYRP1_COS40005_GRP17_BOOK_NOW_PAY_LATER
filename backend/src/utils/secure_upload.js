import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const IMAGE_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function badUpload(message) {
  const error = new Error(message);

  error.statusCode = 400;

  return error;
}

export async function processSecureImage(
  buffer
) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw badUpload(
      "Uploaded image is empty or invalid."
    );
  }

  const detected =
    await fileTypeFromBuffer(buffer);

  if (
    !detected ||
    !ALLOWED_IMAGE_TYPES.has(
      detected.mime
    )
  ) {
    throw badUpload(
      "The real file type must be JPEG, PNG, or WebP."
    );
  }

  try {
    const image = sharp(buffer, {
      failOn: "error",
    })
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      });

    let outputBuffer;

    if (
      detected.mime ===
      "image/jpeg"
    ) {
      outputBuffer =
        await image
          .jpeg({
            quality: 85,
            mozjpeg: true,
          })
          .toBuffer();
    } else if (
      detected.mime ===
      "image/png"
    ) {
      outputBuffer =
        await image
          .png({
            compressionLevel: 9,
          })
          .toBuffer();
    } else {
      outputBuffer =
        await image
          .webp({
            quality: 85,
          })
          .toBuffer();
    }

    return {
      buffer: outputBuffer,
      mime: detected.mime,
      extension:
        IMAGE_EXTENSIONS[
          detected.mime
        ],
    };
  } catch {
    throw badUpload(
      "The uploaded image could not be processed."
    );
  }
}

export async function validateSecureDocument(
  buffer,
  {
    allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ],
    maxBytes = 5 * 1024 * 1024,
  } = {}
) {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw badUpload(
      "Uploaded document is empty or invalid."
    );
  }

  // Check actual file size again at the
  // security-validation layer.
  if (buffer.length > maxBytes) {
    throw badUpload(
      `Document exceeds the maximum allowed size of ${Math.round(
        maxBytes / 1024 / 1024
      )} MB.`
    );
  }

  // Detect the REAL file type from its
  // binary signature, not file.mimetype.
  const detected =
    await fileTypeFromBuffer(buffer);

  if (
    !detected ||
    !allowedTypes.includes(
      detected.mime
    )
  ) {
    throw badUpload(
      "The real document type is not allowed."
    );
  }

  return {
    // IMPORTANT:
    // Keep the original bytes unchanged.
    buffer,
    mime: detected.mime,
    extension: detected.ext,
    size: buffer.length,
  };
}