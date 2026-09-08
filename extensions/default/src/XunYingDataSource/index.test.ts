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

  it('loads AI results from the screening endpoint with URL credentials', async () => {
    const screeningResponse = {
      data: [{ seriesuid: '1.2.840.series', airesults: { nodule_1: {} } }],
    };
    const originalFetch = (global as any).fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => screeningResponse,
    } as Response);
    (global as any).fetch = fetchMock;
    const screeningDataSource = createXunYingApi(
      {
        name: 'xunying',
        baseUrl: '/webpacs/api',
        hospital: '',
        token: '',
      },
      {}
    );
    screeningDataSource.initialize({
      params: {},
      query: new URLSearchParams('hospital=ccfcyy&token=test-token'),
    });

    await expect(screeningDataSource.getAIResults('2609021645305')).resolves.toEqual(
      screeningResponse
    );
    await expect(screeningDataSource.getAIResults('2609021645305')).resolves.toEqual(
      screeningResponse
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestOptions] = fetchMock.mock.calls[0];
    expect(requestUrl).toContain('/webpacs/api/aiscreening?');
    expect(requestUrl).toContain('hospital=ccfcyy');
    expect(requestUrl).toContain('studyuid=2609021645305');
    expect(requestOptions).toMatchObject({
      method: 'GET',
      headers: { token: 'test-token', Accept: 'application/json' },
    });

    if (originalFetch) {
      (global as any).fetch = originalFetch;
    } else {
      delete (global as any).fetch;
    }
  });
});
