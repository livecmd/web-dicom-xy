import type { AINoduleRecord } from '../services/AINoduleService';
import { getNoduleImageNumber, getNoduleSliceCenter } from './aiNoduleAnnotations';

export const AI_NODULE_SORT_OPTIONS = [
  { value: 'im', label: '\u6309IM' },
  { value: 'location', label: '\u6309\u80ba\u6bb5' },
  { value: 'diameter', label: '\u6309\u957f\u5f84' },
  { value: 'volume', label: '\u6309\u4f53\u79ef' },
  { value: 'risk', label: '\u6309\u98ce\u9669' },
  { value: 'type', label: '\u6309\u7c7b\u578b' },
] as const;

export const AI_NODULE_RISK_OPTIONS = [
  { value: 'low', label: '\u4f4e\u5371' },
  { value: 'medium', label: '\u4e2d\u5371' },
  { value: 'high', label: '\u9ad8\u5371' },
] as const;

export const AI_NODULE_TYPE_OPTIONS = [
  { value: 'mass', label: '\u80bf\u5757' },
  { value: 'mixed', label: '\u6df7\u5408' },
  { value: 'groundGlass', label: '\u78e8\u73bb\u7483' },
  { value: 'solid', label: '\u5b9e\u6027' },
  { value: 'calcification', label: '\u9499\u5316' },
] as const;

export const AI_NODULE_DIAMETER_OPTIONS = [
  { value: 'd0to3', label: '0-3mm', min: 0, max: 3 },
  { value: 'd3to5', label: '3-5mm', min: 3, max: 5 },
  { value: 'd5to8', label: '5-8mm', min: 5, max: 8 },
  { value: 'd8plus', label: '>8mm', min: 8, max: Number.POSITIVE_INFINITY },
] as const;

export const AI_NODULE_EDIT_TYPE_OPTIONS = [
  { value: 'mass', label: '\u80bf\u5757' },
  { value: 'solid', label: '\u5b9e\u6027\u7ed3\u8282' },
  { value: 'calcification', label: '\u9499\u5316\u7ed3\u8282' },
  { value: 'partSolid', label: '\u90e8\u5206\u5b9e\u6027\u7ed3\u8282' },
  { value: 'groundGlass', label: '\u78e8\u73bb\u7483\u7ed3\u8282' },
  { value: 'mixed', label: '\u6df7\u5408\u7ed3\u8282' },
] as const;

export const AI_NODULE_LOCATION_OPTIONS = [
  {
    value: '\u5de6\u80ba\u4e0a\u53f6',
    label: '\u5de6\u80ba\u4e0a\u53f6',
    children: ['\u5c16\u540e\u6bb5', '\u524d\u6bb5', '\u4e0a\u820c\u6bb5', '\u4e0b\u820c\u6bb5'],
  },
  {
    value: '\u5de6\u80ba\u4e0b\u53f6',
    label: '\u5de6\u80ba\u4e0b\u53f6',
    children: [
      '\u80cc\u6bb5',
      '\u5185\u524d\u57fa\u5e95\u6bb5',
      '\u5916\u57fa\u5e95\u6bb5',
      '\u540e\u57fa\u5e95\u6bb5',
    ],
  },
  {
    value: '\u53f3\u80ba\u4e0a\u53f6',
    label: '\u53f3\u80ba\u4e0a\u53f6',
    children: ['\u5c16\u6bb5', '\u540e\u6bb5', '\u524d\u6bb5'],
  },
  {
    value: '\u53f3\u80ba\u4e2d\u53f6',
    label: '\u53f3\u80ba\u4e2d\u53f6',
    children: ['\u5185\u4fa7\u6bb5', '\u5916\u4fa7\u6bb5'],
  },
  {
    value: '\u53f3\u80ba\u4e0b\u53f6',
    label: '\u53f3\u80ba\u4e0b\u53f6',
    children: [
      '\u80cc\u6bb5',
      '\u5185\u57fa\u5e95\u6bb5',
      '\u524d\u57fa\u5e95\u6bb5',
      '\u5916\u57fa\u5e95\u6bb5',
      '\u540e\u57fa\u5e95\u6bb5',
    ],
  },
] as const;

export type AINoduleSort = (typeof AI_NODULE_SORT_OPTIONS)[number]['value'];

export type AINoduleFilters = {
  risks: string[];
  types: string[];
  diameterRanges: string[];
  shortDiameterRanges: string[];
  diameterMin: string;
  diameterMax: string;
  shortDiameterMin: string;
  shortDiameterMax: string;
};

