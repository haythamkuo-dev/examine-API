import {
  JsonPanel,
  LoadingHero,
  OperatorThemeFrame,
  PageHero,
  ResultPanel,
  useOperatorTheme,
} from './pageChrome';
import { loadingLabels } from './operatorShared';
import {
  RequestBuilderCard,
} from './requestBuilder';
export {
  normalizeCreateResult,
  shouldHidePayoutField,
} from '../hooks/usePayoutOperator';
import { usePayoutOperator } from '../hooks/usePayoutOperator';

const moduleName = 'Payout Module';
const pageTitle = 'Payout Operator Console';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and diagnostics.';

/**
 * Renders the payout operator page for editing defaults, previewing payloads, and sending payout tests.
 *
 * @returns The payout test workbench page.
 */
export function PayoutPage() {
  const theme = useOperatorTheme();
  const {
    form,
    commonSchema,
    channelSchema,
    channels,
    preview,
    result,
    loading,
    error,
    saveMessage,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    visibilityResolver,
    updateCommonValue,
    updateChannelValue,
    onChannelChange,
    actions,
  } = usePayoutOperator(theme.mode);

  if (!form) {
    return (
      <OperatorThemeFrame>
        <LoadingHero
          eyebrow={moduleName}
          title={pageTitle}
          message={loading === 'defaults' ? 'Loading server-side defaults for the selected channel.' : error || 'Unable to load defaults.'}
          environmentMode={theme.mode}
          onEnvironmentChange={theme.setMode}
          environmentLabel={theme.environmentLabel}
          targetLabel={defaultsLogContext.targetLabel}
        />
      </OperatorThemeFrame>
    );
  }

  return (
    <OperatorThemeFrame>
      <PageHero
        eyebrow={moduleName}
        title={pageTitle}
        description="Edit shared payout fields, switch channel-specific payload sections, preview the signed request, and run the test through the active API target."
        scopeLabel="Payout"
        statusLabel={loading ? loadingLabels[loading] : 'Ready to test'}
        environmentMode={theme.mode}
        onEnvironmentChange={theme.setMode}
        environmentLabel={theme.environmentLabel}
        targetLabel={createLogContext.targetLabel}
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
                {error ? <p className="text-sm text-[color:var(--color-text-muted)]">{error}</p> : null}
                {saveMessage ? <p className="text-sm text-[var(--status-success-text)]">{saveMessage}</p> : null}
              </>
            }
          />
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} logContext={previewLogContext} />
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
