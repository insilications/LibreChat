import { v4 } from 'uuid';
import { useQueryClient } from '@tanstack/react-query';
import {
  Constants,
  QueryKeys,
  ContentTypes,
  EModelEndpoint,
  parseCompactConvo,
  isAssistantsEndpoint,
} from 'librechat-data-provider';
import { useSetRecoilState, useResetRecoilState, useRecoilValue } from 'recoil';
import type {
  TMessage,
  TSubmission,
  TConversation,
  TEndpointOption,
  TEndpointsConfig,
} from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import type { TAskFunction, TPrefillFunction, TAddTitleFunction, ExtendedFile } from '~/common';
import useSetFilesToDelete from '~/hooks/Files/useSetFilesToDelete';
import useGetSender from '~/hooks/Conversations/useGetSender';
import { getArtifactsMode } from '~/utils/artifacts';
import { getEndpointField, logger } from '~/utils';
import useUserKey from '~/hooks/Input/useUserKey';
import store from '~/store';

const logChatRequestAddTitle = (request: Record<string, unknown>) => {
  logger.log('=====================================\nAdd Title function called with:');
  logger.dir(request);
  logger.log('=====================================');
};

const logChatRequestPrefill = (request: Record<string, unknown>) => {
  logger.log('=====================================\nPrefill function called with:');
  logger.dir(request);
  logger.log('=====================================');
};

const logChatRequest = (request: Record<string, unknown>) => {
  logger.log('=====================================\nAsk function called with:');
  logger.dir(request);
  logger.log('=====================================');
};

const usesContentStream = (endpoint: EModelEndpoint | undefined, endpointType?: string) => {
  if (endpointType === EModelEndpoint.custom) {
    return true;
  }
  if (endpoint === EModelEndpoint.openAI || endpoint === EModelEndpoint.azureOpenAI) {
    return true;
  }
};

