import React, { useState } from 'react';
import { Modal, Form, Select, Input, Button, Card, Typography, Alert, Divider } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { BookOpen, Database, Tag } from 'lucide-react';
import './CdiscConfigModal.css';

const { Title } = Typography;
const { Option } = Select;

interface CdiscConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: CdiscConfiguration) => void;
  currentConfig?: CdiscConfiguration;
}

export interface CdiscConfiguration {
  adamIgVersion: string;
  sdtmVersion: string;
  medraVersion: string;
  sdtmDomains: string[];
  controlledTerminology: string;
  additionalNotes?: string;
}

const ADAM_IG_VERSIONS = [
  { value: '1.0', label: 'ADAM IG v1.0' },
  { value: '1.1', label: 'ADAM IG v1.1' },
  { value: '1.2', label: 'ADAM IG v1.2' },
  { value: '1.3', label: 'ADAM IG v1.3 (Recommended)' },
  { value: '1.4', label: 'ADAM IG v1.4 (Latest)' },
];

const SDTM_VERSIONS = [
  { value: '3.1.1', label: 'SDTM v3.1.1' },
  { value: '3.1.2', label: 'SDTM v3.1.2' },
  { value: '3.1.3', label: 'SDTM v3.1.3' },
  { value: '3.2', label: 'SDTM v3.2' },
  { value: '3.3', label: 'SDTM v3.3' },
  { value: '3.4', label: 'SDTM v3.4 (Recommended)' },
];

const MEDDRA_VERSIONS = [
  { value: '23.0', label: 'MedDRA v23.0' },
  { value: '23.1', label: 'MedDRA v23.1' },
  { value: '24.0', label: 'MedDRA v24.0' },
  { value: '24.1', label: 'MedDRA v24.1' },
  { value: '25.0', label: 'MedDRA v25.0' },
  { value: '25.1', label: 'MedDRA v25.1' },
  { value: '26.0', label: 'MedDRA v26.0 (Recommended)' },
  { value: '26.1', label: 'MedDRA v26.1 (Latest)' },
];

const SDTM_DOMAINS = [
  { value: 'DM', label: 'DM - Demographics' },
  { value: 'EX', label: 'EX - Exposure' },
  { value: 'AE', label: 'AE - Adverse Events' },
  { value: 'DS', label: 'DS - Disposition' },
  { value: 'MH', label: 'MH - Medical History' },
  { value: 'CM', label: 'CM - Concomitant Medications' },
  { value: 'VS', label: 'VS - Vital Signs' },
  { value: 'LB', label: 'LB - Laboratory' },
  { value: 'EG', label: 'EG - ECG' },
  { value: 'SV', label: 'SV - Subject Visits' },
  { value: 'PE', label: 'PE - Physical Examination' },
];

const CONTROLLED_TERMINOLOGY = [
  { value: 'CDISC CT 2023-06-30', label: 'CDISC CT 2023-06-30' },
  { value: 'CDISC CT 2023-09-29', label: 'CDISC CT 2023-09-29' },
  { value: 'CDISC CT 2023-12-15', label: 'CDISC CT 2023-12-15 (Recommended)' },
  { value: 'CDISC CT 2024-03-29', label: 'CDISC CT 2024-03-29 (Latest)' },
];

