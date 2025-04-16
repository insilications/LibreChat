import { v4 } from 'uuid';
import { useCallback } from 'react';
import { Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useChatContext, useChatFormContext, useAddedChatContext } from '~/Providers';
import { useAuthContext } from '~/hooks/AuthContext';
import { replaceSpecialVars } from '~/utils';
import store from '~/store';

const appendIndex = (index: number, value?: string) => {
  if (!value) {
    return value;
  }
  return `${value}${Constants.COMMON_DIVIDER}${index}`;
};

export default function useSubmitMessage() {
  const { user } = useAuthContext();
  const methods = useChatFormContext();
  const { ask, prefill, prefill_ask, add_title, index, getMessages, setMessages, latestMessage } =
    useChatContext();
  const { addedIndex, ask: askAdditional, conversation: addedConvo } = useAddedChatContext();

  const autoSendPrompts = useRecoilValue(store.autoSendPrompts);
  const activeConvos = useRecoilValue(store.allConversationsSelector);
  const setActivePrompt = useSetRecoilState(store.activePromptByIndex(index));

  const submitMessage = useCallback(
    (data?: { text: string }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }
      const rootMessages = getMessages();
      const isLatestInRootMessages = rootMessages?.some(
        (message) => message.messageId === latestMessage?.messageId,
      );
      if (!isLatestInRootMessages && latestMessage) {
        setMessages([...(rootMessages || []), latestMessage]);
      }

      const hasAdded = addedIndex && activeConvos[addedIndex] && addedConvo;
      const isNewMultiConvo =
        hasAdded &&
        activeConvos.every((convoId) => convoId === Constants.NEW_CONVO) &&
        !rootMessages?.length;
      const overrideConvoId = isNewMultiConvo ? v4() : undefined;
      const overrideUserMessageId = hasAdded ? v4() : undefined;
      const rootIndex = addedIndex - 1;
      const clientTimestamp = new Date().toISOString();

      ask({
        text: data.text,
        overrideConvoId: appendIndex(rootIndex, overrideConvoId),
        overrideUserMessageId: appendIndex(rootIndex, overrideUserMessageId),
        clientTimestamp,
      });

      if (hasAdded) {
        askAdditional(
          {
            text: data.text,
            overrideConvoId: appendIndex(addedIndex, overrideConvoId),
            overrideUserMessageId: appendIndex(addedIndex, overrideUserMessageId),
            clientTimestamp,
          },
          { overrideMessages: rootMessages },
        );
      }
      methods.reset();
    },
    [
      ask,
      methods,
      addedIndex,
      addedConvo,
      setMessages,
      getMessages,
      activeConvos,
      askAdditional,
      latestMessage,
    ],
  );

  const submitPrompt = useCallback(
    (text: string) => {
      const parsedText = replaceSpecialVars({ text, user });
      if (autoSendPrompts) {
        submitMessage({ text: parsedText });
        return;
      }

      const currentText = methods.getValues('text');
      const newText = currentText.trim().length > 1 ? `\n${parsedText}` : parsedText;
      setActivePrompt(newText);
    },
    [autoSendPrompts, submitMessage, setActivePrompt, methods, user],
  );

  const submitPrefilledMessage = useCallback(
    (data?: { text: string }) => {
      if (!data) {
        return console.warn('No data provided to submitMessage');
      }

      const clientTimestamp = new Date().toLocaleString('sv').replace(' ', 'T');

      prefill({ text: data.text, clientTimestamp });

      // IS THIS NECESSARY?
      methods.reset();
    },
    [prefill, methods, latestMessage],
  );

  const submitPrefillAsk = useCallback(() => {
    if (!latestMessage) {
      console.error('Failed to call submitPrefillAsk: latestMessage not found.');
      return;
    }

    const messages = getMessages();

    const parentMessage = messages?.find(
      (element) => element.messageId == latestMessage.parentMessageId,
    );

    if (parentMessage && parentMessage.isCreatedByUser) {
      prefill_ask({ ...parentMessage }, { isContinued: true, isRegenerate: true, isEdited: true });
    } else {
      console.error('Failed to call prefill_ask: parentMessage not found, or not created by user.');
    }

    // IS THIS NECESSARY?
    methods.reset();
  }, [prefill_ask, methods, getMessages, latestMessage]);

  const submitAddTitle = useCallback(
    (conversationId: string | null, addingTitleMessages: TMessage[]) => {
      if (!conversationId) {
        return console.warn('No conversationId provided to submitAddTitle');
      }

      console.log('PORRA - 0 - submitAddTitle - conversationId: %O', conversationId);
      console.log('PORRA - 1 - submitAddTitle - addingTitleMessages: %O', addingTitleMessages);
      const clientTimestamp = new Date().toLocaleString('sv').replace(' ', 'T');

      add_title({ conversationId, messages: addingTitleMessages, clientTimestamp });

      // IS THIS NECESSARY?
      methods.reset();
    },
    [add_title, methods],
  );

  return { submitMessage, submitPrompt, submitPrefilledMessage, submitPrefillAsk, submitAddTitle };
}
