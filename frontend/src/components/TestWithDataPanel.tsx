/**
 * SDTM Test Data Generator Panel
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
  Progress,
} from 'antd';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { triggerDownload } from '../utils/downloadHelpers';
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
  ExportOutlined,
  UserOutlined,
  CalendarOutlined,
  MedicineBoxOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  RocketOutlined,
  CloseCircleOutlined,
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

// Required SDTM domains per ADAM dataset (matching backend validators.py)
const REQUIRED_DOMAINS: Record<string, string[]> = {
  'ADSL': ['DM', 'EX', 'DS'],
  'ADAE': ['DM', 'AE', 'EX'],
  'ADLB': ['DM', 'LB', 'EX'],
  'ADVS': ['DM', 'VS', 'EX'],
  'ADTTE': ['DM', 'DS', 'AE'],
};

// Domain-Specific Configuration Schema (Expert ADAM Programmer Design)
// Defines which panels and controls are relevant for each SDTM domain
interface DomainConfig {
  domain: string;
  name: string;
  requiredPanels: string[];  // Panels that MUST be shown
  optionalPanels: string[];  // Panels that CAN be shown
  hiddenPanels: string[];     // Panels that should be HIDDEN
  domainSpecificConfig?: {
    // Domain-specific configuration options
    requiresVisitSchedule: boolean;
    requiresTreatment: boolean;
    requiresRecordsPerSubject: boolean;
    requiresSafetyConfig: boolean;
    defaultRecordsPerSubject?: number;
    additionalFields?: string[]; // Additional domain-specific fields
  };
}

const DOMAIN_CONFIGURATIONS: Record<string, DomainConfig> = {
  'DM': {
    domain: 'DM',
    name: 'Demographics',
    requiredPanels: ['study-config', 'subjects'],
    optionalPanels: ['treatment'], // For randomization flags
    hiddenPanels: ['visits', 'safety', 'quality'], // DM is subject-level only
    domainSpecificConfig: {
      requiresVisitSchedule: false, // DM has RFSTDTC/RFENDTC but no visit schedule
      requiresTreatment: false, // Treatment info optional for randomization
      requiresRecordsPerSubject: false, // DM is always 1 record per subject
      requiresSafetyConfig: false,
      defaultRecordsPerSubject: 1,
      additionalFields: ['race', 'ethnicity', 'country', 'site_id']
    }
  },
  'AE': {
    domain: 'AE',
    name: 'Adverse Events',
    requiredPanels: ['study-config', 'subjects', 'visits', 'safety'],
    optionalPanels: ['treatment'], // For AEREL (relationship to treatment)
    hiddenPanels: [],
    domainSpecificConfig: {
      requiresVisitSchedule: true, // AESTDTC, AEENDTC need visit schedule
      requiresTreatment: true, // AEREL requires treatment info
      requiresRecordsPerSubject: true, // Multiple AEs per subject
      requiresSafetyConfig: true, // Serious, severe, related AEs
      defaultRecordsPerSubject: 3, // Average 2-5 AEs per subject
      additionalFields: ['ae_duration_days', 'ae_severity_dist', 'ae_outcome']
    }
  },
  'LB': {
    domain: 'LB',
    name: 'Laboratory',
    requiredPanels: ['study-config', 'subjects', 'visits', 'safety'],
    optionalPanels: ['treatment'], // For treatment-related labs
    hiddenPanels: [],
    domainSpecificConfig: {
      requiresVisitSchedule: true, // LBDTC needs visit schedule
      requiresTreatment: false, // Usually not treatment-specific
      requiresRecordsPerSubject: true, // Multiple lab results per subject
      requiresSafetyConfig: true, // Lab abnormalities
      defaultRecordsPerSubject: 20, // Average 10-50 lab results per subject
      additionalFields: ['lab_test_panels', 'lab_units', 'reference_ranges']
    }
  },
  'VS': {
    domain: 'VS',
    name: 'Vital Signs',
    requiredPanels: ['study-config', 'subjects', 'visits'],
    optionalPanels: ['quality'],
    hiddenPanels: ['safety', 'treatment'], // VS doesn't need safety or treatment config
    domainSpecificConfig: {
      requiresVisitSchedule: true, // VSDTC needs visit schedule
      requiresTreatment: false,
      requiresRecordsPerSubject: true, // Multiple vital signs per subject
      requiresSafetyConfig: false,
      defaultRecordsPerSubject: 8, // Average 5-10 vital signs per subject
      additionalFields: ['vital_sign_types', 'position', 'body_position']
    }
  },
  'EX': {
    domain: 'EX',
    name: 'Exposure',
    requiredPanels: ['study-config', 'subjects', 'treatment', 'visits'],
    optionalPanels: ['quality'],
    hiddenPanels: ['safety'], // EX doesn't need safety config
    domainSpecificConfig: {
      requiresVisitSchedule: true, // EXSTDTC, EXENDTC need visit schedule
      requiresTreatment: true, // CRITICAL: EXTRT, EXDOSE require treatment
      requiresRecordsPerSubject: true, // Multiple exposures per subject
      requiresSafetyConfig: false,
      defaultRecordsPerSubject: 2, // Average 1-3 exposures per subject
      additionalFields: ['dose_amount', 'dose_unit', 'route', 'frequency']
    }
  },
  'DS': {
    domain: 'DS',
    name: 'Disposition',
    requiredPanels: ['study-config', 'subjects', 'visits'],
    optionalPanels: ['quality'],
    hiddenPanels: ['safety', 'treatment'], // DS doesn't need safety or treatment
    domainSpecificConfig: {
      requiresVisitSchedule: true, // DSDTC needs visit schedule
      requiresTreatment: false,
      requiresRecordsPerSubject: false, // Usually 1 record per subject
      requiresSafetyConfig: false,
      defaultRecordsPerSubject: 1,
      additionalFields: ['disposition_events', 'completion_status', 'early_termination_reasons']
    }
  }
};

// Helper function to get domain configuration
const getDomainConfig = (domainCode: string): DomainConfig | null => {
  return DOMAIN_CONFIGURATIONS[domainCode] || null;
};

// Helper function to check if panel should be visible
const shouldShowPanel = (panelKey: string, domainCode: string): boolean => {
  const config = getDomainConfig(domainCode);
  if (!config) return true; // Show all if domain not configured
  
  // Always show required panels
  if (config.requiredPanels.includes(panelKey)) return true;
  
  // Never show hidden panels
  if (config.hiddenPanels.includes(panelKey)) return false;
  
  // Show optional panels (they can be toggled by user)
  if (config.optionalPanels.includes(panelKey)) return true;
  
  // Default: show if not explicitly hidden
  return !config.hiddenPanels.includes(panelKey);
};

export const TestWithDataPanel: React.FC<TestWithDataPanelProps> = ({ standalone: _standalone = false }) => {
  const { projectConfig } = useProjectStore();
  const [form] = Form.useForm();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [availableDatasets, setAvailableDatasets] = useState<string[]>([]);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentDomain: string } | null>(null);
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
  const [activePanels, setActivePanels] = useState<string[]>(['study-config', 'subjects', 'treatment']);
  const [generatedData, setGeneratedData] = useState<any[] | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Table controls state
  const [searchText, setSearchText] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [tablePagination, setTablePagination] = useState({ pageSize: 20, current: 1 });
  const [tableSize, setTableSize] = useState<'small' | 'middle' | 'large'>('middle');

  // Load supported domains on mount and check available datasets
  useEffect(() => {
    loadDomains();
    if (projectConfig?.studyId) {
      checkAvailableDatasets();
    }
  }, [projectConfig?.studyId]);

  // Check which SDTM datasets are already available for the current study
  const checkAvailableDatasets = async () => {
    if (!projectConfig?.studyId) return;
    
    try {
      // Check SDTM inputs to see what's available
      const inputs = await adamApi.checkSdtmInputs({
        study_id: projectConfig.studyId,
        adam_dataset: projectConfig.adamDataset || 'ADSL'
      });
      setAvailableDatasets(inputs.available_domains || []);
    } catch (error) {
      // Silently fail - datasets might not exist yet
      setAvailableDatasets([]);
    }
  };

  // Get required domains for current ADAM dataset
  const getRequiredDomains = useMemo(() => {
    const adamDataset = projectConfig?.adamDataset || 'ADSL';
    return REQUIRED_DOMAINS[adamDataset] || [];
  }, [projectConfig?.adamDataset]);

  // Get missing required domains
  const getMissingRequiredDomains = useMemo(() => {
    return getRequiredDomains.filter(domain => !availableDatasets.includes(domain));
  }, [getRequiredDomains, availableDatasets]);

  // Generate all required datasets for current ADAM dataset
  const handleGenerateAllRequired = async () => {
    if (!projectConfig?.studyId) {
      message.error('Study ID is required. Please set it in the Setup tab.');
      return;
    }

    const missingDomains = getMissingRequiredDomains;
    if (missingDomains.length === 0) {
      message.success('All required datasets are already available!');
      return;
    }

    setIsGeneratingBatch(true);
    setBatchProgress({ current: 0, total: missingDomains.length, currentDomain: '' });

    try {
      message.loading({
        content: `Generating ${missingDomains.length} required dataset(s) for ${projectConfig.adamDataset || 'ADAM'}...`,
        key: 'generate-batch',
        duration: 0,
      });

      const batchRequest = {
        domains: missingDomains,
        study_id: projectConfig.studyId,
        num_subjects: parameters.num_subjects,
        sdtm_version: parameters.sdtm_version,
        adam_ig_version: parameters.adam_ig_version,
        study_start_date: parameters.study_start_date,
        study_end_date: parameters.study_end_date,
        study_phase: parameters.study_phase,
        therapeutic_area: parameters.therapeutic_area,
        sex_distribution: parameters.sex_distribution,
        age_min: parameters.age_min,
        age_max: parameters.age_max,
        age_distribution: parameters.age_distribution,
        num_treatment_arms: parameters.num_treatment_arms,
        treatment_arms: parameters.treatment_arms,
        randomization_ratio: parameters.randomization_ratio,
        num_visits: parameters.num_visits,
        visit_schedule_days: parameters.visit_schedule_days,
        visit_window_days: parameters.visit_window_days,
        records_per_subject: parameters.records_per_subject || 5,
        missingness_pct: parameters.missingness_pct,
        protocol_deviations_pct: parameters.protocol_deviations_pct,
        outlier_pct: parameters.outlier_pct,
        distribution_type: parameters.distribution_type,
        template_source: parameters.template_source,
        include_meddra: parameters.include_meddra,
        include_ct: parameters.include_ct,
        serious_ae_pct: parameters.serious_ae_pct,
        severe_ae_pct: parameters.severe_ae_pct,
        related_ae_pct: parameters.related_ae_pct,
        lab_abnormality_pct: parameters.lab_abnormality_pct,
      };

      const result = await adamApi.generateSdtmBatch(batchRequest);

      if (result.status === 'success' || result.status === 'partial') {
        message.success({
          content: `Successfully generated ${result.total_generated} of ${result.total_requested} required dataset(s)`,
          key: 'generate-batch',
          duration: 5,
        });

        if (result.failed && result.failed.length > 0) {
          message.warning({
            content: `Some datasets failed: ${result.failed.map((f: any) => f.domain).join(', ')}`,
            duration: 6,
          });
        }

        // Refresh available datasets
        await checkAvailableDatasets();
      } else {
        throw new Error(result.message || 'Failed to generate datasets');
      }
    } catch (err: any) {
      console.error('Error generating required datasets:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      
      let errorMessage = 'Failed to generate required datasets';
      if (err.response) {
        if (err.response.status === 404) {
          errorMessage = 'Batch generation endpoint not found. Please ensure the backend server is running and has the latest code.';
        } else if (err.response.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Server error (${err.response.status}): ${err.response.statusText}`;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      message.error({
        content: `Failed to generate datasets: ${errorMessage}`,
        key: 'generate-batch',
        duration: 8,
      });
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress(null);
    }
  };

  const loadDomains = async () => {
    try {
      setLoadingDomains(true);
      const response = await fetch('/api/v1/test-data/domains');
      
      if (!response.ok) {
        throw new Error(`Failed to load domains: ${response.status} ${response.statusText}`);
      }

      // Check if response has content before parsing JSON
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Server returned an empty response');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse domains JSON:', parseError);
        throw new Error('Server returned invalid JSON response');
      }

      setDomains(data.domains || []);
      if (data.domains && data.domains.length > 0) {
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
    
    // Get domain-specific configuration
    const domainConfig = getDomainConfig(domainCode);
    
    // Update parameters with domain-specific defaults
    const updatedParams = { ...parameters, domain: domainCode };
    
    if (domainConfig?.domainSpecificConfig) {
      const config = domainConfig.domainSpecificConfig;
      
      // Set default records per subject if domain requires it
      if (config.requiresRecordsPerSubject && config.defaultRecordsPerSubject) {
        updatedParams.records_per_subject = config.defaultRecordsPerSubject;
        form.setFieldValue('records_per_subject', config.defaultRecordsPerSubject);
      } else if (!config.requiresRecordsPerSubject) {
        updatedParams.records_per_subject = 1;
        form.setFieldValue('records_per_subject', 1);
      }
      
      // Auto-enable MedDRA for AE domain
      if (domainCode === 'AE' && !updatedParams.include_meddra) {
        updatedParams.include_meddra = true;
        form.setFieldValue('include_meddra', true);
      }
    }
    
    setParameters(updatedParams);
    
    // Update active panels based on domain requirements
    if (domainConfig) {
      const newActivePanels = [...domainConfig.requiredPanels];
      // Keep optional panels that are already open if they're in optionalPanels
      activePanels.forEach(panel => {
        if (domainConfig.optionalPanels.includes(panel) && !newActivePanels.includes(panel)) {
          newActivePanels.push(panel);
        }
      });
      setActivePanels(newActivePanels);
    }
  };

  // Error definitions and tips mapping
  const getErrorDefinition = (errorMessage: string): { definition: string; field?: string; tips: string[] } => {
    const lowerError = errorMessage.toLowerCase();
    
    // Missing required variables
    if (lowerError.includes('missing required variables')) {
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

      // Include study_id in the URL if available
      const studyId = projectConfig?.studyId;
      const url = studyId 
        ? `/api/v1/test-data/generate-sdtm?study_id=${encodeURIComponent(studyId)}`
        : '/api/v1/test-data/generate-sdtm';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      // Check if response is OK
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
              // If not JSON, use the text as error message
              errorMessage = errorText || errorMessage;
            }
          }
        } catch (e) {
          // Response body might be empty or unreadable
          console.error('Failed to read error response:', e);
        }
        throw new Error(errorMessage);
      }

      // Check if response has content before parsing JSON
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Server returned an empty response. Please try again.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
        console.error('Response text:', responseText.substring(0, 200));
        throw new Error('Server returned invalid JSON. Please check the server logs.');
      }

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

        // Refresh available datasets after generation
        if (projectConfig?.studyId) {
          await checkAvailableDatasets();
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

  const handleDownload = async (format: 'csv' | 'sas7bdat' | 'rds' | 'xlsx' | 'xpt') => {
    // Prevent multiple simultaneous downloads
    if (isDownloading) {
      message.warning({ content: 'Download already in progress...', key: 'download', duration: 2 });
      return;
    }

    setIsDownloading(true);
    try {
      const formatLabel = format === 'xlsx' ? 'Excel' : format === 'xpt' ? 'XPT' : format.toUpperCase();
      message.loading({ content: `Preparing ${formatLabel} download...`, key: 'download', duration: 0 });

      const response = await fetch(`/api/v1/test-data/download-sdtm?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parameters),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Download failed');
      }

      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${parameters.domain}_${new Date().toISOString().split('T')[0]}.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      triggerDownload(
        blob,
        filename,
        {
          onSuccess: () => message.success({ content: `${formatLabel} download started`, key: 'download', duration: 2 }),
          onError: (err) => {
            message.error({
              content: err.message || 'Failed to download data',
              key: 'download',
              duration: 5,
            });
            console.error('Download error:', err);
          }
        }
      );
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to download data',
        key: 'download',
        duration: 5,
      });
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (!projectConfig?.studyId) {
      message.warning('Please set a Study ID in project settings to download all datasets');
      return;
    }

    if (isDownloading) {
      message.warning({ content: 'Download already in progress...', key: 'download-all', duration: 2 });
      return;
    }

    setIsDownloading(true);
    try {
      message.loading({ content: 'Preparing all SDTM datasets for download...', key: 'download-all', duration: 0 });

      const response = await fetch(`/api/v1/test-data/download-all-sdtm?study_id=${projectConfig.studyId}&format=zip`, {
        method: 'GET',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No datasets found. Please generate some SDTM datasets first.');
        }
        const errorText = await response.text();
        throw new Error(errorText || 'Download failed');
      }

      const blob = await response.blob();
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `SDTM_Datasets_${projectConfig.studyId}_${new Date().toISOString().split('T')[0]}.zip`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      triggerDownload(
        blob,
        filename,
        {
          onSuccess: () => message.success({ content: 'All SDTM datasets downloaded successfully', key: 'download-all', duration: 3 }),
          onError: (err) => {
            message.error({
              content: err.message || 'Failed to download all datasets',
              key: 'download-all',
              duration: 5,
            });
            console.error('Download error:', err);
          }
        }
      );
    } catch (error: any) {
      message.error({
        content: error.message || 'Failed to download all datasets',
        key: 'download-all',
        duration: 5,
      });
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
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
    
    // Calculate column width based on number of columns
    const numColumns = colsToShow.length || allCols.length;
    const baseWidth = 120;
    const minWidth = 100;
    const maxWidth = 180;
    
    // Adjust width based on column count - fewer columns can be wider
    let columnWidth = baseWidth;
    if (numColumns <= 5) {
      columnWidth = 150;
    } else if (numColumns <= 10) {
      columnWidth = 120;
    } else {
      columnWidth = 100;
    }
    
    // Ensure we always have columns to show
    if (colsToShow.length === 0) {
      return allCols.map(key => ({
        title: key,
        dataIndex: key,
        key: key,
        width: Math.max(minWidth, Math.min(columnWidth, maxWidth)),
        ellipsis: {
          showTitle: false,
        },
        render: (text: any) => (
          <Tooltip title={String(text || '—')} placement="topLeft">
            <span style={{ 
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {text !== null && text !== undefined ? String(text) : <Text type="secondary">—</Text>}
            </span>
          </Tooltip>
        ),
      }));
    }
    
    return colsToShow.map(key => ({
        title: key,
        dataIndex: key,
        key: key,
        width: Math.max(minWidth, Math.min(columnWidth, maxWidth)),
        ellipsis: {
          showTitle: false,
        },
        sorter: (a: any, b: any) => {
          const aVal = a[key];
          const bVal = b[key];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal || '').localeCompare(String(bVal || ''));
        },
        render: (text: any) => (
          <Tooltip title={String(text || '—')} placement="topLeft">
            <span style={{ 
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
        key: 'xlsx',
        label: 'Download Excel (.xlsx)',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('xlsx'),
      },
      {
        key: 'xpt',
        label: 'Download XPT (SAS Transport)',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('xpt'),
      },
      {
        key: 'sas',
        label: 'Download SAS (.sas7bdat)',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('sas7bdat'),
      },
      {
        key: 'rds',
        label: 'Download RDS',
        icon: <DownloadOutlined />,
        onClick: () => handleDownload('rds'),
      },
      {
        type: 'divider',
      },
      {
        key: 'download-all',
        label: 'Download All SDTM Tables (ZIP)',
        icon: <ExportOutlined />,
        onClick: handleDownloadAll,
        disabled: !projectConfig?.studyId,
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
            <span className="header-title">SDTM Test Data Generator</span>
            <span className="header-subtitle">Generate CDISC-Compliant SDTM Test Data</span>
          </div>
        </div>
        <div className="header-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={isGenerating || isGeneratingBatch}
            size="middle"
          >
            Reset
          </Button>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={isGenerating || isGeneratingBatch}
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
              {/* Study Configuration & CDISC Standards Section - Always Visible */}
              {shouldShowPanel('study-config', parameters.domain) && (
              <Collapse.Panel 
                key="study-config" 
                header={
                  <span className="panel-header">
                    <FileTextOutlined />
                    <span>Study Configuration & CDISC Standards</span>
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
                  {/* Version and Standards */}
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            SDTM Version
                            <Tooltip title="CDISC SDTM standard version">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="sdtm_version"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="3.4">SDTM v3.4 (Recommended)</Option>
                          <Option value="3.3">SDTM v3.3</Option>
                          <Option value="3.2">SDTM v3.2</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            ADaM IG Version
                            <Tooltip title="ADaM Implementation Guide version">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="adam_ig_version"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="1.3">ADaM IG v1.3 (Recommended)</Option>
                          <Option value="1.4">ADaM IG v1.4</Option>
                          <Option value="2.0">ADaM IG v2.0</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Study Phase and Therapeutic Area */}
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Study Phase
                            <Tooltip title="Clinical trial phase">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="study_phase"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="Phase I">Phase I</Option>
                          <Option value="Phase II">Phase II</Option>
                          <Option value="Phase III">Phase III</Option>
                          <Option value="Phase IV">Phase IV</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Therapeutic Area
                            <Tooltip title="CDISC therapeutic area">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="therapeutic_area"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="Oncology">Oncology</Option>
                          <Option value="Cardiovascular">Cardiovascular</Option>
                          <Option value="Neurology">Neurology</Option>
                          <Option value="Respiratory">Respiratory</Option>
                          <Option value="Other">Other</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Study Dates */}
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            <span style={{ color: '#ff4d4f', marginRight: '4px' }}>*</span>
                            Study Start Date
                          </span>
                        }
                        name="study_start_date"
                        rules={[{ required: true }]}
                      >
                        <Input type="date" size="large" style={{ borderRadius: '8px', height: '40px' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            <span style={{ color: '#ff4d4f', marginRight: '4px' }}>*</span>
                            Study End Date
                          </span>
                        }
                        name="study_end_date"
                        rules={[{ required: true }]}
                      >
                        <Input type="date" size="large" style={{ borderRadius: '8px', height: '40px' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Controlled Terminology */}
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Controlled Terminology
                            <Tooltip title="Include CDISC controlled terminology in generated data">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="include_ct"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" size="default" />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>
              )}

              {/* Subjects Section */}
              {shouldShowPanel('subjects', parameters.domain) && (
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
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Number of Subjects
                            <Tooltip title="Total subjects in study (CDISC: N)">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="num_subjects"
                        rules={[{ required: true }]}
                      >
                        <InputNumber
                          min={1}
                          max={1000}
                          style={{ width: '100%', borderRadius: '8px' }}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Sex Distribution
                            <Tooltip title="Distribution of sex (CDISC: SEX)">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="sex_distribution"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="balanced">Balanced (50/50)</Option>
                          <Option value="male_biased">Male Biased (60/40)</Option>
                          <Option value="female_biased">Female Biased (40/60)</Option>
                          <Option value="custom">Custom</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Age Distribution
                            <Tooltip title="Age distribution pattern (CDISC: AGE)">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="age_distribution"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
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
              )}

              {/* Treatment Section */}
              {shouldShowPanel('treatment', parameters.domain) && (
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
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Number of Treatment Arms
                            <Tooltip title="CDISC: TRT01P, TRT02P, etc.">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="num_treatment_arms"
                      >
                        <InputNumber
                          min={1}
                          max={4}
                          style={{ width: '100%', borderRadius: '8px' }}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Randomization Ratio
                            <Tooltip title="Treatment allocation ratio">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="randomization_ratio"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="1:1">1:1 (Balanced)</Option>
                          <Option value="2:1">2:1 (Active:Placebo)</Option>
                          <Option value="1:2">1:2 (Placebo:Active)</Option>
                          <Option value="3:1">3:1</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Template Source
                            <Tooltip title="Data generation template">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="template_source"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="pharmaverse">Pharmaverse (Industry)</Option>
                          <Option value="cdisc">CDISC Reference</Option>
                          <Option value="custom">Custom Template</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>
              )}

              {/* Visits Section */}
              {shouldShowPanel('visits', parameters.domain) && (
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
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Number of Visits
                            <Tooltip title="CDISC: VISITNUM, VISIT variables">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="num_visits"
                      >
                        <InputNumber
                          min={1}
                          max={20}
                          style={{ width: '100%', borderRadius: '8px' }}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Visit Window (Days)
                            <Tooltip title="Allowable window around scheduled visit">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="visit_window_days"
                      >
                        <InputNumber
                          min={0}
                          max={30}
                          style={{ width: '100%', borderRadius: '8px' }}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={24}>
                      <Form.Item
                        label={
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>
                            Distribution Type
                            <Tooltip title="Data distribution pattern">
                              <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                            </Tooltip>
                          </span>
                        }
                        name="distribution_type"
                      >
                        <Select size="large" style={{ borderRadius: '8px' }}>
                          <Option value="realistic">Realistic (Recommended)</Option>
                          <Option value="normal">Normal</Option>
                          <Option value="uniform">Uniform</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Collapse.Panel>
              )}

              {/* Safety Configuration Section - CDISC SDTM 3.4 */}
              {shouldShowPanel('safety', parameters.domain) && (
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
              )}

              {/* Data Quality Section */}
              {shouldShowPanel('quality', parameters.domain) && (
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
              )}

              {/* Domain-Specific Configuration Section */}
              {getDomainConfig(parameters.domain)?.domainSpecificConfig?.additionalFields && 
               getDomainConfig(parameters.domain)!.domainSpecificConfig!.additionalFields!.length > 0 && (
              <Collapse.Panel 
                key="domain-specific" 
                header={
                  <span className="panel-header">
                    <SettingOutlined />
                    <span>{selectedDomain?.name || 'Domain'} Specific Configuration</span>
                    <Tag color="blue" style={{ marginLeft: 8, fontSize: '11px' }}>
                      {parameters.domain}
                    </Tag>
                  </span>
                }
                className="control-panel-section"
              >
                <Form form={form} layout="vertical" onValuesChange={(_, allValues) => setParameters(allValues)}>
                  {parameters.domain === 'AE' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Average AE Duration (Days)
                                <Tooltip title="CDISC: Average duration of adverse events">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ae_duration_days"
                            initialValue={7}
                          >
                            <InputNumber
                              min={1}
                              max={365}
                              style={{ width: '100%', borderRadius: '8px' }}
                              size="large"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                AE Outcome Distribution
                                <Tooltip title="CDISC: Distribution of AE outcomes (RECOVERED, RECOVERING, NOT RECOVERED, FATAL)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ae_outcome_dist"
                            initialValue="realistic"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="realistic">Realistic (Most Recovered)</Option>
                              <Option value="balanced">Balanced</Option>
                              <Option value="severe">More Severe Outcomes</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                  
                  {parameters.domain === 'LB' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Lab Test Panels
                                <Tooltip title="CDISC: Laboratory test panels to include (CBC, Chemistry, Lipid Panel, etc.)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="lab_test_panels"
                            initialValue={['CBC', 'Chemistry', 'Lipid']}
                          >
                            <Select 
                              mode="multiple" 
                              size="large" 
                              style={{ borderRadius: '8px' }}
                              placeholder="Select lab panels"
                            >
                              <Option value="CBC">Complete Blood Count (CBC)</Option>
                              <Option value="Chemistry">Chemistry Panel</Option>
                              <Option value="Lipid">Lipid Panel</Option>
                              <Option value="Liver">Liver Function Tests</Option>
                              <Option value="Renal">Renal Function Tests</Option>
                              <Option value="Coagulation">Coagulation Panel</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Units Standard
                                <Tooltip title="CDISC: Standard units for lab values (SI, Conventional)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="lab_units_standard"
                            initialValue="SI"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="SI">SI Units (Recommended)</Option>
                              <Option value="Conventional">Conventional Units</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                  
                  {parameters.domain === 'VS' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Vital Sign Types
                                <Tooltip title="CDISC: Types of vital signs to include">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="vital_sign_types"
                            initialValue={['SBP', 'DBP', 'HR', 'TEMP', 'WEIGHT', 'HEIGHT']}
                          >
                            <Select 
                              mode="multiple" 
                              size="large" 
                              style={{ borderRadius: '8px' }}
                              placeholder="Select vital signs"
                            >
                              <Option value="SBP">Systolic Blood Pressure</Option>
                              <Option value="DBP">Diastolic Blood Pressure</Option>
                              <Option value="HR">Heart Rate</Option>
                              <Option value="TEMP">Temperature</Option>
                              <Option value="WEIGHT">Weight</Option>
                              <Option value="HEIGHT">Height</Option>
                              <Option value="BMI">Body Mass Index</Option>
                              <Option value="RESP">Respiratory Rate</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Body Position
                                <Tooltip title="CDISC: Position for vital sign measurements (SITTING, STANDING, SUPINE)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="vs_position"
                            initialValue="SITTING"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="SITTING">Sitting (Most Common)</Option>
                              <Option value="STANDING">Standing</Option>
                              <Option value="SUPINE">Supine</Option>
                              <Option value="MIXED">Mixed Positions</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                  
                  {parameters.domain === 'EX' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Dose Unit
                                <Tooltip title="CDISC: Unit of measurement for dose (mg, g, mL, etc.)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ex_dose_unit"
                            initialValue="mg"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="mg">Milligrams (mg)</Option>
                              <Option value="g">Grams (g)</Option>
                              <Option value="mL">Milliliters (mL)</Option>
                              <Option value="IU">International Units (IU)</Option>
                              <Option value="tablets">Tablets</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Route of Administration
                                <Tooltip title="CDISC: Route of drug administration (ORAL, IV, IM, etc.)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ex_route"
                            initialValue="ORAL"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="ORAL">Oral</Option>
                              <Option value="IV">Intravenous</Option>
                              <Option value="IM">Intramuscular</Option>
                              <Option value="SC">Subcutaneous</Option>
                              <Option value="TOPICAL">Topical</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Dosing Frequency
                                <Tooltip title="CDISC: Frequency of administration (QD, BID, TID, QW, etc.)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ex_frequency"
                            initialValue="QD"
                          >
                            <Select size="large" style={{ borderRadius: '8px' }}>
                              <Option value="QD">Once Daily (QD)</Option>
                              <Option value="BID">Twice Daily (BID)</Option>
                              <Option value="TID">Three Times Daily (TID)</Option>
                              <Option value="QW">Once Weekly (QW)</Option>
                              <Option value="Q2W">Every 2 Weeks (Q2W)</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                  
                  {parameters.domain === 'DS' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Disposition Events
                                <Tooltip title="CDISC: Types of disposition events to include">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="ds_events"
                            initialValue={['ENROLLED', 'COMPLETED', 'SCREEN FAILURE']}
                          >
                            <Select 
                              mode="multiple" 
                              size="large" 
                              style={{ borderRadius: '8px' }}
                              placeholder="Select disposition events"
                            >
                              <Option value="ENROLLED">Enrolled</Option>
                              <Option value="SCREEN FAILURE">Screen Failure</Option>
                              <Option value="RANDOMIZED">Randomized</Option>
                              <Option value="COMPLETED">Completed</Option>
                              <Option value="EARLY TERMINATION">Early Termination</Option>
                              <Option value="LOST TO FOLLOW-UP">Lost to Follow-up</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Completion Rate
                                <Tooltip title="CDISC: Percentage of subjects who complete the study">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="completion_rate_pct"
                            initialValue={80}
                          >
                            <InputNumber
                              min={0}
                              max={100}
                              style={{ width: '100%', borderRadius: '8px' }}
                              size="large"
                              formatter={value => `${value}%`}
                              parser={value => value!.replace('%', '')}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                  
                  {parameters.domain === 'DM' && (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Number of Sites
                                <Tooltip title="CDISC: Number of study sites (for SITEID generation)">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="num_sites"
                            initialValue={5}
                          >
                            <InputNumber
                              min={1}
                              max={50}
                              style={{ width: '100%', borderRadius: '8px' }}
                              size="large"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            label={
                              <span style={{ fontWeight: 700, fontSize: '13px' }}>
                                Include Race/Ethnicity
                                <Tooltip title="CDISC: Include RACE and ETHNIC variables">
                                  <InfoCircleOutlined style={{ marginLeft: 6, fontSize: '12px', color: '#94a3b8' }} />
                                </Tooltip>
                              </span>
                            }
                            name="include_race_ethnicity"
                            valuePropName="checked"
                            initialValue={true}
                          >
                            <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </>
                  )}
                </Form>
              </Collapse.Panel>
              )}
            </Collapse>
          </div>
        </div>

        {/* Right Panel: Study Design Configuration & Data Table View */}
        <div className="test-data-table-panel-right">
          <div className="main-panel-content">
            {/* Study Design & CDISC Standards Section - Always Visible */}
            <Card
              className="study-design-main-card"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#3b82f6', fontSize: '18px' }} />
                  <span style={{ fontSize: '18px', fontWeight: 700 }}>Study Design & CDISC Standards</span>
                </Space>
              }
              style={{ marginBottom: 24 }}
            >
              <Form
                form={form}
                layout="vertical"
                initialValues={parameters}
                onValuesChange={(_, allValues) => setParameters(allValues)}
              >
                {/* Visual Domain Selection Grid */}
                <Form.Item
                  label={
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                      <span style={{ color: '#ff4d4f', marginRight: '4px' }}>*</span>
                      Select SDTM Domain
                      <Tooltip title="Choose the CDISC SDTM domain to generate. EX and DS are critical for ADAM analysis.">
                        <InfoCircleOutlined style={{ marginLeft: 8, color: '#64748b', fontSize: '13px' }} />
                      </Tooltip>
                    </span>
                  }
                  name="domain"
                  rules={[{ required: true }]}
                  style={{ marginBottom: 24 }}
                >
                  <div className="domain-selection-grid-main">
                    {domains.map(domain => {
                      const isAdamCritical = domain.code === 'EX' || domain.code === 'DS';
                      const isAdamReady = domain.code === 'DM' && domain.is_critical_for_adam !== undefined;
                      const isSelected = parameters.domain === domain.code;
                      return (
                        <div
                          key={domain.code}
                          className={`domain-card-main ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            handleDomainChange(domain.code);
                            form.setFieldValue('domain', domain.code);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          {(isAdamCritical || isAdamReady) && (
                            <span className={`domain-badge-main ${isAdamCritical ? 'adam-critical' : 'adam-ready'}`}>
                              {isAdamCritical ? 'Critical' : 'Ready'}
                            </span>
                          )}
                          <div className="domain-card-code-main">{domain.code}</div>
                          <div className="domain-card-name-main">{domain.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </Form.Item>

                {/* Helper message for ADAM-critical domains */}
                {(selectedDomain?.code === 'EX' || selectedDomain?.code === 'DS') && (
                  <Alert
                    message={
                      <Space>
                        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                        <span style={{ fontWeight: 600 }}>
                          <strong>{selectedDomain.code} Domain</strong> - Critical for ADAM Analysis
                        </span>
                      </Space>
                    }
                    description={
                      <div style={{ marginTop: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                        {selectedDomain.code === 'EX' 
                          ? "The EX (Exposure) domain provides treatment exposure data needed for ADAM ADSL (TRTSDT, TRTEDT, TRTDURD) and ADEX datasets. When you generate DM domain, it will automatically include analysis flags if EX data is available."
                          : "The DS (Disposition) domain provides study completion status needed for ADAM analysis flags (ITTFL, SAFFL, EFFFL). When you generate DM domain, it will automatically include these flags if DS data is available."}
                      </div>
                    }
                    type="info"
                    showIcon={false}
                    style={{ 
                      marginBottom: 24,
                      borderRadius: '10px',
                      border: '1px solid #bfdbfe',
                      background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                    }}
                  />
                )}

              </Form>
            </Card>

            {/* Data Table View - Shows when data is generated */}
            {generatedData && (
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
                        scroll={{ 
                          x: Math.max(800, getPreviewColumns().length * 120), 
                          y: 'calc(100vh - 520px)' 
                        }}
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
    </div>
  );
};

export default TestWithDataPanel;

