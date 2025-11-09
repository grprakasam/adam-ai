import React from 'react';
import { FormBlock } from '../FormBlock';
import { SelectField } from '../SelectField';
import { useProjectStore } from '../../store/projectStore';
import './StandardsTab.css';

const StandardsTab: React.FC = () => {
  // Fixed: Use separate selectors to avoid infinite re-render
  const sdtmVersion = useProjectStore((state) => state.sdtmVersion);
  const adamIgVersion = useProjectStore((state) => state.adamIgVersion);
  const medraVersion = useProjectStore((state) => state.medraVersion);
  const setStandards = useProjectStore((state) => state.setStandards);

  const sdtmVersions = [
    { value: 'SDTM v2.0', label: 'SDTM v2.0 (Latest)' },
    { value: 'SDTM v1.7', label: 'SDTM v1.7' },
    { value: 'SDTM v1.6', label: 'SDTM v1.6' },
    { value: 'SDTM v1.5', label: 'SDTM v1.5' },
    { value: 'SDTM v1.4', label: 'SDTM v1.4' },
  ];

  const adamVersions = [
    { value: 'ADaM IG v1.3', label: 'ADaM IG v1.3 (Latest)' },
    { value: 'ADaM IG v1.2', label: 'ADaM IG v1.2' },
    { value: 'ADaM IG v1.1', label: 'ADaM IG v1.1' },
    { value: 'ADaM IG v1.0', label: 'ADaM IG v1.0' },
  ];

  const medraVersions = [
    { value: 'MedDRA v27.1', label: 'MedDRA v27.1 (Latest)' },
    { value: 'MedDRA v27.0', label: 'MedDRA v27.0' },
    { value: 'MedDRA v26.1', label: 'MedDRA v26.1' },
    { value: 'MedDRA v26.0', label: 'MedDRA v26.0' },
    { value: 'MedDRA v25.1', label: 'MedDRA v25.1' },
    { value: 'MedDRA v25.0', label: 'MedDRA v25.0' },
  ];

  return (
    <div className="standards-tab">
      <FormBlock
        title="CDISC Standards"
        description="Select the CDISC implementation guide versions for your study"
        helpText="These versions determine the structure and rules applied to your data"
      >
        <SelectField
          label="SDTM Version"
          value={sdtmVersion}
          options={sdtmVersions}
          onChange={(value) => setStandards({ sdtmVersion: value })}
          required
          helpText="Study Data Tabulation Model version"
        />
        <SelectField
          label="ADaM IG Version"
          value={adamIgVersion}
          options={adamVersions}
          onChange={(value) => setStandards({ adamIgVersion: value })}
          required
          helpText="Analysis Data Model Implementation Guide version"
        />
      </FormBlock>

      <FormBlock
        title="Medical Dictionaries"
        description="Select the controlled terminology versions"
      >
        <SelectField
          label="MedDRA Version"
          value={medraVersion}
          options={medraVersions}
          onChange={(value) => setStandards({ medraVersion: value })}
          required
          helpText="Medical Dictionary for Regulatory Activities version"
        />
      </FormBlock>

    </div>
  );
};

export default StandardsTab;
