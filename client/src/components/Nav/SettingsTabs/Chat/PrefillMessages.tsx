import { useRecoilState } from 'recoil';
import HoverCardSettings from '../HoverCardSettings';
import { Switch } from '~/components/ui/Switch';
import useLocalize from '~/hooks/useLocalize';
import store from '~/store';

export default function PrefillMessages({
  onCheckedChange,
}: {
  onCheckedChange?: (value: boolean) => void;
}) {
  const [prefillMessages, setPrefillMessages] = useRecoilState(store.prefillMessages);
  const localize = useLocalize();

  const handleCheckedChange = (value: boolean) => {
    setPrefillMessages(value);
    if (onCheckedChange) {
      onCheckedChange(value);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div>{localize('com_nav_enable_prefill_messages')}</div>
        <HoverCardSettings side="bottom" text="com_nav_info_prefill_messages" />
      </div>
      <Switch
        id="prefillMessages"
        checked={prefillMessages}
        onCheckedChange={handleCheckedChange}
        className="ml-4"
        data-testid="prefillMessages"
      />
    </div>
  );
}
