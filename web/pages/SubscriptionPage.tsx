import {
  JsonPanel,
  LoadingHero,
  OperatorThemeFrame,
  PageHero,
  ResultPanel,
  useOperatorTheme,
} from './pageChrome';
import { loadingLabels } from './helper/operatorShared';
import { RequestBuilderCard } from './requestBuilder';
export { normalizeCreateResult } from '../hooks/useSubscriptionOperator';
import { useSubscriptionOperator } from '../hooks/useSubscriptionOperator';

const moduleName = 'Subscription Module';
const pageTitle = 'Subscription Operator Console';
const previewEmptyState = 'Run a preview to inspect the exact subscription request body, URL, and masked headers.';
const resultEmptyState = 'Send a subscription request to capture the raw response, status code, and diagnostics.';

/**
 * Renders the subscription operator page for editing defaults, previewing payloads, and sending test requests.
 *
 * @returns The subscription test workbench page.
 */
export function SubscriptionPage() {
  const theme = useOperatorTheme();
  const {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
    resolvedPlanId,
    canSubmit,
    hasMissingPlanConfig,
    preview,
    apiResult,
    loading,
    error,
    defaultsLogContext,
    previewLogContext,
    createLogContext,
    commonFieldOverrides,
    updateApiKey,
    updateCommonValue,
    updateChannelValue,
    onChannelChange,
    actions,
  } = useSubscriptionOperator(theme.mode);
  const draftPlanId =
    typeof form?.channelValues.subs_plan_id === 'string' ? form.channelValues.subs_plan_id : resolvedPlanId;

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
        description="Edit shared subscription fields, review the signed payload preview, and run the test flow through the active API target."
        scopeLabel="Subscription"
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
            channelDetail={(
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
                    Plan ID
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-[var(--color-text)] shadow-[var(--operator-input-shadow)] transition duration-200"
                    value={draftPlanId}
                    onChange={(event) => updateChannelValue(['subs_plan_id'], event.target.value)}
                    onInput={(event) =>
                      updateChannelValue(['subs_plan_id'], (event.target as HTMLInputElement).value)
                    }
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]">
                    API key
                  </span>
                  <input
                    className="w-full rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-[var(--color-text)] shadow-[var(--operator-input-shadow)] transition duration-200"
                    value={apiKey}
                    onChange={(event) => updateApiKey(event.target.value)}
                    onInput={(event) => updateApiKey((event.target as HTMLInputElement).value)}
                  />
                </label>
              </div>
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
            footer={
              error && hasMissingPlanConfig ? (
                <div
                  className="rounded-[18px] border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)]"
                  role="alert"
                >
                  {error}
                  {!canSubmit ? ' Switch to a configured channel or fix the backend env before previewing or sending requests.' : ''}
                </div>
              ) : null
            }
          />
        </form>

        <section className="grid min-w-0 content-start gap-6">
          <JsonPanel title="Request preview" body={preview} emptyState={previewEmptyState} logContext={previewLogContext} />
          <ResultPanel
            statusLabel={apiResult ? `${apiResult.action.toUpperCase()}${apiResult.status !== null ? ` Status ${apiResult.status}` : ''}` : null}
            message={apiResult?.message ?? null}
            details={apiResult?.details ?? null}
            ok={apiResult?.ok}
            raw={apiResult?.raw}
            emptyState={resultEmptyState}
            logContext={apiResult?.logContext ?? createLogContext}
          />
        </section>
      </section>
    </OperatorThemeFrame>
  );
}
