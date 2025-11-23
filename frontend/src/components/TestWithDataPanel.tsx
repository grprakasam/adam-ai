// @ts-nocheck
/**
 * SDTM Generator Panel
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
  
  // Safety-Specific Configuration (CDISC SDTM 3.4)
  serious_ae_pct: number;
  severe_ae_pct: number;
  related_ae_pct: number;
  lab_abnormality_pct: number;
}

interface Domain {
  code: string;
  name: string;
  description: string;
  variables_count: number;
  supports_multiple_records: boolean;
  is_critical_for_adam?: boolean;
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
    
    // Safety-Specific Configuration (CDISC SDTM 3.4)
    serious_ae_pct: 5.0,
    severe_ae_pct: 10.0,
    related_ae_pct: 30.0,
    lab_abnormality_pct: 15.0,
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

  // Error definitions and tips mapping
  const getErrorDefinition = (errorMessage: string): { definition: string; field?: string; tips: string[] } => {
    const lowerError = errorMessage.toLowerCase();
    
    // Missing required variables
    if (lowerError.includes('missing required variables')) {
      const varsMatch = errorMessage.match(/missing required variables: (.+)/i);
      return {
        definition: 'One or more required CDISC variables are missing from the generated dataset. This violates SDTM standards and will prevent proper data analysis.',
        tips: [
          'Check the domain selection - some domains require specific variables',
          'Ensure the domain template includes all required variables for your SDTM version',
          'Try selecting a different template source (CDISC, Pharmaverse, or Custom)',
          'Verify the domain supports the variables you need',
        ],
      };
    }
    
    // Invalid USUBJID format
    if (lowerError.includes('invalid usubjid')) {
      return {
        definition: 'Subject identifiers do not follow the CDISC standard format (STUDY-SITE-SUBJECT).',
        field: 'num_subjects',
        tips: [
          'The system automatically generates USUBJID in the format: STUDYID-SITEID-SUBJID',
          'Ensure you have entered a valid number of subjects (minimum 1)',
          'Check that study ID and site IDs are properly configured',
          'Try reducing the number of subjects and regenerate',
        ],
      };
    }
    
    // Sequence variable issues
    if (lowerError.includes('seq') && lowerError.includes('sequential')) {
      return {
        definition: 'Sequence variables (like AESEQ, LBSEQ) are not properly sequential, which can cause data integrity issues.',
        field: 'records_per_subject',
        tips: [
          'Check the "Records per Subject" setting for this domain',
          'For domains like AE, LB, VS, ensure records_per_subject is greater than 0',
          'Verify visit schedule is configured correctly',
          'Try adjusting the number of visits or records per subject',
        ],
      };
    }
    
    // Date range issues
    if (lowerError.includes('date') || lowerError.includes('rfdstdtc') || lowerError.includes('rfendtc')) {
      return {
        definition: 'Date variables or date ranges are invalid. CDISC requires dates in ISO 8601 format (YYYY-MM-DD).',
        field: 'study_start_date',
        tips: [
          'Ensure study start date is before study end date',
          'Check date format: YYYY-MM-DD (e.g., 2024-01-01)',
          'Verify visit schedule days align with the study date range',
          'For RFSTDTC: ensure it\'s set for all subjects in DM domain',
        ],
      };
    }
    
    // Age validation issues
    if (lowerError.includes('age')) {
      return {
        definition: 'Age values are outside acceptable ranges or not properly formatted.',
        field: 'age_min',
        tips: [
          'Check minimum age is less than maximum age',
          'Ensure age range is realistic (typically 18-100 for clinical trials)',
          'Verify age distribution type matches your study design',
          'For pediatric studies, adjust age range accordingly',
        ],
      };
    }
    
    // Subject count issues
    if (lowerError.includes('subject') || lowerError.includes('no data') || lowerError.includes('empty')) {
      return {
        definition: 'No data was generated, likely due to invalid subject count or configuration.',
        field: 'num_subjects',
        tips: [
          'Ensure number of subjects is at least 1',
          'Check that all required fields are filled in the configuration',
          'Verify the domain selection is valid',
          'Try resetting the form and starting with default values',
        ],
      };
    }
    
    // Treatment/Randomization issues
    if (lowerError.includes('treatment') || lowerError.includes('arm') || lowerError.includes('randomization')) {
      return {
        definition: 'Treatment assignment or randomization configuration is invalid.',
        field: 'num_treatment_arms',
        tips: [
          'Ensure number of treatment arms matches the treatment arms list',
          'Check randomization ratio format (e.g., "1:1" or "2:1:1")',
          'Verify each treatment arm has a unique name',
          'For single-arm studies, set num_treatment_arms to 1',
        ],
      };
    }
    
    // Visit schedule issues
    if (lowerError.includes('visit') || lowerError.includes('schedule')) {
      return {
        definition: 'Visit schedule configuration is invalid or missing required visit information.',
        field: 'num_visits',
        tips: [
          'Ensure number of visits matches the visit schedule days array',
          'Check visit schedule days are in ascending order',
          'Verify visit window is reasonable (typically 1-7 days)',
          'For baseline-only studies, use 1 visit with day 1',
        ],
      };
    }
    
    // Domain-specific errors
    if (lowerError.includes('domain') || lowerError.includes('not supported')) {
      return {
        definition: 'The selected domain is not supported or has invalid configuration.',
        field: 'domain',
        tips: [
          'Select a supported domain (DM, AE, LB, VS, EX, etc.)',
          'Check that the domain template source is compatible',
          'Verify SDTM version supports this domain',
          'Try selecting a different domain to test',
        ],
      };
    }
    
    // Generic error fallback
    return {
      definition: 'An error occurred during data generation. This may be due to invalid configuration parameters.',
      tips: [
        'Review all configuration settings in the left panel',
        'Check that numeric values are within valid ranges',
        'Ensure dates are properly formatted (YYYY-MM-DD)',
        'Try clicking "Reset" to restore default values',
        'Verify all required fields are filled',
      ],
    };
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setValidationResults(null); // Clear previous validation results
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
        
        // Check if there are validation errors
        if (data.validation_results && !data.validation_results.is_valid && data.validation_results.errors?.length > 0) {
          message.warning({
            content: (
              <div>
                <div style={{ fontWeight: 600 }}>Data generated with {data.validation_results.errors.length} validation error(s)</div>
                <div style={{ fontSize: '12px', marginTop: 4 }}>Please review the detailed error information below</div>
              </div>
            ),
            key: 'generate',
            duration: 6,
          });
        } else {
          message.success({
            content: `Successfully generated ${data.data.total_rows} rows`,
            key: 'generate',
            duration: 3,
          });
        }
      } else {
        // Handle API-level errors
        const errorDef = getErrorDefinition(data.message || 'Failed to generate data');
        // Create validation results structure for API errors
        setValidationResults({
          is_valid: false,
          errors: [data.message || 'Failed to generate data'],
          warnings: [],
          error_definitions: [errorDef],
        });
        throw new Error(data.message || 'Failed to generate data');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to generate SDTM data';
      const errorDef = getErrorDefinition(errorMessage);
      
      // Show detailed error message
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{errorMessage}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 }}>
              {errorDef.definition}
            </div>
            {errorDef.tips.length > 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.75)', marginTop: 8, fontStyle: 'italic' }}>
                💡 Tip: {errorDef.tips[0]}
              </div>
            )}
          </div>
        ),
        key: 'generate',
        duration: 8,
      });
      
      // Set error in validation results for display if not already set
      if (!validationResults || !validationResults.errors?.includes(errorMessage)) {
        setValidationResults({
          is_valid: false,
          errors: [errorMessage],
          warnings: [],
          error_definitions: [errorDef],
        });
      }
      
      // Clear generated data on error
      setGeneratedData(null);
      setStatistics(null);
      
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
      
      // Safety-Specific Configuration (CDISC SDTM 3.4)
      serious_ae_pct: 5.0,
      severe_ae_pct: 10.0,
      related_ae_pct: 30.0,
      lab_abnormality_pct: 15.0,
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
            <span className="header-title">SDTM Generator</span>
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
                {/* Helper message for ADAM-critical domains */}
                {(selectedDomain?.code === 'EX' || selectedDomain?.code === 'DS') && (
                  <Alert
                    message={
                      <Space>
                        <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        <span>
                          <strong>{selectedDomain.code} Domain</strong> - Critical for ADAM Analysis
                        </span>
                      </Space>
                    }
                    description={
                      selectedDomain.code === 'EX' 
                        ? "EX domain provides treatment exposure data needed for ADAM ADSL (TRTSDT, TRTEDT, TRTDURD) and ADEX datasets. When you generate DM domain, it will automatically include analysis flags if EX data is available."
                        : "DS domain provides study completion status needed for ADAM analysis flags (ITTFL, SAFFL, EFFFL). When you generate DM domain, it will automatically include these flags if DS data is available."
                    }
                    type="info"
                    showIcon={false}
                    style={{ marginBottom: 16 }}
                  />
                )}
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
                        tooltip="CDISC SDTM domain to generate. EX and DS are critical for ADAM analysis."
                        rules={[{ required: true }]}
                      >
                        <Select size="middle" onChange={handleDomainChange}>
                          {domains.map(domain => {
                            const isAdamCritical = domain.code === 'EX' || domain.code === 'DS';
                            const isAdamReady = domain.code === 'DM' && domain.is_critical_for_adam !== undefined;
                            return (
                              <Option key={domain.code} value={domain.code}>
                                <Space>
                                  <Tag color={isAdamCritical ? 'red' : 'blue'}>{domain.code}</Tag>
                                  <span>{domain.name}</span>
                                  {isAdamCritical && (
                                    <Tag color="red" style={{ fontSize: '10px', marginLeft: 4 }}>
                                      ADAM Critical
                                    </Tag>
                                  )}
                                  {isAdamReady && (
                                    <Tag color="green" style={{ fontSize: '10px', marginLeft: 4 }}>
                                      ADAM Ready
                                    </Tag>
                                  )}
                                </Space>
                              </Option>
                            );
                          })}
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

              {/* Safety Configuration Section - CDISC SDTM 3.4 */}
              <Collapse.Panel 
                key="safety" 
                header={
                  <span className="panel-header">
                    <SafetyOutlined />
                    <span>Safety Analysis Configuration</span>
                    <Tag color="red" style={{ marginLeft: 8, fontSize: '11px' }}>CDISC</Tag>
                  </span>
                }
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={`Serious AEs (AESER='Y'): ${parameters.serious_ae_pct}%`}
                        name="serious_ae_pct"
                        tooltip="CDISC: Percentage of serious adverse events (AESER). Critical for safety analysis."
                      >
                        <Slider
                          min={0}
                          max={50}
                          marks={{ 0: '0%', 5: '5%', 10: '10%', 25: '25%', 50: '50%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={`Severe AEs (AESEV='SEVERE'): ${parameters.severe_ae_pct}%`}
                        name="severe_ae_pct"
                        tooltip="CDISC: Percentage of severe adverse events (AESEV='SEVERE')"
                      >
                        <Slider
                          min={0}
                          max={50}
                          marks={{ 0: '0%', 10: '10%', 20: '20%', 50: '50%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={`Treatment-Related AEs: ${parameters.related_ae_pct}%`}
                        name="related_ae_pct"
                        tooltip="CDISC: Percentage of AEs with AEREL indicating relationship (POSSIBLY/PROBABLY/DEFINITELY RELATED)"
                      >
                        <Slider
                          min={0}
                          max={100}
                          marks={{ 0: '0%', 30: '30%', 50: '50%', 100: '100%' }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={`Lab Abnormalities (LBNRIND): ${parameters.lab_abnormality_pct}%`}
                        name="lab_abnormality_pct"
                        tooltip="CDISC: Percentage of abnormal lab values (LBNRIND='HIGH' or 'LOW') for safety analysis"
                      >
                        <Slider
                          min={0}
                          max={50}
                          marks={{ 0: '0%', 10: '10%', 20: '20%', 50: '50%' }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Divider style={{ margin: '12px 0' }} />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="MedDRA Coding"
                        name="include_meddra"
                        tooltip="CDISC: Include MedDRA coding (AEDECOD, AEBODSYS, AESOC) for AE domain"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="Controlled Terminology"
                        name="include_ct"
                        tooltip="CDISC: Validate against controlled terminology standards"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
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
                    <WarningOutlined />
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
              <Title level={3} style={{ color: '#475569', marginBottom: 8 }}>No SDTM Data Generated</Title>
              <Paragraph style={{ color: '#94a3b8', textAlign: 'center', maxWidth: '500px', marginBottom: 24 }}>
                Configure your SDTM data parameters on the left panel and click "Generate Test Data" to create 
                realistic SDTM datasets for validating your consolidated ADAM code.
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
                    {/* ADAM-Ready Indicator */}
                    {generatedData && generatedData.length > 0 && parameters.domain === 'DM' && (
                      generatedData[0].ITTFL || generatedData[0].SAFFL || generatedData[0].EFFFL ? (
                        <Tag 
                          color="green" 
                          icon={<CheckCircleOutlined />}
                          style={{ fontSize: '13px', padding: '4px 12px', fontWeight: 600 }}
                        >
                          ADAM-Ready
                        </Tag>
                      ) : null
                    )}
                    {validationResults && (
                      <Tag 
                        color={validationResults.is_valid ? 'success' : 'error'} 
                        icon={validationResults.is_valid ? <CheckCircleOutlined /> : <WarningOutlined />}
                        style={{ marginLeft: validationResults.is_valid ? 'auto' : 0, fontSize: '13px', padding: '4px 12px' }}
                      >
                        {validationResults.is_valid ? 'Validated' : 'Issues Found'}
                      </Tag>
                    )}
                  </Space>
                </div>
              )}

              {/* Enhanced Validation Alerts with Definitions and Tips */}
              {validationResults && (validationResults.errors?.length > 0 || validationResults.warnings?.length > 0) && (
                <div style={{ marginBottom: 16 }}>
                  {validationResults.errors && validationResults.errors.length > 0 && (
                    <Card
                      style={{
                        marginBottom: 16,
                        borderColor: '#ff4d4f',
                        backgroundColor: '#fff2f0',
                      }}
                    >
                      <div style={{ marginBottom: 12 }}>
                        <Space>
                          <WarningOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
                          <Title level={5} style={{ margin: 0, color: '#cf1322' }}>
                            Validation Errors ({validationResults.errors.length})
                          </Title>
                        </Space>
                      </div>
                      
                      {validationResults.errors.map((err: string, idx: number) => {
                        const errorDef = getErrorDefinition(err);
                        return (
                          <div
                            key={idx}
                            style={{
                              marginBottom: idx < validationResults.errors.length - 1 ? 20 : 0,
                              padding: '16px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #ffccc7',
                            }}
                          >
                            {/* Error Message */}
                            <div style={{ marginBottom: 12 }}>
                              <Text strong style={{ fontSize: '14px', color: '#cf1322' }}>
                                <WarningOutlined style={{ marginRight: 8 }} />
                                {err}
                              </Text>
                            </div>
                            
                            {/* Error Definition */}
                            <div style={{ marginBottom: 12, padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
                              <Text style={{ fontSize: '13px', color: '#595959' }}>
                                <InfoCircleOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                                <strong>What this means:</strong> {errorDef.definition}
                              </Text>
                            </div>
                            
                            {/* Actionable Tips */}
                            <div>
                              <Text strong style={{ fontSize: '12px', color: '#595959', display: 'block', marginBottom: 8 }}>
                                💡 How to fix:
                              </Text>
                              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '13px', color: '#595959' }}>
                                {errorDef.tips.map((tip, tipIdx) => (
                                  <li key={tipIdx} style={{ marginBottom: 6 }}>
                                    {tip}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            {/* Quick Fix Button */}
                            {errorDef.field && (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e8e8e8' }}>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<SettingOutlined />}
                                  onClick={() => {
                                    // Scroll to the relevant form field
                                    const fieldElement = document.querySelector(`[name="${errorDef.field}"]`);
                                    if (fieldElement) {
                                      fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      // Highlight the field briefly
                                      (fieldElement as HTMLElement).style.transition = 'box-shadow 0.3s';
                                      (fieldElement as HTMLElement).style.boxShadow = '0 0 0 3px rgba(255, 77, 79, 0.3)';
                                      setTimeout(() => {
                                        (fieldElement as HTMLElement).style.boxShadow = '';
                                      }, 2000);
                                    }
                                  }}
                                  style={{ padding: 0, fontSize: '12px' }}
                                >
                                  Go to {errorDef.field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </Card>
                  )}
                  
                  {validationResults.warnings && validationResults.warnings.length > 0 && (
                    <Alert
                      message={
                        <Space>
                          <WarningOutlined />
                          <span>Validation Warnings ({validationResults.warnings.length})</span>
                        </Space>
                      }
                      description={
                        <ul style={{ marginBottom: 0, paddingLeft: 20, marginTop: 8 }}>
                          {validationResults.warnings.map((warn: string, idx: number) => (
                            <li key={idx} style={{ marginBottom: 4 }}>
                              {warn}
                            </li>
                          ))}
                        </ul>
                      }
                      type="warning"
                      showIcon
                      closable
                      style={{ marginBottom: 0 }}
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
                  {getPreviewColumns().length > 0 && (
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
                  )}
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
