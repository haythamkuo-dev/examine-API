import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ActionButton, PageCard, SectionHeading } from './pageChrome';
import { FaChevronDown } from 'react-icons/fa';
import { useModal } from './utils/modal';

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
  /** Render the value as static text instead of a form control. */
  displayOnly?: boolean;
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

const normalizeChannelSearchText = (value: string): string =>
  value.toLocaleLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

const channelShortcut =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? { label: '⌘K', ariaKey: 'Meta+K' }
    : { label: 'Ctrl K', ariaKey: 'Control+K' };

const isEditableElement = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  return (
    element.isContentEditable ||
    Boolean(element.closest('input:not([readonly]), textarea:not([readonly]), select, [contenteditable]'))
  );
};

type ChannelPickerDialogProps = {
  channels: string[];
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  channelLabel: (channel: string) => string;
};

function ChannelPickerDialog({
  channels,
  selectedChannel,
  onChannelChange,
  channelLabel,
}: ChannelPickerDialogProps) {
  const selectorId = useId();
  const listboxId = `${selectorId}-products`;
  const [channelSearch, setChannelSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { closeModal } = useModal();
  const normalizedSearch = normalizeChannelSearchText(channelSearch);
  const filteredChannels = useMemo(() => {
    if (!normalizedSearch) {
      return channels;
    }

    return channels.filter((channel) =>
      normalizeChannelSearchText(`${channel} ${channelLabel(channel)}`).includes(normalizedSearch),
    );
  }, [channels, channelLabel, normalizedSearch]);
  const productLabel = channels.length === 1 ? 'product' : 'products';
  const activeIndex = filteredChannels.length > 0 ? Math.min(highlightedIndex, filteredChannels.length - 1) : -1;

  const selectChannel = (channel: string) => {
    onChannelChange(channel);
    closeModal();
  };

  return (
    <div className="grid gap-4">
      <label className="relative block">
        <input
          type="search"
          className={`${inputClassName} pr-11`}
          aria-label="Channel"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded="true"
          aria-haspopup="listbox"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          role="combobox"
          data-modal-autofocus="true"
          placeholder="Search products or channel ID"
          value={channelSearch}
          onInput={(event) => {
            setChannelSearch(event.currentTarget.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setHighlightedIndex((currentIndex) =>
                filteredChannels.length > 0 ? (currentIndex + 1) % filteredChannels.length : -1,
              );
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setHighlightedIndex((currentIndex) =>
                filteredChannels.length > 0
                  ? (currentIndex - 1 + filteredChannels.length) % filteredChannels.length
                  : -1,
              );
              return;
            }

            if (event.key === 'Enter') {
              const channel = filteredChannels[activeIndex];
              if (channel) {
                event.preventDefault();
                selectChannel(channel);
              }
              return;
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              closeModal();
            }
          }}
          autoComplete="off"
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-[var(--operator-card-border)] bg-[var(--operator-card-bg)] shadow-[var(--operator-input-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-[color:var(--color-text-muted)]">
          <span>Products</span>
          <span aria-live="polite" className="tabular-nums">
            {filteredChannels.length} of {channels.length} {productLabel}
          </span>
        </div>

        {filteredChannels.length > 0 ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label="Products"
            className="grid max-h-64 gap-1 overflow-y-auto border-t border-[var(--operator-card-soft-border)] p-1"
          >
            {filteredChannels.map((channel, index) => {
              const isHighlighted = index === activeIndex;
              const isSelected = channel === selectedChannel;

              return (
                <button
                  key={channel}
                  id={`${listboxId}-option-${index}`}
                  type="button"
                  role="option"
                  value={channel}
                  aria-label={channelLabel(channel)}
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={`grid min-h-11 w-full cursor-pointer gap-0.5 rounded-xl px-3 py-2 text-left text-sm transition duration-200 ${
                    isHighlighted
                      ? 'bg-[var(--app-option-card-hover-bg)] text-[var(--color-text)]'
                      : 'text-[color:var(--color-text-muted)]'
                  } ${isSelected ? 'ring-1 ring-[var(--color-primary)]/60' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectChannel(channel)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="truncate">{channelLabel(channel)}</span>
                  <span className="truncate text-xs text-[color:var(--color-text-muted)]">{channel}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p
            className="border-t border-[var(--operator-card-soft-border)] px-4 py-3 text-sm text-[color:var(--color-text-muted)]"
            role="status"
          >
            {normalizedSearch
              ? `No products match “${channelSearch.trim()}”.`
              : 'No products are available.'}
          </p>
        )}
      </div>
    </div>
  );
}

function ProductChannelSelector(props: {
  channels: string[];
  selectedChannel: string;
  onChannelChange: (channel: string) => void;
  channelLabel: (channel: string) => string;
  disabled: boolean;
}) {
  const { channels, selectedChannel, onChannelChange, channelLabel, disabled } = props;
  const { openModal, closeModal, isOpen } = useModal();

  const openSelector = useCallback(() => {
    if (disabled) {
      return;
    }

    openModal({
      title: 'Select channel',
      description: 'Search by channel name or ID, then choose a channel to continue.',
      dismissible: true,
      children: (
        <ChannelPickerDialog
          channels={channels}
          selectedChannel={selectedChannel}
          onChannelChange={onChannelChange}
          channelLabel={channelLabel}
        />
      ),
    });
  }, [channelLabel, channels, disabled, onChannelChange, openModal, selectedChannel]);

  useEffect(() => {
    if (disabled && isOpen) {
      closeModal();
    }
  }, [closeModal, disabled, isOpen]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (
        disabled ||
        isOpen ||
        event.defaultPrevented ||
        event.key.toLocaleLowerCase() !== 'k' ||
        (!event.metaKey && !event.ctrlKey) ||
        event.altKey ||
        event.shiftKey ||
        isEditableElement(event.target) ||
        isEditableElement(document.activeElement)
      ) {
        return;
      }

      event.preventDefault();
      openSelector();
    };

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [disabled, isOpen, openSelector]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className={fieldLabelTextClassName}>Channel</span>
          <kbd
            aria-hidden="true"
            className="rounded-md border border-[var(--operator-card-border)] bg-[var(--operator-ghost-button-bg)] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[color:var(--color-text-muted)]"
          >
            {channelShortcut.label}
          </kbd>
        </span>
        <span className="text-xs text-[color:var(--color-text-muted)]">Search by name or ID</span>
      </div>

      <button
        type="button"
        aria-label={`Open channel selector. Current channel: ${
          selectedChannel ? channelLabel(selectedChannel) : 'none'
        }`}
        aria-keyshortcuts={channelShortcut.ariaKey}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={openSelector}
        className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-left text-[var(--color-text)] shadow-[var(--operator-input-shadow)] transition duration-200 hover:border-[var(--color-primary)]/60 hover:bg-[var(--app-option-card-hover-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-sm font-medium">
          {selectedChannel ? channelLabel(selectedChannel) : 'Select a channel'}
        </span>
        <FaChevronDown
          aria-hidden="true"
          className={`shrink-0 text-xs text-[color:var(--color-text-muted)] transition duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}

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

    if (
      fieldOverride?.displayOnly &&
      (schema.kind === 'text' || schema.kind === 'textarea' || schema.kind === 'number')
    ) {
      const valueText = toInputValue(value);
      const displayText = valueText || schema.placeholder || '—';

      return (
        <dl className={fieldLabelClassName} key={pathKey}>
          <div className="grid gap-2">
            <dt>
              <span className="flex flex-wrap items-center gap-2">
                <span className={fieldLabelTextClassName}>
                  {schema.label}
                  {schema.required ? ' *' : ''}
                </span>
                {fieldOverride.badge ? (
                  <span
                    aria-hidden="true"
                    className="rounded-full border border-[var(--operator-card-soft-border)] bg-[var(--operator-card-soft-bg)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-text-muted)]"
                  >
                    {fieldOverride.badge}
                  </span>
                ) : null}
              </span>
              {schema.helperText ? <p className={helperTextClassName}>{schema.helperText}</p> : null}
            </dt>
            <dd className="m-0 flex flex-col gap-3 sm:flex-row sm:items-center">
              <span
                className={`min-w-0 flex-1 select-text break-all rounded-2xl border border-[var(--operator-input-border)] bg-[var(--operator-input-bg)] px-4 py-3 text-sm shadow-[var(--operator-input-shadow)] ${
                  valueText ? 'text-[var(--color-text)]' : 'text-[color:var(--color-text-muted)]'
                }`}
              >
                {displayText}
              </span>
              {fieldOverride.action ? (
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
            </dd>
          </div>
        </dl>
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
        <ProductChannelSelector
          channels={channels}
          selectedChannel={selectedChannel}
          onChannelChange={onChannelChange}
          channelLabel={channelLabel}
          disabled={disabled}
        />
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
