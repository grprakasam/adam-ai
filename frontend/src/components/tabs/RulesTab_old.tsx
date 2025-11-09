import { Card, Collapse, Button, Space } from 'antd';
import { DownloadOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';

const rulesData = [
  {
    title: 'ADSL Application Behaviour Rules',
    content: 'Rules for ADSL dataset structure, mandatory variables, and standard derivations as per CDISC ADAM IG.'
  },
  {
    title: 'ADSL IG-Specific Rules',
    content: 'Implementation Guide specific requirements for ADSL including naming conventions, formats, and metadata.'
  },
  {
    title: 'ADSL Macro Logic',
    content: 'Reusable logic patterns for common ADSL derivations including treatment assignment, population flags, and date imputations.'
  },
];

const RulesTab = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card 
        title={<div style={{ fontSize: '14px', fontWeight: 600 }}>Derivation Rules</div>}
        extra={<div style={{ fontSize: '12px', color: '#6b7280' }}>CDISC implementation guidance</div>}
        size="small"
        styles={{ body: { padding: '16px' } }}
      >
        <Collapse
          items={rulesData.map((rule, index) => ({
            key: index.toString(),
            label: rule.title,
            children: <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>{rule.content}</div>,
          }))}
        />
      </Card>

      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Button icon={<DownloadOutlined />} size="small">Import</Button>
        <Button icon={<ReloadOutlined />} size="small">Reload</Button>
        <Button icon={<SettingOutlined />} size="small">Configure</Button>
      </Space>
    </div>
  );
};

export default RulesTab;
