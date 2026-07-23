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
import { RequestBuilderCard } from './requestBuilder';
import { useDepositOperator } from '../hooks/useDepositOperator';

const pageTitle = 'Deposit';
const previewEmptyState = 'Run a preview to inspect the exact request body, URL, and masked headers.';
const resultEmptyState = 'Send a request to capture the raw response, status code, and any diagnostic hint.';
const draftNotice =
  'Temporary session draft. Changes stay in this tab session and reset when you start a new draft.';

/**
 * Renders the deposit operator page for editing defaults, previewing payloads, and sending test requests.
 *
 * @returns The deposit test workbench page.
 */
export function DepositPage() {
  const theme = useOperatorTheme();
  const {
    form,
    apiKey,
    commonSchema,
    channelSchema,
    channels,
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
  } = useDepositOperator(theme.mode);

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
        scopeLabel="Deposit"
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
