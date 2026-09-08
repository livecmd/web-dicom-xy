import { DicomMetadataStore, IWebApiDataSource, utils, classes } from '@ohif/core';
import { fetchJson, buildJsonUrl, buildThumbnailUrl, XunYingHttpConfig } from './utils/httpClient';
import {
  mapInstanceToNaturalized,
  normalizeModality,
  XunYingImageData,
  XunYingStudyData,
} from './utils/mapFields';
import {
  registerXunYingImageLoader,
  setXunYingLoaderConfig,
  buildXunYingImageId,
} from './imageLoader';

const metadataProvider = classes.MetadataProvider;

export interface XunYingDataSourceConfig {
  name: string;
  baseUrl: string;
  hospital: string;
  token: string;
  onConfiguration?: (config: XunYingDataSourceConfig, params: any) => XunYingDataSourceConfig;
}

const STUDY_INSTANCE_UID_PARAM_KEYS = [
  'StudyInstanceUIDs',
  'studyInstanceUIDs',
  'StudyInstanceUID',
  'studyInstanceUID',
  'studyInstanceUid',
  'studyuid',
  'studyUID',
] as const;

function pickFirstDefined<T>(...values: T[]): T | undefined {
  return values.find(value => value !== undefined && value !== null && value !== '') as
    | T
    | undefined;
}

function splitStudyInstanceUIDs(value: string | string[] | undefined) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => utils.splitComma([item]));
  }

  return utils.splitComma([value]);
}

function mapStudySummary(studyUID: string, studyData: XunYingStudyData) {
  const [date = '', time = ''] = (studyData.studytime || '').split(' ');

  return {
    studyInstanceUid: studyUID,
    studyInstanceUID: studyUID,
    patientName: studyData.name || '',
    modalities: studyData.modalities || '',
    description: '',
    accession: '',
    mrn: '',
    instances: 0,
    date: date.replace(/-/g, ''),
    time: time.replace(/:/g, ''),
  };
}

