// @ts-nocheck
/**
 * Test With Data Panel
 * 
 * Generates mock SDTM datasets for testing ADAM programs.
 * Allows users to specify parameters, preview data, and download in multiple formats.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Table,
  Alert,
  Space,
  Slider,
  Radio,
  Tag,
  Statistic,
  Row,
  Col,
  Typography,
  Spin,
  message,
  Divider,
  Tooltip,
  Dropdown,
  MenuProps,
  Checkbox,
  Badge,
  Collapse,
  Switch,
} from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  FilterOutlined,
  FullscreenOutlined,
  ExportOutlined,
  UserOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  ApartmentOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import './TestWithDataPanel.css';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface SDTMGenerationParams {
  // Study Design
  domain: string;
  sdtm_version: string;
  adam_ig_version: string;
  study_start_date: string;
  study_end_date: string;
  study_phase: string;
  therapeutic_area: string;
  
  // Subjects
  num_subjects: number;
  sex_distribution: 'balanced' | 'male_biased' | 'female_biased' | 'custom';
  age_min: number;
  age_max: number;
  age_distribution: 'normal' | 'uniform' | 'realistic';
  
  // Treatment
  num_treatment_arms: number;
  treatment_arms: string[];
  randomization_ratio: string;
  
  // Visits
  num_visits: number;
  visit_schedule_days: number[];
  visit_window_days: number;
  
  // Records & Data Quality
  records_per_subject?: number;
  missingness_pct: number;
  protocol_deviations_pct: number;
  outlier_pct: number;
  
  // Data Generation
  distribution_type: 'uniform' | 'normal' | 'realistic';
  template_source: 'pharmaverse' | 'cdisc' | 'custom';
  include_meddra: boolean;
  include_ct: boolean;
}

interface Domain {
  code: string;
  name: string;
  description: string;
  variables_count: number;
  supports_multiple_records: boolean;
}

interface TestWithDataPanelProps {
  standalone?: boolean;
}

export const TestWithDataPanel: React.FC<TestWithDataPanelProps> = ({ standalone: _standalone = false }) => {
  const [form] = Form.useForm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [parameters, setParameters] = useState<SDTMGenerationParams>({
    // Study Design
    domain: 'DM',
    sdtm_version: '3.4',
    adam_ig_version: '1.3',
    study_start_date: '2024-01-01',
    study_end_date: '2024-12-31',
    study_phase: 'Phase III',
    therapeutic_area: 'Oncology',
    
    // Subjects
    num_subjects: 50,
    sex_distribution: 'balanced',
    age_min: 18,
    age_max: 75,
    age_distribution: 'realistic',
    
    // Treatment
    num_treatment_arms: 2,
    treatment_arms: ['Placebo', 'Active'],
    randomization_ratio: '1:1',
    
    // Visits
    num_visits: 5,
    visit_schedule_days: [1, 15, 30, 60, 90],
    visit_window_days: 3,
    
    // Data Quality
    records_per_subject: 1,
    missingness_pct: 10,
    protocol_deviations_pct: 5,
    outlier_pct: 2,
    
    // Data Generation
    distribution_type: 'realistic',
    template_source: 'pharmaverse',
    include_meddra: true,
    include_ct: true,
  });
  
  // Control panel collapse state
  const [activePanels, setActivePanels] = useState<string[]>(['study', 'subjects', 'treatment']);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);
  const [generatedData, setGeneratedData] = useState<any[] | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(true);
  
  // Table controls state
  const [searchText, setSearchText] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [tablePagination, setTablePagination] = useState({ pageSize: 20, current: 1 });
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('middle');

  // Load supported domains on mount
  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      setLoadingDomains(true);
      const response = await fetch('/api/v1/test-data/domains');
      const data = await response.json();
      setDomains(data.domains);
      if (data.domains.length > 0) {
        setSelectedDomain(data.domains[0]);
      }
    } catch (error) {
      message.error('Failed to load supported domains');
      console.error('Error loading domains:', error);
    } finally {
      setLoadingDomains(false);
    }
  };

  const handleDomainChange = (domainCode: string) => {
    const domain = domains.find(d => d.code === domainCode);
    setSelectedDomain(domain || null);
    setParameters({ ...parameters, domain: domainCode });
    
    // Reset records_per_subject based on domain
    if (domain?.supports_multiple_records && !parameters.records_per_subject) {
      setParameters({ ...parameters, domain: domainCode, records_per_subject: 5 });
      form.setFieldValue('records_per_subject', 5);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      message.loading({ content: 'Generating SDTM data...', key: 'generate', duration: 0 });

      const response = await fetch('/api/v1/test-data/generate-sdtm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      const data = await response.json();

      if (data.status === 'success') {
        setGeneratedData(data.preview_data);
        setStatistics(data.data);
        setValidationResults(data.validation_results);
        message.success({
          content: `Successfully generated ${data.data.total_rows} rows`,
          key: 'generate',
          duration: 3,
        });
      } else {
        throw new Error(data.message || 'Failed to generate data');
      }
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to generate SDTM data',
        key: 'generate',
        duration: 5,
      });
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'sas7bdat' | 'rds') => {
    try {
      message.loading({ content: `Preparing ${format.toUpperCase()} download...`, key: 'download', duration: 0 });

      const response = await fetch(`/api/v1/test-data/download-sdtm?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${parameters.domain}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success({ content: 'Download started', key: 'download', duration: 2 });
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to download data',
        key: 'download',
        duration: 5,
      });
      console.error('Download error:', error);
    }
  };

  const handleReset = () => {
    setGeneratedData(null);
    setStatistics(null);
    setValidationResults(null);
    form.resetFields();
    setParameters({
      domain: 'DM',
      num_subjects: 50,
      missingness_pct: 10,
      distribution_type: 'realistic',
      study_start_date: '2024-01-01',
      study_end_date: '2024-12-31',
      template_source: 'pharmaverse',
    });
  };

  // Initialize visible columns when data is generated
  useEffect(() => {
    if (generatedData && generatedData.length > 0) {
      const allColumns = Object.keys(generatedData[0]);
      // Always initialize visible columns when new data is generated
      if (visibleColumns.size === 0 || visibleColumns.size !== allColumns.length) {
        setVisibleColumns(new Set(allColumns));
      }
    } else {
      // Clear visible columns when no data
      if (visibleColumns.size > 0) {
        setVisibleColumns(new Set());
      }
    }
  }, [generatedData]);

  // Table columns for preview with visibility control
  const getPreviewColumns = () => {
    if (!generatedData || generatedData.length === 0) return [];
    
    const firstRow = generatedData[0];
    const allCols = Object.keys(firstRow);
    
    // Filter columns based on visibility - if none selected, show all
    const colsToShow = visibleColumns.size > 0
      ? allCols.filter(key => visibleColumns.has(key))
      : allCols;
    
    // Ensure we always have columns to show
    if (colsToShow.length === 0) {
      return allCols.map(key => ({
        title: key,
        dataIndex: key,
        key: key,
        width: 140,
        ellipsis: true,
        render: (text: any) => String(text || '—'),
      }));
    }
    
    return colsToShow.map(key => ({
        title: key,
        dataIndex: key,
        key: key,
        width: 140,
        ellipsis: true,
        sorter: (a: any, b: any) => {
          const aVal = a[key];
          const bVal = b[key];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal || '').localeCompare(String(bVal || ''));
        },
        render: (text: any) => (
          <Tooltip title={text}>
            <span style={{ 
              fontWeight: typeof text === 'number' ? 500 : 'normal',
              fontFamily: typeof text === 'number' ? 'monospace' : 'inherit'
            }}>
              {text !== null && text !== undefined ? String(text) : <Text type="secondary">—</Text>}
            </span>
          </Tooltip>
        ),
      }));
  };

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!generatedData || !searchText) return generatedData || [];
    
    const searchLower = searchText.toLowerCase();
    return generatedData.filter((row: any) => {
      return Object.values(row).some((val: any) => 
        String(val || '').toLowerCase().includes(searchLower)
      );
    });
  }, [generatedData, searchText]);

  // Get all available columns
  const allColumns = useMemo(() => {
    if (!generatedData || generatedData.length === 0) return [];
    return Object.keys(generatedData[0]);
  }, [generatedData]);

  // Column visibility menu with select all/none
  const columnVisibilityMenu: MenuProps = {
    items: [
      {
        key: 'header',
        label: (
          <div style={{ padding: '4px 8px', borderBottom: '1px solid #f0f0f0', marginBottom: '4px' }}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisibleColumns(new Set(allColumns));
                }}
                style={{ padding: 0, height: 'auto', fontSize: '12px' }}
              >
                Select All
              </Button>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <Button
                type="link"
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setVisibleColumns(new Set());
                }}
                style={{ padding: 0, height: 'auto', fontSize: '12px' }}
              >
                Clear All
              </Button>
            </Space>
          </div>
        ),
        disabled: true,
      },
      ...allColumns.map((col) => ({
        key: col,
        label: (
          <Checkbox
            checked={visibleColumns.has(col)}
            onChange={(e) => {
              const newVisible = new Set(visibleColumns);
              if (e.target.checked) {
                newVisible.add(col);
              } else {
                newVisible.delete(col);
              }
              setVisibleColumns(newVisible);
            }}
            style={{ width: '100%' }}
          >
            <span style={{ fontSize: '13px' }}>{col}</span>
          </Checkbox>
        ),
      })),
    ],
  };

  // Export menu
  const exportMenu: MenuProps = {
    items: [
      {
        key: 'csv',
        label: 'Download CSV',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('csv'),
      },
      {
        key: 'sas',
        label: 'Download SAS',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('sas7bdat'),
      },
      {
        key: 'rds',
        label: 'Download RDS',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('rds'),
      },
    ],
  };

  if (loadingDomains) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p style={{ marginTop: 16 }}>Loading SDTM domains...</p>
      </div>
    );
  }

  return (
    <div className="test-with-data-panel">
      {/* Compact Header */}
      <div className="test-data-header-compact">
        <div className="header-info">
          <DatabaseOutlined style={{ fontSize: 18 }} />
          <div>
            <span className="header-title">Test With Data</span>
            <span className="header-subtitle">Generate CDISC-Compliant SDTM Test Data</span>
          </div>
        </div>
        <div className="header-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={isGenerating}
            size="middle"
          >
            Reset
          </Button>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={isGenerating}
            size="large"
          >
            {isGenerating ? 'Generating...' : 'Generate Test Data'}
          </Button>
        </div>
      </div>

      {/* Split Layout: Left Controls + Right Table */}
      <div className="test-data-split-layout">
        {/* Left Panel: Configuration Controls */}
        <div className="test-data-controls-panel-left">
          <div className="controls-panel-header">
            <SettingOutlined style={{ fontSize: 16, color: '#3b82f6' }} />
            <span>Configuration</span>
          </div>
          <div className="controls-panel-body">
            <Collapse
              activeKey={activePanels}
              onChange={setActivePanels}
              ghost
              className="adam-control-collapse"
            >
              {/* Study Design Section */}
              <Collapse.Panel 
                key="study" 
                header={
                  <span className="panel-header">
                    <FileTextOutlined />
                    <span>Study Design & CDISC Standards</span>
                  </span>
                }
                className="control-panel-section"
              >
                <Form
                  form={form}
                  layout="vertical"
                  initialValues={parameters}
                  onValuesChange={(_, allValues) => setParameters(allValues)}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="SDTM Domain"
                        name="domain"
                        tooltip="CDISC SDTM domain to generate"
                        rules={[{ required: true }]}
                      >
                        <Select size="middle" onChange={handleDomainChange}>
                          {domains.map(domain => (
                            <Option key={domain.code} value={domain.code}>
                              <Tag color="blue">{domain.code}</Tag> {domain.name}
                            </Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="SDTM Version"
                        name="sdtm_version"
                        tooltip="CDISC SDTM standard version"
                      >
                        <Select size="middle">
                          <Option value="3.4">SDTM v3.4 (Recommended)</Option>
                          <Option value="3.3">SDTM v3.3</Option>
                          <Option value="3.2">SDTM v3.2</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="ADaM IG Version"
                        name="adam_ig_version"
                        tooltip="ADaM Implementation Guide version"
                      >
                        <Select size="middle">
                          <Option value="1.3">ADaM IG v1.3 (Recommended)</Option>
                          <Option value="1.4">ADaM IG v1.4</Option>
                          <Option value="2.0">ADaM IG v2.0</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="Study Phase"
                        name="study_phase"
                        tooltip="Clinical trial phase"
                      >
                        <Select size="middle">
                          <Option value="Phase I">Phase I</Option>
                          <Option value="Phase II">Phase II</Option>
                          <Option value="Phase III">Phase III</Option>
                          <Option value="Phase IV">Phase IV</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Therapeutic Area"
                        name="therapeutic_area"
                        tooltip="CDISC therapeutic area"
                      >
                        <Select size="middle">
                          <Option value="Oncology">Oncology</Option>
                          <Option value="Cardiovascular">Cardiovascular</Option>
                          <Option value="Neurology">Neurology</Option>
                          <Option value="Respiratory">Respiratory</Option>
                          <Option value="Other">Other</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Study Start Date"
                        name="study_start_date"
                        rules={[{ required: true }]}
                      >
                        <Input type="date" size="middle" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="Study End Date"
                        name="study_end_date"
                        rules={[{ required: true }]}
                      >
                        <Input type="date" size="middle" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Controlled Terminology"
                        name="include_ct"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Include CT" unCheckedChildren="No CT" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>

              {/* Subjects Section */}
              <Collapse.Panel 
                key="subjects" 
                header={
                  <span className="panel-header">
                    <UserOutlined />
                    <span>Subjects & Demographics</span>
                  </span>
                }
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="Number of Subjects"
                        name="num_subjects"
                        tooltip="Total subjects in study (CDISC: N)"
                        rules={[{ required: true }]}
                      >
                        <InputNumber
                          min={1}
                          max={1000}
                          style={{ width: '100%' }}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Sex Distribution"
                        name="sex_distribution"
                        tooltip="Distribution of sex (CDISC: SEX)"
                      >
                        <Select size="middle">
                          <Option value="balanced">Balanced (50/50)</Option>
                          <Option value="male_biased">Male Biased (60/40)</Option>
                          <Option value="female_biased">Female Biased (40/60)</Option>
                          <Option value="custom">Custom</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Age Distribution"
                        name="age_distribution"
                        tooltip="Age distribution pattern (CDISC: AGE)"
                      >
                        <Select size="middle">
                          <Option value="realistic">Realistic (Normal)</Option>
                          <Option value="normal">Normal Distribution</Option>
                          <Option value="uniform">Uniform Distribution</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={`Age Range: ${parameters.age_min} - ${parameters.age_max} years`}
                        tooltip="CDISC AGE variable range"
                      >
                        <Space style={{ width: '100%' }} direction="vertical">
                          <InputNumber
                            min={18}
                            max={100}
                            value={parameters.age_min}
                            onChange={(val) => setParameters({ ...parameters, age_min: val || 18 })}
                            placeholder="Min Age"
                            style={{ width: '48%' }}
                          />
                          <InputNumber
                            min={18}
                            max={100}
                            value={parameters.age_max}
                            onChange={(val) => setParameters({ ...parameters, age_max: val || 75 })}
                            placeholder="Max Age"
                            style={{ width: '48%' }}
                          />
                        </Space>
                      </Form.Item>
                    </Col>
                    {selectedDomain?.supports_multiple_records && (
                      <Col span={12}>
                        <Form.Item
                          label="Records Per Subject"
                          name="records_per_subject"
                          tooltip="Average records per subject (e.g., AE, LB)"
                        >
                          <InputNumber
                            min={1}
                            max={100}
                            style={{ width: '100%' }}
                            size="middle"
                          />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                </Form>
              </Collapse.Panel>

              {/* Treatment Section */}
              <Collapse.Panel 
                key="treatment" 
                header={
                  <span className="panel-header">
                    <MedicineBoxOutlined />
                    <span>Treatment & Randomization</span>
                  </span>
                }
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="Number of Treatment Arms"
                        name="num_treatment_arms"
                        tooltip="CDISC: TRT01P, TRT02P, etc."
                      >
                        <InputNumber
                          min={1}
                          max={4}
                          style={{ width: '100%' }}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Randomization Ratio"
                        name="randomization_ratio"
                        tooltip="Treatment allocation ratio"
                      >
                        <Select size="middle">
                          <Option value="1:1">1:1 (Balanced)</Option>
                          <Option value="2:1">2:1 (Active:Placebo)</Option>
                          <Option value="1:2">1:2 (Placebo:Active)</Option>
                          <Option value="3:1">3:1</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Template Source"
                        name="template_source"
                        tooltip="Data generation template"
                      >
                        <Select size="middle">
                          <Option value="pharmaverse">Pharmaverse (Industry)</Option>
                          <Option value="cdisc">CDISC Reference</Option>
                          <Option value="custom">Custom Template</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>

              {/* Visits Section */}
              <Collapse.Panel 
                key="visits" 
                header={
                  <span className="panel-header">
                    <CalendarOutlined />
                    <span>Visit Schedule & Windows</span>
                  </span>
                }
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        label="Number of Visits"
                        name="num_visits"
                        tooltip="CDISC: VISITNUM, VISIT variables"
                      >
                        <InputNumber
                          min={1}
                          max={20}
                          style={{ width: '100%' }}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Visit Window (Days)"
                        name="visit_window_days"
                        tooltip="Allowable window around scheduled visit"
                      >
                        <InputNumber
                          min={0}
                          max={30}
                          style={{ width: '100%' }}
                          size="middle"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label="Distribution Type"
                        name="distribution_type"
                        tooltip="Data distribution pattern"
                      >
                        <Select size="middle">
                          <Option value="realistic">Realistic (Recommended)</Option>
                          <Option value="normal">Normal</Option>
                          <Option value="uniform">Uniform</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>

              {/* Data Quality Section */}
              <Collapse.Panel 
                key="quality" 
                header={
                  <span className="panel-header">
                    <SafetyOutlined />
                    <span>Data Quality & Protocol Deviations</span>
                  </span>
                }
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={`Missing Data: ${parameters.missingness_pct}%`}
                        name="missingness_pct"
                        tooltip="Percentage of missing values (CDISC: --STRESC, --STAT)"
                      >
                        <Slider
                          min={0}
                          max={50}
                          marks={{ 0: '0%', 10: '10%', 25: '25%', 50: '50%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={`Protocol Deviations: ${parameters.protocol_deviations_pct}%`}
                        name="protocol_deviations_pct"
                        tooltip="Percentage of subjects with protocol deviations"
                      >
                        <Slider
                          min={0}
                          max={30}
                          marks={{ 0: '0%', 5: '5%', 15: '15%', 30: '30%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={`Outliers: ${parameters.outlier_pct}%`}
                        name="outlier_pct"
                        tooltip="Percentage of outlier values for testing"
                      >
                        <Slider
                          min={0}
                          max={10}
                          marks={{ 0: '0%', 2: '2%', 5: '5%', 10: '10%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Include MedDRA Coding"
                        name="include_meddra"
                        valuePropName="checked"
                        tooltip="Include MedDRA terminology for AE domain"
                      >
                        <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>
            </Collapse>
          </div>
        </div>

        {/* Right Panel: Data Table View */}
        <div className="test-data-table-panel-right">
          {!generatedData ? (
            <div className="empty-state-right">
              <ExperimentOutlined style={{ fontSize: 64, color: '#cbd5e1', marginBottom: 20 }} />
              <Title level={3} style={{ color: '#475569', marginBottom: 8 }}>No Test Data Generated</Title>
              <Paragraph style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '500px', marginBottom: 24 }}>
                Configure your SDTM data parameters on the left panel and click "Generate Test Data" to create 
                realistic test datasets for validating your consolidated ADAM code.
              </Paragraph>
              <Space direction="vertical" size="small" style={{ textAlign: 'left', maxWidth: '500px' }}>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />
                  Create variations of SDTM data to test edge cases
                </Text>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />
                  Validate your consolidated code against different data scenarios
                </Text>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  <CheckCircleOutlined style={{ color: '#10b981', marginRight: 8 }} />
                  Export data in CSV, SAS, or RDS formats
                </Text>
              </Space>
            </div>
          ) : (
            <div className="table-panel-content">
              {/* Compact Statistics Bar */}
              {statistics && (
                <div className="stats-bar-compact">
                  <Space size="large" wrap>
                    <Statistic
                      title="Rows"
                      value={statistics.total_rows}
                      valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}
                      prefix={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />}
                    />
                    <Statistic
                      title="Columns"
                      value={statistics.total_columns}
                      valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}
                    />
                    <Statistic
                      title="Domain"
                      value={statistics.domain}
                      valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#667eea' }}
                    />
                    <Statistic
                      title="Size"
                      value={statistics.memory_size_kb.toFixed(1)}
                      suffix="KB"
                      valueStyle={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}
                    />
                    {validationResults && (
                      <Tag 
                        color={validationResults.is_valid ? 'success' : 'error'} 
                        icon={validationResults.is_valid ? <CheckCircleOutlined /> : <WarningOutlined />}
                        style={{ marginLeft: 'auto', fontSize: '13px', padding: '4px 12px' }}
                      >
                        {validationResults.is_valid ? 'Validated' : 'Issues Found'}
                      </Tag>
                    )}
                  </Space>
                </div>
              )}

              {/* Validation Alerts */}
              {validationResults && (validationResults.errors?.length > 0 || validationResults.warnings?.length > 0) && (
                <div style={{ marginBottom: 16 }}>
                  {validationResults.errors && validationResults.errors.length > 0 && (
                    <Alert
                      message="Validation Errors"
                      description={
                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                          {validationResults.errors.map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      }
                      type="error"
                      showIcon
                      closable
                      style={{ marginBottom: 8 }}
                    />
                  )}
                  {validationResults.warnings && validationResults.warnings.length > 0 && (
                    <Alert
                      message="Validation Warnings"
                      description={
                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                          {validationResults.warnings.map((warn: string, idx: number) => (
                            <li key={idx}>{warn}</li>
                          ))}
                        </ul>
                      }
                      type="warning"
                      showIcon
                      closable
                    />
                  )}
                </div>
              )}

              {/* Enhanced Data Table with Controls */}
              {generatedData && generatedData.length > 0 && (
                <Card className="preview-card-right" style={{ marginBottom: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  {/* Table Controls Toolbar */}
                  <div className="table-controls-toolbar">
                    <div className="table-controls-left">
                      <Input
                        placeholder="Search in data..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        style={{ width: 280 }}
                        size="middle"
                      />
                      <Dropdown menu={columnVisibilityMenu} trigger={['click']} placement="bottomLeft">
                        <Button icon={<EyeOutlined />}>
                          Columns ({visibleColumns.size}/{allColumns.length})
                        </Button>
                      </Dropdown>
                      <Button 
                        icon={<SettingOutlined />}
                        onClick={() => setTableSize(tableSize === 'small' ? 'middle' : tableSize === 'middle' ? 'large' : 'small')}
                      >
                        Size: {tableSize === 'small' ? 'Compact' : tableSize === 'middle' ? 'Normal' : 'Comfortable'}
                      </Button>
                    </div>
                    <div className="table-controls-right">
                      {searchText && filteredData.length !== (generatedData?.length || 0) && (
                        <Badge count={filteredData.length} offset={[8, 0]} style={{ backgroundColor: '#667eea' }}>
                          <Text type="secondary" style={{ fontSize: '13px' }}>
                            {filteredData.length} of {statistics?.total_rows || 0} rows
                          </Text>
                        </Badge>
                      )}
                      {!searchText && (
                        <Text type="secondary" style={{ fontSize: '13px' }}>
                          Total: {statistics?.total_rows || 0} rows
                        </Text>
                      )}
                      <Dropdown menu={exportMenu} trigger={['click']} placement="bottomRight">
                        <Button type="primary" icon={<ExportOutlined />}>
                          Export
                        </Button>
                      </Dropdown>
                    </div>
                  </div>

                  {/* Data Table */}
                  {getPreviewColumns().length > 0 ? (
                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <Table
                        dataSource={filteredData.map((row: any, idx: number) => ({ ...row, key: idx }))}
                        columns={getPreviewColumns()}
                        scroll={{ x: 'max-content', y: 'calc(100vh - 520px)' }}
                      pagination={{
                        current: tablePagination.current,
                        pageSize: tablePagination.pageSize,
                        total: filteredData.length,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} rows`,
                        pageSizeOptions: ['10', '20', '50', '100', '200'],
                        onChange: (page, pageSize) => {
                          setTablePagination({ current: page, pageSize });
                        },
                      }}
                      size={tableSize}
                      bordered
                      style={{ flex: 1, minHeight: 0 }}
                    />
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestWithDataPanel;
