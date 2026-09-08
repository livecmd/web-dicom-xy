import { PubSubService } from '@ohif/core';
import {
  AINodule,
  getNoduleSeriesUID,
  parseAINoduleResults,
} from '../../utils/aiNoduleAnnotations';

export type AINoduleRecord = {
  recordUID: string;
  id: string;
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  nodule: AINodule;
  isSelected: boolean;
};

export type AINoduleState = {
  records: AINoduleRecord[];
  loadingStudyInstanceUIDs: string[];
  errors: Record<string, string>;
};

class AINoduleService extends PubSubService {
  public static readonly EVENTS = {
    STATE_CHANGED: 'event::aiNoduleStateChanged',
  };

  public static REGISTRATION = {
    name: 'aiNoduleService',
    altName: 'AINoduleService',
    create: () => new AINoduleService(),
  };

  private records: AINoduleRecord[] = [];
  private loadingStudyInstanceUIDs = new Set<string>();
  private errors: Record<string, string> = {};

  constructor() {
    super(AINoduleService.EVENTS);
  }

  public getState(): AINoduleState {
    return {
      records: [...this.records],
      loadingStudyInstanceUIDs: [...this.loadingStudyInstanceUIDs],
      errors: { ...this.errors },
    };
  }

  public setStudyLoading(studyInstanceUID: string, isLoading: boolean): void {
    if (!studyInstanceUID) {
      return;
    }

    if (isLoading) {
      this.loadingStudyInstanceUIDs.add(studyInstanceUID);
      delete this.errors[studyInstanceUID];
    } else {
      this.loadingStudyInstanceUIDs.delete(studyInstanceUID);
    }
    this.publishState();
  }

  public setStudyResults(studyInstanceUID: string, detections: unknown): AINoduleRecord[] {
    const previousByUID = new Map(this.records.map(record => [record.recordUID, record] as const));
    const nextStudyRecords = parseAINoduleResults(detections).map(({ id, nodule }, index) => {
      const seriesInstanceUID = getNoduleSeriesUID(nodule);
      const recordUID = [studyInstanceUID, seriesInstanceUID || 'unknown-series', id || index].join(
        '::'
      );
      const previous = previousByUID.get(recordUID);
      const explicitSelection = nodule.checked ?? nodule.selected;

      return {
        recordUID,
        id: id || `nodule_${index + 1}`,
        studyInstanceUID,
        seriesInstanceUID,
        nodule,
        isSelected: previous?.isSelected ?? Boolean(explicitSelection),
      };
    });

    this.records = [
      ...this.records.filter(record => record.studyInstanceUID !== studyInstanceUID),
      ...nextStudyRecords,
    ];
    this.loadingStudyInstanceUIDs.delete(studyInstanceUID);
    delete this.errors[studyInstanceUID];
    this.publishState();
    return nextStudyRecords;
  }

  public setStudyError(studyInstanceUID: string, error: unknown): void {
    this.loadingStudyInstanceUIDs.delete(studyInstanceUID);
    this.errors[studyInstanceUID] = error instanceof Error ? error.message : String(error);
    this.publishState();
  }

  public setSelected(recordUID: string, isSelected: boolean): void {
    this.setSelectedMany([recordUID], isSelected);
  }

  public setSelectedMany(recordUIDs: string[], isSelected: boolean): void {
    const targetUIDs = new Set(recordUIDs);
    let changed = false;

    this.records = this.records.map(record => {
      if (!targetUIDs.has(record.recordUID) || record.isSelected === isSelected) {
        return record;
      }
      changed = true;
      return { ...record, isSelected };
    });

    if (changed) {
      this.publishState();
    }
  }

  public updateNodule(recordUID: string, patch: Partial<AINodule>): void {
    let changed = false;
    this.records = this.records.map(record => {
      if (record.recordUID !== recordUID) {
        return record;
      }
      changed = true;
      return {
        ...record,
        nodule: { ...record.nodule, ...patch },
      };
    });

    if (changed) {
      this.publishState();
    }
  }

  public clear(): void {
    this.records = [];
    this.loadingStudyInstanceUIDs.clear();
    this.errors = {};
    this.publishState();
  }

  private publishState(): void {
    this._broadcastEvent(this.EVENTS.STATE_CHANGED, this.getState());
  }
}

export default AINoduleService;
