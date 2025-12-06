/**
 * Utility to sync study specification documents with the projectStore.
 * When a study is selected, this finds the SPECIFICATION document and sets it
 * as the active specification file for pair programming.
 * 
 * If multiple specification files exist, it dispatches an event to prompt the user
 * to select which file/sheet to use.
 */

import { useStudyStore, StudyDocument } from '../store/studyStore';
import { useProjectStore } from '../store/projectStore';

/**
 * Find all specification documents from a list of study documents.
 * Returns an array of potential specification files.
 */
export function findAllSpecificationDocuments(documents: StudyDocument[]): StudyDocument[] {
    if (!documents || documents.length === 0) {
        return [];
    }

    const specDocs: StudyDocument[] = [];

    // First, look for documents explicitly marked as SPECIFICATION
    const explicitSpecs = documents.filter(doc =>
        doc.document_type === 'SPECIFICATION' &&
        doc.is_active !== false
    );
    specDocs.push(...explicitSpecs);

    // Also look for Excel files that might be specs (by name)
    const excelDocs = documents.filter(doc =>
        doc.is_active !== false &&
        !explicitSpecs.some(s => s.id === doc.id) && // Not already added
        (doc.original_file_name?.toLowerCase().includes('spec') ||
            doc.original_file_name?.toLowerCase().includes('adam')) &&
        (doc.original_file_name?.endsWith('.xlsx') || doc.original_file_name?.endsWith('.xls'))
    );
    specDocs.push(...excelDocs);

    // Also include any Excel files not already added
    const otherExcel = documents.filter(doc =>
        doc.is_active !== false &&
        !specDocs.some(s => s.id === doc.id) && // Not already added
        (doc.original_file_name?.endsWith('.xlsx') || doc.original_file_name?.endsWith('.xls'))
    );
    specDocs.push(...otherExcel);

    return specDocs;
}

/**
 * Find the specification document from a list of study documents.
 * Prioritizes documents with document_type = 'SPECIFICATION' and Excel files.
 */
export function findSpecificationDocument(documents: StudyDocument[]): StudyDocument | null {
    const allSpecs = findAllSpecificationDocuments(documents);

    if (allSpecs.length === 0) {
        return null;
    }

    // Return the first one (prioritized by the order in findAllSpecificationDocuments)
    return allSpecs[0];
}

/**
 * Clear all study-specific AI-generated data from the projectStore and backend caches.
 * This should be called when switching studies to prevent stale data.
 * 
 * CRITICAL: This function ensures data isolation between studies.
 * When a user switches studies, ALL cached and generated data must be cleared
 * to prevent showing data from the previous study.
 */
export function clearStudySpecificData(previousStudyId?: string): void {
    const projectStore = useProjectStore.getState();

    console.log('[studyDocumentSync] === CLEARING ALL STUDY-SPECIFIC DATA ===');
    console.log('[studyDocumentSync] Previous study ID:', previousStudyId || 'unknown');

    // 1. TRACEABILITY: Clear traceability matrix and related state
    console.log('[studyDocumentSync] Clearing traceability data...');
    if (typeof projectStore.clearTraceability === 'function') {
        projectStore.clearTraceability();
    } else {
        projectStore.setTraceabilityMatrix?.(null);
        projectStore.setTraceabilityError?.(null);
    }
    projectStore.setSelectedTraceabilityVariable?.(null);

    // 2. CATEGORIZED VARIABLES: Clear specification parsing results
    console.log('[studyDocumentSync] Clearing categorized variables...');
    projectStore.setCategorizedVariables(null);

    // 3. PAIR PROGRAMMING: Clear AI-generated code snippets
    console.log('[studyDocumentSync] Clearing AI results and code snippets...');
    if (typeof projectStore.clearAllAIResults === 'function') {
        projectStore.clearAllAIResults();
    }

    // 4. CONSOLIDATED CODE: Clear consolidated code output
    console.log('[studyDocumentSync] Clearing consolidated code...');
    if (typeof projectStore.resetConsolidated === 'function') {
        projectStore.resetConsolidated();
    }

    // 5. SPECIFICATION FILE: Clear to be reloaded from new study
    console.log('[studyDocumentSync] Clearing specification file...');
    projectStore.setSpecificationFile(null);

    // 6. VALIDATION RESULTS: Clear any cached validation data
    // Note: These are typically set through validation actions, not direct setters
    // The validation store manages its own state during validation runs
    console.log('[studyDocumentSync] Clearing validation and submission data...');
    if (typeof (projectStore as any).setSubmissionReadinessScore === 'function') {
        (projectStore as any).setSubmissionReadinessScore(null);
    }

    // 7. GENERATION STATE: Reset generation flags
    console.log('[studyDocumentSync] Resetting generation states...');
    if (typeof projectStore.cleanupGenerationStates === 'function') {
        projectStore.cleanupGenerationStates();
    }
    projectStore.setIsGenerating?.(false);
    projectStore.setIsGeneratingTraceability?.(false);

    // 8. BACKEND CACHE: Clear backend caches for the previous study (fire and forget)
    if (previousStudyId) {
        console.log('[studyDocumentSync] Requesting backend cache clear for study:', previousStudyId);
        clearBackendStudyCaches(previousStudyId).catch(err => {
            console.warn('[studyDocumentSync] Backend cache clear failed:', err);
        });
    }

    console.log('[studyDocumentSync] === STUDY DATA CLEAR COMPLETE ===');

    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('study-data-cleared', {
        detail: { previousStudyId, timestamp: Date.now() }
    }));
}