export default function useChatFunctions({
  index = 0,
  files,
  setFiles,
  getMessages,
  setMessages,
  isSubmitting,
  conversation,
  latestMessage,
  setSubmission,
  setLatestMessage,
}: {
  index?: number;
  isSubmitting: boolean;
  paramId?: string | undefined;
  conversation: TConversation | null;
  latestMessage: TMessage | null;
  getMessages: () => TMessage[] | undefined;
  setMessages: (messages: TMessage[]) => void;
  files?: Map<string, ExtendedFile>;
  setFiles?: SetterOrUpdater<Map<string, ExtendedFile>>;
  setSubmission: SetterOrUpdater<TSubmission | null>;
  setLatestMessage?: SetterOrUpdater<TMessage | null>;
}) {
  const codeArtifacts = useRecoilValue(store.codeArtifacts);
  const includeShadcnui = useRecoilValue(store.includeShadcnui);
  const customPromptMode = useRecoilValue(store.customPromptMode);
  const resetLatestMultiMessage = useResetRecoilState(store.latestMessageFamily(index + 1));
  const setShowStopButton = useSetRecoilState(store.showStopButtonByIndex(index));
  const setFilesToDelete = useSetFilesToDelete();
  const getSender = useGetSender();
  const isTemporary = useRecoilValue(store.isTemporary);

  const queryClient = useQueryClient();
  const { getExpiry } = useUserKey(conversation?.endpoint ?? '');

  const ask: TAskFunction = (
    {
      text,
      overrideConvoId,
      overrideUserMessageId,
      parentMessageId = null,
      conversationId = null,
      messageId = null,
    },
    {
      editedText = null,
      editedMessageId = null,
      resubmitFiles = false,
      isRegenerate = false,
      isContinued = false,
      isEdited = false,
      overrideMessages,
    } = {},
  ) => {
    setShowStopButton(false);
    resetLatestMultiMessage();
    if (!!isSubmitting || text === '') {
      return;
    }

    const endpoint = conversation?.endpoint;
    if (endpoint === null) {
      console.error('No endpoint available');
      return;
    }

    conversationId = conversationId ?? conversation?.conversationId ?? null;
    if (conversationId == 'search') {
      console.error('cannot send any message under search view!');
      return;
    }

    if (isContinued && !latestMessage) {
      console.error('cannot continue AI message without latestMessage!');
      return;
    }

    const isEditOrContinue = isEdited || isContinued;

    let currentMessages = overrideMessages ?? getMessages() ?? [];

    // construct the query message
    // this is not a real messageId, it is used as placeholder before real messageId returned
    text = text.trim();
    const intermediateId = overrideUserMessageId ?? v4();
    parentMessageId = parentMessageId ?? latestMessage?.messageId ?? Constants.NO_PARENT;

    logChatRequest({
      index,
      conversation,
      latestMessage,
      conversationId,
      intermediateId,
      parentMessageId,
      currentMessages,
    });

    if (conversationId == Constants.NEW_CONVO) {
      parentMessageId = Constants.NO_PARENT;
      currentMessages = [];
      conversationId = null;
    }

    const parentMessage = currentMessages.find(
      (msg) => msg.messageId === latestMessage?.parentMessageId,
    );

    let thread_id = parentMessage?.thread_id ?? latestMessage?.thread_id;
    if (thread_id == null) {
      thread_id = currentMessages.find((message) => message.thread_id)?.thread_id;
    }

    const endpointsConfig = queryClient.getQueryData<TEndpointsConfig>([QueryKeys.endpoints]);
    const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');

    // set the endpoint option
    const convo = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: conversation ?? {},
    });

    const { modelDisplayLabel } = endpointsConfig?.[endpoint ?? ''] ?? {};
    const endpointOption = Object.assign(
      {
        endpoint,
        endpointType,
        overrideConvoId,
        overrideUserMessageId,
        artifacts:
          endpoint !== EModelEndpoint.agents
            ? getArtifactsMode({ codeArtifacts, includeShadcnui, customPromptMode })
            : undefined,
      },
      convo,
    ) as TEndpointOption;
    if (endpoint !== EModelEndpoint.agents) {
      endpointOption.key = getExpiry();
      endpointOption.thread_id = thread_id;
      endpointOption.modelDisplayLabel = modelDisplayLabel;
    } else {
      endpointOption.key = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    const responseSender = getSender({ model: conversation?.model, ...endpointOption });

    const currentMsg: TMessage = {
      text,
      sender: 'User',
      clientTimestamp: new Date().toLocaleString('sv').replace(' ', 'T'),
      isCreatedByUser: true,
      parentMessageId,
      conversationId,
      messageId: isContinued && messageId != null && messageId ? messageId : intermediateId,
      thread_id,
      error: false,
    };

    const reuseFiles =
      (isRegenerate || resubmitFiles) && parentMessage?.files && parentMessage.files.length > 0;
    if (setFiles && reuseFiles === true) {
      currentMsg.files = parentMessage.files;
      setFiles(new Map());
      setFilesToDelete({});
    } else if (setFiles && files && files.size > 0) {
      currentMsg.files = Array.from(files.values()).map((file) => ({
        file_id: file.file_id,
        filepath: file.filepath,
        type: file.type ?? '', // Ensure type is not undefined
        height: file.height,
        width: file.width,
      }));
      setFiles(new Map());
      setFilesToDelete({});
    }

    // construct the placeholder response message
    const generation = editedText ?? latestMessage?.text ?? '';
    const responseText = isEditOrContinue ? generation : '';

    const responseMessageId = editedMessageId ?? latestMessage?.messageId ?? null;
    const initialResponse: TMessage = {
      sender: responseSender,
      text: responseText,
      endpoint: endpoint ?? '',
      parentMessageId: isRegenerate ? messageId : intermediateId,
      messageId: responseMessageId ?? `${isRegenerate ? messageId : intermediateId}_`,
      thread_id,
      conversationId,
      unfinished: false,
      isCreatedByUser: false,
      iconURL: convo?.iconURL,
      model: convo?.model,
      error: false,
    };

    if (isAssistantsEndpoint(endpoint)) {
      initialResponse.model = conversation?.assistant_id ?? '';
      initialResponse.text = '';
      initialResponse.content = [
        {
          type: ContentTypes.TEXT,
          [ContentTypes.TEXT]: {
            value: responseText,
          },
        },
      ];
    } else if (endpoint === EModelEndpoint.agents) {
      initialResponse.model = conversation?.agent_id ?? '';
      initialResponse.text = '';
      initialResponse.content = [
        {
          type: ContentTypes.TEXT,
          [ContentTypes.TEXT]: {
            value: responseText,
          },
        },
      ];
      setShowStopButton(true);
    } else if (usesContentStream(endpoint, endpointType)) {
      initialResponse.text = '';
      initialResponse.content = [
        {
          type: ContentTypes.TEXT,
          [ContentTypes.TEXT]: {
            value: responseText,
          },
        },
      ];
      setShowStopButton(true);
    } else {
      setShowStopButton(true);
    }

    if (isContinued) {
      currentMessages = currentMessages.filter((msg) => msg.messageId !== responseMessageId);
    }

    logger.log('message_state', initialResponse);
    const submission: TSubmission = {
      conversation: {
        ...conversation,
        conversationId,
      },
      endpointOption,
      userMessage: {
        ...currentMsg,
        generation,
        responseMessageId,
        overrideParentMessageId: isRegenerate ? messageId : null,
      },
      messages: currentMessages,
      isEdited: isEditOrContinue,
      isContinued,
      isRegenerate,
      initialResponse,
      isTemporary,
    };

    if (isRegenerate) {
      setMessages([...submission.messages, initialResponse]);
    } else {
      setMessages([...submission.messages, currentMsg, initialResponse]);
    }
    if (index === 0 && setLatestMessage) {
      setLatestMessage(initialResponse);
    }

    setSubmission(submission);
    logger.dir('message_stream', submission, { depth: null });
  };

  const prefill: TPrefillFunction = (
    {
      text,
      // isCreatedByUser,
      clientTimestamp,
      overrideConvoId,
      overrideUserMessageId,
      conversationId = null,
      // messageId = null,
    },
    {
      editedText = null,
      editedMessageId = null,
      resubmitFiles = false,
      isRegenerate = false,
      isContinued = false,
      isEdited = false,
      overrideMessages,
    } = {},
  ) => {
    resetLatestMultiMessage();
    if (!!isSubmitting || text === '') {
      return;
    }

    // if (conversation) {
    //   conversation.prefilled = true;
    // }
    const endpoint = conversation?.endpoint;
    if (endpoint === null) {
      console.error('No endpoint available');
      return;
    }

    conversationId = conversationId ?? conversation?.conversationId ?? null;
    if (conversationId == 'search') {
      console.error('cannot add any message under search view!');
      return;
    }

    // if (isContinued && !latestMessage) {
    //   console.error('cannot continue AI message without latestMessage!');
    //   return;
    // }

    // const isEditOrContinue = isEdited || isContinued;

    // let currentMessages: TMessage[] | null = overrideMessages ?? getMessages() ?? [];
    let currentMessages = getMessages() ?? [];

    // construct the query message
    // this is not a real messageId, it is used as placeholder before real messageId returned
    text = text.trim();
    const intermediateId = overrideUserMessageId ?? v4();
    // parentMessageId = parentMessageId ?? latestMessage?.messageId ?? Constants.NO_PARENT;
    const parentMessageId = latestMessage?.messageId ?? Constants.NO_PARENT;
    const isCreatedByUser = latestMessage?.isCreatedByUser ? false : true;

    logChatRequestPrefill({
      index,
      conversation,
      latestMessage,
      conversationId,
      intermediateId,
      parentMessageId,
      currentMessages,
    });

    if (conversationId == Constants.NEW_CONVO) {
      if (!conversation?.prefilled) {
        console.log(
          'PORRA - 0 - useChatFunctions - prefill - conversation?.prefilled: %O',
          conversation?.prefilled,
        );
        currentMessages = [];
      }
      conversationId = null;
    }

    const parentMessage = currentMessages.find(
      (msg) => msg.messageId === latestMessage?.parentMessageId,
    );

    let thread_id = parentMessage?.thread_id ?? latestMessage?.thread_id;
    if (thread_id == null) {
      thread_id = currentMessages.find((message) => message.thread_id)?.thread_id;
    }

    const endpointsConfig = queryClient.getQueryData<TEndpointsConfig>([QueryKeys.endpoints]);
    const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');

    // set the endpoint option
    const convo = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: conversation ?? {},
    });

    const { modelDisplayLabel } = endpointsConfig?.[endpoint ?? ''] ?? {};
    const endpointOption = Object.assign(
      {
        endpoint,
        endpointType,
        overrideConvoId,
        overrideUserMessageId,
        artifacts:
          endpoint !== EModelEndpoint.agents
            ? getArtifactsMode({ codeArtifacts, includeShadcnui, customPromptMode })
            : undefined,
      },
      convo,
    ) as TEndpointOption;
    if (endpoint !== EModelEndpoint.agents) {
      endpointOption.key = getExpiry();
      endpointOption.thread_id = thread_id;
      endpointOption.modelDisplayLabel = modelDisplayLabel;
    } else {
      endpointOption.key = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    let currentMsg: TMessage = {} as TMessage;
    let submission: TSubmission = {} as TSubmission;
    if (isCreatedByUser) {
      console.log('PORRA - 1 - useChatFunctions - prefill - isCreatedByUser: %O', isCreatedByUser);

      currentMsg = {
        text,
        sender: 'User',
        clientTimestamp,
        isCreatedByUser: true,
        parentMessageId,
        conversationId,
        // messageId: isContinued && messageId != null && messageId ? messageId : intermediateId,
        messageId: intermediateId,
        thread_id,
        error: false,
      };

      const reuseFiles =
        (isRegenerate || resubmitFiles) && parentMessage?.files && parentMessage.files.length > 0;
      if (setFiles && reuseFiles === true) {
        currentMsg.files = parentMessage.files;
        setFiles(new Map());
        setFilesToDelete({});
      } else if (setFiles && files && files.size > 0) {
        currentMsg.files = Array.from(files.values()).map((file) => ({
          file_id: file.file_id,
          filepath: file.filepath,
          type: file.type ?? '', // Ensure type is not undefined
          height: file.height,
          width: file.width,
        }));
        setFiles(new Map());
        setFilesToDelete({});
      }

      submission = {
        conversation: {
          ...conversation,
          conversationId,
          prefilled: true,
        },
        endpointOption,
        userMessage: {
          ...currentMsg,
          // generation,
          // responseMessageId,
          overrideParentMessageId: null,
        },
        messages: currentMessages,
        isContinued,
        isRegenerate,
        // initialResponse,
        isTemporary,
        isPrefilledMessage: true,
      };
    } else {
      console.log('PORRA - 2 - useChatFunctions - prefill - isCreatedByUser: %O', isCreatedByUser);

      const responseSender = getSender({ model: conversation?.model, ...endpointOption });
      // const responseMessageId = editedMessageId ?? latestMessage?.messageId ?? null;

      currentMsg = {
        text,
        sender: responseSender,
        clientTimestamp,
        isCreatedByUser: false,
        endpoint: endpoint ?? '',
        // parentMessageId: isRegenerate ? messageId : intermediateId,
        parentMessageId,
        // messageId: `${parentMessageId}_`,
        messageId: intermediateId,
        thread_id,
        conversationId,
        unfinished: false,
        iconURL: convo?.iconURL,
        model: convo?.model,
        error: false,
      };

      submission = {
        conversation: {
          ...conversation,
          conversationId,
          prefilled: true,
        },
        endpointOption,
        userMessage: {
          ...currentMsg,
          // generation,
          // responseMessageId,
          overrideParentMessageId: null,
        },
        messages: currentMessages,
        isContinued,
        isRegenerate,
        // initialResponse,
        isTemporary,
        isPrefilledMessage: true,
      };
    }

    console.log('PORRA - 3 - useChatFunctions - prefill - latestMessage: %O', latestMessage);
    console.log('PORRA - 4 - useChatFunctions - prefill - [...currentMessages]: %O', [
      ...currentMessages,
    ]);
    console.log('PORRA - 5 - useChatFunctions - prefill - [currentMsg]: %O', [currentMsg]);
    console.log('PORRA - 6 - useChatFunctions - prefill - [...currentMessages, currentMsg]: %O', [
      ...currentMessages,
      currentMsg,
    ]);

    // setMessages([...currentMessages, currentMsg]);
    setMessages([...submission.messages, currentMsg]);

    console.log(`PORRA - 7 - useChatFunctions - prefill - index: ${index}`);
    if (index === 0 && setLatestMessage) {
      console.log('PORRA - 8 - useChatFunctions - prefill - setLatestMessage(currentMsg)');
      setLatestMessage(currentMsg);
    }

    // if (conversation) {
    //   setConversation({
    //     ...conversation,
    //     prefilled: true,
    //   });
    // }

    console.log('PORRA - 9 - useChatFunctions - prefill - submission: %O', submission);
    setSubmission(submission);
  };

  const add_title: TAddTitleFunction = (
    {
      // text,
      // isCreatedByUser,
      clientTimestamp,
      overrideConvoId,
      overrideUserMessageId,
      conversationId = null,
      // messageId = null,
    },
    {
      editedText = null,
      editedMessageId = null,
      resubmitFiles = false,
      isRegenerate = false,
      isContinued = false,
      isEdited = false,
      overrideMessages,
    } = {},
  ) => {
    // resetLatestMultiMessage();
    if (isSubmitting) {
      return;
    }

    // if (conversation) {
    //   conversation.prefilled = true;
    // }
    const endpoint = conversation?.endpoint;
    if (endpoint === null) {
      console.error('No endpoint available');
      return;
    }

    conversationId = conversationId ?? conversation?.conversationId ?? null;
    if (conversationId == 'search') {
      console.error('cannot add any message under search view!');
      return;
    }

    // if (isContinued && !latestMessage) {
    //   console.error('cannot continue AI message without latestMessage!');
    //   return;
    // }

    // const isEditOrContinue = isEdited || isContinued;

    // let currentMessages: TMessage[] | null = overrideMessages ?? getMessages() ?? [];
    const currentMessages = getMessages() ?? [];

    // construct the query message
    // this is not a real messageId, it is used as placeholder before real messageId returned
    // text = text.trim();
    const intermediateId = overrideUserMessageId ?? v4();
    // parentMessageId = parentMessageId ?? latestMessage?.messageId ?? Constants.NO_PARENT;
    const parentMessageId = latestMessage?.messageId ?? Constants.NO_PARENT;
    // const isCreatedByUser = latestMessage?.isCreatedByUser ? false : true;

    logChatRequestAddTitle({
      index,
      conversation,
      latestMessage,
      conversationId,
      intermediateId,
      parentMessageId,
      currentMessages,
    });

    if (conversationId == Constants.NEW_CONVO) {
      console.log('PORRA - 0 - useChatFunctions - add_title - conversationId: %O', conversationId);
    }

    const parentMessage = currentMessages.find(
      (msg) => msg.messageId === latestMessage?.parentMessageId,
    );

    let thread_id = parentMessage?.thread_id ?? latestMessage?.thread_id;
    if (thread_id == null) {
      thread_id = currentMessages.find((message) => message.thread_id)?.thread_id;
    }

    const endpointsConfig = queryClient.getQueryData<TEndpointsConfig>([QueryKeys.endpoints]);
    const endpointType = getEndpointField(endpointsConfig, endpoint, 'type');

    // set the endpoint option
    const convo = parseCompactConvo({
      endpoint,
      endpointType,
      conversation: conversation ?? {},
    });

    const { modelDisplayLabel } = endpointsConfig?.[endpoint ?? ''] ?? {};
    const endpointOption = Object.assign(
      {
        endpoint,
        endpointType,
        overrideConvoId,
        overrideUserMessageId,
        artifacts:
          endpoint !== EModelEndpoint.agents
            ? getArtifactsMode({ codeArtifacts, includeShadcnui, customPromptMode })
            : undefined,
      },
      convo,
    ) as TEndpointOption;
    if (endpoint !== EModelEndpoint.agents) {
      endpointOption.key = getExpiry();
      endpointOption.thread_id = thread_id;
      endpointOption.modelDisplayLabel = modelDisplayLabel;
    } else {
      endpointOption.key = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }

    const currentMsg: TMessage = {
      text: 'Add Title',
      sender: 'User',
      clientTimestamp,
      isCreatedByUser: true,
      parentMessageId,
      conversationId,
      // messageId: isContinued && messageId != null && messageId ? messageId : intermediateId,
      messageId: intermediateId,
      thread_id,
      error: false,
    };

    const submission: TSubmission = {
      conversation: {
        ...conversation,
        conversationId,
      },
      endpointOption,
      // userMessage: {} as TMessage,
      userMessage: {
        ...currentMsg,
        // generation,
        // responseMessageId,
        overrideParentMessageId: null,
      },
      // MAYBE CREATE A SPECIAL PROPERTY WITH JUST THE FIRST TWO MESSAGES EXCLUSIVELY FOR GENERATING THE TITLE
      messages: currentMessages.slice(0, 2),
      isContinued,
      isRegenerate,
      // initialResponse,
      isTemporary,
      isAddTitle: true,
    };

    console.log('PORRA - 9 - useChatFunctions - add_title - submission: %O', submission);
    setSubmission(submission);
  };

  const regenerate = ({ parentMessageId }: { parentMessageId: string }) => {
    const messages = getMessages();
    const parentMessage = messages?.find((element) => element.messageId == parentMessageId);

    if (parentMessage && parentMessage.isCreatedByUser) {
      ask({ ...parentMessage }, { isRegenerate: true });
    } else {
      console.error(
        'Failed to regenerate the message: parentMessage not found or not created by user.',
      );
    }
  };

  return {
    ask,
    regenerate,
    prefill,
    add_title,
  };
}
