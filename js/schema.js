/* ==========================================================================
   FormCraft — Form Schema
   Edit this file to change the form's fields without touching the engine.
   Every field type supported by js/fields.js is demonstrated below.
   ========================================================================== */

const FORM_SCHEMA = {
  formId: 'formcraft-demo-v1',
  title: 'Project Intake Form',
  subtitle: 'Tell us about your project — takes about 3 minutes.',
  submitLabel: 'Submit application',
  // Apps Script Web App URL — replace after deployment (see README).
  endpoint: 'https://script.google.com/macros/s/AKfycbxbhVEw7YNCRXKZrF2J7SZ_A_mqpVF-VJeHEWQv2kDWcC4dzsly1YROixf-nCmm0Jol/exec',

  steps: [
    {
      title: 'About you',
      description: 'Basic contact details.',
      fields: [
        { id: 'full_name', type: 'text', label: 'Full name', placeholder: 'Ada Lovelace', required: true, maxLength: 80, autocomplete: 'name' },
        { id: 'email', type: 'email', label: 'Email address', placeholder: 'ada@example.com', required: true, autocomplete: 'email' },
        { id: 'phone', type: 'phone', label: 'Phone number', placeholder: '(555) 123-4567', required: true, hint: 'US format, digits only auto-formatted.' },
        { id: 'website', type: 'url', label: 'Portfolio / website', placeholder: 'https://yoursite.com', required: false },
        { id: 'password', type: 'password', label: 'Create a client password', required: true, hint: 'Min. 8 characters, used to view your submission status later.', minLength: 8 },
        { id: 'referral', type: 'dropdown', label: 'How did you hear about us?', required: true,
          options: ['Search engine', 'Social media', 'Friend or colleague', 'Conference / event', 'Other'] },
      ],
    },
    {
      title: 'Project preferences',
      description: 'Help us understand the shape of the work.',
      fields: [
        { id: 'plan', type: 'radio', label: 'Engagement type', required: true,
          options: ['Solo project', 'Team engagement', 'Enterprise retainer'] },
        { id: 'team_size', type: 'number', label: 'Approximate team size', required: true, min: 2, max: 500,
          conditional: { field: 'plan', operator: 'equals', value: 'Team engagement' } },
        { id: 'interests', type: 'checkbox', label: 'Areas of interest', required: true,
          options: ['Product design', 'Frontend engineering', 'Backend / APIs', 'Data & analytics', 'DevOps'] },
        { id: 'skills', type: 'multiselect', label: 'Relevant skills (select all that apply)', required: false,
          options: ['JavaScript', 'Python', 'Figma', 'SQL', 'React', 'Google Apps Script', 'Tailwind CSS'] },
        { id: 'brand_color', type: 'color', label: 'Brand color', required: false, default: '#0F766E' },
        { id: 'budget', type: 'range', label: 'Estimated budget (USD)', required: true, min: 500, max: 20000, step: 500, default: 5000 },
        { id: 'satisfaction', type: 'rating', label: 'How excited are you about this project?', required: true, max: 5 },
        { id: 'newsletter', type: 'toggle', label: 'Subscribe to product updates', required: false },
      ],
    },
    {
      title: 'Project details',
      description: 'The specifics — dates and a short brief.',
      fields: [
        { id: 'start_date', type: 'date', label: 'Preferred start date', required: true },
        { id: 'preferred_time', type: 'time', label: 'Best time for a kickoff call', required: false },
        { id: 'message', type: 'textarea', label: 'Project brief', required: true, maxLength: 600,
          placeholder: 'Describe your goals, constraints, and timeline…' },
      ],
    },
    {
      title: 'Attachments & signature',
      description: 'Upload any supporting files and sign to confirm.',
      fields: [
        { id: 'avatar', type: 'image', label: 'Profile photo', required: false, accept: 'image/png,image/jpeg,image/webp', maxSizeMB: 5 },
        { id: 'brief_pdf', type: 'pdf', label: 'Brief document (PDF)', required: false, accept: 'application/pdf', maxSizeMB: 10 },
        { id: 'attachments', type: 'files', label: 'Additional files (images, PDF, ZIP, DOCX)', required: false,
          accept: '.png,.jpg,.jpeg,.pdf,.zip,.docx', maxSizeMB: 15, multiple: true },
        { id: 'signature', type: 'signature', label: 'Signature', required: true, hint: 'Draw with mouse or finger to confirm this submission.' },
      ],
    },
  ],
};
