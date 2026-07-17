import { useState, type FormEvent } from 'react';
import { deckTypes, type ProjectDraft } from './types';

interface ProjectFormProps {
  onCancel: () => void;
  onSubmit: (project: ProjectDraft) => void;
}

type ProjectFormErrors = Partial<Record<keyof Pick<ProjectDraft, 'name' | 'client' | 'deckType'>, string>>;

const initialDraft: ProjectDraft = {
  name: '',
  client: '',
  deckType: '',
  description: '',
};

function validate(draft: ProjectDraft): ProjectFormErrors {
  return {
    ...(draft.name.trim() ? {} : { name: 'Project name is required.' }),
    ...(draft.client.trim() ? {} : { client: 'Client name is required.' }),
    ...(draft.deckType ? {} : { deckType: 'Deck type is required.' }),
  };
}

export function ProjectForm({ onCancel, onSubmit }: ProjectFormProps) {
  const [draft, setDraft] = useState<ProjectDraft>(initialDraft);
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  const updateDraft = <Field extends keyof ProjectDraft>(field: Field, value: ProjectDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(draft);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      ...draft,
      name: draft.name.trim(),
      client: draft.client.trim(),
      description: draft.description.trim(),
    });
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <div>
        <label className="block text-sm font-medium text-content-primary" htmlFor="project-name">
          Project Name
        </label>
        <input
          className="mt-2 w-full rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-3 py-2.5 text-sm text-content-primary outline-none placeholder:text-content-muted focus:border-action-primary"
          id="project-name"
          name="projectName"
          value={draft.name}
          onChange={(event) => updateDraft('name', event.target.value)}
          aria-describedby={errors.name ? 'project-name-error' : undefined}
          aria-invalid={Boolean(errors.name)}
          placeholder="e.g. Q3 Advocacy Review"
          autoFocus
        />
        {errors.name && <p className="mt-1.5 text-xs text-content-secondary" id="project-name-error">{errors.name}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-primary" htmlFor="client-name">
          Client Name
        </label>
        <input
          className="mt-2 w-full rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-3 py-2.5 text-sm text-content-primary outline-none placeholder:text-content-muted focus:border-action-primary"
          id="client-name"
          name="clientName"
          value={draft.client}
          onChange={(event) => updateDraft('client', event.target.value)}
          aria-describedby={errors.client ? 'client-name-error' : undefined}
          aria-invalid={Boolean(errors.client)}
          placeholder="e.g. Wozku"
        />
        {errors.client && <p className="mt-1.5 text-xs text-content-secondary" id="client-name-error">{errors.client}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-primary" htmlFor="deck-type">
          Deck Type
        </label>
        <select
          className="mt-2 w-full rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-3 py-2.5 text-sm text-content-primary outline-none focus:border-action-primary"
          id="deck-type"
          name="deckType"
          value={draft.deckType}
          onChange={(event) => updateDraft('deckType', event.target.value as ProjectDraft['deckType'])}
          aria-describedby={errors.deckType ? 'deck-type-error' : undefined}
          aria-invalid={Boolean(errors.deckType)}
        >
          <option value="">Select a deck type</option>
          {deckTypes.map((deckType) => <option key={deckType} value={deckType}>{deckType}</option>)}
        </select>
        {errors.deckType && <p className="mt-1.5 text-xs text-content-secondary" id="deck-type-error">{errors.deckType}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-primary" htmlFor="project-description">
          Description <span className="font-normal text-content-muted">(optional)</span>
        </label>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-[var(--radius-md)] border border-border-default bg-surface-panel px-3 py-2.5 text-sm leading-6 text-content-primary outline-none placeholder:text-content-muted focus:border-action-primary"
          id="project-description"
          name="description"
          value={draft.description}
          onChange={(event) => updateDraft('description', event.target.value)}
          placeholder="Add a short description for this engagement."
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-border-subtle pt-5">
        <button className="rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors hover:bg-surface-subtle hover:text-content-primary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90" type="submit">
          Create Project
        </button>
      </div>
    </form>
  );
}
