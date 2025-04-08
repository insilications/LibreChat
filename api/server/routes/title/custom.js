const express = require('express');
const AddTitleController = require('~/server/controllers/AddTitleController');
const { initializeClient } = require('~/server/services/Endpoints/custom');
const { addTitle } = require('~/server/services/Endpoints/openAI');
const {
  handleAbort,
  setHeaders,
  validateModel,
  validateEndpoint,
  buildEndpointOption,
} = require('~/server/middleware');

const router = express.Router();

router.post('/abort', handleAbort());

router.post(
  '/',
  validateEndpoint,
  validateModel,
  buildEndpointOption,
  setHeaders,
  /**
   * POST /api/title/custom
   *
   * @param {import('~/types/api/server/routes/custom').CustomRequest} req
   * @param {import('express-serve-static-core').Response} res
   * @param {import('express-serve-static-core').NextFunction} next
   * @returns {Promise<void>}
   */
  async (req, res, next) => {
    // const { conversationId } = req.body;
    // const titleCache = getLogStores(CacheKeys.GEN_TITLE);
    // const key = `${req.user.id}-${conversationId}`;
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
    await AddTitleController(req, res, next, initializeClient, addTitle);
  },
);

module.exports = router;
