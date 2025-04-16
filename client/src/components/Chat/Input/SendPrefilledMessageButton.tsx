import React from 'react';
import { TooltipAnchor } from '~/components';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { MessageSquareReply } from 'lucide-react';

type SendPrefilledMessageButtonProps = {
  disabled: boolean;
  handlePrefillAsk: () => void;
};

const SendPrefilledMessageButton = React.memo(function AddPrefilledMessageButton({
  disabled,
  handlePrefillAsk,
}: SendPrefilledMessageButtonProps) {
  const localize = useLocalize();

  return (
    <TooltipAnchor
      description={localize('com_send_prefilled_message')}
      id="send-prefilled-message"
      render={
        <button
          type="button"
          aria-label={localize('com_send_prefilled_message')}
          disabled={disabled}
          className={cn(
            'ml-px flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 disabled:cursor-not-allowed disabled:opacity-20 disabled:hover:bg-transparent',
          )}
          onClick={handlePrefillAsk}
          data-testid="send-prefilled-message-button"
        >
          <div className="flex w-full items-center justify-center gap-2">
            <MessageSquareReply />
          </div>
        </button>
      }
    />
  );
});

export default SendPrefilledMessageButton;