export const CdiscConfigModal: React.FC<CdiscConfigModalProps> = ({
  visible,
  onClose,
  onSave,
  currentConfig,
}) => {
  const [form] = Form.useForm();
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = () => {
    form.validateFields().then((values) => {
      onSave(values);
      setHasChanges(false);
    });
  };

  const handleCancel = () => {
    if (hasChanges) {
      Modal.confirm({
        title: 'Discard Changes?',
        content: 'You have unsaved changes. Are you sure you want to close?',
        onOk: () => {
          form.resetFields();
          setHasChanges(false);
          onClose();
        },
      });
    } else {
      onClose();
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BookOpen size={24} color="#667eea" />
          <span style={{ fontSize: '18px', fontWeight: 600 }}>CDISC Standards Configuration</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} icon={<CheckCircleOutlined />}>
          Save Configuration
        </Button>,
      ]}
      className="cdisc-config-modal"
    >
      <Alert
        message="Configure CDISC Standards"
        description="Select the appropriate CDISC standards versions for your study. These settings will be used to validate generated code and ensure regulatory compliance."
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={currentConfig || {
          adamIgVersion: '1.3',
          sdtmVersion: '3.4',
          medraVersion: '26.0',
          sdtmDomains: ['DM', 'EX', 'AE', 'DS', 'LB'],
          controlledTerminology: 'CDISC CT 2023-12-15',
        }}
        onValuesChange={() => setHasChanges(true)}
      >
        <Card className="config-section" bordered={false}>
          <div className="section-header">
            <Database size={20} color="#667eea" />
            <Title level={5} style={{ margin: 0 }}>ADAM Implementation Guide</Title>
          </div>
          <Form.Item
            name="adamIgVersion"
            label="ADAM IG Version"
            rules={[{ required: true, message: 'Please select ADAM IG version' }]}
            tooltip="Analysis Data Model Implementation Guide version"
          >
            <Select size="large" placeholder="Select ADAM IG version">
              {ADAM_IG_VERSIONS.map((version) => (
                <Option key={version.value} value={version.value}>
                  {version.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <Card className="config-section" bordered={false}>
          <div className="section-header">
            <Database size={20} color="#667eea" />
            <Title level={5} style={{ margin: 0 }}>SDTM Standards</Title>
          </div>
          <Form.Item
            name="sdtmVersion"
            label="SDTM Version"
            rules={[{ required: true, message: 'Please select SDTM version' }]}
            tooltip="Study Data Tabulation Model version"
          >
            <Select size="large" placeholder="Select SDTM version">
              {SDTM_VERSIONS.map((version) => (
                <Option key={version.value} value={version.value}>
                  {version.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="sdtmDomains"
            label="Available SDTM Domains"
            rules={[{ required: true, message: 'Please select at least one SDTM domain' }]}
            tooltip="Select the SDTM domains available in your study"
          >
            <Select
              mode="multiple"
              size="large"
              placeholder="Select SDTM domains"
              maxTagCount="responsive"
            >
              {SDTM_DOMAINS.map((domain) => (
                <Option key={domain.value} value={domain.value}>
                  {domain.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <Card className="config-section" bordered={false}>
          <div className="section-header">
            <Tag size={20} color="#667eea" />
            <Title level={5} style={{ margin: 0 }}>Medical Coding & Terminology</Title>
          </div>
          <Form.Item
            name="medraVersion"
            label="MedDRA Version"
            rules={[{ required: true, message: 'Please select MedDRA version' }]}
            tooltip="Medical Dictionary for Regulatory Activities version"
          >
            <Select size="large" placeholder="Select MedDRA version">
              {MEDDRA_VERSIONS.map((version) => (
                <Option key={version.value} value={version.value}>
                  {version.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="controlledTerminology"
            label="CDISC Controlled Terminology"
            rules={[{ required: true, message: 'Please select controlled terminology' }]}
            tooltip="CDISC Controlled Terminology package"
          >
            <Select size="large" placeholder="Select CDISC CT version">
              {CONTROLLED_TERMINOLOGY.map((ct) => (
                <Option key={ct.value} value={ct.value}>
                  {ct.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <Divider />

        <Form.Item
          name="additionalNotes"
          label="Additional Notes (Optional)"
          tooltip="Any additional configuration notes or study-specific requirements"
        >
          <Input.TextArea
            rows={3}
            placeholder="Enter any additional notes about your CDISC configuration..."
          />
        </Form.Item>
      </Form>

      <Alert
        message="Configuration Impact"
        description="These settings will affect code generation, validation rules, and regulatory compliance checks. Make sure to consult your study protocol and regulatory requirements."
        type="warning"
        showIcon
        style={{ marginTop: '16px' }}
      />
    </Modal>
  );
};
