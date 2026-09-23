-- form_answers was a raw payload dump superseded by custom_fields.
-- Every populated row also has custom_fields; app code never read it and
-- stripped it from all writes (omitLegacyLeadColumns).

alter table public.leads drop column if exists form_answers;
