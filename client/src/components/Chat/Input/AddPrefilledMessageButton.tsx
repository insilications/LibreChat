import React from 'react';
import { TooltipAnchor } from '~/components';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { MessageSquarePlus } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import type { ChatFormValues } from '~/common';
import type { Control } from 'react-hook-form';

type AddPrefilledMessageButtonProps = {
  disabled: boolean;
  control: Control<ChatFormValues>;
  handleAddPrefilledMessage: () => Promise<void>;
};

const AddPrefilledMessageButton = React.memo(function AddPrefilledMessageButton({
  disabled,
  control,
  handleAddPrefilledMessage,
}: AddPrefilledMessageButtonProps) {
  const data = useWatch({ control });
  const localize = useLocalize();

  return (
    <TooltipAnchor
      description={localize('com_add_prefilled_message')}
      id="add-prefilled-message"
      render={
        <button
          type="button"
          aria-label={localize('com_add_prefilled_message')}
          disabled={disabled || !data.text}
          className={cn(
            'ml-px flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent',
          )}
          onClick={handleAddPrefilledMessage}
          data-testid="add-prefilled-message-button"
        >
          <div className="flex w-full items-center justify-center gap-2">
            <MessageSquarePlus />
          </div>
        </button>
      }
    />
  );
});

export default AddPrefilledMessageButton;
