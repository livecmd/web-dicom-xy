import { DicomMetadataStore, log, utils, Enums } from '@ohif/core';
import getStudies from './studiesList';
import isSeriesFilterUsed from '../../utils/isSeriesFilterUsed';

const { getSplitParam } = utils;

/**
 * Initialize the route.
 *
 * @param props.servicesManager to read services from
 * @param props.studyInstanceUIDs for a list of studies to read
 * @param props.dataSource to read the data from
 * @param props.filters filters from query params to read the data from
 * @returns array of subscriptions to cancel
 */
export async function defaultRouteInit(
  {
    servicesManager,
    commandsManager,
    studyInstanceUIDs,
    dataSource,
    filters,
  }: withAppTypes & { studyInstanceUIDs?: string[] },
  hangingProtocolId,
  stageIndex
) {
  const {
    displaySetService,
    hangingProtocolService,
    uiNotificationService,
    customizationService,
    viewportGridService,
  } = servicesManager.services;
  /**
   * Function to apply the hanging protocol when the minimum number of display sets were
   * received or all display sets retrieval were completed
   * @returns
   */
  function applyHangingProtocol() {
    const displaySets = displaySetService.getActiveDisplaySets();
    // The display sets are not necessarily in load order, even though the
    // series got started in load order, so re-sort them before hanging
    const sortCriteria = customizationService.getCustomization('sortingCriteria') as (
      a,
      b
    ) => number;

    if (!displaySets || !displaySets.length) {
      return;
    }
    const sortedDisplaySets = [...displaySets].sort(sortCriteria);

    // Gets the studies list to use
    const studies = getStudies(studyInstanceUIDs, sortedDisplaySets);

    // study being displayed, and is thus the "active" study.
    const activeStudy = studies[0];

    // run the hanging protocol matching on the displaySets with the predefined
    // hanging protocol in the mode configuration
    hangingProtocolService.run(
      { studies, activeStudy, displaySets: sortedDisplaySets },
      hangingProtocolId,
      {
        stageIndex,
      }
    );
  }

  const unsubscriptions = [];

  /** Keep AI screening optional so standard DICOMweb/local data sources remain unchanged. */
  function setupAINoduleDetections() {
    const aiDataSource = dataSource as any;
    const aiCommandsManager = commandsManager as any;
    const aiViewportGridService = viewportGridService as any;
    const aiNoduleService = (servicesManager.services as any).aiNoduleService;
    const aiCornerstoneViewportService = (servicesManager.services as any)
      .cornerstoneViewportService;
    if (
      typeof aiDataSource?.getAIResults !== 'function' ||
      !aiCommandsManager?.getCommand?.('displayAINoduleDetections')
    ) {
      return;
    }

    let disposed = false;
    let readySubscription;
    let displaySetSubscription;
    let gridStateSubscription;
    let viewportDataSubscription;

    const dispose = () => {
      disposed = true;
      readySubscription?.unsubscribe?.();
      displaySetSubscription?.unsubscribe?.();
      gridStateSubscription?.unsubscribe?.();
      viewportDataSubscription?.unsubscribe?.();
      aiCommandsManager.run?.('clearAINoduleDetections');
      aiNoduleService?.clear?.();
    };
    unsubscriptions.push(dispose);

    studyInstanceUIDs.forEach(studyInstanceUID =>
      aiNoduleService?.setStudyLoading?.(studyInstanceUID, true)
    );

    Promise.all(
      studyInstanceUIDs.map(async studyInstanceUID => {
        try {
          const detections = await aiDataSource.getAIResults(studyInstanceUID);
          if (!disposed) {
            aiNoduleService?.setStudyResults?.(studyInstanceUID, detections);
          }
          return { studyInstanceUID, detections };
        } catch (error) {
          if (!disposed) {
            aiNoduleService?.setStudyError?.(studyInstanceUID, error);
          }
          console.warn(`Failed to load AI nodule detections for ${studyInstanceUID}:`, error);
          return null;
        }
      })
    ).then(results => {
      if (disposed) {
        return;
      }

      const successfulResults = results.filter(Boolean) as Array<{
        studyInstanceUID: string;
        detections: unknown;
      }>;
      if (!successfulResults.length) {
        return;
      }

      const apply = () => {
        if (disposed) {
          return;
        }

        const outcomes = successfulResults.map(({ studyInstanceUID, detections }) =>
          aiCommandsManager.run('displayAINoduleDetections', {
            detections,
            studyInstanceUID,
          })
        );

        const complete = outcomes.every(
          (outcome: any) => !outcome || outcome.total === 0 || outcome.applied === outcome.total
        );
        if (complete) {
          readySubscription?.unsubscribe?.();
          displaySetSubscription?.unsubscribe?.();
          gridStateSubscription?.unsubscribe?.();
          viewportDataSubscription?.unsubscribe?.();
        }
      };

      readySubscription = aiViewportGridService?.subscribe?.(
        aiViewportGridService.EVENTS.VIEWPORTS_READY,
        apply
      );
      displaySetSubscription = displaySetService?.subscribe?.(
        displaySetService.EVENTS.DISPLAY_SETS_ADDED,
        apply
      );
      gridStateSubscription = aiViewportGridService?.subscribe?.(
        aiViewportGridService.EVENTS.GRID_STATE_CHANGED,
        apply
      );
      viewportDataSubscription = aiCornerstoneViewportService?.subscribe?.(
        aiCornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
        apply
      );
      // The ready event may already have fired before the async AI request
      // completed, so always attempt once immediately as well.
      apply();
    });
  }

  const issuedWarningSeries = [];
  const { unsubscribe: instanceAddedUnsubscribe } = DicomMetadataStore.subscribe(
    DicomMetadataStore.EVENTS.INSTANCES_ADDED,
    function ({ StudyInstanceUID, SeriesInstanceUID, madeInClient = false }) {
      const seriesMetadata = DicomMetadataStore.getSeries(StudyInstanceUID, SeriesInstanceUID);

      // checks if the series filter was used, if it exists
      const seriesInstanceUIDs = filters?.seriesInstanceUID;
      if (
        seriesInstanceUIDs?.length &&
        !isSeriesFilterUsed(seriesMetadata.instances, filters) &&
        !issuedWarningSeries.includes(seriesInstanceUIDs[0])
      ) {
        // stores the series instance filter so it shows only once the warning
        issuedWarningSeries.push(seriesInstanceUIDs[0]);
        uiNotificationService.show({
          title: 'Series filter',
          message: `Each of the series in filter: ${seriesInstanceUIDs} are not part of the current study. The entire study is being displayed`,
          type: 'error',
          duration: 7000,
        });
      }

      displaySetService.makeDisplaySets(seriesMetadata.instances, { madeInClient });
    }
  );

  unsubscriptions.push(instanceAddedUnsubscribe);

  log.time(Enums.TimingEnum.STUDY_TO_DISPLAY_SETS);
  log.time(Enums.TimingEnum.STUDY_TO_FIRST_IMAGE);

  const allRetrieves = studyInstanceUIDs.map(StudyInstanceUID =>
    dataSource.retrieve.series.metadata({
      StudyInstanceUID,
      filters,
      returnPromises: true,
      sortCriteria: customizationService.getCustomization('sortingCriteria'),
    })
  );

  // log the error if this fails, otherwise it's so difficult to tell what went wrong...
  allRetrieves.forEach(retrieve => {
    retrieve.catch(error => {
      console.error(error);
    });
  });

  // is displaysets from URL and has initialSOPInstanceUID or initialSeriesInstanceUID
  // then we need to wait for all display sets to be retrieved before applying the hanging protocol
  const params = new URLSearchParams(window.location.search);

  const initialSeriesInstanceUID = getSplitParam('initialseriesinstanceuid', params);
  const initialSOPInstanceUID = getSplitParam('initialsopinstanceuid', params);

  let displaySetFromUrl = false;
  if (initialSeriesInstanceUID || initialSOPInstanceUID) {
    displaySetFromUrl = true;
  }

  await Promise.allSettled(allRetrieves).then(async promises => {
    log.timeEnd(Enums.TimingEnum.STUDY_TO_DISPLAY_SETS);
    log.time(Enums.TimingEnum.DISPLAY_SETS_TO_FIRST_IMAGE);
    log.time(Enums.TimingEnum.DISPLAY_SETS_TO_ALL_IMAGES);

    const allPromises = [];
    const remainingPromises = [];

    function startRemainingPromises(remainingPromises) {
      remainingPromises.forEach(p => p.forEach(p => p.start()));
    }

    promises.forEach(promise => {
      const retrieveSeriesMetadataPromise = promise.value;
      if (!Array.isArray(retrieveSeriesMetadataPromise)) {
        return;
      }

      if (displaySetFromUrl) {
        const requiredSeriesPromises = retrieveSeriesMetadataPromise.map(promise =>
          promise.start()
        );
        allPromises.push(Promise.allSettled(requiredSeriesPromises));
      } else {
        const { requiredSeries, remaining } = hangingProtocolService.filterSeriesRequiredForRun(
          hangingProtocolId,
          retrieveSeriesMetadataPromise
        );
        const requiredSeriesPromises = requiredSeries.map(promise => promise.start());
        allPromises.push(Promise.allSettled(requiredSeriesPromises));
        remainingPromises.push(remaining);
      }
    });

    await Promise.allSettled(allPromises).then(applyHangingProtocol);
    startRemainingPromises(remainingPromises);
    applyHangingProtocol();
    setupAINoduleDetections();
  });

  return unsubscriptions;
}
