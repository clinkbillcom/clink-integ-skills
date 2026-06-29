# Elements Integration

## Definition

Elements is the embedded checkout frontend path inside Standard Integration. It is an embedded payment component, not a hosted checkout page.

Use this module when the merchant chooses `@clink-ai/clink-elements`, `loadClinkElements`, `paymentMethod`, `currencySelect`, SDK event handling, iframe payment components, embedded checkout, or a custom host checkout UI.

Elements does not replace merchant backend responsibilities. The merchant backend still creates the checkout session, owns the local order and fulfillment context, verifies webhooks, and reconciles payment state.

## Mental Model

- The merchant controls page structure, order summary, payment button, promotion-code entry, loading states, and success or failure navigation.
- The SDK controls secure payment input, wallet buttons, 3DS, QRCode, payment method iframe behavior, and payment submission plumbing.
- `paymentMethod` and `currencySelect` can mount into any stable DOM region. They do not need to live inside a dialog.
- Inline checkout, modal or dialog checkout, drawer or side-panel checkout, right-side order cards, and multi-step checkout wizards are all valid host layouts.
- Frontend `session-success` and `session-pending` events are UX signals. Webhook-driven server state remains authoritative.

## Integration Shape Selection

| Shape | Use When | Host Responsibilities |
|---|---|---|
| Inline region | Payment should stay directly inside a product, recharge, or order page with low friction | Create the session when the user selects the purchasable item, mount Elements into a stable region, keep the order summary visible |
| Modal/Dialog | Payment should appear after a clear purchase intent without disrupting the main page | Create the session after `Buy Now`, mount Elements inside the dialog, destroy on close, keep dialog scroll and sizing stable |
| Drawer/Side panel | Checkout is paired with a cart or right-side order summary | Keep summary and payment visible together, handle mobile button placement, avoid covering the payment iframe |
| Multi-step checkout | Merchant must collect account, address, tax, or business inputs before payment | Complete merchant-owned inputs first, then create the session and mount `paymentMethod` |
| Headless host UI | Merchant wants full control of order summary, promo code, submit button, and state presentation | Use SDK for secure payment inputs and payment submission while host UI listens to SDK events |

Do not default Elements guidance to "build a payment dialog". A dialog is one recipe, not the product model.

For clinkcoins-like purchase flows, dialog checkout is valid. A more Elements-native option is to create the session after product selection and expand an inline or right-side payment area containing `currencySelect` and `paymentMethod`, while the merchant keeps ownership of the order card and uses `amount-change` to calibrate displayed totals.

## Server And Client Boundary

The core flow is:

1. Merchant server uses the Secret Key to create or confirm a local merchant order.
2. Merchant server creates a checkout session intended for Elements and stores reconciliation context.
3. Merchant server returns only `sessionId`, `publishKey`, and `environment`, or equivalent frontend-safe configuration.
4. Merchant client initializes `loadClinkElements` in browser-only code.
5. Merchant client handles SDK events for UX.
6. Merchant server verifies webhooks and performs authoritative order, subscription, refund, and fulfillment synchronization.

When creating an Elements checkout session, include the Elements UI mode and redirect placeholder in the server-side checkout session payload:

```js
{
  uiMode: "elements",
  redirectUrl: "https://merchant.example/checkout/{ELEMENTS_SESSION_ID}"
}
```

Set `uiMode: "elements"`. `{ELEMENTS_SESSION_ID}` is the placeholder for the session ID that will be filled for the created Elements session. Keep this request server-side because it belongs to checkout session creation.

Hard boundaries:

- never put Secret Key, server SDK calls, checkout session creation, or merchant order creation logic in browser code
- frontend code uses `publishKey`, `environment`, and `sessionId`
- Next.js and similar framework components that access the SDK or DOM must be client-only, for example with `"use client"`
- server-side webhook and reconciliation logic remains required even when `session-success` fires

## SDK Initialization

Bundler usage:

```ts
import { loadClinkElements } from '@clink-ai/clink-elements';
import type { ClinkElements, DueTodayAmountInfo } from '@clink-ai/clink-elements';
```

CDN usage:

