import type { AINoduleRecord } from '../services/AINoduleService';
import {
  createDefaultAINoduleFilters,
  matchesAINoduleFilters,
  sortAINoduleItems,
  toAINoduleListItem,
} from './aiNodulePresentation';

function createRecord(
  id: string,
  findings: string,
  overrides: Record<string, unknown> = {}
): AINoduleRecord {
  return {
    recordUID: `study::series::${id}`,
    id,
    studyInstanceUID: 'study',
    seriesInstanceUID: 'series',
    isSelected: false,
    nodule: {
      findings,
      nodule_position_voxel: [1, 2, 3, 4, 5, 6],
      ...overrides,
    },
  };
}

describe('AI nodule presentation helpers', () => {
  it('normalizes the fields used by the nodule list', () => {
    const item = toAINoduleListItem(
      createRecord(
        'nodule_1',
        '\u53f3\u80ba\u4e0a\u53f6\u5c16\u6bb5\uff08IM:12/100\uff09\u89c1\u5b9e\u6027\u7ed3\u8282\uff0c\u5927\u5c0f\u7ea69 mm x 5 mm\uff0c\u4f53\u79ef\u7ea6120 mm3\uff0c\u5e73\u5747CT\u503c\u7ea6-420 HU\uff0c\u9ad8\u5371'
      ),
      0
    );

    expect(item).toMatchObject({
      imageNumber: 12,
      imageCount: 100,
      lobe: '\u53f3\u80ba\u4e0a\u53f6',
      segment: '\u5c16\u6bb5',
      typeValue: 'solid',
      riskValue: 'high',
      diameter: 9,
      shortDiameter: 5,
      volume: 120,
    });
  });

  it('applies risk, type, and diameter filters together', () => {
    const item = toAINoduleListItem(
      createRecord(
        'nodule_1',
        '\u90e8\u5206\u5b9e\u6027\u7ed3\u8282\uff08IM:8/50\uff09\uff0c\u4e2d\u5371',
        {
          longDiameter: 9,
          shortDiameter: 5,
        }
      ),
      0
    );
    const filters = {
      ...createDefaultAINoduleFilters(),
      risks: ['medium'],
      types: ['mixed'],
      diameterRanges: ['d8plus'],
      shortDiameterRanges: ['d3to5'],
    };

    expect(matchesAINoduleFilters(item, filters)).toBe(true);
    expect(matchesAINoduleFilters(item, { ...filters, risks: ['low'] })).toBe(false);
  });

  it('accepts the normalized diameter aliases from the previous report panel', () => {
    const item = toAINoduleListItem(
      createRecord('nodule_2', '\u7ed3\u8282\uff08IM:6/50\uff09', {
        diameterValue: 7.5,
        shortDiameterValue: 4.2,
      }),
      0
    );

    expect(item.diameter).toBe(7.5);
    expect(item.shortDiameter).toBe(4.2);
    expect(item.diameterText).toBe('7.5 x 4.2 mm');
  });

  it('sorts descending metrics and uses IM as a stable fallback', () => {
    const small = toAINoduleListItem(
      createRecord('small', '\u7ed3\u8282\uff08IM:20/50\uff09', {
        longDiameter: 4,
        risk_level: '\u4f4e\u5371',
      }),
      0
    );
    const large = toAINoduleListItem(
      createRecord('large', '\u7ed3\u8282\uff08IM:10/50\uff09', {
        longDiameter: 9,
        risk_level: '\u9ad8\u5371',
      }),
      1
    );

    expect(sortAINoduleItems([small, large], 'diameter').map(item => item.id)).toEqual([
      'large',
      'small',
    ]);
    expect(sortAINoduleItems([small, large], 'risk').map(item => item.id)).toEqual([
      'large',
      'small',
    ]);
    expect(sortAINoduleItems([small, large], 'im').map(item => item.id)).toEqual([
      'large',
      'small',
    ]);
  });

  it('prefers fields edited in the screening table over the original finding text', () => {
    const item = toAINoduleListItem(
      createRecord(
        'nodule_3',
        '\u5de6\u80ba\u4e0a\u53f6\u5c16\u540e\u6bb5\uff08IM:6/50\uff09\u89c1\u5b9e\u6027\u7ed3\u8282',
        {
          lobe: '\u53f3\u80ba\u4e0b\u53f6',
          segment: '\u540e\u57fa\u5e95\u6bb5',
          nodule_type: '\u78e8\u73bb\u7483\u7ed3\u8282',
        }
      ),
      0
    );

    expect(item).toMatchObject({
      lobe: '\u53f3\u80ba\u4e0b\u53f6',
      segment: '\u540e\u57fa\u5e95\u6bb5',
      typeValue: 'groundGlass',
    });
  });

  it('reads the lobe segment alias returned by the screening API', () => {
    const item = toAINoduleListItem(
      createRecord('nodule_4', '\u7ed3\u8282\uff08IM:9/50\uff09', {
        lobe_position: '\u53f3\u80ba\u4e0a\u53f6',
        lobe_segment_position: '\u5c16\u6bb5',
      }),
      0
    );

    expect(item.location).toBe('\u53f3\u80ba\u4e0a\u53f6 / \u5c16\u6bb5');
  });
});
