# Domain-Specific Configuration System Design - IMPLEMENTED ✅

## Architecture Overview

### 1. Domain Configuration Schema ✅
Implemented a comprehensive `DOMAIN_CONFIGURATIONS` object that maps each SDTM domain to:
- **Required Panels**: Panels that MUST be shown (e.g., AE requires Safety config)
- **Optional Panels**: Panels that CAN be shown (e.g., Treatment for AE is optional)
- **Hidden Panels**: Panels that should be HIDDEN (e.g., DM doesn't need Visit Schedule)
- **Domain-Specific Config**: Flags and defaults for each domain

### 2. Domain-Specific Requirements (CDISC SDTM 3.4 Compliant)

**DM (Demographics)**
- ✅ Core: Subjects, Demographics (age, sex, race, ethnicity)
- ✅ Study dates (for RFSTDTC, RFENDTC)
- ✅ Site information (num_sites)
- ✅ Randomization data (optional)
- ❌ NO: Visit schedule, Treatment details, Records per subject (always 1)
- ✅ Domain-Specific: Number of sites, Include race/ethnicity

**AE (Adverse Events)**
- ✅ Core: Subjects, Demographics
- ✅ Safety Configuration: Serious AE %, Severe AE %, Related AE %
- ✅ MedDRA Coding: Auto-enabled
- ✅ Visit Schedule: For AESTDTC, AEENDTC
- ✅ Treatment: For AEREL (relationship to treatment)
- ✅ Records per Subject: Default 3 (avg 2-5 per subject)
- ✅ Domain-Specific: AE Duration (days), AE Outcome Distribution

**LB (Laboratory)**
- ✅ Core: Subjects, Demographics
- ✅ Visit Schedule: For LBDTC
- ✅ Lab Configuration: Abnormality %, Test panels, Units
- ✅ Records per Subject: Default 20 (10-50 per subject)
- ✅ Domain-Specific: Lab Test Panels (CBC, Chemistry, Lipid, etc.), Units Standard (SI/Conventional)
- ❌ NO: Treatment-specific (unless treatment-related labs)

**VS (Vital Signs)**
- ✅ Core: Subjects, Demographics
- ✅ Visit Schedule: For VSDTC
- ✅ Vital Sign Types: BP, HR, Temp, Weight, Height, BMI, Resp Rate
- ✅ Records per Subject: Default 8 (5-10 per subject)
- ✅ Domain-Specific: Vital Sign Types selection, Body Position (SITTING/STANDING/SUPINE)
- ❌ NO: Treatment-specific, Safety config

**EX (Exposure)**
- ✅ Core: Subjects, Demographics
- ✅ Treatment Arms: CRITICAL (for EXTRT, EXDOSE) - Required Panel
- ✅ Visit Schedule: For EXSTDTC, EXENDTC
- ✅ Records per Subject: Default 2 (1-3 per subject)
- ✅ Domain-Specific: Dose Unit (mg, g, mL, IU, tablets), Route (ORAL, IV, IM, SC, TOPICAL), Frequency (QD, BID, TID, QW, Q2W)
- ❌ NO: Safety config

**DS (Disposition)**
- ✅ Core: Subjects, Demographics
- ✅ Visit Schedule: For DSDTC
- ✅ Disposition Events: Screen failure, Early termination, Completion
- ✅ Records per Subject: Default 1 (usually 1, can have multiple)
- ✅ Domain-Specific: Disposition Events selection, Completion Rate (%)
- ❌ NO: Treatment-specific, Safety config

## Implementation Details ✅

### Phase 1: Domain Configuration Mapping ✅
- Created `DOMAIN_CONFIGURATIONS` constant with complete mapping
- Helper functions: `getDomainConfig()`, `shouldShowPanel()`

### Phase 2: Dynamic Panel Rendering ✅
- All Collapse.Panel components wrapped with `shouldShowPanel()` check
- Panels automatically show/hide based on selected domain
- Required panels auto-expanded on domain selection

### Phase 3: Domain-Specific Controls ✅
- New "Domain Specific Configuration" panel added
- Domain-specific fields for each domain:
  - **AE**: AE Duration, AE Outcome Distribution
  - **LB**: Lab Test Panels, Units Standard
  - **VS**: Vital Sign Types, Body Position
  - **EX**: Dose Unit, Route, Frequency
  - **DS**: Disposition Events, Completion Rate
  - **DM**: Number of Sites, Include Race/Ethnicity

### Phase 4: Smart Defaults ✅
- `handleDomainChange()` function updated to:
  - Set default `records_per_subject` based on domain
  - Auto-enable MedDRA for AE domain
  - Auto-expand required panels
  - Preserve optional panels if already open

## User Experience Flow

1. **User selects a domain** (e.g., AE)
2. **Sidebar automatically updates**:
   - Shows: Study Config, Subjects, Visits, Safety (required)
   - Shows: Treatment (optional, can be toggled)
   - Hides: Quality (if not relevant)
   - Expands: Required panels automatically
3. **Domain-Specific panel appears** with AE-specific options
4. **Smart defaults applied**: Records per subject = 3, MedDRA enabled
5. **User configures domain-specific options** (AE Duration, Outcome Distribution)
6. **Generate button** uses all configured parameters

## Benefits

✅ **Reduced Clutter**: Only relevant controls shown
✅ **CDISC Compliant**: Based on SDTM 3.4 and ADAM IG standards
✅ **Expert Design**: Follows ADAM programmer best practices
✅ **Intuitive**: Domain-specific options grouped logically
✅ **Smart Defaults**: Sensible defaults based on domain type
✅ **Extensible**: Easy to add new domains or configuration options