```html
<script src="https://cdn.jsdelivr.net/npm/@clink-ai/clink-elements/dist/index.iife.js"></script>
<script>
  const { loadClinkElements } = window.ClinkElements;
</script>
```

Initialize with frontend-safe configuration only:

```ts
const clink = await loadClinkElements({
  publishKey: 'pk_xxx',
  environment: 'sandbox',
  sessionId: 'sess_xxx',
  presetOptions: {
    locale: 'en-US',
    theme: 'light',
    primaryColor: '#1677FF',
    radius: { components: 12, card: 14 },
    currencySelect: { hideIfOneCurrency: true },
  },
});
```

Default generated guidance should use `sandbox` unless production has passed the production validation gate.

## Brand Matching And Theme Adaptation

When the merchant website's visual style is discoverable, the agent should automatically adapt the Elements payment UI to the site's color and spacing system instead of leaving generic defaults.

Recommended discovery order:

1. Inspect existing design tokens, CSS variables, Tailwind or theme config, and component-library theme settings.
2. Inspect rendered or source styles for primary buttons, links, price cards, checkout panels, focus rings, border radius, and surface backgrounds.
3. Use computed styles from the running page when a browser is available.
4. Ask the user only when the site has multiple conflicting brand themes or the payment page should intentionally differ from the rest of the site.

Map the discovered style into frontend-safe `presetOptions`:

```ts
const clink = await loadClinkElements({
  publishKey,
  environment: 'sandbox',
  sessionId,
  presetOptions: {
    locale,
    theme: detectedTheme,
    primaryColor: detectedPrimaryColor,
    radius: {
      components: detectedControlRadius,
      card: detectedPanelRadius,
    },
    section: {
      hideSkeleton: useHostManagedSkeleton,
    },
  },
});
```

Keep the host checkout shell and SDK-controlled payment area visually coherent: match the primary action color, focus treatment, neutral surfaces, spacing density, and radius scale. Do not infer a palette from a logo alone when the page's actual checkout or pricing UI provides stronger signals.

## Element Lifecycle

- one `ClinkElements` instance maps to one checkout session
- when `sessionId` changes, destroy the old instance and call `loadClinkElements()` again
- `destroy()` is irreversible for that instance
- create `paymentMethod` before `currencySelect`
- each element type can be created only once per instance
- `unmount()` is idempotent; `destroy()` should be called during component teardown
- React and Vue examples must handle async initialization completing after component unmount
- modal close, route switch, selected product switch, and session recreation must trigger cleanup
- language and theme changes can use `setLocale` and `setTheme` when the same session remains valid; session-changing inputs require re-initialization

Lifecycle order:

```text
1. await loadClinkElements(options)
2. createElement('paymentMethod')
3. createElement('currencySelect') when needed
4. mount each element into a stable DOM container
5. listen to SDK events and update host UI
6. submit from host UI or built-in third-party payment UI
7. destroy on teardown or session replacement
```

## Headless Template Strategy

Prefer a headless integration layer plus layout recipes instead of one fixed checkout component.

For React, guidance should favor a `useClinkElementsPayment` hook:

```ts
type UseClinkElementsPaymentState = {
  currencyContainerRef: React.RefObject<HTMLDivElement>;
  paymentContainerRef: React.RefObject<HTMLDivElement>;
  amount?: DueTodayAmountInfo;
  submitEnabled: boolean;
  submitVisible: boolean;
  initializing: boolean;
  submitting: boolean;
  error?: Error;
  submit: () => void;
  applyPromoCode: (code: string) => void;
  clearPromoCode: () => void;
};
```

The hook or Vue composable should own:

- SDK initialization
- instance refs
- event subscriptions
- submit behavior
- promotion-code calls
- async teardown
- destroy/re-init rules

Layout recipes should consume the state for inline, modal, drawer, and multi-step checkout layouts.

`submit-enabled` payload is `true` when the host can submit and `false` when the host must block submission. Prefer `submitEnabled`, and compute button disabled state as:

```ts
const disabled = !submitEnabled || submitting || initializing;
```

