import React from 'react';
import { Modal, Button, Statistic, message } from 'antd';
import { Copy, Download } from 'lucide-react';
import './ProgramDownloadModal.css';

interface ProgramDownloadModalProps {
  visible: boolean;
  onClose: () => void;
  programCode: string;
  language: 'R' | 'SAS';
  datasetName: string;
}

export const ProgramDownloadModal: React.FC<ProgramDownloadModalProps> = ({
  visible,
  onClose,
  programCode,
  language,
  datasetName,
}) => {
  const downloadProgram = () => {
    const extension = language === 'R' ? 'R' : 'sas';
    const filename = `${datasetName}.${extension}`;

    const blob = new Blob([programCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    message.success(`Program downloaded as ${filename}`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(programCode);
    message.success('Code copied to clipboard!');
  };

  const linesOfCode = programCode ? programCode.split('\n').length : 0;
  const fileSize = programCode ? (programCode.length / 1024).toFixed(2) : '0.00';

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={20} />
          <span>
            Generated {language} Program: {datasetName}
          </span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1100}
      footer={[
        <Button key="copy" icon={<Copy size={16} />} onClick={copyToClipboard}>
          Copy Code
        </Button>,
        <Button
          key="download"
          type="primary"
          icon={<Download size={16} />}
          onClick={downloadProgram}
        >
          Download {language === 'R' ? '.R' : '.sas'} File
        </Button>,
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
      className="program-download-modal"
    >
      {/* Program Statistics */}
      <div className="program-stats">
        <Statistic title="Lines of Code" value={linesOfCode} />
        <Statistic title="File Size" value={fileSize} suffix="KB" />
        <Statistic title="Language" value={language} />
      </div>

      {/* Code Preview with Syntax Highlighting */}
      <div className="code-preview-section">
        <div className="code-preview-header">
          <span>Program Code Preview</span>
          <span className="preview-hint">
            Scroll to view full code or use actions above
          </span>
        </div>
        <pre className="code-preview">
          <code>{programCode}</code>
        </pre>
      </div>
    </Modal>
  );
};
