import { motion } from 'framer-motion';

interface PlaceholderProps {
  title: string;
  description: string;
  icon: string;
}

function PagePlaceholder({ title, description, icon }: PlaceholderProps) {
  return (
    <motion.section
      className="mt-8 flex min-h-[24rem] flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-panel p-8 text-center shadow-[var(--shadow-xs)]"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <div className="grid size-12 place-items-center rounded-[var(--radius-lg)] bg-action-primary-subtle font-display text-xl font-semibold text-action-primary">
        {icon}
      </div>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-content-primary">
        {title}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-content-secondary">
        {description}
      </p>
      <button
        className="mt-6 rounded-[var(--radius-md)] bg-action-primary px-4 py-2.5 text-sm font-semibold text-content-inverse shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90 cursor-not-allowed opacity-50"
        type="button"
        disabled
      >
        Coming Soon
      </button>
    </motion.section>
  );
}

export function PresentationsPlaceholder() {
  return (
    <PagePlaceholder
      title="Presentations Workspace"
      description="Design, preview, and build slide decks using facts compiled from your imported Business Record."
      icon="P"
    />
  );
}

export function AssetsPlaceholder() {
  return (
    <PagePlaceholder
      title="Asset Library"
      description="Manage visual assets, logos, and support media files utilized across your presentations."
      icon="A"
    />
  );
}

export function ExportsPlaceholder() {
  return (
    <PagePlaceholder
      title="Exports Drawer"
      description="Download generated PDF, PPTX, or structural web formats of your final slide decks."
      icon="E"
    />
  );
}

export function SettingsPlaceholder() {
  return (
    <PagePlaceholder
      title="Project Settings"
      description="Configure metadata, client details, deck branding options, and project status parameters."
      icon="S"
    />
  );
}
