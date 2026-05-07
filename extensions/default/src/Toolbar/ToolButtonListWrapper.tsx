import React from 'react';
import {
  ToolButtonList,
  ToolButton,
  ToolButtonListDefault,
  ToolButtonListDropDown,
  ToolButtonListItem,
  ToolButtonListDivider,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@ohif/ui-next';
import { useToolbar } from '@ohif/core/src';

interface ToolButtonListWrapperProps {
  buttonSection: string;
  dropdownOnPrimary?: boolean;
  hidePrimaryItemInDropdown?: boolean;
  onInteraction?: (details: { itemId: string; commands?: Record<string, unknown> }) => void;
  id: string;
  primaryItemId?: string;
}

/**
 * Wraps the ToolButtonList component to handle the OHIF toolbar button structure
 * @param props - Component props
 * @returns Component
 * // test
 */
export default function ToolButtonListWrapper({
  buttonSection,
  dropdownOnPrimary,
  hidePrimaryItemInDropdown,
  id,
  primaryItemId,
}: ToolButtonListWrapperProps) {
  const { onInteraction, toolbarButtons } = useToolbar({
    buttonSection,
  });

  if (!toolbarButtons?.length) {
    return null;
  }

  const activePrimary = toolbarButtons.find(button => button.componentProps.isActive)
    ?.componentProps;
  const configuredPrimary = primaryItemId
    ? toolbarButtons.find(button => button.componentProps.id === primaryItemId)?.componentProps
    : undefined;
  const primary =
    hidePrimaryItemInDropdown && configuredPrimary
      ? configuredPrimary
      : activePrimary || configuredPrimary || toolbarButtons[0].componentProps;

  const items = toolbarButtons
    .map(button => button.componentProps)
    .filter(item => !hidePrimaryItemInDropdown || item.id !== primary.id);

  const renderItems = () =>
    items.map(item => {
      return (
        <ToolButtonListItem
          key={item.id}
          {...item}
          data-cy={item.id}
          data-tool={item.id}
          data-active={item.isActive}
          onSelect={() => onInteraction?.({ id, itemId: item.id, commands: item.commands })}
        >
          <span className="pl-1">{item.label || item.tooltip || item.id}</span>
        </ToolButtonListItem>
      );
    });

  if (dropdownOnPrimary) {
    return (
      <ToolButtonList>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              data-cy={`${id}-split-button-primary`}
              data-tool={primary.id}
              data-active={primary.isActive}
            >
              <ToolButton
                {...primary}
                className={primary.className}
              />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
          >
            {renderItems()}
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolButtonList>
    );
  }

  return (
    <ToolButtonList>
      <ToolButtonListDefault>
        <div
          data-cy={`${id}-split-button-primary`}
          data-tool={primary.id}
          data-active={primary.isActive}
        >
          <ToolButton
            {...primary}
            onInteraction={({ itemId }) =>
              onInteraction?.({ id, itemId, commands: primary.commands })
            }
            className={primary.className}
          />
        </div>
      </ToolButtonListDefault>
      <ToolButtonListDivider className={primary.isActive ? 'opacity-0' : 'opacity-100'} />
      <div data-cy={`${id}-split-button-secondary`}>
        <ToolButtonListDropDown>{renderItems()}</ToolButtonListDropDown>
      </div>
    </ToolButtonList>
  );
}
