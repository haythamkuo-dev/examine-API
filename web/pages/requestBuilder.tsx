import type { ReactNode } from 'react';
import { ActionButton, PageCard, SectionHeading } from './pageChrome';

const fieldsetClassName =
  'mb-4 rounded-[22px] border border-[var(--operator-card-soft-border)] bg-[var(--operator-card-soft-bg)] p-4';
const fieldLabelClassName = 'mb-4 grid gap-2';
const fieldLabelTextClassName =
  'text-[13px] font-medium tracking-[0.01em] text-[color:var(--color-text-muted)]';
const inputClassName =
  'w-full rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-[var(--color-text)] shadow-[var(--operator-input-shadow)] transition duration-200';
const textareaClassName = `${inputClassName} min-h-24 resize-y`;
const helperTextClassName = 'text-xs leading-5 text-[color:var(--color-text-muted)]/80';

type ActionTone = 'primary' | 'secondary' | 'ghost';

type SharedFieldOption = {
  label: string;
  value: string;
};

type SharedFieldSchemaBase = {
  label: string;
  required?: boolean;
  helperText?: string;
};

type SharedTextFieldSchema = SharedFieldSchemaBase & {
  kind: 'text' | 'textarea';
  placeholder?: string;
};

type SharedNumberFieldSchema = SharedFieldSchemaBase & {
  kind: 'number';
  placeholder?: string;
};

type SharedSelectFieldSchema = SharedFieldSchemaBase & {
  kind: 'select';
  options: SharedFieldOption[];
};

type SharedBooleanFieldSchema = SharedFieldSchemaBase & {
  kind: 'boolean';
};

type SharedObjectFieldSchema = SharedFieldSchemaBase & {
  kind: 'object';
  fields: SharedFieldMap;
};

type SharedArrayFieldSchema = SharedFieldSchemaBase & {
  kind: 'array';
  itemLabel: string;
  itemSchema: SharedObjectFieldSchema;
};

export type SharedFieldSchema =
  | SharedTextFieldSchema
  | SharedNumberFieldSchema
  | SharedSelectFieldSchema
  | SharedBooleanFieldSchema
  | SharedObjectFieldSchema
  | SharedArrayFieldSchema;

export type SharedFieldMap = Record<string, SharedFieldSchema>;

export type FieldVisibilityResolver = (
  schema: SharedFieldSchema,
  value: unknown,
) => boolean;

type RequestBuilderAction = {
  label: string;
  tone?: ActionTone;
  onClick: () => void;
};

export type RequestBuilderFieldOverride = {
  action?: RequestBuilderAction;
  readOnly?: boolean;
  badge?: string;
};

const FieldLabel = ({
  label,
  required,
  helperText,
}: {
  label: string;
  required?: boolean;
  helperText?: string;
}) => (
  <>
    <span className={fieldLabelTextClassName}>
      {label}
      {required ? ' *' : ''}
    </span>
    {helperText ? <span className={helperTextClassName}>{helperText}</span> : null}
  </>
);

const toInputValue = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

const parseNumericInputValue = (value: string): number | '' => {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return '';
  }

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : '';
};

/**
 * Renders a schema-driven nested form using recursive object and array traversal.
 *
 * @param props Schema, values, and change handlers for the current subtree.
 * @returns Form controls for the provided schema tree.
 */
