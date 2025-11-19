import { Drawer, Tabs, Steps, List, Typography, Button } from 'antd';
import type { TabsProps } from 'antd';
import './HelpCenterDrawer.css';

const { Paragraph, Text } = Typography;

const tutorialSteps = [
  {
    title: 'Configure the study',
    description: 'Fill in project details and upload the ADaM specification.',
  },
  {
    title: 'Select standards',
    description: 'Choose SDTM, ADaM IG, and MedDRA versions that match your submission.',
  },
  {
    title: 'Unlock pair programming',
    description: 'Run validation, approve variables, then generate and consolidate code.',
  },
  {
    title: 'Validate and export',
    description: 'Use the validation, traceability, and submission tabs to finalize outputs.',
  },
];

const contextualTips: Record<string, { title: string; body: string[] }> = {
  project: {
    title: 'Project configuration guidance',
    body: [
      'Use the official protocol identifiers so downstream metadata remains consistent.',
      'If you are experimenting, mark the study as “Sandbox” to prevent accidental publication.',
    ],
  },
  specification: {
    title: 'Specification upload guidance',
    body: [
      'Validate the spec before uploading by running the macro included in `Content/Templates`.',
      'The sheet name must match the dataset; rename the worksheet if necessary.',
    ],
  },
  standards: {
    title: 'Standards selection tips',
    body: [
      'Always align the ADaM IG version with the SDTM version that generated the upstream datasets.',
      'MedDRA is optional for BDS datasets but required for adverse event outputs.',
    ],
  },
  dataset: {
    title: 'Dataset selection tips',
    body: [
      'Switch datasets to preview validation coverage before generating code.',
      'ADSL is the fastest dataset to validate and is a good starting point for new studies.',
    ],
  },
};

const documentationLinks = [
  {
    title: 'Quick start checklist',
    description: 'Step-by-step setup guide for sandboxes and real submissions.',
    href: 'README.md',
  },
  {
    title: 'Traceability and submission plan',
    description: 'Highlights from the TRACEABILITY_UX_ENHANCEMENT_PLAN document.',
    href: 'TRACEABILITY_UX_ENHANCEMENT_PLAN.md',
  },
];

interface HelpCenterDrawerProps {
  open: boolean;
  onClose: () => void;
  activeTab: string;
}

export const HelpCenterDrawer = ({ open, onClose, activeTab }: HelpCenterDrawerProps) => {
  const contextual = contextualTips[activeTab] || {
    title: 'Workspace tips',
    body: ['Complete the checklist on the left and unlock pair programming to continue.'],
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'tutorial',
      label: 'Tutorial',
      children: (
        <Steps direction="vertical" items={tutorialSteps.map((step) => ({ title: step.title, description: step.description }))} />
      ),
    },
    {
      key: 'context',
      label: 'Contextual help',
      children: (
        <div>
          <Typography.Title level={5}>{contextual.title}</Typography.Title>
          {contextual.body.map((tip) => (
            <Paragraph key={tip}>{tip}</Paragraph>
          ))}
        </div>
      ),
    },
    {
      key: 'docs',
      label: 'Documentation',
      children: (
        <List
          itemLayout="vertical"
          dataSource={documentationLinks}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="open" type="link" href={item.href} target="_blank" rel="noreferrer">
                  View document
                </Button>,
              ]}
            >
              <List.Item.Meta title={item.title} description={item.description} />
            </List.Item>
          )}
        />
      ),
    },
  ];

  return (
    <Drawer
      title="ADAM AI Help Center"
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
    >
      <Text type="secondary">
        Use Shift + / to open this panel at any time. The quick start tutorial is always available here.
      </Text>
      <Tabs className="help-center-tabs" defaultActiveKey="tutorial" items={tabItems} />
    </Drawer>
  );
};

export default HelpCenterDrawer;