export type AINoduleListItem = AINoduleRecord & {
  orderNumber: number;
  imageNumber?: number;
  imageCount?: number;
  lobe: string;
  segment: string;
  location: string;
  type: string;
  typeValue: string;
  risk: string;
  riskValue: string;
  diameter?: number;
  shortDiameter?: number;
  diameterText: string;
  volume?: number;
  volumeText: string;
  ctText: string;
  findings: string;
};

const LOBE_ORDER = [
  '\u5de6\u80ba\u4e0a\u53f6',
  '\u5de6\u80ba\u4e0b\u53f6',
  '\u53f3\u80ba\u4e0a\u53f6',
  '\u53f3\u80ba\u4e2d\u53f6',
  '\u53f3\u80ba\u4e0b\u53f6',
];

const SEGMENT_ORDER = [
  '\u5c16\u540e\u6bb5',
  '\u5c16\u6bb5',
  '\u540e\u6bb5',
  '\u524d\u6bb5',
  '\u4e0a\u820c\u6bb5',
  '\u4e0b\u820c\u6bb5',
  '\u5185\u4fa7\u6bb5',
  '\u5916\u4fa7\u6bb5',
  '\u80cc\u6bb5',
  '\u5185\u57fa\u5e95\u6bb5',
  '\u5185\u524d\u57fa\u5e95\u6bb5',
  '\u524d\u57fa\u5e95\u6bb5',
  '\u5916\u57fa\u5e95\u6bb5',
  '\u540e\u57fa\u5e95\u6bb5',
];

const TYPE_ORDER = ['mass', 'solid', 'calcification', 'partSolid', 'groundGlass', 'mixed'];
const RISK_ORDER = { low: 1, medium: 2, high: 3 };

export function createDefaultAINoduleFilters(): AINoduleFilters {
  return {
    risks: [],
    types: [],
    diameterRanges: [],
    shortDiameterRanges: [],
    diameterMin: '',
    diameterMax: '',
    shortDiameterMin: '',
    shortDiameterMax: '',
  };
}

