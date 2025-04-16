import React from 'react';
import { TooltipAnchor } from '~/components';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { AddTitleSelectMessagesIcon } from '~/components';

type AddTitleSelectMessagesButtonProps = {
  disabled: boolean;
  handleAddTitleSelectMessage: () => void;
};

const AddTitleSelectMessagesButton = React.memo(function AddTitleSelectMessagesButton({
  disabled,
  handleAddTitleSelectMessage,
}: AddTitleSelectMessagesButtonProps) {
  const localize = useLocalize();

  return (
    <TooltipAnchor
      description={localize('com_add_title_select')}
      id="add-title-select-conversation"
      render={
        <button
          type="button"
          aria-label={localize('com_add_title_select')}
          disabled={disabled}
          className={cn(
            'ml-px flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent',
          )}
          onClick={handleAddTitleSelectMessage}
          data-testid="add-title-select-conversation-button"
        >
          <div className="flex w-full items-center justify-center gap-2">
            <AddTitleSelectMessagesIcon />
          </div>
        </button>
      }
    />
  );
});

export default AddTitleSelectMessagesButton;
