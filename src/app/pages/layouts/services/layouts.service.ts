import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import {
  SlotImage,
  LayoutResult,
  CropResult,
  LayoutFormat,
  LayoutPattern,
  SlotRect,
} from '../interfaces/layout.interface';
import {
  LAYOUT_PATTERNS,
  MAX_OUTPUT_SCALE,
  insetSlotRect,
} from '../constants/layouts.constants';

@Injectable({ providedIn: 'root' })
export class LayoutsService {
  private centerCrop(
    img: HTMLImageElement,
    targetW: number,
    targetH: number,
  ): [number, number, number, number] {
    const imgAr = img.width / img.height;
    const targetAr = targetW / targetH;

    let sx: number, sy: number, sw: number, sh: number;

    if (imgAr > targetAr) {
      sh = img.height;
      sw = sh * targetAr;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / targetAr;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    return [sx, sy, sw, sh];
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve(img);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      img.src = url;
    });
  }

  private computeScale(
    images: HTMLImageElement[],
    rects: SlotRect[],
    maxQuality: boolean,
  ): number {
    let minFmax = Infinity;

    images.forEach((img, i) => {
      const rect = rects[i];
      const [, , sw] = this.centerCrop(img, rect.w, rect.h);
      const fmax = sw / rect.w;
      minFmax = Math.min(minFmax, fmax);
    });

    if (maxQuality) {
      return Math.min(MAX_OUTPUT_SCALE, Math.max(1, Math.floor(minFmax)));
    }
    return 1;
  }

  async generateLayout(
    slotImages: SlotImage[],
    pattern: LayoutPattern,
    format: LayoutFormat,
    maxQuality: boolean,
    gap: number,
  ): Promise<LayoutResult> {
    const variant = LAYOUT_PATTERNS[pattern][format];
    const [canvasW, canvasH] = variant.canvas;
    const rects = variant.slots.map((s) => insetSlotRect(s, variant, gap));

    const images = await Promise.all(
      slotImages.map((s) => this.loadImage(s.file)),
    );
    const scale = this.computeScale(images, rects, maxQuality);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW * scale;
    canvas.height = canvasH * scale;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const crops: CropResult[] = [];

    for (let i = 0; i < variant.slots.length; i++) {
      const rect = rects[i];
      const img = images[i];

      const [sx, sy, sw, sh] = this.centerCrop(img, rect.w, rect.h);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.round(rect.w * scale);
      cropCanvas.height = Math.round(rect.h * scale);
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );

      const blob = await new Promise<Blob>((resolve) =>
        cropCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95),
      );
      const url = URL.createObjectURL(blob);
      crops.push({ name: variant.slots[i].name, blob, url });

      ctx.drawImage(
        cropCanvas,
        Math.round(rect.x * scale),
        Math.round(rect.y * scale),
        cropCanvas.width,
        cropCanvas.height,
      );
    }

    const canvasBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95),
    );
    const canvasUrl = URL.createObjectURL(canvasBlob);

    return { format, canvasBlob, canvasUrl, crops };
  }

  async generateAllLayouts(
    slotImages: SlotImage[],
    pattern: LayoutPattern,
    maxQuality: boolean,
    gap: number,
  ): Promise<LayoutResult[]> {
    const formats: LayoutFormat[] = ['4:3', '3:4'];
    return Promise.all(
      formats.map((f) =>
        this.generateLayout(slotImages, pattern, f, maxQuality, gap),
      ),
    );
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private async blobToBuffer(blob: Blob): Promise<Uint8Array> {
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  }

  async downloadBundle(
    results: LayoutResult[],
    pattern: string,
  ): Promise<void> {
    const zip = new JSZip();

    for (const result of results) {
      const formatKey = result.format.replace(':', '-');
      const folder = zip.folder(formatKey)!.folder(pattern)!;
      folder.file(
        `layout_${formatKey}.jpg`,
        await this.blobToBuffer(result.canvasBlob),
        { binary: true },
      );

      for (const crop of result.crops) {
        folder.file(`${crop.name}.jpg`, await this.blobToBuffer(crop.blob), {
          binary: true,
        });
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(content, `${pattern}_bundle.zip`);
  }
}
