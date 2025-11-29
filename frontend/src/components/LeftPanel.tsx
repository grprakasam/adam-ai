import { useState } from 'react';
import { TabNavigation, Tab } from './TabNavigation';
import ProjectConfigTab from './tabs/ProjectConfigTab';
import DatasetSelectionTab from './tabs/DatasetSelectionTab';
import StandardsTab from './tabs/StandardsTab';
import { ContextualHelpCard } from './ContextualHelpCard';
import { useProjectStore } from '../store/projectStore';
import './LeftPanel.css';

interface LeftPanelProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isCollapsed?: boolean;
  onOpenHelpCenter?: () => void;
}

const LeftPanel = ({
  activeTab: controlledActiveTab,
  onTabChange,
  isCollapsed = false,
  onOpenHelpCenter,
}: LeftPanelProps) => {
  // Support both controlled and uncontrolled usage
  const [uncontrolledActive, setUncontrolledActive] = useState<string>(controlledActiveTab || 'project');
  const activeTab = controlledActiveTab ?? uncontrolledActive;
  const changeTab = (tab: string) => {
    if (onTabChange) onTabChange(tab);
    else setUncontrolledActive(tab);
  };

  // Fixed: Use separate selectors instead of creating new object on every render
  const getTabStatus = useProjectStore((state) => state.getTabStatus);

  const tabs: Tab[] = [
    {
      key: 'project',
      label: 'Enter Project Information',
      status: getTabStatus('project'),
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
      case 'standards':
        return <StandardsTab />;
      default:
        return null;
    }
  };

  const panelId = 'configuration-panel';
  const activePanelId = `panel-${activeTab}`;
  const activeTabLabelId = `tab-${activeTab}`;

  return (
    <div
      id={panelId}
      className={`left-panel ${isCollapsed ? 'collapsed' : ''}`}
      role="complementary"
      aria-label="Project configuration wizard"
      aria-hidden={isCollapsed}
    >
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={changeTab}
      />
      
      <div
        className="tab-panel"
        role="tabpanel"
        id={activePanelId}
        aria-labelledby={activeTabLabelId}
      >
        {renderTabContent()}
      </div>

      <ContextualHelpCard currentTab={activeTab} onOpenHelpCenter={onOpenHelpCenter} />
      
    </div>
  );
};

export default LeftPanel;
