import { imageLoader } from '@cornerstonejs/core';
import { fetchPixelData, XunYingHttpConfig } from './utils/httpClient';

export const XUNYING_SCHEME = 'xunying';

let loaderConfig: XunYingHttpConfig | null = null;

export function setXunYingLoaderConfig(config: XunYingHttpConfig): void {
  loaderConfig = config;
}

interface ParsedImageId {
  studyUID: string;
  seriesUID: string;
  sopInstanceUID: string;
  frameNumber?: number;
}

export function parseXunYingImageId(imageId: string): ParsedImageId {
  const colon = imageId.indexOf(':');
  const uri = colon >= 0 ? imageId.substring(colon + 1) : imageId;
  const parts = uri.split('/');
  if (parts.length < 3) {
    throw new Error(`非法 xunying imageId: ${imageId}`);
  }
  const [studyUID, seriesUID, sopInstanceUID] = parts;
  let frameNumber: number | undefined;
  const framesIndex = parts.indexOf('frames');
  if (framesIndex > 0 && parts[framesIndex + 1]) {
    frameNumber = parseInt(parts[framesIndex + 1], 10);
  }
  return { studyUID, seriesUID, sopInstanceUID, frameNumber };
}

export function buildXunYingImageId(
  studyUID: string,
  seriesUID: string,
  sopInstanceUID: string,
  frameNumber?: number
): string {
  const base = `${XUNYING_SCHEME}:${studyUID}/${seriesUID}/${sopInstanceUID}`;
  return frameNumber !== undefined ? `${base}/frames/${frameNumber}` : base;
}

function buildPixelArray(arrayBuffer: ArrayBuffer, bitType: 1 | 2 | 3) {
  if (bitType === 2) {
    return new Int16Array(arrayBuffer);
  }
  return new Uint8Array(arrayBuffer);
}

function calcMinMax(pixelData: Int16Array | Uint8Array): { min: number; max: number } {
  let min = pixelData[0];
  let max = pixelData[0];
  for (let i = 1; i < pixelData.length; i++) {
    const v = pixelData[i];
    if (v < min) {
      min = v;
    }
    if (v > max) {
      max = v;
    }
  }
  return { min, max };
}

function xunyingImageLoader(imageId: string) {
  if (!loaderConfig) {
    return {
      promise: Promise.reject(
        new Error('XunYing image loader 未初始化，请先调用 setXunYingLoaderConfig')
      ),
      cancelFn: undefined,
      decache: undefined,
    };
  }

  const { studyUID, seriesUID, sopInstanceUID, frameNumber } = parseXunYingImageId(imageId);

  const promise = fetchPixelData(
    loaderConfig,
    studyUID,
    seriesUID,
    sopInstanceUID,
    frameNumber
  ).then(pixel => {
    const pixelData = buildPixelArray(pixel.arrayBuffer, pixel.bitType);
    const { min, max } = calcMinMax(pixelData);

    const isColor = pixel.bitType === 3;
    const is16Bit = pixel.bitType === 2;

    const windowCenter =
      pixel.defaultCenter ?? parseFloat(pixel.imageInfo?.wincenter?.split('\\')[0] || '') ?? 0;
    const windowWidth =
      pixel.defaultWindow ?? parseFloat(pixel.imageInfo?.winwidth?.split('\\')[0] || '') ?? 400;

    const image: any = {
      imageId,
      minPixelValue: min,
      maxPixelValue: max,
      slope: 1,
      intercept: 0,
      windowCenter: Number.isFinite(windowCenter) ? windowCenter : 0,
      windowWidth: Number.isFinite(windowWidth) ? windowWidth : 400,
      getPixelData: () => pixelData,
      rows: pixel.height,
      columns: pixel.width,
      height: pixel.height,
      width: pixel.width,
      color: isColor,
      rgba: false,
      numberOfComponents: isColor ? 3 : 1,
      columnPixelSpacing: parseFloat(pixel.imageInfo?.pixelspacing?.split('\\')[1] || '1') || 1,
      rowPixelSpacing: parseFloat(pixel.imageInfo?.pixelspacing?.split('\\')[0] || '1') || 1,
      invert: pixel.inverse,
      sizeInBytes: pixel.arrayBuffer.byteLength,
      photometricInterpretation: isColor ? 'RGB' : 'MONOCHROME2',
      bitsAllocated: is16Bit ? 16 : 8,
      bitsStored: is16Bit ? 16 : 8,
      highBit: is16Bit ? 15 : 7,
      pixelRepresentation: is16Bit ? 1 : 0,
      samplesPerPixel: isColor ? 3 : 1,
      FrameOfReferenceUID: `${seriesUID}.0`,
    };

    return image;
  });

  return {
    promise,
    cancelFn: undefined,
    decache: undefined,
  };
}

let registered = false;

export function registerXunYingImageLoader(): void {
  if (registered) {
    return;
  }
  imageLoader.registerImageLoader(XUNYING_SCHEME, xunyingImageLoader as any);
  registered = true;
}