`buttonDisabled` is acceptable only when assigned from the inverse event value, for example `disabled = !enabled`. Do not set `disabled = enabled`, pass the event payload directly into a disabled prop, or name the event argument `disabled`.

## Event To Host UI Mapping

| Event | Host UI Action |
|---|---|
| `submit-enabled` | Treat `true` as can-submit; derive disabled UI as `disabled = !enabled` plus local loading or initialization state for the payment button, promotion-code input, apply button, and remove button |
| `submit-visible` | Show or hide the host payment button when wallet or third-party buttons own submission |
| `amount-change` | Update total, currency, product display, discount, tax, and payment button text |
| `session-init-success` | Clear host-managed skeleton or initialization state |
| `session-success` | Close modal, navigate to success UI, or refresh order state while waiting for server confirmation where needed |
| `session-pending` | Show pending state and avoid treating it as payment success |
| `promo-code-error` | End promotion-code loading state and show input-level validation |
| `error` | Distinguish expired, completed, load, unsupported-session, API validation, and promotion-code errors |

Host UI must still reconcile order state through backend confirmation. Do not treat `successUrl`, iframe callbacks, or `session-success` alone as authoritative payment confirmation.

## Promotion-Code UI

When the merchant builds its own promotion-code UI:

- show the entry only when `amount-change` reports `enablePromotionCode`
- disable input, apply, and remove actions when `submit-enabled` is `false`; never pass the event payload directly to a `disabled` prop
- apply through `promoCodeChange({ type: 'apply', code })`
- clear through `promoCodeChange({ type: 'clear' })`
- set loading after apply or clear and clear loading on `amount-change` or `promo-code-error`
- use `promotionCodeInfo` from `amount-change` for applied state

Recommended host states:

- collapsed: "Add promo code"
- expanded: input, apply action, cancel action
- loading/error: disabled input plus validation text from `promo-code-error`
- applied: code name, discount amount, duration label, terms, remove action

## Skeleton And Loading Strategy

Two loading strategies are supported:

- SDK-managed skeleton: simplest path; leave `section.hideSkeleton` unset or `false`
- host-managed skeleton: set `section.hideSkeleton: true`, render merchant-owned loading UI, and clear it from `session-init-success` or a resolved initialization state

For branded flows, host-managed skeleton is often preferable because the payment area can match the surrounding order UI.

## Layout Guidance

- iframe height can adapt, but the host must provide stable containers
- inline mode should avoid parent `overflow: hidden` that clips payment, wallet, QRCode, or 3DS interactions
- modal mode should provide reasonable width, height, and an internal scroll area
- drawer mode should ensure mobile sticky buttons do not cover the payment iframe
- `paymentMethod` and `currencySelect` may appear in different visual regions, but creation order still matters
- closing a dialog or drawer should clear session state so component unmount triggers `destroy()`

## Error Handling

Handle these cases explicitly:

- `ClinkApiError`: `loadClinkElements` merchant or session validation failed
- `SessionExpiredError`: create a new session and let the user retry
- `SessionCompleteError`: show already-completed state and refresh merchant order status
- `SessionLoadError`: show loading failure and retry or recreate session
- `SessionNotSupportedError`: the session is not intended for Elements; recreate with the correct frontend path
- `PromoCodeError`: keep the payment form active and show promotion-code validation

## Review Rules

An Elements answer or code review should verify:

- the frontend framework is known before framework-specific code is generated
- backend-created checkout session exists before frontend initialization
- order creation and checkout session creation stay on the server
- Secret Key and webhook signing key are not present in frontend code
- client-only browser execution is used where DOM access is required
- `paymentMethod` is created before `currencySelect`
- one SDK instance does not create duplicate element types
- `destroy()` runs during teardown and session replacement
- `submit-enabled` is interpreted as "can submit"; `true` enables host submission and `false` blocks it
- `submit-visible` is handled to avoid duplicate host and wallet buttons
- `amount-change` drives displayed amount, product, promotion, and tax UI
- `session-success` and `session-pending` stay UX signals only
- webhook-driven backend state remains the source of truth
- site colors, design tokens, computed styles, and radius scale are inspected before setting Elements `presetOptions`
