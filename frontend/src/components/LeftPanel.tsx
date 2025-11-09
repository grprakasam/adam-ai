import { useState } from 'react';
import { Play } from 'lucide-react';
import { TabNavigation, Tab } from './TabNavigation';
import ProjectConfigTab from './tabs/ProjectConfigTab';
import DatasetSelectionTab from './tabs/DatasetSelectionTab';
import SpecificationUploadTab from './tabs/SpecificationUploadTab';
import StandardsTab from './tabs/StandardsTab';
import RulesTab from './tabs/RulesTab';
import { useProjectStore } from '../store/projectStore';
import './LeftPanel.css';

interface LeftPanelProps {
  onGenerate: () => Promise<void>;
}

const LeftPanel = ({ onGenerate }: LeftPanelProps) => {
  const [activeTab, setActiveTab] = useState('project');

  // Fixed: Use separate selectors instead of creating new object on every render
  const getTabStatus = useProjectStore((state) => state.getTabStatus);
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const isGenerating = useProjectStore((state) => state.isGenerating);
  const completionPercentage = getCompletionPercentage();
  const isReadyToGenerate = completionPercentage >= 80;

  const tabs: Tab[] = [
    {
      key: 'project',
      label: 'Project Information',
      status: getTabStatus('project'),
    },
    {
      key: 'specification',
      label: 'ADAM Specification',
      status: getTabStatus('specification'),
    },
    {
      key: 'standards',
      label: 'Select Standards Version',
      status: getTabStatus('standards'),
    },
    {
      key: 'rules',
      label: 'Congire Rules',
      status: getTabStatus('rules'),
    },
    {
      key: 'dataset',
      label: 'Enter ADAM Dataset Name',
      status: getTabStatus('dataset'),
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'project':
        return <ProjectConfigTab />;
      case 'dataset':
        return <DatasetSelectionTab />;
      case 'specification':
        return <SpecificationUploadTab />;
      case 'standards':
        return <StandardsTab />;
      case 'rules':
        return <RulesTab />;
      default:
        return null;
    }
  };

  return (
    <div className="left-panel">
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <div className="tab-panel" role="tabpanel" id={`panel-${activeTab}`}>
        {renderTabContent()}
      </div>
      
      <div className="generate-cta">
        <div className="generate-meta">
          <span className={`generate-status ${isReadyToGenerate ? 'ready' : ''}`}>
            {isReadyToGenerate ? 'Configuration complete' : 'Configuration progress'}
          </span>
          <span className={`generate-percentage ${isReadyToGenerate ? 'ready' : ''}`}>
            {completionPercentage}%
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg generate-button"
          onClick={() => {
            if (!isReadyToGenerate || isGenerating) return;
            void onGenerate();
          }}
          disabled={!isReadyToGenerate || isGenerating}
        >
          <Play size={18} />
          {isGenerating ? 'Generating...' : 'Get Started'}
        </button>
        {!isReadyToGenerate && (
          <p className="generate-hint">
            Complete all required tabs (Project Information, ADAM Specification, Select Standards Version, Congire Rules, Enter ADAM Dataset Name) to unlock code generation.
          </p>
        )}
      </div>
      
    </div>
  );
};

export default LeftPanel;