/**
 * Clear backend caches for a specific study.
 * This ensures the backend doesn't serve stale cached data.
 */
async function clearBackendStudyCaches(studyId: string): Promise<void> {
    try {
        // Use the unified cache clearing API
        const response = await fetch(`/api/v1/cache/study/${studyId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('[studyDocumentSync] Backend cache cleared:', result);
        } else {
            console.warn('[studyDocumentSync] Backend cache clear returned non-ok status:', response.status);
        }
    } catch (error) {
        // Fallback: try clearing individual dataset caches
        console.warn('[studyDocumentSync] Unified cache clear failed, trying fallback:', error);
        const datasets = ['ADSL', 'ADAE', 'ADLB', 'ADVS', 'ADCM'];
        await Promise.allSettled(datasets.map(dataset =>
            fetch(`/api/v1/traceability/${studyId}/${dataset}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => { /* ignore */ })
        ));
    }

    console.log('[studyDocumentSync] Backend caches cleared for study:', studyId);
}

/**
 * Sync the study's specification document to the projectStore.
 * This should be called when a study is selected or when documents are loaded.
 * 
 * If multiple specification files are found, it dispatches an event to prompt
 * the user to select which file to use.
 * 
 * @returns true if a specification was synced, false otherwise
 */
export function syncStudySpecificationToProjectStore(studyId: string): boolean {
    const studyStore = useStudyStore.getState();
    const projectStore = useProjectStore.getState();

    const documents = studyStore.documents[studyId] || [];
    const allSpecDocs = findAllSpecificationDocuments(documents);

    console.log(`[studyDocumentSync] Found ${allSpecDocs.length} potential specification documents for study ${studyId}`);

    if (allSpecDocs.length === 0) {
        console.log('[studyDocumentSync] No specification document found for study:', studyId);
        return false;
    }

    // If multiple spec documents exist, dispatch an event to prompt user selection
    if (allSpecDocs.length > 1) {
        console.log('[studyDocumentSync] Multiple specification files found, prompting user to select');
        window.dispatchEvent(new CustomEvent('multiple-specifications-found', {
            detail: {
                studyId,
                specificationDocuments: allSpecDocs,
                message: `Found ${allSpecDocs.length} potential specification files. Please select which one to use.`
            }
        }));

        // Still set the first one as default, user can change later
        console.log('[studyDocumentSync] Setting first specification as default:', allSpecDocs[0].original_file_name);
    }

    const specDoc = allSpecDocs[0];

    console.log('[studyDocumentSync] Found specification document for study:', studyId, specDoc.original_file_name);

    // Set the specification file in projectStore
    projectStore.setSpecificationFile({
        name: specDoc.original_file_name,
        path: specDoc.storage_path,
        size: specDoc.size_bytes || 0,
        uploadedAt: specDoc.uploaded_at,
        isDefault: false, // Not a default - it's from the study
    });

    // Also update project config with study context
    const study = studyStore.currentStudy;
    if (study) {
        projectStore.setProjectConfig({
            studyId: study.id,
            studyName: study.name,
            studyPhase: study.phase,
            // Reset the adamDataset when switching studies to avoid stale selection
            adamDataset: 'ADSL', // Default to ADSL for new study
        } as any);
    }

    console.log('[studyDocumentSync] Specification file synced to projectStore:', specDoc.storage_path);
    return true;
}

