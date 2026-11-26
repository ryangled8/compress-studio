import sharp from "sharp";
import path from "path";

async function compressImage(input, settings, output) {
  const { keepOriginalDimensions, widthOverride, width, widthFactor, format, quality } = settings;

  // .rotate() turns photos upright using their EXIF orientation (phones often
  // store portrait shots sideways plus a "rotate" tag). Metadata, including that
  // tag, is stripped from the output, so without this they'd come out sideways.
  const pipeline = sharp(input).rotate();
  const meta     = await sharp(input).metadata();

  // Orientations 5–8 are 90° turns: the upright width is the stored height.
  const uprightWidth = (meta.orientation ?? 1) >= 5 ? meta.height : meta.width;

  if (widthFactor != null) {
    const targetWidth = Math.round(uprightWidth * widthFactor);
    pipeline.resize({ width: targetWidth });
  } else if (!keepOriginalDimensions && width) {
    pipeline.resize({
      width,
      withoutEnlargement: !widthOverride,
    });
  }

  // When format is null, detect from input extension so we always apply
  // best-compression settings rather than sharp's defaults.
  const resolvedFormat = format ?? path.extname(input).slice(1).toLowerCase().replace("jpg", "jpeg");

  switch (resolvedFormat) {
    case "jpeg": pipeline.jpeg({ quality, mozjpeg: true }); break;
    case "webp":  pipeline.webp({ quality }); break;
    case "avif":  pipeline.avif({ quality }); break;
    // Keep palette (8-bit) PNGs as palette PNGs; writing them as full colour
    // can make them much bigger than the original.
    default:      pipeline.png({ compressionLevel: 9, palette: Boolean(meta.isPalette) }); break;
  }

  await pipeline.toFile(output);
}

export { compressImage };
