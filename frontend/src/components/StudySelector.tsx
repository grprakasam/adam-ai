import React, { useState, useEffect } from 'react';
import { Select, Modal, Form, Input, Button, message, Spin, Empty } from 'antd';
import { FolderOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import './StudySelector.css';

const { Option } = Select;

interface Study {
  id: string;
  name: string;
  protocol_number?: string;
  sponsor?: string;
  phase?: string;
  last_accessed_at?: string;
  setup_complete: boolean;
  my_permission: string;
}

interface StudySelectorProps {
  value?: string;
  onChange?: (studyId: string) => void;
  onStudyChange?: (study: Study | null) => void;
}

export const StudySelector: React.FC<StudySelectorProps> = ({
  value,
  onChange,
  onStudyChange
}) => {
  const [studies, setStudies] = useState<Study[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creatingStudy, setCreatingStudy] = useState(false);
  const [selectedStudyId, setSelectedStudyId] = useState<string | undefined>(value);
  const [form] = Form.useForm();

  // Load studies on mount
  useEffect(() => {
    loadStudies();
  }, []);

  // Update selected study when value prop changes
  useEffect(() => {
    setSelectedStudyId(value);
  }, [value]);

  const loadStudies = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/studies');
      setStudies(response.data);

      // If there's a selected study, emit it
      if (selectedStudyId && onStudyChange) {
        const study = response.data.find((s: Study) => s.id === selectedStudyId);
        onStudyChange(study || null);
      }
    } catch (error) {
      message.error('Failed to load studies');
      console.error('Error loading studies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStudySelect = async (studyId: string) => {
    setSelectedStudyId(studyId);

    // Track access
    try {
      await api.post(`/api/v1/studies/${studyId}/access`);
    } catch (error) {
      console.error('Failed to track study access:', error);
    }

    // Emit change
    if (onChange) {
      onChange(studyId);
    }

    // Emit full study object if callback provided
    if (onStudyChange) {
      const study = studies.find(s => s.id === studyId);
      onStudyChange(study || null);
    }
  };

  const handleCreateStudy = async (values: any) => {
    setCreatingStudy(true);
    try {
      const response = await api.post('/api/v1/studies', values);
      const newStudy = response.data;

      message.success(`Study "${newStudy.name}" created successfully`);

      // Add to list and select
      setStudies([newStudy, ...studies]);
      handleStudySelect(newStudy.id);

      // Close modal and reset form
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.detail || 'Failed to create study');
      console.error('Error creating study:', error);
    } finally {
      setCreatingStudy(false);
    }
  };

  const renderStudyOption = (study: Study) => (
    <Option key={study.id} value={study.id}>
      <div className="study-option">
        <div className="study-option-main">
          <FolderOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          <span className="study-name">{study.name}</span>
          {study.protocol_number && (
            <span className="study-protocol"> ({study.protocol_number})</span>
          )}
        </div>
        {study.sponsor && (
          <div className="study-option-meta">{study.sponsor}</div>
        )}
      </div>
    </Option>
  );

  return (
    <>
      <Select
        className="study-selector"
        placeholder="Select a study"
        value={selectedStudyId}
        onChange={handleStudySelect}
        loading={loading}
        style={{ minWidth: 250 }}
        size="large"
        showSearch
        optionFilterProp="children"
        filterOption={(input, option) =>
          (option?.children as any)?.props?.children?.[1]?.props?.children
            ?.toLowerCase()
            .includes(input.toLowerCase())
        }
        dropdownRender={menu => (
          <div>
            {menu}
            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
              <Button
                type="link"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
                block
              >
                Create New Study
              </Button>
            </div>
          </div>
        )}
        notFoundContent={
          loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin />
            </div>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No studies found"
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Your First Study
              </Button>
            </Empty>
          )
        }
      >
        {studies.map(renderStudyOption)}
      </Select>

      {/* Create Study Modal */}
      <Modal
        title="Create New Study"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateStudy}
        >
          <Form.Item
            name="name"
            label="Study Name"
            rules={[{ required: true, message: 'Please enter study name' }]}
          >
            <Input placeholder="e.g., STUDY-2025-001" />
          </Form.Item>

          <Form.Item
            name="protocol_number"
            label="Protocol Number"
          >
            <Input placeholder="e.g., PROTO-001" />
          </Form.Item>

          <Form.Item
            name="sponsor"
            label="Sponsor"
          >
            <Input placeholder="e.g., Acme Pharma" />
          </Form.Item>

          <Form.Item
            name="therapeutic_area"
            label="Therapeutic Area"
          >
            <Input placeholder="e.g., Oncology" />
          </Form.Item>

          <Form.Item
            name="phase"
            label="Study Phase"
          >
            <Select placeholder="Select phase">
              <Option value="Phase I">Phase I</Option>
              <Option value="Phase II">Phase II</Option>
              <Option value="Phase III">Phase III</Option>
              <Option value="Phase IV">Phase IV</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Brief study description" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={creatingStudy}>
                Create Study
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
