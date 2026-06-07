# Error Codes as Frontend-Backend Contract

Every API error response includes a machine-readable error code (e.g., `LEAD_STAGE_INVALID`, `DEAL_CLOSING_LOCKED`) in addition to the HTTP status code. The frontend uses these codes — not the human-readable message — to decide what to display.

This decouples the frontend from backend wording. The same `400` status code can have dozens of different business reasons, each with its own code. The frontend maps codes to localized messages, UI actions, or error-specific handling.

We use the `nest-problem-details` library to emit RFC 7807 Problem Details responses. Each error includes: `type`, `title`, `status`, `code`, `detail`, `instance`, and an optional `i18nKey` for translation lookup.

This contract is as important as the OpenAPI schema. Frontend developers rely on the error code list to handle edge cases.

**Considered options**: Plain error messages (fragile, breaks when backend rewords), HTTP status only (not granular enough), error code enum (robust, contract, i18n-friendly).
