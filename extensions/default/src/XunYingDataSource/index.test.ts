jest.mock('@ohif/core', () => ({
  DicomMetadataStore: {},
  IWebApiDataSource: {
    create: jest.fn(implementation => implementation),
  },
  utils: {
    splitComma: (values: string[]) =>
      values.flatMap(value =>
        String(value)
          .split(',')
          .map(item => item.trim())
          .filter(Boolean)
      ),
  },
  classes: {
    MetadataProvider: {},
  },
}));

import { createXunYingApi } from './index';

describe('XunYingDataSource URL params', () => {
  const dataSource = createXunYingApi(
    {
      name: 'xunying',
      baseUrl: '/webpacs/api',
      hospital: '',
      token: '',
    },
    {}
  );

  it('reads production studyuid query params directly', () => {
    const studyInstanceUIDs = dataSource.getStudyInstanceUIDs({
      params: {},
      query: new URLSearchParams('hospital=shapyy&studyuid=1.2.840.1&token=abc'),
    });

    expect(studyInstanceUIDs).toEqual(['1.2.840.1']);
  });

  it('keeps legacy StudyInstanceUIDs query params working', () => {
    const studyInstanceUIDs = dataSource.getStudyInstanceUIDs({
      params: {},
      query: new URLSearchParams('StudyInstanceUIDs=1.2.840.2&hospital=shapyy'),
    });

    expect(studyInstanceUIDs).toEqual(['1.2.840.2']);
  });
});
