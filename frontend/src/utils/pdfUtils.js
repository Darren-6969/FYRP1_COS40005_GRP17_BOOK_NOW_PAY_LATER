import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// A downloaded document should stay well under this. If the first attempt is
// larger, the page images are saved at a lower quality and size until it fits.
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

// The page is drawn at up to this width. A4 at this width is about 170 dpi,
// which reads clearly on screen and in print.
const MAX_CANVAS_WIDTH = 1400;
const MAX_SCALE = 2;

// Quality, then how much to shrink the page image on each attempt.
const ATTEMPTS = [
  { quality: 0.85, shrink: 1 },
  { quality: 0.7, shrink: 0.8 },
  { quality: 0.55, shrink: 0.65 },
  { quality: 0.45, shrink: 0.5 },
];

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// html2canvas can only draw an image from another address if that address
// allows it. Fetching each image first and drawing the copy keeps a logo from
// being dropped from the PDF. An image that cannot be fetched is left as it is.
async function fetchImageCopies(element) {
  const copies = new Map();
  const sources = [...new Set([...element.querySelectorAll("img")].map((img) => img.getAttribute("src")))];

  await Promise.all(
    sources.map(async (source) => {
      if (!source || source.startsWith("data:")) return;
      try {
        const response = await fetch(source, { mode: "cors", cache: "reload" });
        if (!response.ok) return;
        copies.set(source, await readAsDataUrl(await response.blob()));
      } catch {
        // The browser will try the original address.
      }
    })
  );

  return copies;
}

// One JPEG per page. A JPEG is stored as it is, where a PNG is unpacked to raw
// pixels inside the PDF, and one image per page avoids repeating the whole
// picture on every page.
function buildPdf(canvas, { quality, shrink }) {
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const sliceHeight = Math.floor((canvas.width * pageHeight) / pageWidth);
  const outWidth = Math.max(1, Math.round(canvas.width * shrink));
  const slice = document.createElement("canvas");

  for (let top = 0, page = 0; top < canvas.height; top += sliceHeight, page += 1) {
    const height = Math.min(sliceHeight, canvas.height - top);
    const outHeight = Math.max(1, Math.round(height * shrink));
    slice.width = outWidth;
    slice.height = outHeight;

    const context = slice.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outWidth, outHeight);
    context.drawImage(canvas, 0, top, canvas.width, height, 0, 0, outWidth, outHeight);

    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", quality), "JPEG", 0, 0, pageWidth, (height * pageWidth) / canvas.width, undefined, "FAST");
  }

  return pdf;
}

export async function downloadElementAsPdf(element, filename = "document.pdf") {
  if (!element) {
    alert("PDF document is not ready yet.");
    return;
  }

  const copies = await fetchImageCopies(element);
  const width = element.scrollWidth || element.offsetWidth || 760;

  const canvas = await html2canvas(element, {
    scale: Math.min(MAX_SCALE, MAX_CANVAS_WIDTH / width),
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll("img").forEach((img) => {
        const copy = copies.get(img.getAttribute("src"));
        if (copy) img.src = copy;
      });
    },
  });

  let pdf = null;
  for (const attempt of ATTEMPTS) {
    pdf = buildPdf(canvas, attempt);
    if (pdf.output("blob").size <= MAX_PDF_BYTES) break;
  }

  pdf.save(filename);
}
