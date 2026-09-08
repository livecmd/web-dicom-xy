export type AINodule = {
  nodule_position?: unknown;
  nodule_position_voxel?: unknown;
  findings?: unknown;
  risk_level?: unknown;
  nodule_type?: unknown;
  seriesInstanceUID?: unknown;
  SeriesInstanceUID?: unknown;
  series_uid?: unknown;
  seriesUID?: unknown;
  seriesuid?: unknown;
  [key: string]: unknown;
};

export type AINoduleEntry = {
  id: string;
  nodule: AINodule;
};

export type NoduleImageSelection = {
  displaySet: any;
  image: any;
  imageIndex: number;
};

const RISK_COLORS: Record<string, string> = {
  低危: 'rgb(0, 220, 0)',
  中危: 'rgb(255, 165, 0)',
  高危: 'rgb(255, 0, 0)',
};

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  let current = value.trim();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parsed = JSON.parse(current);
      if (typeof parsed !== 'string') {
        return parsed;
      }
      current = parsed.trim();
      continue;
    } catch (_error) {
      const unescaped = current.replace(/\\(["\\])/g, '$1');
      if (unescaped === current) {
        return undefined;
      }
      current = unescaped;
    }
  }

  return undefined;
}

function isNodule(value: unknown): value is AINodule {
  return Boolean(
    value &&
      typeof value === 'object' &&
      ('nodule_position' in value || 'nodule_position_voxel' in value)
  );
}

function getSeriesUID(value: any): string | undefined {
  const seriesUID =
    value?.seriesInstanceUID ||
    value?.SeriesInstanceUID ||
    value?.series_uid ||
    value?.seriesUID ||
    value?.seriesuid;
  return seriesUID ? String(seriesUID) : undefined;
}

function attachSeriesUID(nodule: AINodule, seriesUID?: string): AINodule {
  if (!seriesUID || getSeriesUID(nodule)) {
    return nodule;
  }
  return { ...nodule, seriesInstanceUID: seriesUID };
}

function collectNoduleEntries(input: unknown, inheritedSeriesUID?: string): AINoduleEntry[] {
  const value: any = parseJsonValue(input);
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const parsedItem = parseJsonValue(item);
      if (isNodule(parsedItem)) {
        return [
          {
            id: `nodule_${index + 1}`,
            nodule: attachSeriesUID(parsedItem, inheritedSeriesUID),
          },
        ];
      }
      return collectNoduleEntries(parsedItem, inheritedSeriesUID);
    });
  }

  const seriesUID = getSeriesUID(value) || inheritedSeriesUID;
  if (isNodule(value)) {
    return [{ id: 'nodule_1', nodule: attachSeriesUID(value, seriesUID) }];
  }

  const entries = Object.entries(value).filter(([, nodule]) => isNodule(nodule));
  if (entries.length) {
    return entries.map(([id, nodule]) => ({
      id,
      nodule: attachSeriesUID(nodule as AINodule, seriesUID),
    }));
  }

  for (const key of ['airesults', 'aiResults', 'nodules', 'noduleList', 'data']) {
    if (value[key] !== undefined) {
      const nestedEntries = collectNoduleEntries(value[key], seriesUID);
      if (nestedEntries.length) {
        return nestedEntries;
      }
    }
  }

  return [];
}

/** Accepts direct AI results as well as /aiscreening response records. */
export function parseAINoduleResults(input: unknown): AINoduleEntry[] {
  return collectNoduleEntries(input);
}

function toFiniteNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(Number).filter(Number.isFinite);
}

/** Returns the one-based InstanceNumber embedded in findings, e.g. IM:48/227. */
export function getNoduleImageNumber(nodule: AINodule): number | undefined {
  const explicitImageNumber = Number(nodule.im ?? nodule.IM);
  if (Number.isFinite(explicitImageNumber) && explicitImageNumber > 0) {
    return explicitImageNumber;
  }
  const findings = String(nodule.findings || '');
  const match = findings.match(/\bIM\s*[:：]\s*(\d+)/i);
  if (!match) {
    return undefined;
  }
  const imageNumber = Number(match[1]);
  return Number.isFinite(imageNumber) ? imageNumber : undefined;
}

