import cloudinary from "../config/cloudinary.js";

const FOLDER = "fortune-poultry/salary-ledger";

/**
 * Uploads a document supplied as a base64 data URL (e.g. "data:image/jpeg;base64,...")
 * to Cloudinary and returns the bits worth persisting on our own record. Images and
 * PDFs both go through cleanly with resource_type "auto" (PDFs land as a "raw"/
 * "image" asset depending on account settings, but the returned secure_url always
 * works for viewing/downloading).
 *
 * Throws if Cloudinary isn't configured or the upload fails — callers should treat
 * that as a request failure rather than silently dropping the document.
 */
export async function uploadDocument(dataUrl, { name } = {}) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const err = new Error(
      "Document storage isn't configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
    );
    err.statusCode = 500;
    throw err;
  }

  const result = await cloudinary.uploader.upload(dataUrl, {
    folder: FOLDER,
    resource_type: "auto",
    // Keeps the original filename recognisable in the Cloudinary media library
    // without colliding — Cloudinary appends its own unique suffix.
    filename_override: name || undefined,
    use_filename: !!name,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
  };
}

/** Best-effort delete — failures are logged, not thrown, so a cleanup call never blocks the caller. */
export async function deleteDocument(publicId, resourceType = "image") {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error("Cloudinary delete failed for", publicId, err.message);
  }
}
