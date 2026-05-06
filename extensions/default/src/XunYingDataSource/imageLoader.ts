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
  rows?: number;
  columns?: number;
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
  const sizeIndex = parts.indexOf('size');
  const rows = sizeIndex > 0 && parts[sizeIndex + 1] ? parseInt(parts[sizeIndex + 1], 10) : undefined;
  const columns =
    sizeIndex > 0 && parts[sizeIndex + 2] ? parseInt(parts[sizeIndex + 2], 10) : undefined;

  return { studyUID, seriesUID, sopInstanceUID, frameNumber, rows, columns };
}

export function buildXunYingImageId(
  studyUID: string,
  seriesUID: string,
  sopInstanceUID: string,
  frameNumber?: number,
  rows?: number,
  columns?: number
): string {
  let imageId = `${XUNYING_SCHEME}:${studyUID}/${seriesUID}/${sopInstanceUID}`;
  if (frameNumber !== undefined) {
    imageId += `/frames/${frameNumber}`;
  }
  if (rows && columns) {
    imageId += `/size/${rows}/${columns}`;
  }
  return imageId;
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

function getFirstNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const first = String(value).split('\\')[0];
  const n = parseFloat(first);
  return Number.isFinite(n) ? n : undefined;
}

function getSpacing(value: unknown, index: number): number {
  if (!value) {
    return 1;
  }

  const spacing = String(value)
    .split('\\')
    .map(item => parseFloat(item));
  return Number.isFinite(spacing[index]) ? spacing[index] : 1;
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

  const { studyUID, seriesUID, sopInstanceUID, frameNumber, rows, columns } =
    parseXunYingImageId(imageId);

  const promise = fetchPixelData(
    loaderConfig,
    studyUID,
    seriesUID,
    sopInstanceUID,
    frameNumber,
    rows,
    columns
  ).then(pixel => {
    const pixelData = buildPixelArray(pixel.arrayBuffer, pixel.bitType);
    const { min, max } = calcMinMax(pixelData);

    const isColor = pixel.bitType === 3;
    const is16Bit = pixel.bitType === 2;
    const imageInfo = pixel.imageInfo || {};

    const windowCenter =
      getFirstNumber(imageInfo.wincenter) ??
      getFirstNumber(imageInfo.WinCenter) ??
      pixel.defaultCenter ??
      0;
    const windowWidth =
      getFirstNumber(imageInfo.winwidth) ??
      getFirstNumber(imageInfo.WinWidth) ??
      pixel.defaultWindow ??
      400;
    const slope = getFirstNumber(imageInfo.rescaleslope) ?? 1;
    const intercept = getFirstNumber(imageInfo.rescaleintercept) ?? 0;

    const image: any = {
      imageId,
      minPixelValue: min,
      maxPixelValue: max,
      slope,
      intercept,
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
      columnPixelSpacing: getSpacing(imageInfo.pixelspacing, 1),
      rowPixelSpacing: getSpacing(imageInfo.pixelspacing, 0),
      invert: pixel.inverse,
      sizeInBytes: pixel.arrayBuffer.byteLength,
      photometricInterpretation: isColor ? 'RGB' : 'MONOCHROME2',
      bitsAllocated: is16Bit ? 16 : 8,
      bitsStored: is16Bit ? 16 : 8,
      highBit: is16Bit ? 15 : 7,
      pixelRepresentation: is16Bit ? 1 : 0,
      samplesPerPixel: isColor ? 3 : 1,
      FrameOfReferenceUID: `${seriesUID}.0`,
      imagePositionPatient: imageInfo.imgpos,
      imageOrientationPatient: imageInfo.imageorientation,
      sliceLocation: getFirstNumber(imageInfo.sliceloction),
      sliceThickness: getFirstNumber(imageInfo.slicethick),
      modality: imageInfo.modality,
      patientId: imageInfo.patientid,
      patientName: imageInfo.name,
      patientSex: imageInfo.sex,
      patientAge: imageInfo.age,
      studyDescription: imageInfo.studydesc,
      seriesDescription: imageInfo.seriesdesc,
      rescaleType: imageInfo.rescale_type,
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
