import {
  JsonPanel,
  LoadingHero,
  OperatorThemeFrame,
  PageHero,
  ResultPanel,
  useOperatorTheme,
} from './pageChrome';
import { ApiKeyEditorTrigger } from './ApiKeyEditorTrigger';
import { loadingLabels } from './helper/operatorShared';
import {
  RequestBuilderCard,
} from './requestBuilder';
export { normalizeCreateResult, shouldHidePayoutField } from '../hooks/usePayoutOperator';
import { usePayoutOperator } from '../hooks/usePayoutOperator';

const pageTitle = 'Payout';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and diagnostics.';
const draftNotice =
  'Temporary session draft. Changes stay in this tab session and reset when you start a new draft.';

/**
 * Renders the payout operator page for editing defaults, previewing payloads, and sending payout tests.
 *
 * @returns The payout test workbench page.
 */
export function PayoutPage() {
  const theme = useOperatorTheme();
  const {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
    preview,
    result,
    loading,
    error,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    visibilityResolver,
    updateApiKey,
    updateCommonValue,
    updateChannelValue,
    onChannelChange,
    actions,
  } = usePayoutOperator(theme.mode);

  if (!form) {
    return (
      <OperatorThemeFrame>
        <LoadingHero
          title={pageTitle}
          message={loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
          isLoading={loading === 'defaults'}
          environmentLabel={theme.environmentLabel}
          targetLabel={defaultsLogContext.targetLabel}
        />
      </OperatorThemeFrame>
    );
  }

  return (
    <OperatorThemeFrame>
      <PageHero
        title={pageTitle}
        scopeLabel="Payout"
        environmentLabel={theme.environmentLabel}
        environmentMode={theme.mode}
        onEnvironmentChange={theme.setMode}
      />

      <section className="grid gap-6 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <form
          className="contents"
          onSubmit={(event) => event.preventDefault()}
        >
          <RequestBuilderCard
            channels={channels}
            selectedChannel={form.channel}
            onChannelChange={onChannelChange}
            channelDetail={(
              <ApiKeyEditorTrigger
                apiKey={apiKey}
                disabled={loading !== null}
                onConfirm={updateApiKey}
              />
            )}
            commonSchema={commonSchema}
            commonValues={form.commonValues as Record<string, unknown>}
            onCommonValueChange={updateCommonValue}
            commonFieldOverrides={commonFieldOverrides}
            channelSchema={channelSchema}
            channelValues={form.channelValues}
            onChannelValueChange={updateChannelValue}
            loadingLabel={loading ? loadingLabels[loading] : 'Form ready'}
            disabled={loading !== null}
            actions={actions}
            visibilityResolver={visibilityResolver}
            footer={
              <>
                <p className="text-sm text-[color:var(--color-text-muted)]">{draftNotice}</p>
                {error ? <p className="text-sm text-[color:var(--color-text-muted)]">{error}</p> : null}
              </>
            }
          />
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel
            title="Request preview"
            body={preview ? { payload: preview.request.payload } : null}
            emptyState={previewEmptyState}
            logContext={previewLogContext}
          />
          <ResultPanel
            statusLabel={
              result
                ? `${result.action.toUpperCase()}${result.status !== null ? ` Status ${result.status}` : ''}`
                : null
            }
            message={result?.message ?? null}
            details={result?.details ?? null}
            ok={result?.ok}
            raw={result?.raw}
            emptyState={resultEmptyState}
            logContext={result?.logContext ?? createLogContext}
          />
        </section>
      </section>
    </OperatorThemeFrame>
  );
}
