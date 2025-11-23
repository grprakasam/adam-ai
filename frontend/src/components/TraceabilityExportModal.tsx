import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Alert,
  Form,
  Checkbox,
  Select,
  Button,
  message,
  Spin,
} from 'antd';
import {
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  CodeOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { TraceabilityMatrix } from '../types/traceability';

const { TabPane } = Tabs;
const { Option } = Select;

interface TraceabilityExportModalProps {
  visible: boolean;
  matrix: TraceabilityMatrix | null;
  onClose: () => void;
}

export const TraceabilityExportModal: React.FC<TraceabilityExportModalProps> = ({
  visible,
  matrix,
  onClose,
}) => {
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [exporting, setExporting] = useState(false);
  const [excelOptions, setExcelOptions] = useState({
    includeGraph: true,
    includeSteps: true,
    includeRules: true,
    includeCode: false,
    includeComments: false,
  });

  const handleExport = async () => {
    if (!matrix) {
      message.error('No traceability matrix to export');
      return;
    }

    setExporting(true);

    try {
      const response = await fetch(
        `/api/v1/traceability/export/${matrix.study_id}/${matrix.dataset}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format: selectedFormat,
            options: excelOptions,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${matrix.study_id}_${matrix.dataset}_traceability.${selectedFormat === 'excel' ? 'xlsx' : selectedFormat === 'pdf' ? 'pdf' : selectedFormat === 'word' ? 'docx' : 'json'}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // Safely remove the element
      setTimeout(() => {
        try {
          if (a.parentNode === document.body) {
            document.body.removeChild(a);
          }
        } catch (e) {
          // Element may have already been removed, ignore
        }
        window.URL.revokeObjectURL(url);
      }, 100);

      message.success(`Traceability matrix exported as ${selectedFormat.toUpperCase()}`);
      onClose();
    } catch (error: any) {
      message.error(error.message || 'Failed to export traceability matrix');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title="Export Traceability Matrix"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
    >
      <Tabs activeKey={selectedFormat} onChange={setSelectedFormat}>
        {/* Excel Export */}
        <TabPane
          tab={
            <>
              <FileExcelOutlined /> Excel
            </>
          }
          key="excel"
        >
          <Alert
            message="Recommended for Data Review"
            description="Full traceability matrix with all variables, formulas, and hyperlinks."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form layout="vertical">
            <Form.Item label="Include">
              <Checkbox.Group
                value={Object.keys(excelOptions).filter(
                  (key) => excelOptions[key as keyof typeof excelOptions]
                )}
                onChange={(values) => {
                  setExcelOptions({
                    includeGraph: values.includes('includeGraph'),
                    includeSteps: values.includes('includeSteps'),
                    includeRules: values.includes('includeRules'),
                    includeCode: values.includes('includeCode'),
                    includeComments: values.includes('includeComments'),
                  });
                }}
              >
                <Checkbox value="includeGraph">Lineage Graph (embedded image)</Checkbox>
                <br />
                <Checkbox value="includeSteps">Derivation Steps (expanded)</Checkbox>
                <br />
                <Checkbox value="includeRules">ADAM IG Rule References</Checkbox>
                <br />
                <Checkbox value="includeCode">Code Snippets</Checkbox>
                <br />
                <Checkbox value="includeComments">Comments & Annotations</Checkbox>
              </Checkbox.Group>
            </Form.Item>

            <Form.Item label="Confidence Filter">
              <Select defaultValue="all" style={{ width: '100%' }}>
                <Option value="all">All Variables</Option>
                <Option value="high">High Confidence Only (&gt;80%)</Option>
                <Option value="flagged">Flagged for Review</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                block
                onClick={handleExport}
                loading={exporting}
              >
                Download Excel (.xlsx)
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        {/* PDF Export */}
        <TabPane
          tab={
            <>
              <FilePdfOutlined /> PDF
            </>
          }
          key="pdf"
        >
          <Alert
            message="Audit-Ready PDF Report"
            description="Professional document with embedded lineage graph, ideal for regulatory submissions."
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form layout="vertical">
            <Form.Item label="Template">
              <Select defaultValue="standard" style={{ width: '100%' }}>
                <Option value="standard">Standard FDA Template</Option>
                <Option value="corporate">Corporate Branding</Option>
                <Option value="minimal">Minimal (Compact)</Option>
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                block
                onClick={handleExport}
                loading={exporting}
              >
                Download PDF
              </Button>
            </Form.Item>
          </Form>
        </TabPane>

        {/* Word Export */}
        <TabPane
          tab={
            <>
              <FileWordOutlined /> Word
            </>
          }
          key="word"
        >
          <Alert
            message="Editable Word Document"
            description="Export to .docx for further customization and review comments."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            block
            onClick={handleExport}
            loading={exporting}
          >
            Download Word (.docx)
          </Button>
        </TabPane>

        {/* JSON Export */}
        <TabPane
          tab={
            <>
              <CodeOutlined /> JSON
            </>
          }
          key="json"
        >
          <Alert
            message="Machine-Readable Format"
            description="Raw traceability data for integration with other tools."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            block
            onClick={handleExport}
            loading={exporting}
          >
            Download JSON
          </Button>
        </TabPane>
      </Tabs>

      {exporting && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin />
          <div style={{ marginTop: 12, color: '#8c8c8c' }}>
            Preparing export...
          </div>
        </div>
      )}
    </Modal>
  );
};
