import {
  getNoduleImageNumber,
  getNoduleRectanglePoints,
  parseAINoduleResults,
  selectNoduleImage,
} from './aiNoduleAnnotations';

describe('AI nodule annotation helpers', () => {
  const nodule = {
    nodule_position: [-5, -4, 90, 5, 4, 110],
    nodule_position_voxel: [10, 20, 40, 20, 30, 50],
    findings: '肺结节（IM:48/227）',
    risk_level: '\u4f4e\u5371',
  };

  it('parses object and encoded JSON result formats', () => {
    const input = { nodule_1: nodule };
    expect(parseAINoduleResults(input)).toEqual([{ id: 'nodule_1', nodule }]);
    expect(parseAINoduleResults(JSON.stringify(JSON.stringify(input)))).toEqual([
      { id: 'nodule_1', nodule },
    ]);
    expect(parseAINoduleResults(String.raw`{\"nodule_1\":${JSON.stringify(nodule)}}`)).toEqual([
      { id: 'nodule_1', nodule },
    ]);
  });

  it('injects the screening record series UID into every nodule', () => {
    const response = {
      data: [
        {
          seriesuid: '1.2.840.series',
          airesults: {
            nodule_1: nodule,
          },
        },
      ],
    };

    expect(parseAINoduleResults(response)).toEqual([
      {
        id: 'nodule_1',
        nodule: { ...nodule, seriesInstanceUID: '1.2.840.series' },
      },
    ]);
  });

  it('prefers the IM image number when selecting a display set image', () => {
    const wrongSeries = {
      Modality: 'CT',
      SeriesInstanceUID: 'localizer',
      instances: [{ InstanceNumber: 48, imageId: 'localizer-48' }],
    };
    const displaySet = {
      Modality: 'CT',
      SeriesInstanceUID: 'series-1',
      instances: Array.from({ length: 227 }, (_, index) => ({
        InstanceNumber: index + 1,
        imageId: `image-${index + 1}`,
      })),
    };

    expect(getNoduleImageNumber(nodule)).toBe(48);
    expect(selectNoduleImage(nodule, [wrongSeries, displaySet])).toEqual({
      displaySet,
      image: displaySet.instances[47],
      imageIndex: 47,
    });
  });

  it('accepts an explicit IM field when findings do not include an image number', () => {
    expect(getNoduleImageNumber({ ...nodule, findings: '', im: 19 })).toBe(19);
  });

  it('uses an explicit series UID instead of guessing from the reported image count', () => {
    const reportedCountSeries = {
      Modality: 'CT',
      SeriesInstanceUID: 'series-227',
      instances: Array.from({ length: 227 }, (_, index) => ({
        InstanceNumber: index + 1,
        imageId: `reported-${index + 1}`,
      })),
    };
    const targetSeries = {
      Modality: 'CT',
      SeriesInstanceUID: 'series-201',
      instances: Array.from({ length: 201 }, (_, index) => ({
        InstanceNumber: index + 1,
        imageId: `target-${index + 1}`,
      })),
    };

    expect(
      selectNoduleImage({ ...nodule, seriesInstanceUID: 'series-201' }, [
        reportedCountSeries,
        targetSeries,
      ])
    ).toEqual({
      displaySet: targetSeries,
      image: targetSeries.instances[47],
      imageIndex: 47,
    });
  });

  it('does not place an explicit-series detection on a missing image', () => {
    const incompleteTargetSeries = {
      Modality: 'CT',
      SeriesInstanceUID: 'series-1',
      instances: [{ InstanceNumber: 54, imageId: 'image-54' }],
    };

    expect(
      selectNoduleImage({ ...nodule, seriesInstanceUID: 'series-1' }, [incompleteTargetSeries])
    ).toBeNull();
  });

  it('projects the world-space fallback onto the selected image plane', () => {
    const points = getNoduleRectanglePoints(
      { ...nodule, nodule_position_voxel: undefined },
      {
        ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
        ImagePositionPatient: [0, 0, 100],
      }
    );

    expect(points).toEqual([
      [-5, -4, 100],
      [5, -4, 100],
      [-5, 4, 100],
      [5, 4, 100],
    ]);
  });

  it('maps voxel box coordinates onto the target image plane', () => {
    const points = getNoduleRectanglePoints(nodule, {
      ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
      ImagePositionPatient: [0, 0, -273],
      PixelSpacing: [0.5, 0.75],
    });

    expect(points).toEqual([
      [7.5, 10, -273],
      [15, 10, -273],
      [7.5, 15, -273],
      [15, 15, -273],
    ]);
  });
});
