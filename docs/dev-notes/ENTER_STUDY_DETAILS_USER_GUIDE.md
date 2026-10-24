# Enter Study Details Page - User Guide

## Overview

The **Enter Study Details Page** is a professionally designed interface for creating and configuring clinical trial studies in ADAM AI. This page features an intuitive form-based layout with modern UI/UX design, smart defaults, and comprehensive validation.

---

## Accessing the Page

1. Launch the ADAM AI application at **http://localhost:3000/**
2. Log in with your credentials (default: `admin` / `admin`)
3. Click **"Create New Study"** or select **"Enter Study Details"** from the navigation

---

## Page Layout

The page is organized into **four main sections**, each with collapsible form blocks:

### 1. Enter Basic Study Info
### 2. Set CDISC Standards Version
### 3. Select Target Datasets to Generate
### 4. Save Study Information (sticky button at bottom)

---

## Section 1: Enter Basic Study Info

This section captures core study metadata.

### Fields:

**Study Name** (Required)
- **Type**: Text input
- **Purpose**: Unique identifier for your clinical trial
- **Example**: "ONCOLOGY-2024-001"
- **Validation**: Cannot be empty when saving
- **Help**: Clear error message shown if empty

**Protocol Number**
- **Type**: Text input
- **Purpose**: Official protocol identification number
- **Example**: "PRO-12345"

**Sponsor Name**
- **Type**: Text input
- **Purpose**: Name of the sponsoring organization
- **Example**: "Acme Pharmaceuticals Inc."

**Therapeutic Area**
- **Type**: Dropdown select
- **Default**: "Oncology"
- **Options**: Oncology, Cardiology, Neurology, Immunology, Dermatology, Other
- **Purpose**: Primary disease area under investigation

**Study Phase**
- **Type**: Dropdown select
- **Default**: "Phase II"
- **Options**: Phase I, Phase II, Phase III, Phase IV
- **Purpose**: Clinical trial phase classification

**Study Description**
- **Type**: Multiline text area
- **Purpose**: Detailed description of study objectives and design
- **Example**: "A randomized, double-blind, placebo-controlled study to evaluate the efficacy and safety of Drug X in patients with advanced melanoma."

---

## Section 2: Set CDISC Standards Version

Configure CDISC compliance standards for data generation.

### Fields:

**SDTM Version**
- **Type**: Dropdown select
- **Default**: "SDTM v2.0" (latest version)
- **Options**: SDTM v2.0, SDTM v1.7, SDTM v1.6, SDTM v1.5, SDTM v1.4
- **Purpose**: Source Data Tabulation Model version
- **Recommendation**: Use latest version (v2.0) unless regulatory requirements specify otherwise

**ADaM IG Version**
- **Type**: Dropdown select
- **Default**: "ADaM IG v1.3" (latest version)
- **Options**: ADaM IG v1.3, ADaM IG v1.2, ADaM IG v1.1, ADaM IG v1.0
- **Purpose**: Analysis Data Model Implementation Guide version
- **Recommendation**: Use latest version (v1.3) for maximum compliance

**MedDRA Version**
- **Type**: Dropdown select
- **Default**: "MedDRA v27.1" (latest version)
- **Options**: MedDRA v27.1, MedDRA v27.0, MedDRA v26.1, MedDRA v26.0, MedDRA v25.1
- **Purpose**: Medical Dictionary for Regulatory Activities version
- **Recommendation**: Use latest version (v27.1) for most comprehensive coding

---

## Section 3: Select Target Datasets to Generate

Choose which ADaM datasets to generate for your study.

### ADaM Dataset Categories:

#### Core Datasets (Always Recommended)
- **ADSL** - Subject-Level Analysis Dataset (Default selected, essential for all studies)

#### Efficacy Datasets
- **ADTTE** - Time-to-Event Analysis Dataset
- **ADBDS** - Biomarker Data Structure
- **ADRS** - Response Analysis Dataset
- **ADTR** - Tumor Results Analysis Dataset

#### Safety Datasets
- **ADAE** - Adverse Events Analysis Dataset
- **ADLB** - Laboratory Analysis Dataset
- **ADVS** - Vital Signs Analysis Dataset
- **ADCM** - Concomitant Medications Analysis Dataset

#### PK/PD Datasets
- **ADPC** - Pharmacokinetic Concentrations Analysis Dataset
- **ADPP** - Pharmacokinetic Parameters Analysis Dataset

#### Patient-Reported Outcomes
- **ADQOL** - Quality of Life Analysis Dataset

#### Other Datasets
- **ADEX** - Exposure Analysis Dataset

### Dataset Selection:
- Click checkboxes to select/deselect datasets
- **ADSL is pre-selected** as it's required for most analyses
- You can select multiple datasets
- Datasets can be modified later after study creation

---

## Saving Your Study

### The Save Button

A **sticky save button** is positioned at the bottom of the page for easy access:

**Button Name**: "Save Study Information"

**Button States**:

1. **Enabled** (when study name is provided)
   - Purple gradient background
   - Hover effect with shadow and scale animation
   - Click to save study details

2. **Disabled** (when study name is empty)
   - Grayed out appearance
   - Shows helper text: "Please enter a study name to save"

3. **Saving** (during save operation)
   - Shows loading spinner
   - Text changes to "Saving Study Information..."
   - Button disabled during save

### Validation Rules:

**Required Field**:
- Study Name must not be empty

**Optional Fields**:
- All other fields are optional but recommended for completeness

### Save Process:

