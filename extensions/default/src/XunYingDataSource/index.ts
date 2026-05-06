import { DicomMetadataStore, IWebApiDataSource, utils, classes } from '@ohif/core';
import {
  fetchJson,
  buildJsonUrl,
  buildThumbnailUrl,
  XunYingHttpConfig,
} from './utils/httpClient';
import {
  mapInstanceToNaturalized,
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

function createXunYingApi(xunyingConfig: XunYingDataSourceConfig, servicesManager) {
  let configCopy: XunYingDataSourceConfig;
  let httpConfig: XunYingHttpConfig;

  const studyMetadataPromises = new Map<string, Promise<any>>();

  function getHttpConfig(): XunYingHttpConfig {
    return httpConfig;
  }

  async function fetchStudyData(studyUID: string): Promise<XunYingStudyData> {
    const url = buildJsonUrl(getHttpConfig(), '/study', {
      level: 'study',
      studyuid: studyUID,
      ai: 1,
    });
    return fetchJson<XunYingStudyData>(getHttpConfig(), url);
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
      if (
        xunyingConfig.onConfiguration &&
        typeof xunyingConfig.onConfiguration === 'function'
      ) {
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
        mapParams: (params) => params,
        search: async function (origParams) {
          return [];
        },
        processResults: (results) => results,
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
            Modality: studyData.modalities || '',
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
      directURL: (params) => {
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

    deleteStudyMetadataPromise: (StudyInstanceUID) => {
      studyMetadataPromises.delete(StudyInstanceUID);
    },

    getImageIdsForDisplaySet(displaySet) {
      const images = displaySet.images;
      const imageIds: string[] = [];
      if (!images) {
        return imageIds;
      }
      displaySet.images.forEach((instance) => {
        const numberOfFrames = instance.NumberOfFrames || 1;
        if (numberOfFrames > 1) {
          for (let frame = 1; frame <= numberOfFrames; frame++) {
            imageIds.push(
              this.getImageIdsForInstance({ instance, frame })
            );
          }
        } else {
          imageIds.push(this.getImageIdsForInstance({ instance }));
        }
      });
      return imageIds;
    },

    getImageIdsForInstance({ instance, frame = undefined }) {
      const { StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID } = instance;
      return buildXunYingImageId(StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID, frame);
    },

    getConfig() {
      return configCopy;
    },

    getStudyInstanceUIDs({ params, query }) {
      const paramsStudyInstanceUIDs =
        params.StudyInstanceUIDs || params.studyInstanceUIDs;

      const queryStudyInstanceUIDs = utils.splitComma(
        query.getAll('StudyInstanceUIDs').concat(query.getAll('studyInstanceUIDs'))
      );

      const StudyInstanceUIDs =
        (queryStudyInstanceUIDs.length && queryStudyInstanceUIDs) || paramsStudyInstanceUIDs;

      return StudyInstanceUIDs && Array.isArray(StudyInstanceUIDs)
        ? StudyInstanceUIDs
        : [StudyInstanceUIDs];
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

    const modality = studyData.modalities || '';
    const seriesSummaryMetadata: any[] = [];
    const allSeriesPromises: Promise<void>[] = [];

    for (const seriesUID of studyData.series) {
      const seriesPromise = fetchSeriesImages(StudyInstanceUID, seriesUID).then(
        (images) => {
          if (!images || images.length === 0) {
            return;
          }

          const firstImage = images[0];
          const seriesModality = modality || 'OT';
          const seriesNumber =
            parseInt(firstImage.series_no || firstImage.seriesno) || 1;

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
                numberOfFrames > 1 ? frameNumber : undefined
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
              naturalized.SOPInstanceUID
            );
            (naturalized as any).imageId = imageId;

            return naturalized;
          });

          seriesSummaryMetadata.push(seriesMeta);
          DicomMetadataStore.addInstances(naturalizedInstances, madeInClient);
        }
      );
      allSeriesPromises.push(seriesPromise);
    }

    DicomMetadataStore.addSeriesMetadata(seriesSummaryMetadata, madeInClient);

    await Promise.all(allSeriesPromises);

    const study = DicomMetadataStore.getStudy(StudyInstanceUID);
    if (study) {
      study.isLoaded = true;
    }

    return seriesSummaryMetadata;
  }

  return IWebApiDataSource.create(implementation);
}

export { createXunYingApi };
