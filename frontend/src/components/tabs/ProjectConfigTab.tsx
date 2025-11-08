import { Form, Input, Select, Card, Row, Col } from 'antd';
import type { ProjectConfiguration } from '../../types';

interface ProjectConfigTabProps {
  projectConfig: ProjectConfiguration;
  onConfigChange: (config: ProjectConfiguration) => void;
}

const ProjectConfigTab = ({ projectConfig, onConfigChange }: ProjectConfigTabProps) => {
  const handleFieldChange = (field: keyof ProjectConfiguration, value: string) => {
    onConfigChange({ ...projectConfig, [field]: value });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card 
        title={<div style={{ fontSize: '14px', fontWeight: 600 }}>Project Information</div>}
        size="small"
        styles={{ body: { padding: '16px' } }}
      >
        <Form layout="vertical" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Study ID">
                <Input 
                  value={projectConfig.studyId}
                  onChange={(e) => handleFieldChange('studyId', e.target.value)}
                  placeholder="e.g., CDISC01"
                />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Protocol Number">
                <Input 
                  value={projectConfig.protocolNumber}
                  onChange={(e) => handleFieldChange('protocolNumber', e.target.value)}
                  placeholder="e.g., PROTO-2024-001"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Sponsor">
            <Input 
              value={projectConfig.sponsor}
              onChange={(e) => handleFieldChange('sponsor', e.target.value)}
              placeholder="e.g., Pharma Corp"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Therapeutic Area">
                <Select
                  value={projectConfig.therapeuticArea}
                  onChange={(value) => handleFieldChange('therapeuticArea', value)}
                  options={[
                    { value: 'Oncology', label: 'Oncology' },
                    { value: 'Cardiology', label: 'Cardiology' },
                    { value: 'Neurology', label: 'Neurology' },
                    { value: 'Immunology', label: 'Immunology' },
                    { value: 'Respiratory', label: 'Respiratory' },
                    { value: 'Endocrinology', label: 'Endocrinology' },
                  ]}
                />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="Study Phase">
                <Select
                  value={projectConfig.studyPhase}
                  onChange={(value) => handleFieldChange('studyPhase', value)}
                  options={[
                    { value: 'Phase I', label: 'Phase I' },
                    { value: 'Phase II', label: 'Phase II' },
                    { value: 'Phase III', label: 'Phase III' },
                    { value: 'Phase IV', label: 'Phase IV' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Programming Language">
            <Select
              value={projectConfig.programmingLanguage}
              onChange={(value) => handleFieldChange('programmingLanguage', value)}
              options={[
                { value: 'R', label: 'R' },
                { value: 'SAS', label: 'SAS' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title={<div style={{ fontSize: '14px', fontWeight: 600 }}>CDISC Standards & Dictionaries</div>}
        size="small"
        styles={{ body: { padding: '16px' } }}
      >
        <Form layout="vertical" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="SDTM Version">
                <Select
                  value={projectConfig.sdtmVersion}
                  onChange={(value) => handleFieldChange('sdtmVersion', value)}
                  options={[
                    { value: 'SDTM v2.0', label: 'SDTM v2.0' },
                    { value: 'SDTM v1.7', label: 'SDTM v1.7' },
                    { value: 'SDTM v1.6', label: 'SDTM v1.6' },
                    { value: 'SDTM v1.5', label: 'SDTM v1.5' },
                  ]}
                />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="ADaM IG Version">
                <Select
                  value={projectConfig.adamIgVersion}
                  onChange={(value) => handleFieldChange('adamIgVersion', value)}
                  options={[
                    { value: 'ADaM IG v1.3', label: 'ADaM IG v1.3' },
                    { value: 'ADaM IG v1.2', label: 'ADaM IG v1.2' },
                    { value: 'ADaM IG v1.1', label: 'ADaM IG v1.1' },
                    { value: 'ADaM IG v1.0', label: 'ADaM IG v1.0' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="MedDRA Version">
            <Select
              value={projectConfig.medraVersion}
              onChange={(value) => handleFieldChange('medraVersion', value)}
              options={[
                { value: 'MedDRA v27.0', label: 'MedDRA v27.0' },
                { value: 'MedDRA v26.1', label: 'MedDRA v26.1' },
                { value: 'MedDRA v26.0', label: 'MedDRA v26.0' },
                { value: 'MedDRA v25.1', label: 'MedDRA v25.1' },
                { value: 'MedDRA v25.0', label: 'MedDRA v25.0' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ProjectConfigTab;
