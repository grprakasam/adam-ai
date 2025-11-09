import React from 'react';
import { FormBlock } from '../FormBlock';
import { TextField } from '../TextField';
import { SelectField } from '../SelectField';
import { useProjectStore } from '../../store/projectStore';
import './ProjectConfigTab.css';

const ProjectConfigTab: React.FC = () => {
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);

  const therapeuticAreas = [
    { value: 'Oncology', label: 'Oncology' },
    { value: 'Cardiology', label: 'Cardiology' },
    { value: 'Neurology', label: 'Neurology' },
    { value: 'Immunology', label: 'Immunology' },
    { value: 'Respiratory', label: 'Respiratory' },
    { value: 'Endocrinology', label: 'Endocrinology' },
    { value: 'Infectious Disease', label: 'Infectious Disease' },
    { value: 'Dermatology', label: 'Dermatology' },
  ];

  const studyPhases = [
    { value: 'Phase I', label: 'Phase I - First-in-Human' },
    { value: 'Phase II', label: 'Phase II - Proof of Concept' },
    { value: 'Phase III', label: 'Phase III - Pivotal' },
    { value: 'Phase IV', label: 'Phase IV - Post-Marketing' },
  ];

  const programmingLanguages = [
    { value: 'R', label: 'R (Recommended)' },
    { value: 'SAS', label: 'SAS' },
  ];

  return (
    <div className="project-config-tab">
      <FormBlock
        title="Study Identification"
        description="Basic information to identify your clinical study"
      >
        <TextField
          label="Study ID"
          value={projectConfig.studyId}
          onChange={(value) => setProjectConfig({ studyId: value })}
          placeholder="e.g., CDISC01"
          required
          helpText="Unique identifier for your clinical study"
        />
        <TextField
          label="Protocol Number"
          value={projectConfig.protocolNumber}
          onChange={(value) => setProjectConfig({ protocolNumber: value })}
          placeholder="e.g., PROTO-2024-001"
          required
          helpText="Official protocol document number"
        />
        <TextField
          label="Sponsor"
          value={projectConfig.sponsor}
          onChange={(value) => setProjectConfig({ sponsor: value })}
          placeholder="e.g., Pharma Corporation"
          required
          helpText="Organization sponsoring the study"
        />
      </FormBlock>

      <FormBlock
        title="Study Details"
        description="Clinical and operational study characteristics"
      >
        <SelectField
          label="Therapeutic Area"
          value={projectConfig.therapeuticArea}
          options={therapeuticAreas}
          onChange={(value) => setProjectConfig({ therapeuticArea: value })}
          placeholder="Select therapeutic area"
          required
          helpText="Primary disease or condition being studied"
        />
        <SelectField
          label="Study Phase"
          value={projectConfig.studyPhase}
          options={studyPhases}
          onChange={(value) => setProjectConfig({ studyPhase: value })}
          placeholder="Select study phase"
          required
          helpText="Clinical development phase"
        />
        <SelectField
          label="Programming Language"
          value={projectConfig.programmingLanguage}
          options={programmingLanguages}
          onChange={(value) => setProjectConfig({ programmingLanguage: value })}
          required
          helpText="Language for generated code"
        />
      </FormBlock>
    </div>
  );
};

export default ProjectConfigTab;
