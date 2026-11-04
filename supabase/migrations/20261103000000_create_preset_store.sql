create schema if not exists preset_store;

create table if not exists preset_store.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default clock_timestamp()
);

create table if not exists preset_store.preset_sets (
  feature text primary key,
  common_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint preset_sets_feature_check
    check (feature in ('deposit', 'payout', 'subscription')),
  constraint preset_sets_common_values_object_check
    check (jsonb_typeof(common_values) = 'object')
);

create table if not exists preset_store.preset_channels (
  feature text not null,
  channel text not null,
  channel_common_values jsonb not null default '{}'::jsonb,
  channel_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint preset_channels_pkey primary key (feature, channel),
  constraint preset_channels_feature_fkey
    foreign key (feature)
    references preset_store.preset_sets (feature)
    on delete cascade,
  constraint preset_channels_feature_check
    check (feature in ('deposit', 'payout', 'subscription')),
  constraint preset_channels_channel_check
    check (btrim(channel) <> ''),
  constraint preset_channels_common_values_object_check
    check (jsonb_typeof(channel_common_values) = 'object'),
  constraint preset_channels_values_object_check
    check (jsonb_typeof(channel_values) = 'object')
);

create or replace function preset_store.set_preset_timestamps()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := clock_timestamp();
  else
    new.created_at := old.created_at;
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists preset_sets_set_timestamps on preset_store.preset_sets;

create trigger preset_sets_set_timestamps
before insert or update on preset_store.preset_sets
for each row
execute function preset_store.set_preset_timestamps();

drop trigger if exists preset_channels_set_timestamps on preset_store.preset_channels;

create trigger preset_channels_set_timestamps
before insert or update on preset_store.preset_channels
for each row
execute function preset_store.set_preset_timestamps();

revoke all on schema preset_store from public;
revoke all on all tables in schema preset_store from public;
revoke all on all functions in schema preset_store from public;

insert into preset_store.schema_migrations (version)
values ('20261103000000')
on conflict (version) do nothing;
