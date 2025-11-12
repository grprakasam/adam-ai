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
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const LeftPanel = ({ onGenerate, activeTab: controlledActiveTab, onTabChange }: LeftPanelProps) => {
  // Support both controlled and uncontrolled usage
  const [uncontrolledActive, setUncontrolledActive] = useState<string>(controlledActiveTab || 'project');
  const activeTab = controlledActiveTab ?? uncontrolledActive;
  const changeTab = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else setUncontrolledActive(tab);
  };

  // Fixed: Use separate selectors instead of creating new object on every render
  const getTabStatus = useProjectStore((state) => state.getTabStatus);
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const isGenerating = useProjectStore((state) => state.isGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const projectConfig = useProjectStore((state) => state.projectConfig);
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
      label: 'Configure Rules',
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

  const handleGetStarted = () => {
    // Pre-populate sensible defaults so the workspace can demonstrate functionality immediately
    if (!projectConfig.adamDataset) {
      setProjectConfig({ adamDataset: 'ADSL' });
    }
    // Attach default specification path (relative to project root)
    setSpecificationFile({
      name: 'ADSLSpec.xlsx',
      path: 'Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx',
      size: 0,
      uploadedAt: new Date().toISOString(),
      isDefault: true,
    } as any);
    // Guide user to Specification tab next
    changeTab('specification');
  };

  return (
    <div className="left-panel">
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={changeTab}
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
            if (isGenerating) return;
            if (isReadyToGenerate) {
              void onGenerate();
            } else {
              handleGetStarted();
            }
          }}
          disabled={isGenerating}
        >
          <Play size={18} />
          {isGenerating ? 'Generating...' : (isReadyToGenerate ? 'Generate ADAM Code' : 'Get Started')}
        </button>
        {!isReadyToGenerate && (
          <p className="generate-hint">
            We’ll pre-load a sample specification (ADSLSpec.xlsx). Complete the tabs to unlock code generation.
          </p>
        )}
      </div>
      
    </div>
  );
};

export default LeftPanel;
