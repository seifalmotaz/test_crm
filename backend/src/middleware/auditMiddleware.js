/**
 * Audit Middleware
 *
 * Automatically logs critical write operations after they complete.
 * Attach to specific routes that require an audit trail.
 *
 * Usage:
 *   router.post('/deals/:id/stage', audit('DEAL_STAGE_ADVANCE', 'deals', 'id'), c.updateStage)
 *   router.patch('/properties/:id', audit('PROPERTY_UPDATE', 'properties', 'id'), c.update)
 *
 * For more granular before/after diffing, call auditService.log() directly in the controller.
 */

const audit = require('../services/auditService');

/**
 * @param {string} action     - audit action string (e.g. 'DEAL_STAGE_ADVANCE')
 * @param {string} resource   - resource type (e.g. 'deals')
 * @param {string} paramKey   - req.params key for the resource ID (default 'id')
 */
function auditMiddleware(action, resource, paramKey = 'id') {
  return async (req, res, next) => {
    // Capture original json() to intercept the response body
    const originalJson = res.json.bind(res);
    let responseBody   = null;

    res.json = function (body) {
      responseBody = body;
      return originalJson(body);
    };

    // Let the route handler run first
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const ctx = audit.fromRequest(req);
        audit.log(action, resource, {
          ...ctx,
          resourceId: req.params?.[paramKey],
          changes:    responseBody?.data ? { after: responseBody.data } : null,
        }).catch(() => {}); // never fail the request
      }
    });

    next();
  };
}

module.exports = auditMiddleware;
