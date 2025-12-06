# Pair Programming Page - Specification File Loading Fix

## Problem Summary

When a user enters the pair programming page and selects a Study ID, the app was not automatically loading the specification file uploaded for that study. The pair programming page requires:

1. Dataset name (e.g., ADSL, ADAE)
2. Specification file path
3. Excel sheet name

Even when the study had an uploaded specification sheet, the app didn't know how to pick it from the study details.

## Root Cause

The disconnect was caused by two issues:

1. **`setCurrentStudy` in studyStore** only loaded study details - it didn't load documents or dataset selections automatically.

2. **`handleOpenStudy` and `handleContinueExistingProject` in App.tsx** only checked if a `specificationFile` was already set, and fell back to a default spec file. They never looked at the study's uploaded documents.

## Solution

### 1. Enhanced `setCurrentStudy` in studyStore.ts (line 208-229)

Now automatically loads study documents and dataset selections when a study is selected:

```typescript
setCurrentStudy: async (studyId: string) => {
  set({ currentStudyId: studyId });
  const study = await get().loadStudy(studyId);
  set({ currentStudy: study });
  window.dispatchEvent(new CustomEvent('study-changed', { detail: { studyId } }));
  
  // NEW: Also load study documents and dataset selections
  try {
    await Promise.all([
      get().loadStudyDocuments(studyId, true),
      get().loadDatasetSelections(studyId)
    ]);
    console.log('Study documents and datasets loaded for study:', studyId);
    window.dispatchEvent(new CustomEvent('study-documents-ready', { 
      detail: { studyId, study, documents: get().documents[studyId] || [], datasets: get().datasetSelections[studyId] || [] } 
    }));
  } catch (error) {
    console.warn('Failed to load study documents/datasets:', error);
  }
},
```

### 2. New Utility File: `studyDocumentSync.ts`

Created a new utility that:

- **`findSpecificationDocument()`**: Finds the best specification document from study documents
  - Prioritizes documents with `document_type = 'SPECIFICATION'`
  - Prefers Excel files (.xlsx, .xls)
  - Falls back to Excel files with 'spec' or 'adam' in their name

- **`syncStudySpecificationToProjectStore()`**: Sets the found specification file in projectStore

- **`setupStudyDocumentSync()`**: Sets up event listeners to automatically sync when:
  - A study is changed
  - Study documents are updated
  - Study documents are ready

### 3. Updated App.tsx

- Added import for the new sync utility
- Added `useEffect` to set up document sync listeners on app mount
- Updated `handleOpenStudy()` to:
  - Try syncing specification from study documents first
  - Only fall back to default spec if no study spec found
  - Show appropriate messages to user

- Updated `handleContinueExistingProject()` to also sync specification files

## Flow After Fix

1. User selects a Study ID in pair programming page
2. `setCurrentStudy(studyId)` is called
3. Study details are loaded
4. Study documents and dataset selections are loaded automatically
5. `study-documents-ready` event is dispatched
6. `syncStudySpecificationToProjectStore()` is triggered
7. Finds the SPECIFICATION document from study documents
8. Sets it as the active `specificationFile` in projectStore
9. Pair programming page now has access to the specification file
10. Variables can be categorized and code can be generated

## Files Modified

1. **frontend/src/store/studyStore.ts** - Enhanced `setCurrentStudy` function
2. **frontend/src/utils/studyDocumentSync.ts** - NEW file for spec sync utilities
3. **frontend/src/App.tsx** - Added sync setup and updated handlers

## Testing

To test the fix:

1. Start the backend and frontend servers
2. Log in to the app
3. Go to "Enter Study Details" and create/select a study
4. Upload an ADAM specification Excel file (.xlsx)
5. Navigate to the pair programming page
6. Select the same study from the dropdown
7. The specification file should now be automatically loaded
8. Variables can be categorized and pair programming can proceed

## Notes

- The fix is backward compatible - if no study documents exist, the default specification file is used
- Excel files with SPECIFICATION document_type are prioritized
- The sync happens automatically via event listeners, making it robust

---

# Path Resolution Fix (December 6, 2025)

## Issue Summary

**Problem**: After implementing the above fix, categorization still failed with error:
```
Categorization Failed
Specification file not found: C:\...\backend\app\storage\study_documents\STUDY-2025-D5A2647B\doc-1d8a0d7093b0_Oncology_ADaM_Spec_ADSL.xlsx
```