export function getNoduleSliceCenter(nodule: AINodule): number | undefined {
  const voxelPosition = toFiniteNumbers(nodule.nodule_position_voxel);
  if (voxelPosition.length < 6) {
    return undefined;
  }
  return (voxelPosition[2] + voxelPosition[5]) / 2;
}

export function getNoduleSeriesUID(nodule: AINodule): string | undefined {
  return getSeriesUID(nodule);
}

function getDisplaySetImages(displaySet: any): any[] {
  return displaySet?.instances || displaySet?.images || [];
}

function getNoduleImageReference(nodule: AINodule) {
  const findings = String(nodule.findings || '');
  const match = findings.match(/\bIM\s*[:：]\s*(\d+)\s*[/／]\s*(\d+)/i);
  if (!match) {
    return undefined;
  }
  return {
    imageNumber: Number(match[1]),
    imageCount: Number(match[2]),
  };
}

/** Finds the CT image that corresponds to the AI result's IM or voxel slice. */
export function selectNoduleImage(
  nodule: AINodule,
  displaySets: any[]
): NoduleImageSelection | null {
  const seriesUID = getNoduleSeriesUID(nodule);
  const candidates = (displaySets || [])
    .filter(displaySet => !displaySet?.Modality || displaySet.Modality === 'CT')
    .filter(displaySet => !seriesUID || displaySet.SeriesInstanceUID === seriesUID);
  const imageReference = getNoduleImageReference(nodule);
  const orderedCandidates = imageReference?.imageCount
    ? [...candidates].sort((left, right) => {
        const leftMatches = getDisplaySetImages(left).length === imageReference.imageCount;
        const rightMatches = getDisplaySetImages(right).length === imageReference.imageCount;
        return Number(rightMatches) - Number(leftMatches);
      })
    : candidates;

  const imageNumber = getNoduleImageNumber(nodule);
  if (imageNumber !== undefined) {
    for (const displaySet of orderedCandidates) {
      const images = getDisplaySetImages(displaySet);
      const imageIndex = images.findIndex(image => Number(image.InstanceNumber) === imageNumber);
      if (imageIndex !== -1) {
        return { displaySet, image: images[imageIndex], imageIndex };
      }
    }

    // With an explicit backend series reference, never place a detection on an
    // arbitrary fallback slice. An ordinal fallback is only valid when the
    // complete reported stack is present.
    if (seriesUID && imageReference) {
      for (const displaySet of orderedCandidates) {
        const images = getDisplaySetImages(displaySet);
        const imageIndex = imageNumber - 1;
        if (images.length === imageReference.imageCount && images[imageIndex]) {
          return { displaySet, image: images[imageIndex], imageIndex };
        }
      }
      return null;
    }
  }

  const sliceCenter = getNoduleSliceCenter(nodule);
  if (sliceCenter === undefined) {
    return null;
  }

  const roundedSlice = Math.round(sliceCenter);
  for (const displaySet of orderedCandidates) {
    const images = getDisplaySetImages(displaySet);
    const byInstanceNumber = images.findIndex(
      image => Number(image.InstanceNumber) === roundedSlice
    );
    if (byInstanceNumber !== -1) {
      return { displaySet, image: images[byInstanceNumber], imageIndex: byInstanceNumber };
    }

    const imageIndex = Math.min(Math.max(roundedSlice, 0), images.length - 1);
    if (images[imageIndex]) {
      return { displaySet, image: images[imageIndex], imageIndex };
    }
  }

  return null;
}

function normalizeVector(vector: number[], fallback: number[]): number[] {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map(component => component / length) : fallback;
}

