import React from 'react';
import { TooltipAnchor } from '~/components';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { AddTitleConversationIcon } from '~/components';

type AddTitleConversationButtonProps = {
  disabled: boolean;
  handleAddTitleConversation: () => void;
};

const AddTitleConversationButton = React.memo(function AddTitleConversationButton({
  disabled,
  handleAddTitleConversation,
}: AddTitleConversationButtonProps) {
  const localize = useLocalize();

  return (
    <TooltipAnchor
      description={localize('com_add_title_conversation')}
      id="add-title-conversation"
      render={
        <button
          type="button"
          aria-label={localize('com_add_title_conversation')}
          disabled={disabled}
          className={cn(
            'ml-[2px] flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent',
          )}
          onClick={handleAddTitleConversation}
          data-testid="add-title-conversation-button"
        >
          <div className="flex w-full items-center justify-center gap-2">
            <AddTitleConversationIcon />
          </div>
        </button>
      }
    />
  );
});

export default AddTitleConversationButton;
