-- S5-T05 (change 2): the contact page's form.
--
-- `record_form_submission` accepts only a stored, active form, so the contact page's first form is a row
-- like any other. The admin form builder (Stage 7) can edit it. If a form with this slug exists already
-- (an admin made it first), nothing is changed. The fields are the ones in
-- `src/features/forms/contact-form.ts`; a unit test keeps the two identical.

insert into public.forms (name, slug, kind, placement, button_text, fields, active)
values (
  'Contact us',
  'contact',
  'contact',
  'contact',
  'Send message',
  $fields$[
    {"label": "Your name", "key": "name", "type": "text", "required": true},
    {"label": "Mobile", "key": "mobile", "type": "text", "required": true},
    {"label": "Email", "key": "email", "type": "email", "placeholder": "you@example.com", "required": false},
    {"label": "I'm interested in", "key": "interest", "type": "dropdown", "options": ["A home to buy", "A home to rent", "A new project", "Listing my property", "Something else"], "required": false},
    {"label": "Message", "key": "message", "type": "textarea", "placeholder": "How can we help?", "max": 1000, "required": false}
  ]$fields$::jsonb,
  true
)
on conflict (slug) do nothing;
