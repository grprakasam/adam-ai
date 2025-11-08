import { Form, Input, Select, Card } from 'antd';
import type { StudyMetadata, GenerationOptions } from '../../types';

interface SetupTabProps {
  studyMetadata: StudyMetadata;
  generationOptions: GenerationOptions;
  onStudyMetadataChange: (metadata: StudyMetadata) => void;
  onOptionsChange: (options: GenerationOptions) => void;
}

const SetupTab = ({ studyMetadata, generationOptions, onStudyMetadataChange, onOptionsChange }: SetupTabProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card 
        title={<div style={{ fontSize: '14px', fontWeight: 600 }}>Study Metadata</div>}
        size="small"
        styles={{ body: { padding: '16px' } }}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="Study ID">
            <Input 
              value={studyMetadata.studyId}
              onChange={(e) => onStudyMetadataChange({ ...studyMetadata, studyId: e.target.value })}
              placeholder="e.g., CDISC01"
            />
          </Form.Item>

          <Form.Item label="Protocol Number">
            <Input 
              value={studyMetadata.protocolNumber}
              onChange={(e) => onStudyMetadataChange({ ...studyMetadata, protocolNumber: e.target.value })}
              placeholder="e.g., PROTO-2024-001"
            />
          </Form.Item>

          <Form.Item label="Therapeutic Area">
            <Select
              value={studyMetadata.therapeuticArea}
              onChange={(value) => onStudyMetadataChange({ ...studyMetadata, therapeuticArea: value })}
              options={[
                { value: 'Oncology', label: 'Oncology' },
                { value: 'Cardiology', label: 'Cardiology' },
                { value: 'Neurology', label: 'Neurology' },
                { value: 'Immunology', label: 'Immunology' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Study Phase">
            <Select
              value={studyMetadata.studyPhase}
              onChange={(value) => onStudyMetadataChange({ ...studyMetadata, studyPhase: value })}
              options={[
                { value: 'Phase I', label: 'Phase I' },
                { value: 'Phase II', label: 'Phase II' },
                { value: 'Phase III', label: 'Phase III' },
                { value: 'Phase IV', label: 'Phase IV' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card 
        title={<div style={{ fontSize: '14px', fontWeight: 600 }}>Generation Options</div>}
        size="small"
        styles={{ body: { padding: '16px' } }}
      >
        <Form layout="vertical" size="small">
          <Form.Item label="Include Comments">
            <Select
              value={generationOptions.includeComments}
              onChange={(value) => onOptionsChange({ ...generationOptions, includeComments: value })}
              options={[
                { value: 'comprehensive', label: 'Comprehensive' },
                { value: 'minimal', label: 'Minimal' },
                { value: 'none', label: 'None' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Code Style">
            <Select
              value={generationOptions.codeStyle}
              onChange={(value) => onOptionsChange({ ...generationOptions, codeStyle: value })}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'compact', label: 'Compact' },
                { value: 'verbose', label: 'Verbose' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Optimization Level">
            <Select
              value={generationOptions.optimizationLevel}
              onChange={(value) => onOptionsChange({ ...generationOptions, optimizationLevel: value })}
              options={[
                { value: 'balanced', label: 'Balanced' },
                { value: 'performance', label: 'Performance' },
                { value: 'readability', label: 'Readability' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SetupTab;
