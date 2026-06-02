import { mapInstanceToNaturalized } from './mapFields';

describe('XunYing mapFields geometry fallback', () => {
  const baseImage = {
    imageuid: '1.2.3',
    rows: 428,
    columns: 428,
    numberofframes: 1,
    imageno: 3,
    seriesno: '1',
    pixelspacing: '0.35\\0.35',
    sliceloction: '',
    pat_name: 'Patient',
    patid: 'P1',
    age: '',
    sex: 'F',
    model_name: '',
    manufacturer: '',
    institution_name: '',
    series_date: '2026-02-10',
    series_desc: '',
    series_no: '1',
    slice_thick: '',
    studyid: '',
    study_desc: '',
    imageorientation: '1\\0\\0\\0\\1\\0',
  };

  const study = {
    name: 'Patient',
    studytime: '2026-02-10 14:04:22',
    modalities: 'CT',
    sex: 'F',
    series: ['series-1'],
  };

  it('synthesizes ImagePositionPatient when XunYing metadata omits imgpos', () => {
    const instance = mapInstanceToNaturalized(baseImage, 'study-1', 'series-1', 'CT', study, 2);

    expect(instance.ImagePositionPatient).toEqual([0, 0, 0.7]);
    expect(instance.SliceThickness).toBe(0.35);
    expect(instance.SpacingBetweenSlices).toBe(0.35);
  });

  it('prefers real imgpos over synthesized geometry', () => {
    const instance = mapInstanceToNaturalized(
      {
        ...baseImage,
        imgpos: '-74.9\\-74.9\\38.85',
      },
      'study-1',
      'series-1',
      'CT',
      study,
      0
    );

    expect(instance.ImagePositionPatient).toEqual([-74.9, -74.9, 38.85]);
  });
});