/**
 * Select a specific specification document and sync it to the projectStore.
 * This is used when the user manually selects a specification file.
 */
export function selectSpecificationDocument(documentId: string): boolean {
    const studyStore = useStudyStore.getState();
    const projectStore = useProjectStore.getState();
    const studyId = studyStore.currentStudyId;

    if (!studyId) {
        console.error('[studyDocumentSync] No study selected');
        return false;
    }

    const documents = studyStore.documents[studyId] || [];
    const specDoc = documents.find(d => d.id === documentId);

    if (!specDoc) {
        console.error('[studyDocumentSync] Document not found:', documentId);
        return false;
    }

    // Clear old study-specific data before setting new specification
    clearStudySpecificData();

    // Set the specification file in projectStore
    projectStore.setSpecificationFile({
        name: specDoc.original_file_name,
        path: specDoc.storage_path,
        size: specDoc.size_bytes || 0,
        uploadedAt: specDoc.uploaded_at,
        isDefault: false,
    });

    console.log('[studyDocumentSync] Specification document selected:', specDoc.original_file_name);

    // Dispatch event to notify components
    window.dispatchEvent(new CustomEvent('specification-selected', {
        detail: {
            studyId,
            document: specDoc
        }
    }));

    return true;
}

/**
 * Setup event listeners to automatically sync specification files
 * when study documents are loaded.
 */
export function setupStudyDocumentSync(): () => void {
    // Track the current study ID to detect changes
    let previousTrackedStudyId: string | null = null;

    const handleStudyChanged = (event: CustomEvent<{ studyId: string }>) => {
        const { studyId } = event.detail;
        console.log('[studyDocumentSync] Study changed event received:', studyId);
        console.log('[studyDocumentSync] Previous study:', previousTrackedStudyId);

        // Clear old study-specific data immediately, passing the previous study ID
        // This ensures backend caches are also invalidated
        clearStudySpecificData(previousTrackedStudyId || undefined);

        // Update tracked study ID
        previousTrackedStudyId = studyId;

        // Wait a short time for documents to be loaded
        setTimeout(() => {
            syncStudySpecificationToProjectStore(studyId);
        }, 500);
    };

    const handleDocumentsUpdated = (event: CustomEvent<{ studyId: string }>) => {
        const { studyId } = event.detail;
        console.log('[studyDocumentSync] Study documents updated event received:', studyId);

        // Only sync if this is the current study
        const currentStudyId = useStudyStore.getState().currentStudyId;
        if (studyId === currentStudyId) {
            syncStudySpecificationToProjectStore(studyId);
        }
    };

    const handleDocumentsReady = (event: CustomEvent<{ studyId: string; documents: StudyDocument[] }>) => {
        const { studyId, documents } = event.detail;
        console.log('[studyDocumentSync] Study documents ready event received:', studyId, 'with', documents?.length || 0, 'documents');

        // Sync immediately
        syncStudySpecificationToProjectStore(studyId);
    };

    // Add listeners
    window.addEventListener('study-changed', handleStudyChanged as EventListener);
    window.addEventListener('study-documents-updated', handleDocumentsUpdated as EventListener);
    window.addEventListener('study-documents-ready', handleDocumentsReady as EventListener);

    console.log('[studyDocumentSync] Study document sync listeners set up');

    // Return cleanup function
    return () => {
        window.removeEventListener('study-changed', handleStudyChanged as EventListener);
        window.removeEventListener('study-documents-updated', handleDocumentsUpdated as EventListener);
        window.removeEventListener('study-documents-ready', handleDocumentsReady as EventListener);
    };
}
