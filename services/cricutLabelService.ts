import JsBarcode from 'jsbarcode';
import { Book } from '../types';

export const CRICUT_LABELS_PER_PAGE = 12;

const fitText = (context: CanvasRenderingContext2D, value: string, maxWidth: number) => {
  const text = value.trim() || 'Untitled Book';
  if (context.measureText(text).width <= maxWidth) return text;
  let shortened = text;
  while (shortened.length > 1 && context.measureText(`${shortened}…`).width > maxWidth) shortened = shortened.slice(0, -1);
  return `${shortened}…`;
};

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the Cricut image.')), 'image/png');
});

export const downloadCricutLabelPage = async (books: Book[], pageNumber: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1800;
  canvas.height = 2700;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot create a Cricut image.');

  const labelWidth = 750;
  const labelHeight = 375;
  const columnGap = 75;
  const rowGap = 60;
  const left = (canvas.width - (labelWidth * 2 + columnGap)) / 2;
  const top = (canvas.height - (labelHeight * 6 + rowGap * 5)) / 2;

  books.slice(0, CRICUT_LABELS_PER_PAGE).forEach((book, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + column * (labelWidth + columnGap);
    const y = top + row * (labelHeight + rowGap);

    context.fillStyle = '#ffffff';
    context.fillRect(x, y, labelWidth, labelHeight);
    context.strokeStyle = '#000000';
    context.lineWidth = 5;
    context.strokeRect(x + 2.5, y + 2.5, labelWidth - 5, labelHeight - 5);

    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '900 24px Arial, sans-serif';
    context.fillText("MARIAH'S LIBRARY", x + labelWidth / 2, y + 34);
    context.font = '700 31px Arial, sans-serif';
    context.fillText(fitText(context, book.title, labelWidth - 44), x + labelWidth / 2, y + 78);

    const barcodeCanvas = document.createElement('canvas');
    try {
      JsBarcode(barcodeCanvas, book.barcode || book.bookId, {
        format: 'code128', width: 3, height: 105, displayValue: false, margin: 0,
        background: '#ffffff', lineColor: '#000000',
      });
      const maxBarcodeWidth = labelWidth - 80;
      const scale = Math.min(1, maxBarcodeWidth / barcodeCanvas.width);
      const renderedWidth = barcodeCanvas.width * scale;
      const renderedHeight = barcodeCanvas.height * scale;
      context.drawImage(barcodeCanvas, x + (labelWidth - renderedWidth) / 2, y + 112, renderedWidth, renderedHeight);
    } catch {
      // The printed Book ID remains available if a malformed barcode cannot render.
    }

    context.font = '800 25px ui-monospace, SFMono-Regular, Menlo, monospace';
    context.fillText(book.bookId, x + labelWidth / 2, y + 322);
  });

  const blob = await canvasToBlob(canvas);
  const filename = `mariahs-library-cricut-labels-page-${pageNumber}.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `Mariah's Library Cricut Labels – Page ${pageNumber}` });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
