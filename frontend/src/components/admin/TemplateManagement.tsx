import React, { useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons';

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export const TemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: '1',
      name: 'ADSL Standard Template',
      type: 'code',
      description: 'Standard ADSL derivation template',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: () => (
        <Space>
          <Button size="small" icon={<EditOutlined />}>Edit</Button>
          <Button size="small" icon={<CopyOutlined />}>Clone</Button>
          <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="template-management">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>Code & Document Templates</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          New Template
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={templates}
        rowKey="id"
      />

      <Modal
        title="Create Template"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="code">Code Template</Select.Option>
              <Select.Option value="document">Document Template</Select.Option>
              <Select.Option value="validation">Validation Rule</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