**Root Cause**: Path resolution inconsistency due to current working directory (CWD) dependency:
- When backend runs from `backend/` directory: paths resolve correctly to `backend/storage/...`
- When backend runs from `backend/app/` directory: paths resolve incorrectly to `backend/app/storage/...` (adds extra `/app/`)

The `DocumentService` was using a relative path `storage/study_documents` which resolved differently depending on CWD.

## Solution Implemented

Modified `DocumentService` and related endpoints to always resolve storage paths relative to the **backend directory**, not the current working directory.

### Changes Made

#### 1. `backend/app/modules/studies/document_service.py`

**Added helper method** (line 24-29):
```python
@staticmethod
def _get_backend_dir() -> Path:
    """Get backend directory path consistently"""
    # document_service.py -> studies -> modules -> app -> backend
    current_file = Path(__file__).resolve()
    return current_file.parent.parent.parent.parent
```

**Updated `__init__`** to use absolute backend-relative paths (line 31-41).

**Updated `upload_document`** to store relative paths in database (line 93-101):
- Paths are stored relative to backend directory for portability
- Format: `storage/study_documents/{study_id}/{doc_id}_{filename}`

**Updated `delete_document`** to resolve relative paths (line 211-216).

#### 2. `backend/app/api/v1/endpoints/study_documents.py`

**Updated `download_document` endpoint** (line 146-152):
- Resolves relative paths to absolute before checking file existence
- Uses same backend directory calculation as DocumentService

### Existing Auto-Correction

The `backend/app/api/v1/endpoints/specification.py` already had auto-correction logic (lines 210-239) that handles old corrupted paths containing `app/storage` pattern. This remains in place for backward compatibility.

## Verification Test

Test from `backend/app/` directory (the problematic case):
```bash
./prakenv/Scripts/python.exe -c "
from pathlib import Path
import os
os.chdir('backend/app')

from app.modules.studies.document_service import DocumentService
backend_dir = DocumentService._get_backend_dir()

db_path = 'storage/study_documents/STUDY-2025-D5A2647B/doc-1d8a0d7093b0_Oncology_ADaM_Spec_ADSL.xlsx'
file_path = Path(db_path)
if not file_path.is_absolute():
    file_path = backend_dir / file_path

print('Backend dir:', backend_dir)
print('Resolved path:', file_path)
print('File exists:', file_path.exists())
"
```

**Result**:
```
Backend dir: C:\...\backend
Resolved path: C:\...\backend\storage\study_documents\STUDY-2025-D5A2647B\doc-1d8a0d7093b0_Oncology_ADaM_Spec_ADSL.xlsx
File exists: True ✓
```

## Benefits

1. **CWD Independence**: Backend works correctly regardless of which directory it's run from
2. **Portability**: Database stores relative paths, making the system portable across environments
3. **Backward Compatibility**: Existing auto-correction logic handles old corrupted paths
4. **Consistency**: All file operations use the same backend directory resolution logic
5. **No Frontend Changes Needed**: The path sanitization in `frontend/src/store/projectStore.ts` continues to work

## Database Schema

The `study_documents.storage_path` field now stores:
- **Format**: Relative path from backend directory
- **Example**: `storage/study_documents/STUDY-2025-69030F30/doc-62941b472881_Oncology_ADaM_Spec_ADSL.xlsx`
- **Separator**: Backslash on Windows, forward slash on Unix
- **Note**: Old absolute paths still supported via auto-correction in specification.py

## Files Modified

1. `backend/app/modules/studies/document_service.py` - Primary fix with `_get_backend_dir()` method
2. `backend/app/api/v1/endpoints/study_documents.py` - Download endpoint fix

## No Changes Needed

1. `backend/app/api/v1/endpoints/specification.py` - Already has auto-correction logic
2. `frontend/src/store/projectStore.ts` - Path sanitization works with new relative paths
3. `frontend/src/components/VariablesAnalysisTab.tsx` - No changes needed

## Testing Checklist

- [x] Path resolution from `backend/app/` directory
- [ ] Upload new specification file and verify path stored correctly
- [ ] Categorize variables with newly uploaded file
- [ ] Test pair programming page with study documents
- [ ] Download document file
- [ ] Delete document (soft delete)
- [ ] Delete document (hard delete)

## Next Steps

1. Start the backend server with: `cd backend && ../prakenv/Scripts/python.exe -m uvicorn app.main:app --reload`
2. Start the frontend server with: `cd frontend && npm run dev`
3. Test the pair programming page with an existing study
4. Verify categorization works without "file not found" errors
