import AINoduleService from './AINoduleService';

const nodule = {
  findings: '\u53f3\u80ba\u4e0a\u53f6\u7ed3\u8282\uff08IM:12/100\uff09',
  nodule_position_voxel: [1, 2, 10, 5, 6, 14],
};

describe('AINoduleService', () => {
  it('publishes normalized study results and selection changes', () => {
    const service = new AINoduleService();
    const listener = jest.fn();
    service.subscribe(service.EVENTS.STATE_CHANGED, listener);

    service.setStudyLoading('study-1', true);
    const records = service.setStudyResults('study-1', {
      data: [{ seriesuid: 'series-1', airesults: { nodule_1: nodule } }],
    });
    service.setSelected(records[0].recordUID, true);

    expect(service.getState()).toMatchObject({
      loadingStudyInstanceUIDs: [],
      errors: {},
      records: [
        {
          id: 'nodule_1',
          studyInstanceUID: 'study-1',
          seriesInstanceUID: 'series-1',
          isSelected: true,
        },
      ],
    });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('preserves selection when a study result is refreshed', () => {
    const service = new AINoduleService();
    const detections = {
      data: [{ seriesuid: 'series-1', airesults: { nodule_1: nodule } }],
    };
    const [record] = service.setStudyResults('study-1', detections);
    service.setSelected(record.recordUID, true);
    service.setStudyResults('study-1', detections);

    expect(service.getState().records[0].isSelected).toBe(true);
  });

  it('updates editable nodule fields without changing selection', () => {
    const service = new AINoduleService();
    const [record] = service.setStudyResults('study-1', {
      data: [{ seriesuid: 'series-1', airesults: { nodule_1: nodule } }],
    });
    service.setSelected(record.recordUID, true);
    service.updateNodule(record.recordUID, {
      lobe: '\u53f3\u80ba\u4e0a\u53f6',
      segment: '\u5c16\u6bb5',
      nodule_type: '\u5b9e\u6027\u7ed3\u8282',
    });

    expect(service.getState().records[0]).toMatchObject({
      isSelected: true,
      nodule: {
        lobe: '\u53f3\u80ba\u4e0a\u53f6',
        segment: '\u5c16\u6bb5',
        nodule_type: '\u5b9e\u6027\u7ed3\u8282',
      },
    });
  });
});
