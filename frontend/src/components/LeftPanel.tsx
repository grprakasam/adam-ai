import { useState } from 'react';
import { TabNavigation, Tab } from './TabNavigation';
import ProjectConfigTab from './tabs/ProjectConfigTab';
import DatasetSelectionTab from './tabs/DatasetSelectionTab';
import SpecificationUploadTab from './tabs/SpecificationUploadTab';
import StandardsTab from './tabs/StandardsTab';
import { useProjectStore } from '../store/projectStore';
import './LeftPanel.css';

interface LeftPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isCollapsed?: boolean;
}

const LeftPanel = ({ activeTab: controlledActiveTab, onTabChange, isCollapsed = false }: LeftPanelProps) => {
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

  const tabs: Tab[] = [
    {
      key: 'project',
      label: 'Enter Project Information',
      status: getTabStatus('project'),
    },
    {
      key: 'specification',
      label: 'Upload ADAM Specification',
      status: getTabStatus('specification'),
    },
    {
      key: 'standards',
      label: 'Choose Standards Version',
      status: getTabStatus('standards'),
    },
    {
      key: 'dataset',
      label: 'Specify ADAM Dataset Name',
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
      default:
        return null;
    }
  };

  return (
    <div className={`left-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={changeTab}
      />
      
      <div className="tab-panel" role="tabpanel" id={`panel-${activeTab}`}>
        {renderTabContent()}
      </div>
      
    </div>
  );
};

export default LeftPanel;
