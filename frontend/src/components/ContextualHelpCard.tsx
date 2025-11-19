import { Button } from 'antd';
import './ContextualHelpCard.css';

const HELP_COPY: Record<string, { title: string; tips: string[] }> = {
  project: {
    title: 'Project information tips',
    tips: [
      'Provide the study ID, sponsor, and therapeutic area exactly as they appear in the protocol.',
      'Optional fields such as phase and indication help tailor the generation prompt.',
    ],
  },
  specification: {
    title: 'Upload the ADaM specification',
    tips: [
      'Only XLSX/XLS files are accepted. Use the template from Content/UserInputs/ADAMSpecifications.',
      'After uploading, confirm the sheet name matches the dataset (e.g., ADSL, ADAE).',
    ],
  },
  standards: {
    title: 'Choose CDISC versions',
    tips: [
      'Select SDTM, ADaM IG, and MedDRA versions that match the protocol amendment.',
      'Changing versions will re-run the validation checks automatically.',
    ],
  },
  dataset: {
    title: 'Confirm dataset name',
    tips: [
      'Use uppercase dataset names (ADSL, ADAE, BDS, OCCDS).',
      'The dataset selection drives validation and traceability outputs.',
    ],
  },
};

interface ContextualHelpCardProps {
  currentTab: string;
  onOpenHelpCenter?: () => void;
}

export const ContextualHelpCard = ({ currentTab, onOpenHelpCenter }: ContextualHelpCardProps) => {
  const content = HELP_COPY[currentTab] || {
    title: 'Need a hand?',
    tips: ['Use the help center for walkthroughs and documentation.'],
  };

  return (
    <div className="contextual-help-card" role="note" aria-live="polite">
      <div>
        <h4>{content.title}</h4>
        <ul>
          {content.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      {onOpenHelpCenter && (
        <Button type="link" onClick={onOpenHelpCenter}>
          Open help center
        </Button>
      )}
    </div>
  );
};

export default ContextualHelpCard;