1. Click **"Save Study Information"** button
2. System validates study name is not empty
3. Study details are saved to the database
4. Confirmation message appears
5. You're redirected to the study workspace

---

## UI/UX Features

### Professional Design Elements:

**Input Fields**:
- 2px borders with rounded corners (8px radius)
- Hover effects: Light purple background (#faf5ff)
- Focus states: Indigo border (#6366f1) with shadow
- Smooth transitions (0.3s cubic-bezier easing)

**Dropdown Selects**:
- Custom chevron icon (changes color on hover/focus)
- Purple hover states matching text inputs
- Clear visual feedback for selection

**Form Blocks**:
- Gradient headers (gray to light gray)
- Hover effects with border color change
- Collapsible sections (click +/- to expand/collapse)

**Sticky Save Button**:
- Always visible at bottom of page
- Gradient background (indigo to purple)
- Hover effect: Lifts up with shadow
- Disabled state when requirements not met

**Error Handling**:
- Warning emoji (⚠️) for error messages
- Red borders on invalid fields
- Clear error text below fields

**Accessibility**:
- Proper ARIA labels
- Keyboard navigation support (Tab, Enter)
- Focus indicators on all interactive elements
- Required field indicators (red asterisk *)

---

## Default Values

To accelerate study setup, the following defaults are pre-filled:

| Field | Default Value |
|-------|--------------|
| Therapeutic Area | Oncology |
| Study Phase | Phase II |
| SDTM Version | SDTM v2.0 |
| ADaM IG Version | ADaM IG v1.3 |
| MedDRA Version | MedDRA v27.1 |
| Selected Datasets | ADSL |

**Note**: You can change any default value before saving.

---

## Keyboard Shortcuts

- **Tab**: Navigate between fields
- **Enter**: Submit form (when save button is focused)
- **Escape**: Clear current field (when focused)
- **Space**: Toggle checkboxes

---

## Tips for Best Results

1. **Study Name**: Use a clear, unique identifier that follows your organization's naming convention
2. **Protocol Number**: Match the official regulatory submission documents
3. **Standards Versions**: Use the latest versions unless specific regulatory guidance requires older versions
4. **Dataset Selection**: Start with ADSL and add datasets as needed for your analysis plan
5. **Description**: Provide comprehensive details to help team members understand study objectives

---

## Troubleshooting

### "Save Study Information" button is disabled
**Solution**: Ensure the Study Name field is not empty

### Cannot type in input fields
**Solution**:
- Ensure you're clicking inside the input box
- Check that the field is not disabled
- Try refreshing the page if issue persists

### Dropdown not showing options
**Solution**:
- Click directly on the dropdown
- Ensure JavaScript is enabled in browser
- Try refreshing the page

### Changes not saving
**Solution**:
- Check browser console for errors (F12)
- Verify backend server is running (http://localhost:8000)
- Ensure valid authentication token

---

## Technical Details

### Input Field Behavior:

**TextField Component** (`frontend/src/components/TextField.tsx`):
- Controlled React components
- OnChange handlers with debug logging
- Auto-complete disabled for clean UX
- Tab index management for accessibility

**SelectField Component** (`frontend/src/components/SelectField.tsx`):
- Custom SVG arrow indicators
- Disabled state handling
- Proper event propagation

### Styling:

**CSS Files**:
- `EnterStudyDetailsPage.css` - Page layout and save button
- `FormBlock.css` - Form section styling
- `TextField.css` - Text input styling
- `SelectField.css` - Dropdown styling

**Design System**:
- Primary color: Indigo (#6366f1)
- Hover color: Light purple (#a78bfa)
- Error color: Red (#ef4444)
- Border color: Gray (#e5e7eb)

### State Management:

**Form State**: Managed via React useState hook in `EnterStudyDetailsPageEnhanced.tsx`

**Default Form State**:
```typescript
{
  name: '',
  protocol_number: '',
  sponsor: '',
  therapeutic_area: 'Oncology',
  phase: 'Phase II',
  description: '',
  sdtm_version: 'SDTM v2.0',
  adam_ig_version: 'ADaM IG v1.3',
  meddra_version: 'MedDRA v27.1',
  selectedDatasets: ['ADSL']
}
```

---

## API Integration

### Endpoint: `POST /api/v1/studies`

**Request Body**:
```json
{
  "name": "ONCOLOGY-2024-001",
  "protocol_number": "PRO-12345",
  "sponsor": "Acme Pharmaceuticals Inc.",
  "therapeutic_area": "Oncology",
  "phase": "Phase II",
  "description": "Study description...",
  "sdtm_version": "SDTM v2.0",
  "adam_ig_version": "ADaM IG v1.3",
  "meddra_version": "MedDRA v27.1",
  "target_datasets": ["ADSL", "ADAE"]
}
```

**Response** (Success):
```json
{
  "id": 1,
  "name": "ONCOLOGY-2024-001",
  "status": "created",
  "created_at": "2024-11-29T08:30:00Z"
}
```

---

## Related Documentation

- **Backend API Documentation**: http://localhost:8000/api/docs
- **CDISC Standards**: https://www.cdisc.org/standards
- **ADaM Implementation Guide**: https://www.cdisc.org/standards/foundational/adam
- **Project Architecture**: See `Context/ProjectArchitecture/` folder

---

## Support

For technical support or feature requests:
- Check browser console for detailed error messages
- Review backend logs at `backend/logs/adam_ai.log`
- Contact development team with error details

---

**Last Updated**: November 29, 2024
**Component Version**: EnterStudyDetailsPageEnhanced v2.0
**Status**: Production Ready
