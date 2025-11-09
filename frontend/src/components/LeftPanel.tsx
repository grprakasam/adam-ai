import { useState } from 'react';
import { TabNavigation, Tab } from './TabNavigation';
import ProjectConfigTab from './tabs/ProjectConfigTab';
import StandardsTab from './tabs/StandardsTab';
import DataTab from './tabs/DataTab';
import RulesTab from './tabs/RulesTab';
import GenerateTab from './tabs/GenerateTab';
import ProgressIndicator from './ProgressIndicator';
import { useProjectStore } from '../store/projectStore';
import './LeftPanel.css';

interface LeftPanelProps {
  onGenerate: () => Promise<void>;
}

const LeftPanel = ({ onGenerate }: LeftPanelProps) => {
  const [activeTab, setActiveTab] = useState('project');

  // Fixed: Use separate selectors instead of creating new object on every render
  const selectedDatasets = useProjectStore((state) => state.selectedDatasets);
  const selectedVariables = useProjectStore((state) => state.selectedVariables);
  const getTabStatus = useProjectStore((state) => state.getTabStatus);
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);

  const tabs: Tab[] = [
    {
      key: 'project',
      label: 'Project',
      status: getTabStatus('project'),
    },
    {
      key: 'standards',
      label: 'Standards',
      status: getTabStatus('standards'),
    },
    {
      key: 'data',
      label: 'Data',
      // No count - SDTM datasets are no longer tracked
      status: getTabStatus('data'),
    },
    {
      key: 'rules',
      label: 'Rules',
      status: getTabStatus('rules'),
    },
    {
      key: 'generate',
      label: 'Generate',
      status: getTabStatus('generate'),
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'project':
        return <ProjectConfigTab />;
      case 'standards':
        return <StandardsTab />;
      case 'data':
        return <DataTab />;
      case 'rules':
        return <RulesTab />;
      case 'generate':
        return <GenerateTab onGenerate={onGenerate} />;
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
      
      <ProgressIndicator percentage={getCompletionPercentage()} />
    </div>
  );
};

export default LeftPanel;
