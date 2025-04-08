const { getResponseSender, Constants } = require('librechat-data-provider');
const { createAbortController, handleAbortError } = require('~/server/middleware');
const { sendMessage, createOnProgress, isEnabled } = require('~/server/utils');
const { saveMessage, saveConvo } = require('~/models');
const { CacheKeys, EModelEndpoint } = require('librechat-data-provider');
const getLogStores = require('~/cache/getLogStores');
const { sleep } = require('~/server/utils');
const { logger } = require('~/config');

/**
 * Controller for handling title generation through custom endpoints
 * @type {import('~/types/api/server/controllers/AddTitleController').AddTitleControllerFn}
 */
const AddTitleController = async (req, res, next, initializeClient, addTitle) => {
  let {
    // text,
    endpointOption,
    conversationId,
    modelDisplayLabel,
    // isCreatedByUser,
    parentMessageId = null,
    overrideParentMessageId = null,
    messageId,
    messages,
  } = req.body;

  const isCreatedByUser = true;

  console.log('PORRA - 0 - AddTitleController - req.body: %O', req.body);

  logger.debug('[AddTitleController]', {
    // text,
    conversationId,
    ...endpointOption,
    modelsConfig: endpointOption.modelsConfig ? 'exists' : '',
  });

  // /** @type {TMessage | undefined} */
  // let userMessage;
  // /** @type {Promise<TMessage> | undefined} */
  // let userMessagePromise;
  // /** @type {number | undefined} */
  // let promptTokens;
  // /** @type {string | null} */
  // let userMessageId = null;
  // /** @type {string | undefined} */
  // let responseMessageId;
  // const sender = isCreatedByUser
  //   ? 'User'
  //   : getResponseSender({
  //       ...endpointOption,
  //       model: endpointOption.modelOptions.model,
  //       modelDisplayLabel,
  //     });

  // const newConvo = !conversationId;
  // const user = req.user.id;

  // /** @type {import('~/types/api/server/controllers/AddTitleController').AddTitleControllerGetReqDataFn} */
  // const getReqData = (data = {}) => {
  //   for (let key in data) {
  //     if (key === 'userMessage') {
  //       userMessage = data[key];
  //       userMessageId = data[key].messageId;
  //     } else if (key === 'userMessagePromise') {
  //       userMessagePromise = data[key];
  //     } else if (key === 'responseMessageId') {
  //       responseMessageId = data[key];
  //     } else if (key === 'promptTokens') {
  //       promptTokens = data[key];
  //     } else if (!conversationId && key === 'conversationId') {
  //       conversationId = data[key];
  //     }
  //   }
  // };

  // let getText;

  try {
    const { client } = await initializeClient({ req, res, endpointOption });
    // const { onProgress: progressCallback, getPartialText } = createOnProgress();

    // getText = client.getStreamText != null ? client.getStreamText.bind(client) : getPartialText;

    // const getAbortData = () => ({
    //   sender,
    //   conversationId,
    //   userMessagePromise,
    //   messageId: responseMessageId,
    //   parentMessageId: overrideParentMessageId ?? userMessageId,
    //   text: getText(),
    //   userMessage,
    //   promptTokens,
    // });

    // const { abortController, onStart } = createAbortController(req, res, getAbortData, getReqData);

    // res.on('close', () => {
    //   logger.debug('[AddTitleController] Request closed');
    //   if (!abortController) {
    //     logger.debug('[AddTitleController] !abortController');
    //     return;
    //   } else if (abortController.signal.aborted) {
    //     logger.debug('[AddTitleController] abortController.signal.aborted');
    //     return;
    //   } else if (abortController.requestCompleted) {
    //     logger.debug('[AddTitleController] abortController.requestCompleted');
    //     return;
    //   }

    //   abortController.abort();
    //   logger.debug('[AddTitleController] Request aborted on close');
    // });

    // const messageOptions = {
    //   user,
    //   parentMessageId,
    //   conversationId,
    //   overrideParentMessageId,
    //   sender,
    //   isCreatedByUser,
    //   getReqData,
    //   onStart,
    //   abortController,
    //   progressCallback,
    //   progressOptions: {
    //     res,
    //   },
    // };

    // console.log('PORRA - 1 - AddTitleController - messageOptions: %O', messageOptions);

    // Make sure that messages are sorted by `isCreatedByUser`, making messages created by the user come first when requesting the title generation.
    messages.sort((a, b) => Number(b.isCreatedByUser) - Number(a.isCreatedByUser));

    const firstMessage = messages[0];
    let firstMessageText = '';
    if (firstMessage) {
      firstMessageText = firstMessage.text;
    }

    const secondMessage = messages[1];
    let secondMessageText = '';
    if (secondMessage) {
      secondMessageText = secondMessage.text;
    }

    // const msg = messages[1];
    // let userMessageText = '';
    // if (msg) {
    //   userMessageText = msg.text;
    // }
    // userMessage = {
    //   conversationId,
    //   text: userMessageText,
    //   messageId,
    //   parentMessageId,
    //   isCreatedByUser,
    // };

    // console.log('PORRA - 2 - AddTitleController - userMessage: %O', userMessage);
    console.log('PORRA - 2 - AddTitleController - addTitle');

    // if (addTitle && parentMessageId === Constants.NO_PARENT && newConvo) {
    // if (addTitle) {

    // addTitle(req, {
    //   text: messages[0].text,
    //   response: userMessage,
    //   client,
    // });

    // const { TITLE_CONVO = 'true' } = process.env ?? {};
    // if (!isEnabled(TITLE_CONVO)) {
    // return;
    // }

    // if (client.options.titleConvo === false) {
    // return;
    // }

    // If the request was aborted and is not azure, don't generate the title.
    // if (!client.azure && client.abortController.signal.aborted) {
    // if (!client.azure) {
    //   return;
    // }

    const titleCache = getLogStores(CacheKeys.GEN_TITLE);
    const key = `${req.user.id}-${conversationId}`;

    const title = await client.titleConvo({
      text: firstMessageText,
      responseText: secondMessageText,
      conversationId: conversationId,
    });
    await titleCache.set(key, title, 120000);
    await saveConvo(
      req,
      {
        conversationId: conversationId,
        title,
      },
      { context: 'api/server/controllers/AddTitleController.js' },
    );

    // const { conversationId } = req.body;
    // const titleCache = getLogStores(CacheKeys.GEN_TITLE);
    // const key = `${req.user.id}-${conversationId}`;
    // /** @type {string | undefined} */
    // let title = await titleCache.get(key);

    // if (!title) {
    //   await sleep(2500);
    //   title = await titleCache.get(key);
    // }

    // if (title) {
    //   await titleCache.delete(key);
    //   res.status(200).json({ title });
    // } else {
    //   res.status(404).json({
    //     message: "Title not found or method not implemented for the conversation's endpoint",
    //   });
    // }
    // } else {
    //   console.log('PORRA - 3 - AddTitleController - NO addTitle');
    // }

    // if (!abortController.signal.aborted) {
    sendMessage(res, {
      title_added: true,
      conversationId: conversationId,
      // conversation,
      // title: conversation?.title,
      // requestMessage: userMessage,
      // requestMessage: userMessage,
      // responseMessage: response,
    });
    console.log('PORRA - 3 - AddTitleController - sendMessage - res.end()');
    res.end();
    // }
  } catch (error) {
    logger.error('[AddTitleController] Error', error.message);

    // const partialText = getText && getText();
    // handleAbortError(res, req, error, {
    //   sender,
    //   partialText,
    //   conversationId,
    //   messageId: responseMessageId,
    //   parentMessageId: overrideParentMessageId ?? userMessageId ?? parentMessageId,
    // }).catch((err) => {
    //   logger.error('[AddTitleController] Error in `handleAbortError`', err);
    // });
  }
};

module.exports = AddTitleController;
