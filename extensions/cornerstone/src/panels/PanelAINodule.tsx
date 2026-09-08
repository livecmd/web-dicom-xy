import React, { useEffect, useMemo, useState } from 'react';
import { useSystem } from '@ohif/core';
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@ohif/ui-next';
import { ChevronDown } from 'lucide-react';
import type { AINoduleState } from '../services/AINoduleService';
import {
  AI_NODULE_DIAMETER_OPTIONS,
  AI_NODULE_EDIT_TYPE_OPTIONS,
  AI_NODULE_LOCATION_OPTIONS,
  AI_NODULE_RISK_OPTIONS,
  AI_NODULE_SORT_OPTIONS,
  AI_NODULE_TYPE_OPTIONS,
  AINoduleFilters,
  AINoduleListItem,
  AINoduleSort,
  matchesAINoduleFilters,
  sortAINoduleItems,
  toAINoduleListItem,
} from '../utils/aiNodulePresentation';

const SORT_STORAGE_KEY = 'ris_h5_ai_screening_sort';
const FILTER_STORAGE_KEY = 'ris_h5_ai_screening_filter';
const PREVIOUS_STORAGE_KEY = 'ohif_ai_nodule_panel_preferences_v1';

const EMPTY_STATE: AINoduleState = {
  records: [],
  loadingStudyInstanceUIDs: [],
  errors: {},
};

type DiameterFilterState = {
  all: boolean;
  ranges: string[];
  custom: boolean;
  min: string;
  max: string;
};

type PanelFilters = {
  risks: string[];
  types: string[];
  diameter: DiameterFilterState;
  shortDiameter: DiameterFilterState;
};

type Option = { readonly value: string; readonly label: string };

const ALL_DIAMETER_RANGES = AI_NODULE_DIAMETER_OPTIONS.map(option => option.value);

function createDefaultDiameterFilter(): DiameterFilterState {
  return {
    all: true,
    ranges: [...ALL_DIAMETER_RANGES],
    custom: false,
    min: '',
    max: '',
  };
}

function createDefaultPanelFilters(): PanelFilters {
  return {
    risks: [],
    types: [],
    diameter: createDefaultDiameterFilter(),
    shortDiameter: createDefaultDiameterFilter(),
  };
}

function clonePanelFilters(filters: PanelFilters): PanelFilters {
  return {
    risks: [...filters.risks],
    types: [...filters.types],
    diameter: { ...filters.diameter, ranges: [...filters.diameter.ranges] },
    shortDiameter: {
      ...filters.shortDiameter,
      ranges: [...filters.shortDiameter.ranges],
    },
  };
}

function readStorage(key: string): any {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  } catch (_error) {
    return undefined;
  }
}

function readOptionGroup(source: any, options: readonly Option[]): string[] {
  if (!source || source.all !== false) {
    return [];
  }
  return options.filter(option => source[option.value]).map(option => option.value);
}

function readDiameterGroup(source: any): DiameterFilterState {
  if (!source) {
    return createDefaultDiameterFilter();
  }
  const custom = Boolean(source.custom);
  const all = source.all !== false && !custom;
  return {
    all,
    ranges: all ? [...ALL_DIAMETER_RANGES] : ALL_DIAMETER_RANGES.filter(value => source[value]),
    custom,
    min: custom ? String(source.min ?? '') : '',
    max: custom ? String(source.max ?? '') : '',
  };
}

function readCurrentDiameterGroup(
  ranges: unknown,
  min: unknown,
  max: unknown
): DiameterFilterState {
  const selectedRanges = Array.isArray(ranges) ? ranges.map(String) : [];
  const minText = String(min ?? '');
  const maxText = String(max ?? '');
  const custom = Boolean(minText || maxText);
  const all = !selectedRanges.length && !custom;
  return {
    all,
    ranges: all ? [...ALL_DIAMETER_RANGES] : selectedRanges,
    custom,
    min: minText,
    max: maxText,
  };
}

