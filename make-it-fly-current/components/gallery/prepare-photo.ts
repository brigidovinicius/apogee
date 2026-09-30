const MAX_PREPARED_BYTES = 2_500_000;
const MAX_SOURCE_PIXELS = 120_000_000;

function isHeicPhoto(file: File): boolean {
  return /^(image\/heic|image\/heif|image\/heic-sequence|image\/heif-sequence)$/i.test(file.type)
    || /\.hei[cf]$/i.test(file.name);
}

export async function preparePhoto(file: File): Promise<Blob> {
  let url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      if (!isHeicPhoto(file)) {
        throw new Error("Este navegador não conseguiu abrir a foto. Tente exportá-la como JPEG ou PNG.");
      }
      try {
        const { heicTo } = await import("heic-to/csp");
        const converted = await heicTo({ blob: file, type: "image/jpeg", quality: 0.85 });
        URL.revokeObjectURL(url);
        url = URL.createObjectURL(converted);
        image.src = url;
        await image.decode();
      } catch {
        throw new Error("Não foi possível abrir esta foto HEIC. Tente compartilhá-la como JPEG.");
      }
    }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS) {
      throw new Error("Esta foto tem resolução acima do limite de 120 megapixels ou está inválida.");
    }

    for (const dimension of [2400, 1800, 1400, 1100, 850, 640]) {
      const scale = Math.min(1, dimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Este navegador não conseguiu preparar a foto.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const format of ["image/webp", "image/jpeg"] as const) {
        for (const quality of [0.82, 0.68, 0.52, 0.38]) {
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality));
          if (blob?.type !== format) break;
          if (blob.size >= 100 && blob.size <= MAX_PREPARED_BYTES) return blob;
        }
      }
    }
    throw new Error("Não foi possível preparar esta foto para envio. Tente uma imagem menor.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
