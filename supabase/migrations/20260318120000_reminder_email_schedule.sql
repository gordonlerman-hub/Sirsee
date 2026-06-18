-- Scheduling columns for reminder digest emails.
alter table public.reminders
  add column if not exists next_send_at timestamptz,
  add column if not exists last_sent_at timestamptz;

create index if not exists reminders_next_send_at_idx
  on public.reminders (next_send_at)
  where next_send_at is not null;