function dot(left: number[], right: number[]): number {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function cross(left: number[], right: number[]): number[] {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function add(left: number[], right: number[]): number[] {
  return left.map((value, index) => value + right[index]);
}

function subtract(left: number[], right: number[]): number[] {
  return left.map((value, index) => value - right[index]);
}

function multiply(vector: number[], scalar: number): number[] {
  return vector.map(value => value * scalar);
}

function getVoxelRectanglePoints(nodule: AINodule, image: any): number[][] | null {
  const voxelPosition = toFiniteNumbers(nodule.nodule_position_voxel);
  if (voxelPosition.length < 6) {
    return null;
  }

  const imageOrientation = toFiniteNumbers(image?.ImageOrientationPatient);
  const imagePosition = toFiniteNumbers(image?.ImagePositionPatient);
  const pixelSpacing = toFiniteNumbers(image?.PixelSpacing);
  const row = normalizeVector(imageOrientation.slice(0, 3), [1, 0, 0]);
  const column = normalizeVector(imageOrientation.slice(3, 6), [0, 1, 0]);
  const origin = imagePosition.length >= 3 ? imagePosition.slice(0, 3) : [0, 0, 0];
  const rowSpacing = pixelSpacing[0] || 1;
  const columnSpacing = pixelSpacing[1] || rowSpacing;
  const xMin = Math.min(voxelPosition[0], voxelPosition[3]);
  const xMax = Math.max(voxelPosition[0], voxelPosition[3]);
  const yMin = Math.min(voxelPosition[1], voxelPosition[4]);
  const yMax = Math.max(voxelPosition[1], voxelPosition[4]);

  const pixelToWorld = (x: number, y: number) =>
    add(add(origin, multiply(row, x * columnSpacing)), multiply(column, y * rowSpacing));

  return [
    pixelToWorld(xMin, yMin),
    pixelToWorld(xMax, yMin),
    pixelToWorld(xMin, yMax),
    pixelToWorld(xMax, yMax),
  ];
}

/**
 * Converts the two opposite world-space box corners into four points on the
 * target image plane. RectangleROITool expects points 0 and 3 to be diagonal
 * corners, with points 1 and 2 completing the rectangle.
 */
export function getNoduleRectanglePoints(nodule: AINodule, image: any): number[][] | null {
  const voxelPoints = getVoxelRectanglePoints(nodule, image);
  if (voxelPoints) {
    return voxelPoints;
  }

  const position = toFiniteNumbers(nodule.nodule_position);
  if (position.length < 6) {
    return null;
  }

  const first = position.slice(0, 3);
  const second = position.slice(3, 6);
  const imageOrientation = toFiniteNumbers(image?.ImageOrientationPatient);
  const imagePosition = toFiniteNumbers(image?.ImagePositionPatient);

  if (imageOrientation.length >= 6) {
    const row = normalizeVector(imageOrientation.slice(0, 3), [1, 0, 0]);
    const column = normalizeVector(imageOrientation.slice(3, 6), [0, 1, 0]);
    const normal = normalizeVector(cross(row, column), [0, 0, 1]);
    let center = multiply(add(first, second), 0.5);

    // Project the center onto the selected IM slice plane. This removes the
    // through-plane extent of the model box while preserving its in-plane size.
    if (imagePosition.length >= 3) {
      center = subtract(center, multiply(normal, dot(subtract(center, imagePosition), normal)));
    }

    const delta = subtract(second, first);
    const halfRow = Math.abs(dot(delta, row)) / 2;
    const halfColumn = Math.abs(dot(delta, column)) / 2;
    if (halfRow > 0 && halfColumn > 0) {
      return [
        subtract(subtract(center, multiply(row, halfRow)), multiply(column, halfColumn)),
        add(subtract(center, multiply(column, halfColumn)), multiply(row, halfRow)),
        add(subtract(center, multiply(row, halfRow)), multiply(column, halfColumn)),
        add(add(center, multiply(row, halfRow)), multiply(column, halfColumn)),
      ];
    }
  }

  const xMin = Math.min(first[0], second[0]);
  const xMax = Math.max(first[0], second[0]);
  const yMin = Math.min(first[1], second[1]);
  const yMax = Math.max(first[1], second[1]);
  const z = (first[2] + second[2]) / 2;
  return [
    [xMin, yMin, z],
    [xMax, yMin, z],
    [xMin, yMax, z],
    [xMax, yMax, z],
  ];
}

export function getAINoduleRiskColor(riskLevel: unknown): string {
  return RISK_COLORS[String(riskLevel || '')] || 'rgb(255, 255, 0)';
}

export function getAINoduleAnnotationUID(
  studyInstanceUID: string,
  id: string,
  seriesInstanceUID?: string
): string {
  const safeStudyUID = String(studyInstanceUID || 'study').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const safeId = String(id).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const safeSeriesUID = String(seriesInstanceUID || 'series').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `ai-nodule:${safeStudyUID}:${safeSeriesUID}:${safeId}`;
}