function createXunYingApi(xunyingConfig: XunYingDataSourceConfig, servicesManager) {
  let configCopy: XunYingDataSourceConfig;
  let httpConfig: XunYingHttpConfig;

  const studyDataPromises = new Map<string, Promise<XunYingStudyData>>();
  const studyMetadataPromises = new Map<string, Promise<any>>();
  const aiResultPromises = new Map<string, Promise<unknown>>();

  function getHttpConfig(): XunYingHttpConfig {
    return httpConfig;
  }

  function getStudyDataCacheKey(studyUID: string) {
    const cfg = getHttpConfig();
    return `${cfg.baseUrl}|${cfg.hospital}|${cfg.token}|${studyUID}`;
  }

  async function fetchStudyData(studyUID: string): Promise<XunYingStudyData> {
    const cacheKey = getStudyDataCacheKey(studyUID);
    const existingPromise = studyDataPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const url = buildJsonUrl(getHttpConfig(), '/study', {
      level: 'study',
      studyuid: studyUID,
    });
    const promise = fetchJson<XunYingStudyData>(getHttpConfig(), url).catch(error => {
      studyDataPromises.delete(cacheKey);
      throw error;
    });
    studyDataPromises.set(cacheKey, promise);
    return promise;
  }

  async function fetchSeriesImages(
    studyUID: string,
    seriesUID: string
  ): Promise<XunYingImageData[]> {
    const url = buildJsonUrl(getHttpConfig(), '/study', {
      level: 'image',
      studyuid: studyUID,
      seriesuid: seriesUID,
    });
    const result = await fetchJson<{ data: XunYingImageData[] }>(getHttpConfig(), url);
    return result.data || [];
  }

  const implementation = {
    initialize: ({ params, query }) => {
      if (xunyingConfig.onConfiguration && typeof xunyingConfig.onConfiguration === 'function') {
        xunyingConfig = xunyingConfig.onConfiguration(xunyingConfig, { params, query });
      }

      const urlToken = query?.get?.('token') || params?.token || xunyingConfig.token || '';
      const urlHospital =
        query?.get?.('hospital') || params?.hospital || xunyingConfig.hospital || '';

      xunyingConfig.token = urlToken;
      xunyingConfig.hospital = urlHospital;

      configCopy = { ...xunyingConfig };
      httpConfig = {
        baseUrl: xunyingConfig.baseUrl,
        hospital: xunyingConfig.hospital,
        token: xunyingConfig.token,
      };

      registerXunYingImageLoader();
      setXunYingLoaderConfig(httpConfig);
    },

    query: {
      studies: {
        mapParams: params => params,
        search: async function (origParams) {
          const studyUID = pickFirstDefined(
            origParams?.studyInstanceUid,
            origParams?.StudyInstanceUID,
            origParams?.studyInstanceUID,
            origParams?.studyuid,
            origParams?.studyUID,
            splitStudyInstanceUIDs(origParams?.StudyInstanceUIDs)?.[0],
            splitStudyInstanceUIDs(origParams?.studyInstanceUIDs)?.[0]
          );

          if (!studyUID) {
            return [];
          }

          const studyData = await fetchStudyData(studyUID);
          if (!studyData?.series?.length) {
            return [];
          }

          return [mapStudySummary(studyUID, studyData)];
        },
        processResults: results => results,
      },
      series: {
        search: async function (studyInstanceUid) {
          const studyData = await fetchStudyData(studyInstanceUid);
          if (!studyData || !studyData.series) {
            return [];
          }
          return studyData.series.map((seriesUID, idx) => ({
            StudyInstanceUID: studyInstanceUid,
            SeriesInstanceUID: seriesUID,
            SeriesNumber: idx + 1,
            Modality: normalizeModality(studyData.modalities) || studyData.modalities || '',
          }));
        },
      },
      instances: {
        search: () => {
          return [];
        },
      },
    },

    retrieve: {
      directURL: params => {
        return undefined;
      },
      bulkDataURI: async () => undefined,

      getGetThumbnailSrc: function (instance) {
        const cfg = getHttpConfig();
        if (!cfg) {
          return undefined;
        }
        return function getThumbnailSrc() {
          return buildThumbnailUrl(
            cfg,
            instance.StudyInstanceUID,
            instance.SeriesInstanceUID,
            instance.SOPInstanceUID
          );
        };
      },

      series: {
        metadata: async ({
          StudyInstanceUID,
          filters = undefined,
          sortCriteria = undefined,
          sortFunction = undefined,
          madeInClient = false,
          returnPromises = false,
        } = {}) => {
          if (!StudyInstanceUID) {
            throw new Error('retrieve.series.metadata 需要 StudyInstanceUID');
          }

          const existingPromise = studyMetadataPromises.get(StudyInstanceUID);
          if (existingPromise) {
            return existingPromise;
          }

          const promise = _retrieveAllSeriesMetadata(
            StudyInstanceUID,
            madeInClient,
            returnPromises
          );
          studyMetadataPromises.set(StudyInstanceUID, promise);
          return promise;
        },
      },
    },

    deleteStudyMetadataPromise: StudyInstanceUID => {
      studyMetadataPromises.delete(StudyInstanceUID);
      for (const key of studyDataPromises.keys()) {
        if (key.endsWith(`|${StudyInstanceUID}`)) {
          studyDataPromises.delete(key);
        }
      }
    },

    getImageIdsForDisplaySet(displaySet) {
      const images = displaySet.images;
      const imageIds: string[] = [];
      if (!images) {
        return imageIds;
      }
      displaySet.images.forEach(instance => {
        const numberOfFrames = instance.NumberOfFrames || 1;
        if (numberOfFrames > 1) {
          for (let frame = 1; frame <= numberOfFrames; frame++) {
            imageIds.push(this.getImageIdsForInstance({ instance, frame }));
          }
        } else {
          imageIds.push(this.getImageIdsForInstance({ instance }));
        }
      });
      return imageIds;
    },

    getImageIdsForInstance({ instance, frame = undefined }) {
      const { StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID, Rows, Columns } = instance;
      return buildXunYingImageId(
        StudyInstanceUID,
        SeriesInstanceUID,
        SOPInstanceUID,
        frame,
        Rows,
        Columns
      );
    },

    getConfig() {
      return configCopy;
    },

    getStudyInstanceUIDs({ params, query }) {
      const safeParams = params || {};
      const safeQuery = query || new URLSearchParams();
      const paramsStudyInstanceUIDs = pickFirstDefined(
        ...STUDY_INSTANCE_UID_PARAM_KEYS.map(key => safeParams[key])
      );

      const queryStudyInstanceUIDs = utils.splitComma(
        STUDY_INSTANCE_UID_PARAM_KEYS.flatMap(key => safeQuery.getAll(key))
      );

      const StudyInstanceUIDs =
        (queryStudyInstanceUIDs.length && queryStudyInstanceUIDs) ||
        splitStudyInstanceUIDs(paramsStudyInstanceUIDs);

      return StudyInstanceUIDs.filter(Boolean);
    },
  };

  async function _retrieveAllSeriesMetadata(
    StudyInstanceUID: string,
    madeInClient: boolean,
    returnPromises: boolean
  ) {
    const studyData = await fetchStudyData(StudyInstanceUID);
    if (!studyData || !studyData.series || studyData.series.length === 0) {
      return [];
    }

    const seriesLoaders = studyData.series.map((seriesUID, index) => {
      let startPromise: Promise<any> | undefined;
      const loader: any = {
        StudyInstanceUID,
        SeriesInstanceUID: seriesUID,
        SeriesNumber: index + 1,
        Modality: studyData.modalities || 'OT',
        start: () => {
          if (!startPromise) {
            startPromise = _retrieveSeriesMetadata(
              StudyInstanceUID,
              seriesUID,
              studyData,
              madeInClient
            ).catch(error => {
              startPromise = undefined;
              throw error;
            });
          }
          return startPromise;
        },
      };
      return loader;
    });

    if (returnPromises) {
      return seriesLoaders;
    }

    const seriesSummaryMetadata = await Promise.all(seriesLoaders.map(loader => loader.start()));
    return seriesSummaryMetadata.filter(Boolean);
  }

  async function _retrieveSeriesMetadata(
    StudyInstanceUID: string,
    seriesUID: string,
    studyData: XunYingStudyData,
    madeInClient: boolean
  ) {
    const images = await fetchSeriesImages(StudyInstanceUID, seriesUID);
    if (!images || images.length === 0) {
      return;
    }

    const firstImage = images[0];
    const seriesModality = normalizeModality(studyData.modalities) || 'OT';
    const seriesNumber = parseInt(firstImage.series_no || firstImage.seriesno) || 1;

    const seriesMeta = {
      StudyInstanceUID,
      SeriesInstanceUID: seriesUID,
      SeriesDescription: firstImage.series_desc || '',
      SeriesNumber: seriesNumber,
      Modality: seriesModality,
      StudyDescription: firstImage.study_desc || studyData.name || '',
      SOPClassUID: undefined as string | undefined,
    };

    const naturalizedInstances = images.map((imageData, idx) => {
      const naturalized = mapInstanceToNaturalized(
        imageData,
        StudyInstanceUID,
        seriesUID,
        seriesModality,
        studyData,
        idx
      );

      if (!seriesMeta.SOPClassUID) {
        seriesMeta.SOPClassUID = naturalized.SOPClassUID;
      }

      const numberOfFrames = naturalized.NumberOfFrames || 1;
      for (let i = 0; i < numberOfFrames; i++) {
        const frameNumber = i + 1;
        const frameImageId = buildXunYingImageId(
          StudyInstanceUID,
          seriesUID,
          naturalized.SOPInstanceUID,
          numberOfFrames > 1 ? frameNumber : undefined,
          naturalized.Rows,
          naturalized.Columns
        );
        metadataProvider.addImageIdToUIDs(frameImageId, {
          StudyInstanceUID,
          SeriesInstanceUID: seriesUID,
          SOPInstanceUID: naturalized.SOPInstanceUID,
          frameNumber: numberOfFrames > 1 ? frameNumber : undefined,
        });
      }

      const imageId = buildXunYingImageId(
        StudyInstanceUID,
        seriesUID,
        naturalized.SOPInstanceUID,
        undefined,
        naturalized.Rows,
        naturalized.Columns
      );
      (naturalized as any).imageId = imageId;

      return naturalized;
    });

    DicomMetadataStore.addSeriesMetadata([seriesMeta], madeInClient);
    DicomMetadataStore.addInstances(naturalizedInstances, madeInClient);

    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    if (study) {
      study.isLoaded = true;
    }

    return seriesMeta;
  }

  const dataSource = IWebApiDataSource.create(implementation);

  // Keep the screening endpoint behind the data-source capability so the
  // viewer route remains independent of XunYing API details.
  (dataSource as any).getAIResults = async (studyUID: string) => {
    const cacheKey = getStudyDataCacheKey(studyUID);
    const existingPromise = aiResultPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const url = buildJsonUrl(getHttpConfig(), '/aiscreening', {
      studyuid: studyUID,
    });
    const promise = fetchJson<unknown>(getHttpConfig(), url).catch(error => {
      aiResultPromises.delete(cacheKey);
      throw error;
    });
    aiResultPromises.set(cacheKey, promise);
    return promise;
  };

  return dataSource;
}

export { createXunYingApi };