export function SchemaFields(props: {
  schemaMap: SharedFieldMap;
  values: Record<string, unknown>;
  pathPrefix: Array<string | number>;
  onChange: (path: Array<string | number>, value: unknown) => void;
  fieldOverrides?: Record<string, RequestBuilderFieldOverride>;
  disabled?: boolean;
  visibilityResolver?: FieldVisibilityResolver;
}) {
  const { schemaMap, values, pathPrefix, onChange, fieldOverrides, disabled = false, visibilityResolver } = props;

  return Object.entries(schemaMap).map(([key, schema]) => {
    const value = values[key];
    const fieldPath = [...pathPrefix, key];
    const pathKey = fieldPath.join('.');
    const inputId = `field-${pathKey.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
    const fieldOverride = fieldOverrides?.[pathKey];

    if (visibilityResolver?.(schema, value)) {
      return null;
    }

    if (schema.kind === 'object') {
      const objectValues = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      return (
        <fieldset className={fieldsetClassName} key={pathKey}>
          <legend className="px-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
            {schema.label}
            {schema.required ? ' *' : ''}
          </legend>
          {schema.helperText ? <p className={`mb-4 ${helperTextClassName}`}>{schema.helperText}</p> : null}
          <SchemaFields
            schemaMap={schema.fields}
            values={objectValues}
            pathPrefix={fieldPath}
            onChange={onChange}
            fieldOverrides={fieldOverrides}
            disabled={disabled}
            visibilityResolver={visibilityResolver}
          />
        </fieldset>
      );
    }

    if (schema.kind === 'array') {
      const items = Array.isArray(value) ? value : [];
      return (
        <div className="mb-[14px] grid gap-3" key={pathKey}>
          <div className="flex items-center justify-between gap-3 text-[13px] text-[color:var(--color-text-muted)]">
            <span>{schema.label}</span>
            <span>{items.length} items</span>
          </div>
          {schema.helperText ? <p className={helperTextClassName}>{schema.helperText}</p> : null}
          {items.map((item, index) => (
            <fieldset className={fieldsetClassName} key={`${pathKey}.${index}`}>
              <legend className="px-2 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                {schema.itemLabel} {index + 1}
              </legend>
              <SchemaFields
                schemaMap={schema.itemSchema.fields}
                values={(item || {}) as Record<string, unknown>}
                pathPrefix={[...fieldPath, index]}
                onChange={onChange}
                fieldOverrides={fieldOverrides}
                disabled={disabled}
                visibilityResolver={visibilityResolver}
              />
            </fieldset>
          ))}
        </div>
      );
    }

    if (schema.kind === 'boolean') {
      return (
        <label
          className="mb-4 flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--operator-card-soft-border)] bg-[var(--operator-card-soft-bg)] px-4 py-3"
          key={pathKey}
        >
          <input
            className="h-4 w-4 accent-[var(--color-primary)]"
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(fieldPath, event.target.checked)}
          />
          <span className="grid gap-1 text-sm text-[var(--color-text)]">
            <span>
              {schema.label}
              {schema.required ? ' *' : ''}
            </span>
            {schema.helperText ? <span className={helperTextClassName}>{schema.helperText}</span> : null}
          </span>
        </label>
      );
    }

    if (schema.kind === 'select') {
      return (
        <div className={fieldLabelClassName} key={pathKey}>
          <label htmlFor={inputId}>
            <FieldLabel label={schema.label} required={schema.required} helperText={schema.helperText} />
          </label>
          <select
            id={inputId}
            className={inputClassName}
            disabled={disabled}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          >
            <option value="">Select an option</option>
            {schema.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (schema.kind === 'textarea') {
      return (
        <div className={fieldLabelClassName} key={pathKey}>
          <label htmlFor={inputId}>
            <FieldLabel label={schema.label} required={schema.required} helperText={schema.helperText} />
          </label>
          <textarea
            id={inputId}
            className={textareaClassName}
            disabled={disabled}
            placeholder={schema.placeholder}
            readOnly={fieldOverride?.readOnly}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          />
        </div>
      );
    }

    if (schema.kind === 'number') {
      return (
        <div className={fieldLabelClassName} key={pathKey}>
          <label htmlFor={inputId}>
            <span className="flex flex-wrap items-center gap-2">
              <FieldLabel label={schema.label} required={schema.required} helperText={schema.helperText} />
              {fieldOverride?.badge ? (
                <span
                  aria-hidden="true"
                  className="rounded-full border border-[var(--operator-card-soft-border)] bg-[var(--operator-card-soft-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]"
                >
                  {fieldOverride.badge}
                </span>
              ) : null}
            </span>
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            className={`${inputClassName} ${fieldOverride?.action ? 'sm:flex-1' : ''}`}
            disabled={disabled}
            placeholder={schema.placeholder}
            readOnly={fieldOverride?.readOnly}
            aria-readonly={fieldOverride?.readOnly ? 'true' : undefined}
            value={toInputValue(value)}
            onChange={(event) => onChange(fieldPath, parseNumericInputValue(event.target.value))}
          />
        </div>
      );
    }

    return (
      <div className={fieldLabelClassName} key={pathKey}>
        <label htmlFor={inputId}>
            <span className="flex flex-wrap items-center gap-2">
              <FieldLabel label={schema.label} required={schema.required} helperText={schema.helperText} />
              {fieldOverride?.badge ? (
                <span
                  aria-hidden="true"
                  className="rounded-full border border-[var(--operator-card-soft-border)] bg-[var(--operator-card-soft-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]"
                >
                  {fieldOverride.badge}
                </span>
              ) : null}
            </span>
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            id={inputId}
            className={`${inputClassName} ${fieldOverride?.action ? 'sm:flex-1' : ''}`}
            disabled={disabled}
            placeholder={schema.placeholder}
            readOnly={fieldOverride?.readOnly}
            aria-readonly={fieldOverride?.readOnly ? 'true' : undefined}
            value={toInputValue(value)}
            onChange={(event) => onChange(fieldPath, event.target.value)}
          />
          {fieldOverride?.action ? (
            <ActionButton
              type="button"
              tone={fieldOverride.action.tone}
              onClick={fieldOverride.action.onClick}
              disabled={disabled}
              className="min-h-11 shrink-0 px-4 sm:min-h-12 sm:px-5"
            >
              {fieldOverride.action.label}
            </ActionButton>
          ) : null}
        </div>
      </div>
    );
  });
}

/**
 * Renders the shared request-builder card used by the operator pages.
 *
 * @param props Channel selector, schema sections, actions, and optional footer content.
 * @returns Shared form card for editing and dispatching operator requests.
 */
export function RequestBuilderCard(props: {
  channels: string[];
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  channelLabel?: (channel: string) => string;
  channelDetail?: ReactNode;
  commonSchema: SharedFieldMap;
  commonValues: Record<string, unknown>;
  onCommonValueChange: (key: string, value: string) => void;
  commonFieldOverrides?: Record<string, RequestBuilderFieldOverride>;
  channelFieldOverrides?: Record<string, RequestBuilderFieldOverride>;
  channelSchema: SharedFieldMap;
  channelValues: Record<string, unknown>;
  onChannelValueChange: (path: Array<string | number>, value: unknown) => void;
  loadingLabel: string;
  disabled: boolean;
  actions: RequestBuilderAction[];
  footer?: ReactNode;
  visibilityResolver?: FieldVisibilityResolver;
}) {
  const {
    channels,
    selectedChannel,
    onChannelChange,
    channelLabel = (channel) => channel,
    channelDetail,
    commonSchema,
    commonValues,
    onCommonValueChange,
    commonFieldOverrides,
    channelFieldOverrides,
    channelSchema,
    channelValues,
    onChannelValueChange,
    loadingLabel,
    disabled,
    actions,
    footer,
    visibilityResolver,
  } = props;

  return (
    <PageCard className="p-6">
      <SectionHeading title="Request builder" detail={loadingLabel} />

      <div
        className="max-h-[32rem] min-w-0 overflow-y-auto rounded-2xl border border-[var(--operator-card-border)] bg-[var(--operator-card-bg)] p-4 shadow-[var(--operator-input-shadow)] lg:max-h-[calc(100vh-18rem)]"
        data-testid="request-builder-fields"
      >
        <label className={fieldLabelClassName}>
          <span className={fieldLabelTextClassName}>Channel</span>
          <select className={inputClassName} value={selectedChannel} onChange={(event) => onChannelChange(event.target.value)}>
            {channels.map((channel) => (
              <option key={channel} value={channel}>
                {channelLabel(channel)}
              </option>
            ))}
          </select>
        </label>
        {channelDetail ? <div className="mt-3">{channelDetail}</div> : null}

        <div className="mt-4 border-t border-[var(--operator-card-soft-border)] pt-5">
          <SectionHeading title="Shared fields" />
          <SchemaFields
            schemaMap={commonSchema}
            values={commonValues}
            pathPrefix={[]}
            onChange={(path, value) => {
              const key = path[0];
              if (typeof key === 'string' && typeof value === 'string') {
                onCommonValueChange(key, value);
              }
            }}
            fieldOverrides={commonFieldOverrides}
            disabled={disabled}
          />
        </div>

        <div className="mt-4 border-t border-[var(--operator-card-soft-border)] pt-5">
          <SectionHeading title="Channel fields" />
          <SchemaFields
            schemaMap={channelSchema}
            values={channelValues}
            pathPrefix={[]}
            onChange={onChannelValueChange}
            disabled={disabled}
            fieldOverrides={channelFieldOverrides}
            visibilityResolver={visibilityResolver}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {actions.map((action) => (
          <ActionButton
            key={action.label}
            type="button"
            tone={action.tone}
            onClick={action.onClick}
            disabled={disabled}
          >
            {action.label}
          </ActionButton>
        ))}
      </div>

      {footer ? <div className="mt-4">{footer}</div> : null}
    </PageCard>
  );
}
