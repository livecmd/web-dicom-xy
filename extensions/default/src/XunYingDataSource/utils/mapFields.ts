const MODALITY_SOP_CLASS_MAP: Record<string, string> = {
  CT: '1.2.840.10008.5.1.4.1.1.2',
  MR: '1.2.840.10008.5.1.4.1.1.4',
  CR: '1.2.840.10008.5.1.4.1.1.1',
  DX: '1.2.840.10008.5.1.4.1.1.1.1',
  MG: '1.2.840.10008.5.1.4.1.1.1.2',
  XA: '1.2.840.10008.5.1.4.1.1.12.1',
  US: '1.2.840.10008.5.1.4.1.1.6.1',
  NM: '1.2.840.10008.5.1.4.1.1.20',
  PT: '1.2.840.10008.5.1.4.1.1.128',
  SC: '1.2.840.10008.5.1.4.1.1.7',
};

const DEFAULT_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.7';

export function normalizeModality(modality: string): string {
  if (!modality) {
    return '';
  }

  const modalities = modality
    .split(/[\\,/]/)
    .map(item => item.trim().toUpperCase())
    .filter(Boolean);

  return modalities.find(item => MODALITY_SOP_CLASS_MAP[item]) || modality.toUpperCase();
}

export function getSopClassUID(modality: string): string {
  const normalizedModality = normalizeModality(modality);
  if (!normalizedModality) {
    return DEFAULT_SOP_CLASS_UID;
  }
  return MODALITY_SOP_CLASS_MAP[normalizedModality] || DEFAULT_SOP_CLASS_UID;
}

function parseBackslashSeparated(value: string | undefined | null): number[] | undefined {
  if (!value || value === '') {
    return undefined;
  }
  return value.split('\\').map(Number);
}

function parseNumber(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const n = parseFloat(String(value).split('\\')[0]);
  return Number.isFinite(n) ? n : undefined;
}

function getImageOrientationPatient(imageData: XunYingImageData): number[] | undefined {
  return parseBackslashSeparated(imageData.imageorientation) || [1, 0, 0, 0, 1, 0];
}

function getImagePositionPatient(imageData: XunYingImageData): number[] | undefined {
  const imagePositionPatient = parseBackslashSeparated(imageData.imgpos);
  if (imagePositionPatient?.length === 3) {
    return imagePositionPatient;
  }

  const sliceLocation = parseNumber(imageData.sliceloction);
  if (sliceLocation !== undefined) {
    return [0, 0, sliceLocation];
  }

  return undefined;
}

function parseDateToDA(dateStr: string | undefined | null): string | undefined {
  if (!dateStr) {
    return undefined;
  }
  return dateStr.replace(/-/g, '').substring(0, 8);
}

function parseTimeToTM(dateStr: string | undefined | null): string | undefined {
  if (!dateStr) {
    return undefined;
  }
  const parts = dateStr.split(' ');
  if (parts.length > 1) {
    return parts[1].replace(/:/g, '');
  }
  return undefined;
}

export interface XunYingImageData {
  imageuid: string;
  rows: number;
  columns: number;
  numberofframes: number;
  imageno: number;
  seriesno: string;
  pixelspacing: string;
  sliceloction: string;
  pat_name: string;
  patid: string;
  age: string;
  sex: string;
  model_name: string;
  manufacturer: string;
  institution_name: string;
  series_date: string;
  series_desc: string;
  series_no: string;
  slice_thick: string;
  studyid: string;
  study_desc: string;
  imgpos?: string;
  imageorientation?: string;
  rescaleslope?: string | number;
  rescaleintercept?: string | number;
  winwidth?: string | number;
  wincenter?: string | number;
  image_type?: string;
}

export interface XunYingStudyData {
  name: string;
  studytime: string;
  modalities: string;
  sex: string;
  series: string[];
}

export function mapInstanceToNaturalized(
  imageData: XunYingImageData,
  studyUID: string,
  seriesUID: string,
  modality: string,
  studyData: XunYingStudyData,
  imageIndex: number
) {
  const pixelSpacing = parseBackslashSeparated(imageData.pixelspacing);
  const imageOrientationPatient = getImageOrientationPatient(imageData);
  const imagePositionPatient = getImagePositionPatient(imageData);
  const normalizedModality = normalizeModality(modality);
  const sopClassUID = getSopClassUID(normalizedModality);
  const is16Bit = ['CT', 'MR', 'PT', 'NM'].includes(normalizedModality);

  return {
    StudyInstanceUID: studyUID,
    SeriesInstanceUID: seriesUID,
    SOPInstanceUID: imageData.imageuid,
    SOPClassUID: sopClassUID,
    Modality: normalizedModality || modality,
    Rows: imageData.rows,
    Columns: imageData.columns,
    NumberOfFrames: imageData.numberofframes || 1,
    InstanceNumber: imageData.imageno || imageIndex + 1,
    SeriesNumber: parseInt(imageData.series_no || imageData.seriesno) || 1,
    SeriesDescription: imageData.series_desc || '',
    ImageType: imageData.image_type,
    StudyDescription: imageData.study_desc || studyData?.name || '',
    StudyDate: parseDateToDA(imageData.series_date || studyData?.studytime),
    StudyTime: parseTimeToTM(studyData?.studytime),
    SeriesDate: parseDateToDA(imageData.series_date),
    PatientName: imageData.pat_name || studyData?.name || '',
    PatientID: imageData.patid || '',
    PatientSex: imageData.sex || studyData?.sex || '',
    PatientAge: imageData.age || '',
    Manufacturer: imageData.manufacturer || '',
    ManufacturerModelName: imageData.model_name || '',
    InstitutionName: imageData.institution_name || '',
    StudyID: imageData.studyid || '',
    SliceThickness: imageData.slice_thick ? parseFloat(imageData.slice_thick) : undefined,
    SliceLocation: imageData.sliceloction ? parseFloat(imageData.sliceloction) : undefined,
    PixelSpacing: pixelSpacing,
    ImageOrientationPatient: imageOrientationPatient,
    ImagePositionPatient: imagePositionPatient,
    BitsAllocated: is16Bit ? 16 : 8,
    BitsStored: is16Bit ? 16 : 8,
    HighBit: is16Bit ? 15 : 7,
    PixelRepresentation: is16Bit ? 1 : 0,
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    RescaleSlope: parseNumber(imageData.rescaleslope) ?? 1,
    RescaleIntercept: parseNumber(imageData.rescaleintercept) ?? 0,
    WindowWidth: parseNumber(imageData.winwidth),
    WindowCenter: parseNumber(imageData.wincenter),
    FrameOfReferenceUID: studyUID,
  };
}
