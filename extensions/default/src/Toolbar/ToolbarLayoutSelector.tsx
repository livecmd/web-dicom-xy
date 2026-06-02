// Updated ToolbarLayoutSelector.tsx
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { CommandsManager } from '@ohif/core';

import { LayoutSelector } from '@ohif/ui-next';
import { useTranslation } from 'react-i18next';

function ToolbarLayoutSelectorWithServices({
  commandsManager,
  servicesManager,
  rows = 3,
  columns = 4,
  showAdvancedPresets = true,
  ...props
}) {
  const { customizationService } = servicesManager.services;
  const { t } = useTranslation(['ToolbarLayoutSelector', 'Hps']);
  const translatedHpTitle = title => t(`Hps:${title}`, { defaultValue: title });
  const getPresetDataCy = preset => {
    const protocolId = preset.commandOptions?.protocolId;

    return (
      {
        mpr: 'MPR',
        fourUp: '3D four up',
        '3d-four-up': '3D four up',
        main3D: '3D main',
        '3d-main': '3D main',
        primaryAxial: 'Axial Primary',
        'axial-primary': 'Axial Primary',
        only3D: '3D only',
        '3d-only': '3D only',
        primary3D: '3D primary',
        '3d-primary': '3D primary',
        '@ohif/frameView': 'Frame View',
        'frame-view': 'Frame View',
      }[protocolId] || preset.title
    );
  };

  // Get the presets from the customization service
  const commonPresets = customizationService?.getCustomization('layoutSelector.commonPresets') || [
    {
      icon: 'layout-single',
      commandOptions: {
        numRows: 1,
        numCols: 1,
      },
    },
    {
      icon: 'layout-side-by-side',
      commandOptions: {
        numRows: 1,
        numCols: 2,
      },
    },
    {
      icon: 'layout-four-up',
      commandOptions: {
        numRows: 2,
        numCols: 2,
      },
    },
    {
      icon: 'layout-three-row',
      commandOptions: {
        numRows: 3,
        numCols: 1,
      },
    },
  ];

  // Get the advanced presets generator from the customization service
  const advancedPresetsGenerator = customizationService?.getCustomization(
    'layoutSelector.advancedPresetGenerator'
  );

  // Generate the advanced presets
  const advancedPresets = showAdvancedPresets
    ? advancedPresetsGenerator
      ? advancedPresetsGenerator({ servicesManager })
      : [
          {
            title: translatedHpTitle('MPR'),
            icon: 'layout-three-col',
            commandOptions: {
              protocolId: 'mpr',
            },
          },
          {
            title: translatedHpTitle('3D four up'),
            icon: 'layout-four-up',
            commandOptions: {
              protocolId: '3d-four-up',
            },
          },
          {
            title: translatedHpTitle('3D main'),
            icon: 'layout-three-row',
            commandOptions: {
              protocolId: '3d-main',
            },
          },
          {
            title: translatedHpTitle('Axial Primary'),
            icon: 'layout-side-by-side',
            commandOptions: {
              protocolId: 'axial-primary',
            },
          },
          {
            title: translatedHpTitle('3D only'),
            icon: 'layout-single',
            commandOptions: {
              protocolId: '3d-only',
            },
          },
          {
            title: translatedHpTitle('3D primary'),
            icon: 'layout-side-by-side',
            commandOptions: {
              protocolId: '3d-primary',
            },
          },
          {
            title: translatedHpTitle('Frame View'),
            icon: 'icon-stack',
            commandOptions: {
              protocolId: 'frame-view',
            },
          },
        ]
    : [];

  // Unified selection handler that dispatches to the appropriate command
  const handleSelectionChange = useCallback(
    (commandOptions, isPreset) => {
      if (isPreset) {
        // Advanced preset selection
        commandsManager.run({
          commandName: 'setHangingProtocol',
          commandOptions,
        });
      } else {
        // Common preset or custom grid selection
        commandsManager.run({
          commandName: 'setViewportGridLayout',
          commandOptions,
        });
      }
    },
    [commandsManager]
  );

  return (
    <div
      id="Layout"
      data-cy="Layout"
    >
      <LayoutSelector
        onSelectionChange={handleSelectionChange}
        {...props}
      >
        <LayoutSelector.Trigger tooltip={t('Change layout')} />
        <LayoutSelector.Content>
          {/* Left side - Presets */}
          {(commonPresets.length > 0 || advancedPresets.length > 0) && (
            <div className="bg-popover flex flex-col gap-2.5 rounded-lg p-2">
              {commonPresets.length > 0 && (
                <>
                  <LayoutSelector.PresetSection title={t('Common')}>
                    {commonPresets.map((preset, index) => (
                      <LayoutSelector.Preset
                        key={`common-preset-${index}`}
                        icon={preset.icon}
                        commandOptions={preset.commandOptions}
                        isPreset={false}
                      />
                    ))}
                  </LayoutSelector.PresetSection>
                  {advancedPresets.length > 0 && <LayoutSelector.Divider />}
                </>
              )}

              {advancedPresets.length > 0 && (
                <LayoutSelector.PresetSection title={t('Advanced')}>
                  {advancedPresets.map((preset, index) => {
                    const title = preset.title ? translatedHpTitle(preset.title) : preset.title;

                    return (
                      <LayoutSelector.Preset
                        key={`advanced-preset-${index}`}
                        title={title}
                        dataCy={preset.dataCy || getPresetDataCy(preset)}
                        icon={preset.icon}
                        commandOptions={preset.commandOptions}
                        disabled={preset.disabled}
                        isPreset={true}
                      />
                    );
                  })}
                </LayoutSelector.PresetSection>
              )}
            </div>
          )}

          {/* Right Side - Grid Layout */}
          <div className="bg-muted border-background flex flex-col gap-2.5 border-l-2 border-solid p-2">
            <div className="text-muted-foreground text-xs">{t('Custom')}</div>
            <LayoutSelector.GridSelector
              rows={rows}
              columns={columns}
            />
            <LayoutSelector.HelpText>
              {t('Hover to select')} <br />
              {t('rows and columns')} <br />
              {t('Click to apply')}
            </LayoutSelector.HelpText>
          </div>
        </LayoutSelector.Content>
      </LayoutSelector>
    </div>
  );
}

ToolbarLayoutSelectorWithServices.propTypes = {
  commandsManager: PropTypes.instanceOf(CommandsManager),
  servicesManager: PropTypes.object,
  rows: PropTypes.number,
  columns: PropTypes.number,
  showAdvancedPresets: PropTypes.bool,
};

export default ToolbarLayoutSelectorWithServices;