function readPreferences(): { sort: AINoduleSort; filters: PanelFilters } {
  const previous = readStorage(PREVIOUS_STORAGE_KEY);
  const storedSort = readStorage(SORT_STORAGE_KEY) ?? previous?.sort;
  const sort = AI_NODULE_SORT_OPTIONS.some(option => option.value === storedSort)
    ? (storedSort as AINoduleSort)
    : ('im' as AINoduleSort);
  const storedFilters = readStorage(FILTER_STORAGE_KEY) ?? previous?.filters;

  if (!storedFilters) {
    return { sort, filters: createDefaultPanelFilters() };
  }

  if (storedFilters.risk || storedFilters.type) {
    return {
      sort,
      filters: {
        risks: readOptionGroup(storedFilters.risk, AI_NODULE_RISK_OPTIONS),
        types: readOptionGroup(storedFilters.type, AI_NODULE_TYPE_OPTIONS),
        diameter: readDiameterGroup(storedFilters.diameter),
        shortDiameter: readDiameterGroup(storedFilters.shortDiameter),
      },
    };
  }

  return {
    sort,
    filters: {
      risks: Array.isArray(storedFilters.risks) ? storedFilters.risks.map(String) : [],
      types: Array.isArray(storedFilters.types) ? storedFilters.types.map(String) : [],
      diameter: readCurrentDiameterGroup(
        storedFilters.diameterRanges,
        storedFilters.diameterMin,
        storedFilters.diameterMax
      ),
      shortDiameter: readCurrentDiameterGroup(
        storedFilters.shortDiameterRanges,
        storedFilters.shortDiameterMin,
        storedFilters.shortDiameterMax
      ),
    },
  };
}

function serializeOptionGroup(selected: string[], options: readonly Option[]) {
  return options.reduce(
    (result, option) => {
      result[option.value] = selected.includes(option.value);
      return result;
    },
    { all: !selected.length } as Record<string, boolean>
  );
}

function serializeDiameterGroup(group: DiameterFilterState) {
  return ALL_DIAMETER_RANGES.reduce(
    (result, value) => {
      result[value] = group.ranges.includes(value);
      return result;
    },
    {
      all: group.all,
      custom: group.custom,
      min: group.min,
      max: group.max,
    } as Record<string, boolean | string>
  );
}

function savePreferences(sort: AINoduleSort, filters: PanelFilters): void {
  try {
    window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(sort));
    window.localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({
        risk: serializeOptionGroup(filters.risks, AI_NODULE_RISK_OPTIONS),
        type: serializeOptionGroup(filters.types, AI_NODULE_TYPE_OPTIONS),
        diameter: serializeDiameterGroup(filters.diameter),
        shortDiameter: serializeDiameterGroup(filters.shortDiameter),
      })
    );
  } catch (_error) {
    // Storage can be unavailable in embedded/private browser contexts.
  }
}

function toAppliedFilters(filters: PanelFilters): AINoduleFilters {
  return {
    risks: filters.risks,
    types: filters.types,
    diameterRanges: filters.diameter.all || filters.diameter.custom ? [] : filters.diameter.ranges,
    shortDiameterRanges:
      filters.shortDiameter.all || filters.shortDiameter.custom ? [] : filters.shortDiameter.ranges,
    diameterMin: filters.diameter.custom ? filters.diameter.min : '',
    diameterMax: filters.diameter.custom ? filters.diameter.max : '',
    shortDiameterMin: filters.shortDiameter.custom ? filters.shortDiameter.min : '',
    shortDiameterMax: filters.shortDiameter.custom ? filters.shortDiameter.max : '',
  };
}

function matchesPanelFilters(item: AINoduleListItem, filters: PanelFilters): boolean {
  if (!filters.diameter.all && !filters.diameter.custom && !filters.diameter.ranges.length) {
    return false;
  }
  if (
    !filters.shortDiameter.all &&
    !filters.shortDiameter.custom &&
    !filters.shortDiameter.ranges.length
  ) {
    return false;
  }
  return matchesAINoduleFilters(item, toAppliedFilters(filters));
}

function countPanelFilters(filters: PanelFilters): number {
  return (
    filters.risks.length +
    filters.types.length +
    (filters.diameter.all ? 0 : filters.diameter.ranges.length + Number(filters.diameter.custom)) +
    (filters.shortDiameter.all
      ? 0
      : filters.shortDiameter.ranges.length + Number(filters.shortDiameter.custom))
  );
}

function OptionGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: readonly Option[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string, checked: boolean) => {
    const next = checked
      ? [...new Set([...selected, value])]
      : selected.filter(item => item !== value);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[#e4eef9]">{title}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#e4eef9]">
          <Checkbox
            checked={!selected.length}
            onCheckedChange={checked => checked === true && onChange([])}
          />
          <span>全部</span>
        </label>
        {options.map(option => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-1.5 text-xs text-[#e4eef9]"
          >
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={checked => toggle(option.value, checked === true)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DiameterFilter({
  title,
  value,
  onChange,
}: {
  title: string;
  value: DiameterFilterState;
  onChange: (value: DiameterFilterState) => void;
}) {
  const checkedRangeCount = ALL_DIAMETER_RANGES.filter(range =>
    value.ranges.includes(range)
  ).length;
  const rangeActive = !value.custom && (value.all || checkedRangeCount > 0);

  const toggleAll = (checked: boolean) => {
    onChange({
      all: checked,
      ranges: checked ? [...ALL_DIAMETER_RANGES] : [],
      custom: false,
      min: '',
      max: '',
    });
  };

  const toggleRange = (range: string, checked: boolean) => {
    const ranges = checked
      ? [...new Set([...value.ranges, range])]
      : value.ranges.filter(item => item !== range);
    onChange({
      all: ranges.length === ALL_DIAMETER_RANGES.length,
      ranges,
      custom: false,
      min: '',
      max: '',
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-[#e4eef9]">{title}</div>
      <div
        className={`flex items-center gap-2 whitespace-nowrap ${value.custom ? 'opacity-[0.45]' : ''}`}
      >
        <label className="flex cursor-pointer items-center gap-1 text-xs text-[#e4eef9]">
          <Checkbox
            checked={
              !value.custom &&
              checkedRangeCount > 0 &&
              checkedRangeCount < ALL_DIAMETER_RANGES.length
                ? 'indeterminate'
                : value.all
            }
            onCheckedChange={checked => toggleAll(checked === true)}
          />
          <span>全部</span>
        </label>
        {AI_NODULE_DIAMETER_OPTIONS.map(option => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-1 text-xs text-[#e4eef9]"
          >
            <Checkbox
              checked={value.ranges.includes(option.value)}
              onCheckedChange={checked => toggleRange(option.value, checked === true)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <div className={`flex items-center gap-1.5 ${rangeActive ? 'opacity-[0.45]' : ''}`}>
        <Checkbox
          aria-label={`${title}自定义范围`}
          checked={value.custom}
          onCheckedChange={checked => {
            const custom = checked === true;
            onChange({
              all: false,
              ranges: custom ? [] : value.ranges,
              custom,
              min: custom ? value.min : '',
              max: custom ? value.max : '',
            });
          }}
        />
        <Input
          aria-label={`${title}最小值`}
          className="h-7 min-w-0 flex-1 border-[#33475b] bg-[#1b2632] text-xs"
          disabled={!value.custom}
          min="0"
          placeholder="最小值"
          step="0.1"
          type="number"
          value={value.min}
          onChange={event => onChange({ ...value, min: event.target.value })}
        />
        <span className="text-xs text-[#c9d8e8]">-</span>
        <Input
          aria-label={`${title}最大值`}
          className="h-7 min-w-0 flex-1 border-[#33475b] bg-[#1b2632] text-xs"
          disabled={!value.custom}
          min="0"
          placeholder="最大值"
          step="0.1"
          type="number"
          value={value.max}
          onChange={event => onChange({ ...value, max: event.target.value })}
        />
        <span className="shrink-0 text-xs text-[#c9d8e8]">mm</span>
      </div>
    </div>
  );
}

function InlineLocationMenu({
  item,
  onChange,
}: {
  item: AINoduleListItem;
  onChange: (lobe: string, segment: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-full min-w-0 items-center text-left font-semibold text-[#e4eef9] outline-none"
          title={item.location || '--'}
        >
          <span className="min-w-0 truncate">{item.location || '--'}</span>
          <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 text-[#96adc4]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-32 border-[#3a4a5d] bg-[#202c38]"
      >
        {AI_NODULE_LOCATION_OPTIONS.map(location => (
          <DropdownMenuSub key={location.value}>
            <DropdownMenuSubTrigger
              className={item.lobe === location.value ? 'bg-[#2f5f9f] text-white' : ''}
            >
              {location.label}
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="border-[#3a4a5d] bg-[#202c38]">
                {location.children.map(segment => (
                  <DropdownMenuItem
                    key={segment}
                    className={
                      item.lobe === location.value && item.segment === segment
                        ? 'bg-[#2f5f9f] text-white'
                        : ''
                    }
                    onSelect={() => onChange(location.value, segment)}
                  >
                    {segment}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InlineTypeMenu({
  item,
  onChange,
}: {
  item: AINoduleListItem;
  onChange: (label: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-6 w-full min-w-0 items-center text-left font-semibold text-[#e4eef9] outline-none"
          title={item.type || '--'}
        >
          <span className="min-w-0 truncate">{item.type || '--'}</span>
          <ChevronDown className="ml-0.5 h-3 w-3 shrink-0 text-[#96adc4]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-32 border-[#3a4a5d] bg-[#202c38]"
      >
        {AI_NODULE_EDIT_TYPE_OPTIONS.map(option => (
          <DropdownMenuItem
            key={option.value}
            className={item.type === option.label ? 'bg-[#2f5f9f] text-white' : ''}
            onSelect={() => onChange(option.label)}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoduleRow({
  item,
  onToggle,
  onLocationChange,
  onTypeChange,
}: {
  item: AINoduleListItem;
  onToggle: (item: AINoduleListItem, checked: boolean) => void;
  onLocationChange: (item: AINoduleListItem, lobe: string, segment: string) => void;
  onTypeChange: (item: AINoduleListItem, label: string) => void;
}) {
  const riskClass =
    item.riskValue === 'high'
      ? 'text-[#f17878]'
      : item.riskValue === 'medium'
        ? 'text-[#e9c15f]'
        : 'text-[#58abe9]';

  return (
    <div
      className={`mb-1 rounded border px-2 py-2 text-xs text-[#e4eef9] transition-colors ${
        item.isSelected
          ? 'border-[#4d82bd] bg-[#2f5f9f]'
          : 'border-[#2b3a49] bg-[#202c38] hover:border-[#40566c]'
      }`}
      data-testid={`ai-nodule-${item.recordUID}`}
    >
      <div className="grid grid-cols-[34px_50px_minmax(74px,1fr)_minmax(64px,.7fr)] items-center gap-x-2 font-semibold">
        <div className="flex min-w-0 items-center gap-1">
          <Checkbox
            aria-label={`选择结节 ${item.orderNumber}`}
            checked={item.isSelected}
            className="h-3.5 w-3.5"
            onCheckedChange={checked => onToggle(item, checked === true)}
          />
          <span>{item.orderNumber}</span>
        </div>
        <div className="whitespace-nowrap">IM {item.imageNumber ?? '--'}</div>
        <InlineLocationMenu
          item={item}
          onChange={(lobe, segment) => onLocationChange(item, lobe, segment)}
        />
        <InlineTypeMenu
          item={item}
          onChange={label => onTypeChange(item, label)}
        />
      </div>
      <div className="mt-2 grid grid-cols-[34px_50px_minmax(74px,1fr)_minmax(64px,.7fr)] items-center gap-x-2 text-[#c9d8e8]">
        <div
          className={`truncate font-semibold ${riskClass}`}
          title={item.risk || '--'}
        >
          {item.risk || '--'}
        </div>
        <div
          className="truncate"
          title={item.volumeText || '--'}
        >
          {item.volumeText || '--'}
        </div>
        <div
          className="truncate"
          title={item.diameterText || '--'}
        >
          {item.diameterText || '--'}
        </div>
        <div
          className="truncate"
          title={item.ctText || '--'}
        >
          {item.ctText || '--'}
        </div>
      </div>
    </div>
  );
}

export default function PanelAINodule() {
  const { servicesManager, commandsManager } = useSystem();
  const { aiNoduleService, displaySetService, uiNotificationService } = servicesManager.services;
  const preferences = useMemo(readPreferences, []);
  const [state, setState] = useState<AINoduleState>(
    () => aiNoduleService?.getState() || EMPTY_STATE
  );
  const [sort, setSort] = useState<AINoduleSort>(preferences.sort);
  const [filters, setFilters] = useState<PanelFilters>(preferences.filters);
  const [draftFilters, setDraftFilters] = useState<PanelFilters>(
    clonePanelFilters(preferences.filters)
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeSeriesUID, setActiveSeriesUID] = useState('');

  useEffect(() => {
    if (!aiNoduleService) {
      return;
    }
    setState(aiNoduleService.getState());
    const subscription = aiNoduleService.subscribe(
      aiNoduleService.EVENTS.STATE_CHANGED,
      (nextState: AINoduleState) => setState(nextState)
    );
    return () => subscription.unsubscribe();
  }, [aiNoduleService]);

  useEffect(() => {
    savePreferences(sort, filters);
  }, [filters, sort]);

  const displaySets = displaySetService?.getActiveDisplaySets?.() || [];
  const items = useMemo(
    () => state.records.map((record, index) => toAINoduleListItem(record, index)),
    [state.records]
  );
  const series = useMemo(() => {
    const byUID = new Map<string, string>();
    items.forEach(item => {
      const uid = item.seriesInstanceUID || 'unknown-series';
      if (byUID.has(uid)) {
        return;
      }
      const displaySet = displaySets.find(candidate => candidate.SeriesInstanceUID === uid);
      byUID.set(
        uid,
        displaySet?.SeriesDescription ||
          (displaySet?.SeriesNumber ? `序列 ${displaySet.SeriesNumber}` : '') ||
          (uid === 'unknown-series' ? '未知序列' : `序列 ${byUID.size + 1}`)
      );
    });
    return [...byUID].map(([uid, label]) => ({ uid, label }));
  }, [displaySets, items]);

  useEffect(() => {
    if (!series.length) {
      setActiveSeriesUID('');
    } else if (!series.some(item => item.uid === activeSeriesUID)) {
      setActiveSeriesUID(series[0].uid);
    }
  }, [activeSeriesUID, series]);

  const filteredItems = useMemo(
    () => items.filter(item => matchesPanelFilters(item, filters)),
    [filters, items]
  );
  const visibleItems = useMemo(
    () =>
      sortAINoduleItems(
        filteredItems.filter(
          item =>
            !activeSeriesUID || (item.seriesInstanceUID || 'unknown-series') === activeSeriesUID
        ),
        sort
      ),
    [activeSeriesUID, filteredItems, sort]
  );
  const selectedCount = filteredItems.filter(item => item.isSelected).length;
  const allSelected = filteredItems.length > 0 && selectedCount === filteredItems.length;
  const partiallySelected = selectedCount > 0 && !allSelected;
  const activeFilterCount = countPanelFilters(filters);
  const sortLabel = AI_NODULE_SORT_OPTIONS.find(option => option.value === sort)?.label || '按IM';

  const handleToggle = (item: AINoduleListItem, checked: boolean) => {
    aiNoduleService?.setSelected(item.recordUID, checked);
    if (!checked) {
      return;
    }
    commandsManager
      .runAsync('navigateToAINodule', { record: item })
      .then(success => {
        if (success === false) {
          uiNotificationService?.show({
            title: '结节定位',
            message: '未找到该结节对应的序列或图像',
            type: 'warning',
            duration: 3000,
          });
        }
      })
      .catch(error => {
        console.warn('Failed to navigate to AI nodule:', error);
        uiNotificationService?.show({
          title: '结节定位',
          message: '结节图像定位失败',
          type: 'warning',
          duration: 3000,
        });
      });
  };

  if (!aiNoduleService) {
    return <div className="p-4 text-sm text-[#98aabe]">AI 结节服务未启用</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col border border-[#263646] bg-[#18232f] px-1.5 pb-2 pt-2">
      <div className="mb-1.5 shrink-0 px-1.5 text-base font-bold text-white">AI筛查结论</div>

      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 px-1.5 text-xs text-[#dce9f6]">
        <label className="flex min-w-0 cursor-pointer items-center gap-1.5">
          <Checkbox
            checked={partiallySelected ? 'indeterminate' : allSelected}
            disabled={!filteredItems.length}
            onCheckedChange={checked =>
              aiNoduleService.setSelectedMany(
                filteredItems.map(item => item.recordUID),
                checked === true
              )
            }
          />
          <span className="truncate">
            全选（{selectedCount}/{filteredItems.length}）
          </span>
        </label>

        <div className="flex shrink-0 items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-7 border-[#33475b] bg-[#202d3a] px-2 text-xs text-[#dce9f6]"
              >
                {sortLabel}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-[#33475b] bg-[#202c38]"
            >
              {AI_NODULE_SORT_OPTIONS.map(option => (
                <DropdownMenuItem
                  key={option.value}
                  className={sort === option.value ? 'bg-[#2f5f9f] text-white' : ''}
                  onSelect={() => setSort(option.value)}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover
            open={filterOpen}
            onOpenChange={open => {
              setFilterOpen(open);
              if (open) {
                setDraftFilters(clonePanelFilters(filters));
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-7 border-[#33475b] bg-[#202d3a] px-2 text-xs text-[#dce9f6]"
              >
                筛选
                {activeFilterCount > 0 && (
                  <span className="min-w-4 ml-1 inline-flex h-4 items-center justify-center rounded-full bg-[#2f72c7] px-1 text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[380px] space-y-3.5 border-[#33475b] bg-[#202c38] p-4 text-[#e4eef9]"
            >
              <OptionGroup
                title="良恶性"
                options={AI_NODULE_RISK_OPTIONS}
                selected={draftFilters.risks}
                onChange={risks => setDraftFilters(current => ({ ...current, risks }))}
              />
              <OptionGroup
                title="类型"
                options={AI_NODULE_TYPE_OPTIONS}
                selected={draftFilters.types}
                onChange={types => setDraftFilters(current => ({ ...current, types }))}
              />
              <DiameterFilter
                title="长径"
                value={draftFilters.diameter}
                onChange={diameter => setDraftFilters(current => ({ ...current, diameter }))}
              />
              <DiameterFilter
                title="短径"
                value={draftFilters.shortDiameter}
                onChange={shortDiameter =>
                  setDraftFilters(current => ({ ...current, shortDiameter }))
                }
              />
              <div className="flex justify-end gap-2 border-t border-[#33475b] pt-3">
                <Button
                  variant="outline"
                  className="h-7 border-[#33475b] bg-[#202d3a] text-xs text-[#dce9f6]"
                  onClick={() => {
                    const defaults = createDefaultPanelFilters();
                    setDraftFilters(clonePanelFilters(defaults));
                    setFilters(defaults);
                    setFilterOpen(false);
                  }}
                >
                  重置
                </Button>
                <Button
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilters(clonePanelFilters(draftFilters));
                    setFilterOpen(false);
                  }}
                >
                  确定
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {series.length > 0 && (
        <div className="mb-1.5 flex shrink-0 items-center gap-1 overflow-x-auto px-1.5">
          {series.map(item => (
            <button
              key={item.uid}
              type="button"
              className={`h-6 shrink-0 rounded-sm border px-2.5 text-xs outline-none ${
                activeSeriesUID === item.uid
                  ? 'border-[#5d93d7] bg-[#2f5f9f] text-white'
                  : 'border-[#33475b] bg-[#202d3a] text-[#c9d8e8] hover:border-[#5d93d7] hover:text-white'
              }`}
              onClick={() => setActiveSeriesUID(item.uid)}
              title={item.label}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1 px-1.5">
        {state.loadingStudyInstanceUIDs.length > 0 && !items.length ? (
          <div className="mt-5 text-center text-sm text-[#98aabe]">正在加载AI结果...</div>
        ) : Object.keys(state.errors).length > 0 && !items.length ? (
          <div className="mt-5 text-center text-sm text-[#f17878]">AI结果加载失败</div>
        ) : !visibleItems.length ? (
          <div className="mt-5 text-center text-sm text-[#98aabe]">暂无AI结果</div>
        ) : (
          visibleItems.map(item => (
            <NoduleRow
              key={item.recordUID}
              item={item}
              onToggle={handleToggle}
              onLocationChange={(target, lobe, segment) =>
                aiNoduleService.updateNodule(target.recordUID, {
                  lobe,
                  segment,
                  locationValue: [lobe, segment],
                })
              }
              onTypeChange={(target, label) =>
                aiNoduleService.updateNodule(target.recordUID, {
                  type: label,
                  nodule_type: label,
                })
              }
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
