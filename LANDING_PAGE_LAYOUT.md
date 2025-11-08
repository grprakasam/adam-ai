# ADAM AI - Landing Page Layout Documentation

## 📋 Overview
The landing page has been created as a comprehensive three-column form layout based on your reference image.

## 🎨 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADAM AI - Landing Page                       │
│           Configure your ADaM dataset generation parameters     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────────┬─────────────────────┐
│   COLUMN 1       │     COLUMN 2         │    COLUMN 3         │
│   Labels         │   Input Controls     │   Descriptions      │
│   (Green)        │   (Orange)           │   (Gray)            │
└──────────────────┴──────────────────────┴─────────────────────┘
```

## 📝 Form Fields Implementation

### 1. **Project Name**
- **Label** (Green): "Project Name"
- **Control** (Orange): Text Input
- **Description**: "Enter the project name for this ADAM generation session..."
- **Validation**: Required field

### 2. **Therapeutic Area**
- **Label** (Green): "Therapeutic Area"
- **Control** (Orange): Dropdown Select
- **Options**: Oncology, Cardiology, Neurology, Respiratory, Immunology, etc.
- **Description**: "Select the therapeutic area (e.g., Oncology, Cardiology)..."
- **Validation**: Required field

### 3. **Study Phase**
- **Label** (Green): "Study Phase"
- **Control** (Orange): Dropdown Select
- **Options**: Phase I, Phase II, Phase III, Phase IV, Phase I/II, Phase II/III
- **Description**: "Select study phase (Phase I, II, III, IV)..."

### 4. **SDTM-IG Version**
- **Label** (Green): "SDTM-IG Version"
- **Control** (Orange): Dropdown Select
- **Options**: SDTM-IG v3.2, v3.3, v3.4, v4.0
- **Description**: "Select SDTM-IG version to use..."

### 5. **ADaM Datasets to Generate**
- **Label** (Green): "ADaM Datasets to Generate"
- **Control** (Orange): Multi-select Checkboxes
- **Options**: 
  - ADSL - Subject-Level Analysis Dataset
  - ADAE - Adverse Events Analysis Dataset
  - ADCM - Concomitant Medications Analysis Dataset
  - ADLB - Laboratory Analysis Dataset
  - ADVS - Vital Signs Analysis Dataset
  - ADEG - ECG Analysis Dataset
  - ADTTE - Time-to-Event Analysis Dataset
  - ADEX - Exposure Analysis Dataset
- **Description**: "Select which ADaM datasets to generate..."
- **Validation**: At least one dataset required

### 6. **Input SDTM Datasets**
- **Label** (Green): "Input SDTM Datasets"
- **Control** (Orange): File Upload Button
- **Accepts**: .xpt, .sas7bdat, .csv
- **Description**: "Upload or select SDTM datasets folder..."
- **Feature**: Multiple file upload

### 7. **ADaM Specifications**
- **Label** (Green): "ADaM Specifications"
- **Control** (Orange): File Upload Button
- **Accepts**: .pdf, .xlsx, .docx
- **Description**: "Upload ADaM specification documents..."
- **Feature**: Multiple document upload

### 8. **Standard Documents**
- **Label** (Green): "Standard Documents"
- **Control** (Orange): Multi-select Dropdown
- **Options**: 
  - ADaM IG v1.1, v1.2, v1.3
  - CDISC Controlled Terminology
  - ADaM Controlled Terminology
  - MedDRA Dictionary
  - WHODrug Dictionary
- **Description**: "Select standard documents (IG, Controlled Terminology, MedDRA)..."

### 9. **Output Format**
- **Label** (Green): "Output Format"
- **Control** (Orange): Radio Button Group
- **Options**: SAS, R, Python
- **Default**: SAS
- **Description**: "Select output format (SAS, R, Python)..."

### 10. **Validation Rules**
- **Label** (Green): "Validation Rules"
- **Control** (Orange): Multi-select Checkboxes
- **Options**:
  - CDISC Compliance Checks
  - Cross-Domain Validation
  - Variable Format Validation
  - Derivation Logic Validation
  - Missing Data Checks
- **Description**: "Enable/disable specific validation rules..."

## 🎯 Action Buttons Section

```
┌────────────────────────────────────────────────────────────┐
│  [Generate ADaM Datasets] [Save Configuration] [Load...]   │
└────────────────────────────────────────────────────────────┘
```

- **Generate ADaM Datasets** (Primary, Green): Main action button
- **Save Configuration**: Exports form data as JSON
- **Load Configuration**: Imports previously saved JSON configuration

## 🎨 Color Scheme

### Column 1 - Labels (Green Theme)
- Background: `#d4edda` (Light green)
- Border: `4px solid #28a745` (Dark green left border)
- Text: `#155724` (Dark green text)

### Column 2 - Input Controls (Orange Theme)
- Background: `#fff3cd` (Light yellow/orange)
- Border: `2px solid #ffc107` (Orange border)
- Inputs: White background with standard borders

### Column 3 - Descriptions (Gray Theme)
- Background: `#f8f9fa` (Light gray)
- Border: `3px solid #6c757d` (Gray left border)
- Text: `#495057` (Dark gray text)

## 📱 Responsive Design

### Desktop (1600px+)
- Three-column grid layout
- Full spacing and padding
- All features visible

### Tablet (1200px - 1400px)
- Slightly compressed columns
- Reduced spacing

### Mobile (<1200px)
- Single column stack layout
- Labels → Controls → Descriptions stacked vertically
- Full-width buttons

## 🔄 Navigation

The app now has two modes:
1. **Landing Page** (Default) - The new configuration form
2. **Workspace** - The original code generation interface

Toggle between modes using:
- "Go to Workspace" button (top-right on Landing Page)
- "Back to Landing" button (top-right on Workspace)

## ✨ Features Implemented

### Form Validation
- Required field checks
- Real-time validation messages
- Error highlighting

### Configuration Management
- **Save**: Export current form as JSON file
- **Load**: Import previously saved configuration
- Filename: `adam-config-{projectName}.json`

### User Experience
- Ant Design components for consistency
- Loading states for async operations
- Success/error message notifications
- Hover effects and transitions
- Disabled states during processing

## 🚀 Next Steps to Run

1. **Install dependencies** (if not already done):
   ```bash
   cd frontend
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Access the application**:
   - The landing page will be the default view
   - Navigate to `http://localhost:5173`

## 📦 Files Created/Modified

1. ✅ `frontend/src/components/LandingPage.tsx` - Main component
2. ✅ `frontend/src/components/LandingPage.css` - Styling
3. ✅ `frontend/src/App.tsx` - Integration with routing

## 🎯 Design Principles Applied

1. **Clear Visual Hierarchy**: Three distinct columns with color coding
2. **Intuitive Labels**: Descriptive field names in green
3. **Prominent Controls**: Orange-highlighted input areas
4. **Helpful Context**: Gray descriptions for each field
5. **Progressive Disclosure**: Organized top-to-bottom flow
6. **Action-Oriented**: Clear call-to-action buttons
7. **Error Prevention**: Built-in validation
8. **State Management**: React hooks for form state

---

**The landing page is now ready and matches the layout from your reference image!**
