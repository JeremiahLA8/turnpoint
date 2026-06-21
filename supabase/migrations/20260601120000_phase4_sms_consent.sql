-- Phase 4 follow-up: explicit, auditable SMS opt-in consent.
--
-- The A2P 10DLC campaign was rejected for insufficient opt-in information.
-- Carriers require an affirmative, separate consent action (a checkbox) plus
-- a durable record of WHEN the user consented and to WHAT disclosure text.
-- These columns capture that audit trail so the opt-in is verifiable.

alter table public.profiles
  add column if not exists sms_consent_at timestamptz,
  add column if not exists sms_consent_text text;

comment on column public.profiles.sms_consent_at is
  'Timestamp the user affirmatively opted in to operational SMS. NULL = no consent on file (do not text).';
comment on column public.profiles.sms_consent_text is
  'Verbatim disclosure text the user agreed to at opt-in time (versioned audit trail).';
