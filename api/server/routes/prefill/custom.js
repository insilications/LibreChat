const express = require('express');
const PrefillController = require('~/server/controllers/PrefillController');
const { initializeClient } = require('~/server/services/Endpoints/custom');
// const { addTitle } = require('~/server/services/Endpoints/openAI');
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
   * POST /api/prefill/custom
   *
   * @param {import('~/types/api/server/routes/custom').CustomRequest} req
   * @param {import('express-serve-static-core').Response} res
   * @param {import('express-serve-static-core').NextFunction} next
   * @returns {Promise<void>}
   */
  async (req, res, next) => {
    await PrefillController(req, res, next, initializeClient);
  },
);

module.exports = router;
