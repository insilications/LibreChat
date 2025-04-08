import { v4 } from 'uuid';
import { useCallback, useRef } from 'react';
import { useSetRecoilState } from 'recoil';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  QueryKeys,
  Constants,
  EndpointURLs,
  tPresetSchema,
  tMessageSchema,
  tConvoUpdateSchema,
  ContentTypes,
  LocalStorageKeys,
} from 'librechat-data-provider';
import type {
  TMessage,
  TConversation,
  EventSubmission,
  ConversationData,
} from 'librechat-data-provider';
import type { SetterOrUpdater, Resetter } from 'recoil';
import type {
  TResData,
  TFinalResData,
  TPrefillResData,
  TAddTitleResData,
  ConvoGenerator,
} from '~/common';
import type { TGenTitleMutation } from '~/data-provider';
import {
  scrollToEnd,
  addConversation,
  getAllContentText,
  deleteConversation,
  updateConversation,
  getConversationById,
} from '~/utils';
import useAttachmentHandler from '~/hooks/SSE/useAttachmentHandler';
import useContentHandler from '~/hooks/SSE/useContentHandler';
import store, { useApplyNewAgentTemplate } from '~/store';
import useStepHandler from '~/hooks/SSE/useStepHandler';
import { useAuthContext } from '~/hooks/AuthContext';
import { MESSAGE_UPDATE_INTERVAL } from '~/common';
import { useLiveAnnouncer } from '~/Providers';

type TSyncData = {
  sync: boolean;
  thread_id: string;
  messages?: TMessage[];
  requestMessage: TMessage;
  responseMessage: TMessage;
  conversationId: string;
};

export type EventHandlerParams = {
  isAddedRequest?: boolean;
  genTitle?: TGenTitleMutation;
  setCompleted: React.Dispatch<React.SetStateAction<Set<unknown>>>;
  setMessages: (messages: TMessage[]) => void;
  getMessages: () => TMessage[] | undefined;
  setIsSubmitting: SetterOrUpdater<boolean>;
  setConversation?: SetterOrUpdater<TConversation | null>;
  newConversation?: ConvoGenerator;
  setShowStopButton: SetterOrUpdater<boolean>;
  resetLatestMessage?: Resetter;
};

const createErrorMessage = ({
  errorMetadata,
  getMessages,
  submission,
  error,
}: {
  getMessages: () => TMessage[] | undefined;
  errorMetadata?: Partial<TMessage>;
  submission: EventSubmission;
  error?: Error | unknown;
}) => {
  const currentMessages = getMessages();
  const latestMessage = currentMessages?.[currentMessages.length - 1];
  let errorMessage: TMessage;
  const text = submission.initialResponse.text.length > 45 ? submission.initialResponse.text : '';
  const errorText =
    (errorMetadata?.text || text || (error as Error | undefined)?.message) ??
    'Error cancelling request';
  const latestContent = latestMessage?.content ?? [];
  let isValidContentPart = false;
  if (latestContent.length > 0) {
    const latestContentPart = latestContent[latestContent.length - 1];
    const latestPartValue = latestContentPart?.[latestContentPart.type ?? ''];
    isValidContentPart =
      latestContentPart.type !== ContentTypes.TEXT ||
      (latestContentPart.type === ContentTypes.TEXT && typeof latestPartValue === 'string')
        ? true
        : latestPartValue?.value !== '';
  }
  if (
    latestMessage?.conversationId &&
    latestMessage?.messageId &&
    latestContent &&
    isValidContentPart
  ) {
    const content = [...latestContent];
    content.push({
      type: ContentTypes.ERROR,
      error: errorText,
    });
    errorMessage = {
      ...latestMessage,
      ...errorMetadata,
      error: undefined,
      text: '',
      content,
    };
    if (
      submission.userMessage.messageId &&
      submission.userMessage.messageId !== errorMessage.parentMessageId
    ) {
      errorMessage.parentMessageId = submission.userMessage.messageId;
    }
    return errorMessage;
  } else if (errorMetadata) {
    return errorMetadata as TMessage;
  } else {
    errorMessage = {
      ...submission,
      ...submission.initialResponse,
      text: errorText,
      unfinished: !!text.length,
      error: true,
    };
  }
  return tMessageSchema.parse(errorMessage);
};

