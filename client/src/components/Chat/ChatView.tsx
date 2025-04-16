import { memo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { useGetMessagesByConvoId } from 'librechat-data-provider/react-query';
import type { TMessage } from 'librechat-data-provider';
import type { ChatFormValues } from '~/common';
import { ChatContext, AddedChatContext, useFileMapContext, ChatFormProvider } from '~/Providers';
import { useChatHelpers, useAddedResponse, useSSE } from '~/hooks';
import ConversationStarters from './Input/ConversationStarters';
import MessagesView from './Messages/MessagesView';
import { Spinner } from '~/components/svg';
import Presentation from './Presentation';
import ChatForm from './Input/ChatForm';
import { buildTree } from '~/utils';
import Landing from './Landing';
import Header from './Header';
import Footer from './Footer';
import store from '~/store';
// import type { TConversation } from 'librechat-data-provider';

function ChatView({ index = 0 }: { index?: number }) {
  const { conversationId } = useParams();
  const rootSubmission = useRecoilValue(store.submissionByIndex(index));
  const addedSubmission = useRecoilValue(store.submissionByIndex(index + 1));
  const centerFormOnLanding = useRecoilValue(store.centerFormOnLanding);

  // console.log(`PORRA 0 - ChatView - index: ${index} - index + 1: ${index + 1}`);

  const fileMap = useFileMapContext();

  const { data: messagesTree = null, isLoading } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback(
      (data: TMessage[]) => {
        const dataTree = buildTree({ messages: data, fileMap });
        return dataTree?.length === 0 ? null : (dataTree ?? null);
      },
      [fileMap],
    ),
    enabled: !!fileMap,
  });

  const chatHelpers = useChatHelpers(index, conversationId);
  const addedChatHelpers = useAddedResponse({ rootIndex: index });

  // const { endpoint: _endpoint_rootSubmission, endpointType: endpointType_rootSubmission } =
  //   (rootSubmission?.conversation as TConversation | null) ?? {};
  // console.log('PORRA - 1 - ChatView - rootSubmission: %O', rootSubmission);
  // console.log('PORRA - 2 - ChatView - _endpoint_rootSubmission: %O', _endpoint_rootSubmission);
  // console.log(
  //   'PORRA - 3 - ChatView - endpointType_rootSubmission: %O',
  //   endpointType_rootSubmission,
  // );

  // const { endpoint: _endpoint_addedSubmission, endpointType: endpointType_addedSubmission } =
  //   (addedSubmission?.conversation as TConversation | null) ?? {};
  // console.log('PORRA - 4 - ChatView - addedSubmission: %O', addedSubmission);
  // console.log('PORRA - 5 - ChatView - _endpoint_addedSubmission: %O', _endpoint_addedSubmission);
  // console.log(
  //   'PORRA - 6 - ChatView - endpointType_addedSubmission: %O',
  //   endpointType_addedSubmission,
  // );

  useSSE(rootSubmission, chatHelpers, false);
  useSSE(addedSubmission, addedChatHelpers, true);

  const methods = useForm<ChatFormValues>({
    defaultValues: { text: '' },
  });

  let content: JSX.Element | null | undefined;
  const isLandingPage = !messagesTree || messagesTree.length === 0;

  if (isLoading && conversationId !== 'new') {
    content = (
      <div className="relative flex-1 overflow-hidden overflow-y-auto">
        <div className="relative flex h-full items-center justify-center">
          <Spinner className="text-text-primary" />
        </div>
      </div>
    );
  } else if (!isLandingPage) {
    content = <MessagesView messagesTree={messagesTree} />;
  } else {
    content = <Landing centerFormOnLanding={centerFormOnLanding} />;
  }

  return (
    <ChatFormProvider {...methods}>
      <ChatContext.Provider value={chatHelpers}>
        <AddedChatContext.Provider value={addedChatHelpers}>
          <Presentation>
            <div className="flex h-full w-full flex-col">
              {!isLoading && <Header />}

              {isLandingPage ? (
                <>
                  <div className="flex flex-1 flex-col items-center justify-end sm:justify-center">
                    {content}
                    <div className="w-full max-w-3xl transition-all duration-200 xl:max-w-4xl">
                      <ChatForm index={index} />
                      <ConversationStarters />
                    </div>
                  </div>
                  <Footer />
                </>
              ) : (
                <div className="flex h-full flex-col overflow-y-auto">
                  {content}
                  <div className="w-full">
                    <ChatForm index={index} />
                    <Footer />
                  </div>
                </div>
              )}
            </div>
          </Presentation>
        </AddedChatContext.Provider>
      </ChatContext.Provider>
    </ChatFormProvider>
  );
}

export default memo(ChatView);
