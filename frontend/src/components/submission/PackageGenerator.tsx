/**
 * Package Generator Panel Component
 * 
 * Wizard-style UI for generating submission packages with artifact selection
 */

import React, { useState } from 'react';
import { Card, Steps, Button, Checkbox, Alert, List, Tag, Space, Progress, Result } from 'antd';
import { 
  FileOutlined, 
  CheckCircleOutlined, 
  SettingOutlined,
  RocketOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { useProjectStore } from '../../store/projectStore';
import './PackageGenerator.css';

const { Step } = Steps;

interface PackageGeneratorProps {
  onBack: () => void;
}

const PackageGenerator: React.FC<PackageGeneratorProps> = ({ onBack }) => {
  const {
    selectedStudy,
    selectedDataset,
    isGeneratingPackage,
    generatedArtifacts,
    generateDefineXml,
    generateADRG,
    generateSDRG,
    createECTDPackage,
  } = useProjectStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedArtifacts, setSelectedArtifacts] = useState({
    defineXml: true,
    adrg: true,
    sdrg: false,
    programs: false
  });
  const [createZip, setCreateZip] = useState(true);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [packageResult, setPackageResult] = useState<any>(null);

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleGenerate = async () => {
    if (!selectedStudy) return;

    setGenerationProgress(10);

    try {
      // Step 1: Generate Define.xml
      if (selectedArtifacts.defineXml) {
        setGenerationProgress(20);
        await generateDefineXml(selectedStudy, [selectedDataset || '']);
      }

      // Step 2: Generate ADRG
      if (selectedArtifacts.adrg) {
        setGenerationProgress(40);
        await generateADRG(selectedStudy);
      }

      // Step 3: Generate SDRG
      if (selectedArtifacts.sdrg) {
        setGenerationProgress(60);
        await generateSDRG(selectedStudy);
      }

      // Step 4: Create eCTD Package
      setGenerationProgress(80);
      const result = await createECTDPackage(selectedStudy, createZip);
      setPackageResult(result);

      setGenerationProgress(100);
      handleNext();
    } catch (error) {
      console.error('Package generation failed:', error);
    }
  };

  const steps = [
    {
      title: 'Select Datasets',
      icon: <FileOutlined />,
      content: (
        <div className="step-content">
          <Alert
            message="Dataset Selection"
            description="Select which datasets to include in the submission package."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          
          <List
            bordered
            dataSource={[selectedDataset || 'ADSL', 'ADAE', 'ADLB', 'ADVS', 'ADTTE']}
            renderItem={item => (
              <List.Item>
                <Checkbox defaultChecked={item === selectedDataset}>
                  {item}
                </Checkbox>
                <Tag color="blue">{item === selectedDataset ? 'Active' : 'Available'}</Tag>
              </List.Item>
            )}
          />
        </div>
      )
    },
    {
      title: 'Configure Artifacts',
      icon: <SettingOutlined />,
      content: (
        <div className="step-content">
          <Alert
            message="Artifact Configuration"
            description="Choose which artifacts to generate for the submission."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card type="inner" title="Required Documents">
              <Checkbox
                checked={selectedArtifacts.defineXml}
                onChange={(e) => setSelectedArtifacts({ ...selectedArtifacts, defineXml: e.target.checked })}
              >
                <strong>Define.xml 2.1</strong>
                <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                  Dataset and variable metadata (FDA required)
                </div>
              </Checkbox>
              <br />
              <Checkbox
                checked={selectedArtifacts.adrg}
                onChange={(e) => setSelectedArtifacts({ ...selectedArtifacts, adrg: e.target.checked })}
                style={{ marginTop: 12 }}
              >
                <strong>ADRG (Analysis Data Reviewer's Guide)</strong>
                <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                  Documentation for reviewers
                </div>
              </Checkbox>
            </Card>

            <Card type="inner" title="Optional Documents">
              <Checkbox
                checked={selectedArtifacts.sdrg}
                onChange={(e) => setSelectedArtifacts({ ...selectedArtifacts, sdrg: e.target.checked })}
              >
                <strong>SDRG (Study Data Reviewer's Guide)</strong>
                <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                  Additional reviewer documentation
                </div>
              </Checkbox>
              <br />
              <Checkbox
                checked={selectedArtifacts.programs}
                onChange={(e) => setSelectedArtifacts({ ...selectedArtifacts, programs: e.target.checked })}
                style={{ marginTop: 12 }}
              >
                <strong>Analysis Programs</strong>
                <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
                  SAS/R programs used to generate datasets
                </div>
              </Checkbox>
            </Card>

            <Card type="inner" title="Package Options">
              <Checkbox
                checked={createZip}
                onChange={(e) => setCreateZip(e.target.checked)}
              >
                Create ZIP archive
              </Checkbox>
            </Card>
          </Space>
        </div>
      )
    },
    {
      title: 'Generate',
      icon: <RocketOutlined />,
      content: (
        <div className="step-content">
          <Alert
            message="Ready to Generate"
            description="Click 'Generate Package' to create your submission package with the selected configuration."
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card title="Selected Configuration">
            <List size="small">
              <List.Item>
                <strong>Study:</strong> {selectedStudy}
              </List.Item>
              <List.Item>
                <strong>Artifacts:</strong>
                <Space style={{ marginLeft: 8 }}>
                  {selectedArtifacts.defineXml && <Tag color="blue">Define.xml</Tag>}
                  {selectedArtifacts.adrg && <Tag color="green">ADRG</Tag>}
                  {selectedArtifacts.sdrg && <Tag color="green">SDRG</Tag>}
                  {selectedArtifacts.programs && <Tag color="orange">Programs</Tag>}
                </Space>
              </List.Item>
              <List.Item>
                <strong>Package Format:</strong> {createZip ? 'ZIP Archive' : 'Folder'}
              </List.Item>
            </List>
          </Card>

          {generationProgress > 0 && generationProgress < 100 && (
            <div style={{ marginTop: 24 }}>
              <Progress percent={generationProgress} status="active" />
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Complete',
      icon: <CheckCircleOutlined />,
      content: (
        <div className="step-content">
          <Result
            status="success"
            title="Package Generated Successfully!"
            subTitle={`Your submission package has been created: ${packageResult?.package_path || ''}`}
            extra={[
              <Button type="primary" key="download" icon={<DownloadOutlined />}>
                Download Package
              </Button>,
              <Button key="view" onClick={() => {
                // TODO: Open package location
              }}>
                View in Explorer
              </Button>
            ]}
          />

          {generatedArtifacts && generatedArtifacts.length > 0 && (
            <Card title="Generated Artifacts" style={{ marginTop: 24 }}>
              <List
                dataSource={generatedArtifacts}
                renderItem={artifact => (
                  <List.Item>
                    <List.Item.Meta
                      title={artifact.name}
                      description={artifact.path}
                    />
                    <Tag>{artifact.status}</Tag>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="package-generator">
      <Card
        title="Submission Package Generator"
        extra={<Button onClick={onBack}>Back to Dashboard</Button>}
      >
        {!selectedStudy ? (
          <Alert
            message="No Study Selected"
            description="Please select a study from the dashboard to generate a package."
            type="warning"
            showIcon
          />
        ) : (
          <>
            <Steps current={currentStep} style={{ marginBottom: 32 }}>
              {steps.map(item => (
                <Step key={item.title} title={item.title} icon={item.icon} />
              ))}
            </Steps>

            <div className="steps-content">
              {steps[currentStep].content}
            </div>

            <div className="steps-action" style={{ marginTop: 24 }}>
              <Space>
                {currentStep > 0 && currentStep < steps.length - 1 && (
                  <Button onClick={handlePrev}>
                    Previous
                  </Button>
                )}
                {currentStep < steps.length - 2 && (
                  <Button type="primary" onClick={handleNext}>
                    Next
                  </Button>
                )}
                {currentStep === steps.length - 2 && (
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={handleGenerate}
                    loading={isGeneratingPackage || (generationProgress > 0 && generationProgress < 100)}
                  >
                    Generate Package
                  </Button>
                )}
                {currentStep === steps.length - 1 && (
                  <Button type="primary" onClick={() => setCurrentStep(0)}>
                    Create Another Package
                  </Button>
                )}
              </Space>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default PackageGenerator;