export default function useEventHandlers({
  genTitle,
  setMessages,
  getMessages,
  setCompleted,
  isAddedRequest = false,
  setConversation,
  setIsSubmitting,
  newConversation,
  setShowStopButton,
  resetLatestMessage,
}: EventHandlerParams) {
  const queryClient = useQueryClient();
  const { announcePolite } = useLiveAnnouncer();
  const applyAgentTemplate = useApplyNewAgentTemplate();
  const setAbortScroll = useSetRecoilState(store.abortScroll);

  const lastAnnouncementTimeRef = useRef(Date.now());
  const { conversationId: paramId } = useParams();
  const { token } = useAuthContext();

  const contentHandler = useContentHandler({ setMessages, getMessages });
  const stepHandler = useStepHandler({
    setMessages,
    getMessages,
    announcePolite,
    setIsSubmitting,
    lastAnnouncementTimeRef,
  });
  const attachmentHandler = useAttachmentHandler();

  const messageHandler = useCallback(
    (data: string | undefined, submission: EventSubmission) => {
      const {
        messages,
        userMessage,
        plugin,
        plugins,
        initialResponse,
        isRegenerate = false,
      } = submission;
      const text = data ?? '';
      setIsSubmitting(true);

      const currentTime = Date.now();
      if (currentTime - lastAnnouncementTimeRef.current > MESSAGE_UPDATE_INTERVAL) {
        announcePolite({ message: 'composing', isStatus: true });
        lastAnnouncementTimeRef.current = currentTime;
      }

      if (isRegenerate) {
        setMessages([
          ...messages,
          {
            ...initialResponse,
            text,
            plugin: plugin ?? null,
            plugins: plugins ?? [],
            // unfinished: true
          },
        ]);
      } else {
        setMessages([
          ...messages,
          userMessage,
          {
            ...initialResponse,
            text,
            plugin: plugin ?? null,
            plugins: plugins ?? [],
            // unfinished: true
          },
        ]);
      }
    },
    [setMessages, announcePolite, setIsSubmitting],
  );

  const cancelHandler = useCallback(
    (data: TResData, submission: EventSubmission) => {
      const { requestMessage, responseMessage, conversation } = data;
      const { messages, isRegenerate = false } = submission;

      console.log('PORRA - 0 - useEventHandlers - cancelHandler');

      const convoUpdate =
        (conversation as TConversation | null) ?? (submission.conversation as TConversation);

      // update the messages
      if (isRegenerate) {
        const messagesUpdate = (
          [...messages, responseMessage] as Array<TMessage | undefined>
        ).filter((msg) => msg);
        setMessages(messagesUpdate as TMessage[]);
      } else {
        const messagesUpdate = (
          [...messages, requestMessage, responseMessage] as Array<TMessage | undefined>
        ).filter((msg) => msg);
        setMessages(messagesUpdate as TMessage[]);
      }

      const isNewConvo = conversation.conversationId !== submission.conversation.conversationId;
      if (isNewConvo) {
        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          return deleteConversation(convoData, submission.conversation.conversationId as string);
        });
      }

      // refresh title
      if (genTitle && isNewConvo && requestMessage.parentMessageId === Constants.NO_PARENT) {
        setTimeout(() => {
          genTitle.mutate({ conversationId: convoUpdate.conversationId as string });
        }, 2500);
      }

      if (setConversation && !isAddedRequest) {
        console.log('PORRA - 1 - useEventHandlers - cancelHandler');
        setConversation((prevState) => {
          const update = {
            ...prevState,
            ...convoUpdate,
          };

          return update;
        });
      }

      setIsSubmitting(false);
    },
    [setMessages, setConversation, genTitle, isAddedRequest, queryClient, setIsSubmitting],
  );

  const syncHandler = useCallback(
    (data: TSyncData, submission: EventSubmission) => {
      const { conversationId, thread_id, responseMessage, requestMessage } = data;
      const { initialResponse, messages: _messages, userMessage } = submission;

      console.log('PORRA - 0 - useEventHandlers - syncHandler');

      const messages = _messages.filter((msg) => msg.messageId !== userMessage.messageId);

      setMessages([
        ...messages,
        requestMessage,
        {
          ...initialResponse,
          ...responseMessage,
        },
      ]);

      announcePolite({
        message: 'start',
        isStatus: true,
      });

      let update = {} as TConversation;
      if (setConversation && !isAddedRequest) {
        setConversation((prevState) => {
          let title = prevState?.title;
          const parentId = requestMessage.parentMessageId;
          if (
            parentId !== Constants.NO_PARENT &&
            (title?.toLowerCase().includes('new chat') ?? false)
          ) {
            const convos = queryClient.getQueryData<ConversationData>([QueryKeys.allConversations]);
            const cachedConvo = getConversationById(convos, conversationId);
            title = cachedConvo?.title;
          }

          update = tConvoUpdateSchema.parse({
            ...prevState,
            conversationId,
            thread_id,
            title,
            messages: [requestMessage.messageId, responseMessage.messageId],
          }) as TConversation;

          return update;
        });

        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          if (requestMessage.parentMessageId === Constants.NO_PARENT) {
            return addConversation(convoData, update);
          } else {
            return updateConversation(convoData, update);
          }
        });
      } else if (setConversation) {
        console.log('PORRA - 1 - useEventHandlers - syncHandler');
        setConversation((prevState) => {
          update = tConvoUpdateSchema.parse({
            ...prevState,
            conversationId,
            thread_id,
            messages: [requestMessage.messageId, responseMessage.messageId],
          }) as TConversation;
          return update;
        });
      }

      setShowStopButton(true);
      if (resetLatestMessage) {
        resetLatestMessage();
      }
    },
    [
      queryClient,
      setMessages,
      isAddedRequest,
      announcePolite,
      setConversation,
      setShowStopButton,
      resetLatestMessage,
    ],
  );

  const createdHandler = useCallback(
    (data: TResData, submission: EventSubmission) => {
      console.log('PORRA - 0 - useEventHandlers - createdHandler');
      const { messages, userMessage, isRegenerate = false, isTemporary = false } = submission;
      const initialResponse = {
        ...submission.initialResponse,
        parentMessageId: userMessage.messageId,
        messageId: userMessage.messageId + '_',
      };
      if (isRegenerate) {
        setMessages([...messages, initialResponse]);
      } else {
        setMessages([...messages, userMessage, initialResponse]);
      }

      const { conversationId, parentMessageId } = userMessage;
      lastAnnouncementTimeRef.current = Date.now();
      announcePolite({
        message: 'start',
        isStatus: true,
      });

      let update = {} as TConversation;
      if (conversationId) {
        applyAgentTemplate(conversationId, submission.conversation.conversationId);
      }
      if (setConversation && !isAddedRequest) {
        setConversation((prevState) => {
          let title = prevState?.title;
          const parentId = isRegenerate ? userMessage.overrideParentMessageId : parentMessageId;
          if (
            parentId !== Constants.NO_PARENT &&
            (title?.toLowerCase().includes('new chat') ?? false)
          ) {
            const convos = queryClient.getQueryData<ConversationData>([QueryKeys.allConversations]);
            const cachedConvo = getConversationById(convos, conversationId);
            title = cachedConvo?.title;
          }

          update = tConvoUpdateSchema.parse({
            ...prevState,
            conversationId,
            title,
          }) as TConversation;

          return update;
        });

        if (isTemporary) {
          return;
        }
        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          if (parentMessageId === Constants.NO_PARENT) {
            return addConversation(convoData, update);
          } else {
            return updateConversation(convoData, update);
          }
        });
      } else if (setConversation) {
        console.log('PORRA - 1 - useEventHandlers - createdHandler');
        setConversation((prevState) => {
          update = tConvoUpdateSchema.parse({
            ...prevState,
            conversationId,
          }) as TConversation;
          return update;
        });
      }

      if (resetLatestMessage) {
        resetLatestMessage();
      }

      scrollToEnd(() => setAbortScroll(false));
    },
    [
      setMessages,
      queryClient,
      setAbortScroll,
      isAddedRequest,
      announcePolite,
      setConversation,
      resetLatestMessage,
    ],
  );

  const finalHandler = useCallback(
    (data: TFinalResData, submission: EventSubmission) => {
      const { requestMessage, responseMessage, conversation, runMessages } = data;
      const {
        messages,
        conversation: submissionConvo,
        isRegenerate = false,
        isTemporary = false,
      } = submission;

      console.log('PORRA - 0 - useEventHandlers - finalHandler - conversation: %O', conversation);

      setShowStopButton(false);
      setCompleted((prev) => new Set(prev.add(submission.initialResponse.messageId)));

      const currentMessages = getMessages();
      /* Early return if messages are empty; i.e., the user navigated away */
      if (!currentMessages || currentMessages.length === 0) {
        return setIsSubmitting(false);
      }

      /* a11y announcements */
      announcePolite({
        message: 'end',
        isStatus: true,
      });

      announcePolite({
        message: getAllContentText(responseMessage),
      });

      /* Update messages; if assistants endpoint, client doesn't receive responseMessage */
      if (runMessages) {
        setMessages([...runMessages]);
      } else if (isRegenerate && responseMessage) {
        setMessages([...messages, responseMessage]);
      } else if (requestMessage != null && responseMessage != null) {
        setMessages([...messages, requestMessage, responseMessage]);
      }

      const isNewConvo = conversation.conversationId !== submissionConvo.conversationId;
      if (isNewConvo) {
        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          return deleteConversation(convoData, submissionConvo.conversationId as string);
        });
      }

      /* Refresh title */
      if (
        genTitle &&
        isNewConvo &&
        !isTemporary &&
        requestMessage &&
        requestMessage.parentMessageId === Constants.NO_PARENT
      ) {
        setTimeout(() => {
          genTitle.mutate({ conversationId: conversation.conversationId as string });
        }, 2500);
      }

      if (setConversation && isAddedRequest !== true) {
        if (window.location.pathname === '/c/new') {
          window.history.pushState({}, '', '/c/' + conversation.conversationId);
        }

        setConversation((prevState) => {
          const update = {
            ...prevState,
            ...conversation,
          };

          if (prevState?.model != null && prevState.model !== submissionConvo.model) {
            update.model = prevState.model;
          }

          return update;
        });
      }

      setIsSubmitting(false);
    },
    [
      genTitle,
      queryClient,
      getMessages,
      setMessages,
      setCompleted,
      isAddedRequest,
      announcePolite,
      setConversation,
      setIsSubmitting,
      setShowStopButton,
    ],
  );

  const errorHandler = useCallback(
    ({ data, submission }: { data?: TResData; submission: EventSubmission }) => {
      const { messages, userMessage, initialResponse } = submission;

      setCompleted((prev) => new Set(prev.add(initialResponse.messageId)));

      const conversationId =
        userMessage.conversationId ?? submission.conversation?.conversationId ?? '';

      const parseErrorResponse = (data: TResData | Partial<TMessage>) => {
        const metadata = data['responseMessage'] ?? data;
        const errorMessage: Partial<TMessage> = {
          ...initialResponse,
          ...metadata,
          error: true,
          parentMessageId: userMessage.messageId,
        };

        if (errorMessage.messageId === undefined || errorMessage.messageId === '') {
          errorMessage.messageId = v4();
        }

        return tMessageSchema.parse(errorMessage);
      };

      if (!data) {
        const convoId = conversationId || v4();
        const errorMetadata = parseErrorResponse({
          text: 'Error connecting to server, try refreshing the page.',
          ...submission,
          conversationId: convoId,
        });
        const errorResponse = createErrorMessage({
          errorMetadata,
          getMessages,
          submission,
        });
        setMessages([...messages, userMessage, errorResponse]);
        if (newConversation) {
          newConversation({
            template: { conversationId: convoId },
            preset: tPresetSchema.parse(submission.conversation),
          });
        }
        setIsSubmitting(false);
        return;
      }

      const receivedConvoId = data.conversationId ?? '';
      if (!conversationId && !receivedConvoId) {
        const convoId = v4();
        const errorResponse = parseErrorResponse(data);
        setMessages([...messages, userMessage, errorResponse]);
        if (newConversation) {
          newConversation({
            template: { conversationId: convoId },
            preset: tPresetSchema.parse(submission.conversation),
          });
        }
        setIsSubmitting(false);
        return;
      } else if (!receivedConvoId) {
        const errorResponse = parseErrorResponse(data);
        setMessages([...messages, userMessage, errorResponse]);
        setIsSubmitting(false);
        return;
      }

      console.log('Error:', data);
      const errorResponse = tMessageSchema.parse({
        ...data,
        error: true,
        parentMessageId: userMessage.messageId,
      });

      setMessages([...messages, userMessage, errorResponse]);
      if (receivedConvoId && paramId === Constants.NEW_CONVO && newConversation) {
        newConversation({
          template: { conversationId: receivedConvoId },
          preset: tPresetSchema.parse(submission.conversation),
        });
      }

      setIsSubmitting(false);
      return;
    },
    [setMessages, paramId, setIsSubmitting, setCompleted, newConversation],
  );

  const abortConversation = useCallback(
    async (conversationId = '', submission: EventSubmission, messages?: TMessage[]) => {
      const runAbortKey = `${conversationId}:${messages?.[messages.length - 1]?.messageId ?? ''}`;
      console.log({ conversationId, submission, messages, runAbortKey });
      const { endpoint: _endpoint, endpointType } =
        (submission.conversation as TConversation | null) ?? {};
      const endpoint = endpointType ?? _endpoint;
      try {
        const response = await fetch(`${EndpointURLs[endpoint ?? '']}/abort`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            abortKey: runAbortKey,
            endpoint,
          }),
        });

        // Check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType != null && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`[aborted] RESPONSE STATUS: ${response.status}`, data);
          if (response.status === 404) {
            setIsSubmitting(false);
            return;
          }
          if (data.final === true) {
            finalHandler(data, submission);
          } else {
            cancelHandler(data, submission);
          }
        } else if (response.status === 204 || response.status === 200) {
          const responseMessage = {
            ...submission.initialResponse,
          };

          const data = {
            requestMessage: submission.userMessage,
            responseMessage: responseMessage,
            conversation: submission.conversation,
          };
          console.log(`[aborted] RESPONSE STATUS: ${response.status}`, data);
          setIsSubmitting(false);
        } else {
          throw new Error(
            'Unexpected response from server; Status: ' +
              response.status +
              ' ' +
              response.statusText,
          );
        }
      } catch (error) {
        console.error('Error cancelling request');
        console.error(error);
        const errorResponse = createErrorMessage({
          getMessages,
          submission,
          error,
        });
        setMessages([...submission.messages, submission.userMessage, errorResponse]);
        if (newConversation) {
          newConversation({
            template: { conversationId: conversationId || errorResponse.conversationId || v4() },
            preset: tPresetSchema.parse(submission.conversation),
          });
        }
        setIsSubmitting(false);
      }
    },
    [token, setIsSubmitting, finalHandler, cancelHandler, setMessages, newConversation],
  );

  const prefilledHandler = useCallback(
    (data: TPrefillResData, submission: EventSubmission) => {
      // sendMessage(res, {
      //   added: true,
      //   conversation,
      //   title: conversation?.title,
      //   // requestMessage: userMessage,
      //   requestMessage: userMessage,
      //   // responseMessage: response,
      // });
      // const { requestMessage, responseMessage, conversation, runMessages } = data;
      const { requestMessage, conversation } = data;
      const {
        messages,
        conversation: submissionConvo,
        // userMessage: submissionUserMessage,
        // isRegenerate = false,
        isTemporary = false,
      } = submission;

      // const {
      //   conversationId: submissionUserMessage_conversationId,
      //   parentMessageId: submissionUserMessage_parentMessageId,
      // } = submissionUserMessage;

      console.log('PORRA - 0 - useEventHandlers - prefilledHandler - submission: %O', submission);
      console.log('PORRA - 1 - useEventHandlers - prefilledHandler - data: %O', data);

      // setShowStopButton(false);
      setCompleted((prev) => new Set(prev.add(submission.userMessage.messageId)));

      // IS THIS CHECK NECESSARY???
      const currentMessages = getMessages();
      /* Early return if messages are empty; i.e., the user navigated away */
      if (!currentMessages || currentMessages.length === 0) {
        return setIsSubmitting(false);
      }

      /* a11y announcements */
      announcePolite({
        message: 'prefilled',
        isStatus: true,
      });
      announcePolite({
        message: getAllContentText(requestMessage),
      });

      setMessages([...messages, requestMessage]);

      /* Update messages; if assistants endpoint, client doesn't receive responseMessage */
      // if (runMessages) {
      //   setMessages([...runMessages]);
      // } else if (isRegenerate && responseMessage) {
      //   setMessages([...messages, responseMessage]);
      // } else if (requestMessage != null && responseMessage != null) {
      //   setMessages([...messages, requestMessage, responseMessage]);
      // }

      // const { mutateAsync: sendEdit } = usePromptEditSendMutation();
      // const kk = await sendEdit();

      const isNewConvo = conversation.conversationId !== submissionConvo.conversationId;
      console.log(
        `PORRA - 2 - useEventHandlers - prefilledHandler - conversation.conversationId: ${conversation.conversationId} - submissionConvo.conversationId: ${submissionConvo.conversationId} - isNewConvo: ${isNewConvo}`,
      );

      if (isNewConvo) {
        //   queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
        //     if (!convoData) {
        //       console.log('PORRA - 14 - useEventHandlers - prefilledHandler - convoData: %O', convoData);
        //       return convoData;
        //     }
        //     console.log('PORRA - 15 - useEventHandlers - prefilledHandler - convoData: %O', convoData);
        //     console.log(
        //       'PORRA - 16 - useEventHandlers - prefilledHandler - submissionConvo.conversationId: %O',
        //       submissionConvo.conversationId,
        //     );
        //     return deleteConversation(convoData, submissionConvo.conversationId as string);
        //   });
        setTimeout(() => {
          console.log('PORRA - 3 - useEventHandlers - prefilledHandler - clearDraft NEW');
          localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${Constants.NEW_CONVO}`);
          localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${Constants.NEW_CONVO}`);
        }, 2500);
      } else {
        console.log(
          `PORRA - 4 - useEventHandlers - prefilledHandler - clearDraft conversation.conversationId: ${conversation.conversationId}`,
        );
        localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${conversation.conversationId}`);
        localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${conversation.conversationId}`);
      }

      // /* Refresh title */
      // if (
      //   genTitle &&
      //   isNewConvo &&
      //   !isTemporary &&
      //   // requestMessage &&
      //   requestMessage.parentMessageId === Constants.NO_PARENT
      // ) {
      //   setTimeout(() => {
      //     console.log('PORRA - 5 - useEventHandlers - prefilledHandler - genTitle.mutate');
      //     genTitle.mutate({
      //       conversationId: conversation.conversationId as string,
      //     });
      //   }, 2500);
      // }

      let update = {} as TConversation;
      if (setConversation && isAddedRequest !== true) {
        console.log('PORRA - 6 - useEventHandlers - prefilledHandler - window.history.pushState');
        if (window.location.pathname === '/c/new') {
          window.history.pushState({}, '', '/c/' + conversation.conversationId);
        }

        setConversation((prevState) => {
          // let title = prevState?.title;
          // console.log('PORRA - 6.5 - useEventHandlers - createdHandler - title: %O', title);

          // if (
          //   submissionUserMessage_parentMessageId !== Constants.NO_PARENT &&
          //   (title?.toLowerCase().includes('new chat') ?? false)
          // ) {
          //   const convos = queryClient.getQueryData<ConversationData>([QueryKeys.allConversations]);
          //   const cachedConvo = getConversationById(convos, conversationId);
          //   title = cachedConvo?.title;
          //   console.log('PORRA - 6.6 - useEventHandlers - createdHandler - title: %O', title);
          // }

          update = {
            ...prevState,
            ...conversation,
            // prefilled: true,
          };
          // update = tConvoUpdateSchema.parse({
          //   ...prevState,
          //   ...conversation,
          //   prefilled: true,
          // }) as TConversation;

          if (prevState?.model != null && prevState.model !== submissionConvo.model) {
            update.model = prevState.model;
          }

          console.log('PORRA - 7 - useEventHandlers - addHandler - setConversation');

          return update;
        });

        if (isTemporary) {
          return;
        }

        console.log(
          'PORRA - 8 - useEventHandlers - prefilledHandler - requestMessage: %O',
          requestMessage,
        );

        queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
          if (!convoData) {
            return convoData;
          }
          if (requestMessage.parentMessageId === Constants.NO_PARENT) {
            console.log('PORRA - 9 - useEventHandlers - prefilledHandler - addConversation');
            return addConversation(convoData, update);
          } else {
            console.log('PORRA - 10 - useEventHandlers - prefilledHandler - updateConversation');
            return updateConversation(convoData, update);
          }
        });
      } else {
        console.log(
          'PORRA - 11 - useEventHandlers - prefilledHandler - NO window.history.pushState',
        );
      }

      // if (resetLatestMessage) {
      //   resetLatestMessage();
      // }

      setIsSubmitting(false);
      scrollToEnd(() => setAbortScroll(false));
    },
    [
      genTitle,
      queryClient,
      getMessages,
      setMessages,
      setCompleted,
      isAddedRequest,
      announcePolite,
      setConversation,
      setIsSubmitting,
      // setShowStopButton,
      // resetLatestMessage,
      setAbortScroll,
    ],
  );

  const addTitleHandler = useCallback(
    (data: TAddTitleResData, submission: EventSubmission) => {
      const { conversationId } = data;
      // const {
      //   // messages,
      //   // conversation: submissionConvo,
      //   // userMessage: submissionUserMessage,
      //   // isRegenerate = false,
      //   isTemporary = false,
      // } = submission;

      // const {
      //   conversationId: submissionUserMessage_conversationId,
      //   parentMessageId: submissionUserMessage_parentMessageId,
      // } = submissionUserMessage;

      console.log('PORRA - 1 - useEventHandlers - addTitleHandler - submission: %O', submission);
      console.log('PORRA - 2 - useEventHandlers - addTitleHandler - data: %O', data);

      // setShowStopButton(false);
      // setCompleted((prev) => new Set(prev.add(submission.userMessage.messageId)));

      // IS THIS CHECK NECESSARY???
      const currentMessages = getMessages();
      /* Early return if messages are empty; i.e., the user navigated away */
      if (!currentMessages || currentMessages.length === 0) {
        return setIsSubmitting(false);
      }

      /* a11y announcements */
      announcePolite({
        message: 'title added',
        isStatus: true,
      });

      // setMessages([...messages, requestMessage]);

      /* Update messages; if assistants endpoint, client doesn't receive responseMessage */
      // if (runMessages) {
      //   setMessages([...runMessages]);
      // } else if (isRegenerate && responseMessage) {
      //   setMessages([...messages, responseMessage]);
      // } else if (requestMessage != null && responseMessage != null) {
      //   setMessages([...messages, requestMessage, responseMessage]);
      // }

      // const { mutateAsync: sendEdit } = usePromptEditSendMutation();
      // const kk = await sendEdit();

      // const isNewConvo = conversation.conversationId !== submissionConvo.conversationId;
      // console.log(
      //   `PORRA - 3 - useEventHandlers - addTitleHandler - conversation.conversationId: ${conversation.conversationId} - submissionConvo.conversationId: ${submissionConvo.conversationId} - isNewConvo: ${isNewConvo}`,
      // );

      // if (isNewConvo) {
      //   setTimeout(() => {
      //     console.log('PORRA - 4 - useEventHandlers - addTitleHandler - clearDraft NEW');
      //     localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${Constants.NEW_CONVO}`);
      //     localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${Constants.NEW_CONVO}`);
      //   }, 2500);
      // } else {
      //   console.log(
      //     `PORRA - 5 - useEventHandlers - addTitleHandler - clearDraft conversation.conversationId: ${conversation.conversationId}`,
      //   );
      //   localStorage.removeItem(`${LocalStorageKeys.TEXT_DRAFT}${conversation.conversationId}`);
      //   localStorage.removeItem(`${LocalStorageKeys.FILES_DRAFT}${conversation.conversationId}`);
      // }

      /* Refresh title */
      if (genTitle) {
        setTimeout(() => {
          console.log('PORRA - 6 - useEventHandlers - addTitleHandler - genTitle.mutate');
          genTitle.mutate({
            conversationId,
          });
        }, 2500);
      }

      // let update = {} as TConversation;
      // if (setConversation && isAddedRequest !== true) {
      //   console.log('PORRA - 7 - useEventHandlers - addTitleHandler - window.history.pushState');
      //   if (window.location.pathname === '/c/new') {
      //     window.history.pushState({}, '', '/c/' + conversation.conversationId);
      //   }

      //   setConversation((prevState) => {
      //     // let title = prevState?.title;
      //     // console.log('PORRA - 6.5 - useEventHandlers - addTitleHandler - title: %O', title);

      //     // if (
      //     //   submissionUserMessage_parentMessageId !== Constants.NO_PARENT &&
      //     //   (title?.toLowerCase().includes('new chat') ?? false)
      //     // ) {
      //     //   const convos = queryClient.getQueryData<ConversationData>([QueryKeys.allConversations]);
      //     //   const cachedConvo = getConversationById(convos, conversationId);
      //     //   title = cachedConvo?.title;
      //     //   console.log('PORRA - 6.6 - useEventHandlers - addTitleHandler - title: %O', title);
      //     // }

      //     // update = {
      //     //   ...prevState,
      //     //   ...conversation,
      //     // };
      //     update = tConvoUpdateSchema.parse({
      //       ...prevState,
      //       ...conversation,
      //       prefilled: true,
      //     }) as TConversation;

      //     if (prevState?.model != null && prevState.model !== submissionConvo.model) {
      //       update.model = prevState.model;
      //     }

      //     console.log('PORRA - 8 - useEventHandlers - addTitleHandler - setConversation');

      //     return update;
      //   });

      //   if (isTemporary) {
      //     return;
      //   }
      //   queryClient.setQueryData<ConversationData>([QueryKeys.allConversations], (convoData) => {
      //     if (!convoData) {
      //       return convoData;
      //     }
      //     if (requestMessage.parentMessageId === Constants.NO_PARENT) {
      //       console.log('PORRA - 9 - useEventHandlers - addTitleHandler - addConversation');
      //       return addConversation(convoData, update);
      //     } else {
      //       console.log('PORRA - 10 - useEventHandlers - addTitleHandler - updateConversation');
      //       return updateConversation(convoData, update);
      //     }
      //   });
      // } else {
      //   console.log(
      //     'PORRA - 11 - useEventHandlers - addTitleHandler - NO window.history.pushState',
      //   );
      // }

      setIsSubmitting(false);
    },
    [
      genTitle,
      // queryClient,
      getMessages,
      // setMessages,
      // setCompleted,
      // isAddedRequest,
      announcePolite,
      // setConversation,
      setIsSubmitting,
      // setShowStopButton,
      // resetLatestMessage,
      // setAbortScroll,
    ],
  );

  return {
    stepHandler,
    syncHandler,
    finalHandler,
    errorHandler,
    messageHandler,
    contentHandler,
    createdHandler,
    attachmentHandler,
    abortConversation,
    prefilledHandler,
    addTitleHandler,
  };
}
