import React from 'react';
import { TextEncoder } from 'util';
import PanelAINodule from './PanelAINodule';

global.TextEncoder = TextEncoder as typeof global.TextEncoder;
const { renderToStaticMarkup } = require('react-dom/server');

const mockUseSystem = jest.fn();
jest.mock('@ohif/core', () => ({
  useSystem: () => mockUseSystem(),
}));
jest.mock('@ohif/ui-next', () => {
  const React = require('react');
  const Container = ({ children }) => React.createElement('div', null, children);
  return {
    Button: ({ children }) => React.createElement('button', null, children),
    Checkbox: props => React.createElement('input', { type: 'checkbox', ...props }),
    DropdownMenu: Container,
    DropdownMenuContent: Container,
    DropdownMenuItem: Container,
    DropdownMenuPortal: Container,
    DropdownMenuSub: Container,
    DropdownMenuSubContent: Container,
    DropdownMenuSubTrigger: Container,
    DropdownMenuTrigger: Container,
    Input: props => React.createElement('input', props),
    Popover: Container,
    PopoverContent: Container,
    PopoverTrigger: Container,
    ScrollArea: Container,
  };
});

describe('PanelAINodule', () => {
  beforeEach(() => {
    mockUseSystem.mockReturnValue({
      servicesManager: { services: {} },
      commandsManager: {},
    });
  });

  it('renders readable localized text when the service is unavailable', () => {
    const markup = renderToStaticMarkup(React.createElement(PanelAINodule));

    expect(markup).toContain('AI \u7ed3\u8282\u670d\u52a1\u672a\u542f\u7528');
    expect(markup).not.toContain('\\u7ed3\\u8282');
  });

  it('renders the Vue screening table structure with normalized results', () => {
    const record = {
      recordUID: 'study::series::nodule_1',
      id: 'nodule_1',
      studyInstanceUID: 'study',
      seriesInstanceUID: 'series',
      isSelected: false,
      nodule: {
        findings:
          '\u53f3\u80ba\u4e0a\u53f6\u5c16\u6bb5\uff08IM:12/100\uff09\u89c1\u5b9e\u6027\u7ed3\u8282',
        risk_level: '\u9ad8\u5371',
        Major_axis_length: 9,
        Minimum_axis_length: 5,
        Volume: 120,
        CT_value_mean: -420,
      },
    };
    mockUseSystem.mockReturnValue({
      servicesManager: {
        services: {
          aiNoduleService: {
            EVENTS: { STATE_CHANGED: 'changed' },
            getState: () => ({
              records: [record],
              loadingStudyInstanceUIDs: [],
              errors: {},
            }),
            subscribe: jest.fn(),
            setSelectedMany: jest.fn(),
            updateNodule: jest.fn(),
          },
          displaySetService: {
            getActiveDisplaySets: () => [
              { SeriesInstanceUID: 'series', SeriesDescription: '\u80ba\u7a97' },
            ],
          },
          uiNotificationService: { show: jest.fn() },
        },
      },
      commandsManager: { runAsync: jest.fn() },
    });

    const markup = renderToStaticMarkup(React.createElement(PanelAINodule));

    expect(markup).toContain('AI\u7b5b\u67e5\u7ed3\u8bba');
    expect(markup).toContain('\u5168\u9009\uff080/1\uff09');
    expect(markup).toContain('\u6309IM');
    expect(markup).toContain('\u80ba\u7a97');
    expect(markup).toContain('IM 12');
    expect(markup).toContain('\u53f3\u80ba\u4e0a\u53f6 / \u5c16\u6bb5');
    expect(markup).toContain('\u5b9e\u6027\u7ed3\u8282');
    expect(markup).toContain('\u9ad8\u5371');
  });
});