function getNumber(value: unknown): number | undefined {
  if (value === '' || value === undefined || value === null) {
    return;
  }
  const match = String(value).match(/-?[\d.]+/);
  const number = match ? Number(match[0]) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function getNumbers(value: unknown): number[] {
  if (value === '' || value === undefined || value === null) {
    return [];
  }
  return (String(value).match(/-?[\d.]+/g) || []).map(Number).filter(Number.isFinite);
}

function firstNumber(...values: unknown[]): number | undefined {
  return values.map(getNumber).find(value => value !== undefined);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function formatUnit(value: unknown, unit: string): string {
  if (value === '' || value === undefined || value === null) {
    return '';
  }
  const text = String(value).trim();
  return /[a-zA-Z\u00b3]/.test(text) ? text : `${text} ${unit}`;
}

function getType(nodule: Record<string, unknown>, findings: string) {
  const raw = String(
    nodule.nodule_type ||
      nodule.noduleType ||
      nodule.type ||
      nodule.densityType ||
      nodule.noduleTypeLabel ||
      ''
  ).trim();
  const text = raw || findings;
  const normalized = text.toLowerCase().replace(/[\s_-]/g, '');

  if (text.includes('\u80bf\u5757') || ['mass', 'occupying'].includes(normalized)) {
    return { value: 'mass', label: raw || '\u80bf\u5757' };
  }
  if (
    text.includes('\u90e8\u5206\u5b9e\u6027') ||
    ['partsolid', 'partsolidnodule', 'subsolid', 'semisolid', 'mggn'].includes(normalized)
  ) {
    return { value: 'partSolid', label: raw || '\u90e8\u5206\u5b9e\u6027\u7ed3\u8282' };
  }
  if (text.includes('\u6df7\u5408') || ['mixed', 'mixednodule'].includes(normalized)) {
    return { value: 'mixed', label: raw || '\u6df7\u5408\u7ed3\u8282' };
  }
  if (
    text.includes('\u78e8\u73bb\u7483') ||
    normalized.includes('groundglass') ||
    ['gcn', 'pggn', 'nonsolid', 'nonsolidnodule'].includes(normalized)
  ) {
    return { value: 'groundGlass', label: raw || '\u78e8\u73bb\u7483\u7ed3\u8282' };
  }
  if (
    text.includes('\u9499\u5316') ||
    ['calcification', 'calcified', 'calcifiednodule'].includes(normalized)
  ) {
    return { value: 'calcification', label: raw || '\u9499\u5316\u7ed3\u8282' };
  }
  if (text.includes('\u5b9e\u6027') || ['solid', 'solidnodule'].includes(normalized)) {
    return { value: 'solid', label: raw || '\u5b9e\u6027\u7ed3\u8282' };
  }
  return { value: '', label: raw || '\u7ed3\u8282' };
}

function getRisk(value: unknown) {
  const label = String(value ?? '').trim();
  const normalized = label.toLowerCase();
  if (label.includes('\u4f4e') || normalized.includes('low') || normalized === '1') {
    return { value: 'low', label: label || '\u4f4e\u5371' };
  }
  if (
    label.includes('\u4e2d') ||
    normalized.includes('medium') ||
    normalized.includes('middle') ||
    normalized === '2'
  ) {
    return { value: 'medium', label: label || '\u4e2d\u5371' };
  }
  if (label.includes('\u9ad8') || normalized.includes('high') || normalized === '3') {
    return { value: 'high', label: label || '\u9ad8\u5371' };
  }
  return { value: '', label };
}

export function toAINoduleListItem(record: AINoduleRecord, index: number): AINoduleListItem {
  const nodule = record.nodule as Record<string, unknown>;
  const findings = String(
    nodule.findings || nodule.finding || nodule.desc || nodule.description || ''
  ).trim();
  const imMatch = findings.match(/IM\s*[:\uff1a]?\s*(\d+)(?:\s*[/\uff0f]\s*(\d+))?/i);
  const locationMatch = findings.match(
    /([\u5de6\u53f3]\u80ba(?:\u4e0a\u53f6|\u4e2d\u53f6|\u4e0b\u53f6))(?:[/\u3001\s]?([^\uff0c\u3002,\uff1b;\s]*\u6bb5))?/
  );
  const diameterMatch = findings.match(
    /\u5927\u5c0f\u7ea6?\s*([\d.]+)\s*mm(?:\s*[xX\u00d7*]\s*([\d.]+)\s*mm)?/i
  );
  const volumeMatch = findings.match(/\u4f53\u79ef\u7ea6?\s*([\d.]+)\s*mm/i);
  const ctMatch = findings.match(/\u5e73\u5747CT\u503c\u7ea6?\s*(-?[\d.]+)\s*HU/i);
  const riskMatch = findings.match(/(\u4f4e\u5371|\u4e2d\u5371|\u9ad8\u5371)/);
  const diameterValues = getNumbers(nodule.diameterText);
  const diameter = firstNumber(
    nodule.diameterValue,
    nodule.longDiameter,
    nodule.longAxisLength,
    nodule.Major_axis_length,
    (nodule.ellipsoidAxis as any)?.major,
    (nodule.ellipsoidAxis as any)?.long,
    nodule.diameter,
    diameterMatch?.[1],
    diameterValues[0]
  );
  const shortDiameter = firstNumber(
    nodule.shortDiameterValue,
    nodule.shortDiameter,
    nodule.shortAxisLength,
    nodule.minorAxisValue,
    nodule.Minor_axis_length,
    nodule.Minimum_axis_length,
    (nodule.ellipsoidAxis as any)?.least,
    (nodule.ellipsoidAxis as any)?.short,
    (nodule.ellipsoidAxis as any)?.minor,
    diameterMatch?.[2],
    diameterValues.length > 1 ? Math.min(...diameterValues) : undefined
  );
  const imageNumber =
    getNoduleImageNumber(record.nodule) ||
    firstNumber(nodule.im, nodule.IM) ||
    (() => {
      const sliceCenter = getNoduleSliceCenter(record.nodule);
      return sliceCenter === undefined ? undefined : Math.floor(sliceCenter) + 1;
    })();
  const lobe = String(
    nodule.lobe ||
      nodule.lungLobe ||
      nodule.lobePosition ||
      nodule.lobe_position ||
      locationMatch?.[1] ||
      ''
  );
  const segment = String(
    nodule.segment ||
      nodule.lungSegment ||
      nodule.lobeSegment ||
      nodule.lobe_segment_position ||
      nodule.lung_segment ||
      locationMatch?.[2] ||
      ''
  );
  const type = getType(nodule, findings);
  const risk = getRisk(
    nodule.risk_level || nodule.risk || nodule.riskLevel || nodule.riskGrade || riskMatch?.[1]
  );
  const volumeValue =
    nodule.volume || nodule.volumeValue || nodule.Volume || nodule.noduleVolume || volumeMatch?.[1];
  const ctValue =
    nodule.ct ||
    nodule.ctValue ||
    nodule.averageCt ||
    nodule.ctMeasureMean ||
    nodule.CT_value_mean ||
    ctMatch?.[1];
  const diameterText = nodule.diameterText
    ? String(nodule.diameterText)
    : diameter === undefined
      ? ''
      : shortDiameter === undefined || shortDiameter === diameter
        ? `${formatNumber(diameter)} mm`
        : `${formatNumber(diameter)} x ${formatNumber(shortDiameter)} mm`;

  return {
    ...record,
    orderNumber:
      firstNumber(nodule.orderNo, nodule.index, record.id.match(/\d+/)?.[0]) || index + 1,
    imageNumber: imageNumber || (imMatch?.[1] ? Number(imMatch[1]) : undefined),
    imageCount: imMatch?.[2] ? Number(imMatch[2]) : undefined,
    lobe,
    segment,
    location: [lobe, segment].filter(Boolean).join(' / '),
    type: type.label,
    typeValue: type.value,
    risk: risk.label,
    riskValue: risk.value,
    diameter,
    shortDiameter,
    diameterText,
    volume: getNumber(volumeValue),
    volumeText: formatUnit(volumeValue, 'mm3'),
    ctText: formatUnit(ctValue, 'HU'),
    findings,
  };
}

function compareNumbers(left?: number, right?: number, descending = false): number {
  const normalizedLeft = left ?? Number.POSITIVE_INFINITY;
  const normalizedRight = right ?? Number.POSITIVE_INFINITY;
  return descending
    ? (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY)
    : normalizedLeft - normalizedRight;
}

function optionOrder(value: string, options: string[]): number {
  const index = options.indexOf(value);
  return index === -1 ? options.length : index;
}

export function sortAINoduleItems(
  items: AINoduleListItem[],
  sort: AINoduleSort
): AINoduleListItem[] {
  return [...items].sort((left, right) => {
    let comparison = 0;
    if (sort === 'location') {
      comparison =
        optionOrder(left.lobe, LOBE_ORDER) - optionOrder(right.lobe, LOBE_ORDER) ||
        optionOrder(left.segment, SEGMENT_ORDER) - optionOrder(right.segment, SEGMENT_ORDER);
    } else if (sort === 'diameter') {
      comparison = compareNumbers(left.diameter, right.diameter, true);
    } else if (sort === 'volume') {
      comparison = compareNumbers(left.volume, right.volume, true);
    } else if (sort === 'risk') {
      comparison = (RISK_ORDER[right.riskValue] || 0) - (RISK_ORDER[left.riskValue] || 0);
    } else if (sort === 'type') {
      comparison =
        optionOrder(left.typeValue, TYPE_ORDER) - optionOrder(right.typeValue, TYPE_ORDER);
    }
    return comparison || compareNumbers(left.imageNumber, right.imageNumber);
  });
}

function matchesDiameter(
  value: number | undefined,
  ranges: string[],
  minText: string,
  maxText: string
): boolean {
  const min = getNumber(minText);
  const max = getNumber(maxText);
  if (!ranges.length && min === undefined && max === undefined) {
    return true;
  }
  if (value === undefined) {
    return false;
  }

  const rangeMatches = AI_NODULE_DIAMETER_OPTIONS.some(option => {
    if (!ranges.includes(option.value)) {
      return false;
    }
    return option.value === 'd8plus'
      ? value > option.min
      : value >= option.min && value <= option.max;
  });
  const customMatches =
    (min !== undefined || max !== undefined) &&
    (min === undefined || value >= min) &&
    (max === undefined || value <= max);
  return rangeMatches || customMatches;
}

export function matchesAINoduleFilters(item: AINoduleListItem, filters: AINoduleFilters): boolean {
  if (filters.risks.length && !filters.risks.includes(item.riskValue)) {
    return false;
  }
  if (
    filters.types.length &&
    !filters.types.includes(item.typeValue) &&
    !(item.typeValue === 'partSolid' && filters.types.includes('mixed'))
  ) {
    return false;
  }
  return (
    matchesDiameter(
      item.diameter,
      filters.diameterRanges,
      filters.diameterMin,
      filters.diameterMax
    ) &&
    matchesDiameter(
      item.shortDiameter,
      filters.shortDiameterRanges,
      filters.shortDiameterMin,
      filters.shortDiameterMax
    )
  );
}

export function countAINoduleFilters(filters: AINoduleFilters): number {
  return (
    filters.risks.length +
    filters.types.length +
    filters.diameterRanges.length +
    filters.shortDiameterRanges.length +
    Number(Boolean(filters.diameterMin || filters.diameterMax)) +
    Number(Boolean(filters.shortDiameterMin || filters.shortDiameterMax))
  );
}
