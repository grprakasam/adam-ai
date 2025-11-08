import { useState } from 'react';
import { Tabs, Button } from 'antd';
import SetupTab from './tabs/SetupTab';
import DatasetsTab from './tabs/DatasetsTab';
import VariablesTab from './tabs/VariablesTab';
import RulesTab from './tabs/RulesTab';
import type { StudyMetadata, GenerationOptions } from '../types';
import './LeftPanel.css';

interface LeftPanelProps {
  studyMetadata: StudyMetadata;
  selectedDatasets: string[];
  selectedVariables: string[];
  generationOptions: GenerationOptions;
  onStudyMetadataChange: (metadata: StudyMetadata) => void;
  onDatasetsChange: (datasets: string[]) => void;
  onVariablesChange: (variables: string[]) => void;
  onOptionsChange: (options: GenerationOptions) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

const LeftPanel = (props: LeftPanelProps) => {
  const [activeTab, setActiveTab] = useState('setup');

  const tabItems = [
    {
      key: 'setup',
      label: 'Setup',
      children: (
        <SetupTab
          studyMetadata={props.studyMetadata}
          generationOptions={props.generationOptions}
          onStudyMetadataChange={props.onStudyMetadataChange}
          onOptionsChange={props.onOptionsChange}
        />
      ),
    },
    {
      key: 'datasets',
      label: 'Datasets',
      children: (
        <DatasetsTab
          selectedDatasets={props.selectedDatasets}
          onDatasetsChange={props.onDatasetsChange}
        />
      ),
    },
    {
      key: 'variables',
      label: 'Variables',
      children: (
        <VariablesTab
          selectedVariables={props.selectedVariables}
          onVariablesChange={props.onVariablesChange}
        />
      ),
    },
    {
      key: 'rules',
      label: 'Rules',
      children: <RulesTab />,
    },
  ];

  return (
    <div className="left-panel">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="config-tabs"
      />
      
      <div className="generate-button-container">
        <Button
          type="primary"
          size="large"
          onClick={props.onGenerate}
          loading={props.isGenerating}
          className="generate-button"
          block
        >
          ✨ Generate ADSL Code
        </Button>
      </div>
    </div>
  );
};

export default LeftPanel;
