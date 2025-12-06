/**
 * Utility to sync study specification documents with the projectStore.
 * When a study is selected, this finds the SPECIFICATION document and sets it
 * as the active specification file for pair programming.
 */

import { useStudyStore, StudyDocument } from '../store/studyStore';
import { useProjectStore } from '../store/projectStore';

/**
 * Find the specification document from a list of study documents.
 * Prioritizes documents with document_type = 'SPECIFICATION' and Excel files.
 */
export function findSpecificationDocument(documents: StudyDocument[]): StudyDocument | null {
    if (!documents || documents.length === 0) {
        return null;
    }

    // First, look for documents explicitly marked as SPECIFICATION
    const specDocs = documents.filter(doc =>
        doc.document_type === 'SPECIFICATION' &&
        doc.is_active !== false
    );

    if (specDocs.length > 0) {
        // Prefer Excel files
        const excelSpec = specDocs.find(doc =>
            doc.original_file_name?.endsWith('.xlsx') ||
            doc.original_file_name?.endsWith('.xls')
        );
        if (excelSpec) return excelSpec;
        return specDocs[0];
    }

    // If no SPECIFICATION type, look for Excel files that might be specs
    const excelDocs = documents.filter(doc =>
        doc.is_active !== false &&
        (doc.original_file_name?.toLowerCase().includes('spec') ||
            doc.original_file_name?.toLowerCase().includes('adam')) &&
        (doc.original_file_name?.endsWith('.xlsx') || doc.original_file_name?.endsWith('.xls'))
    );

    if (excelDocs.length > 0) {
        return excelDocs[0];
    }

    // Last resort: any Excel file
    const anyExcel = documents.find(doc =>
        doc.is_active !== false &&
        (doc.original_file_name?.endsWith('.xlsx') || doc.original_file_name?.endsWith('.xls'))
    );

    return anyExcel || null;
}

/**
 * Sync the study's specification document to the projectStore.
 * This should be called when a study is selected or when documents are loaded.
 */
export function syncStudySpecificationToProjectStore(studyId: string): boolean {
    const studyStore = useStudyStore.getState();
    const projectStore = useProjectStore.getState();

    const documents = studyStore.documents[studyId] || [];
    const specDoc = findSpecificationDocument(documents);

    if (specDoc) {
        console.log('Found specification document for study:', studyId, specDoc.original_file_name);

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
                // Default to ADSL if no dataset is set
                adamDataset: projectStore.projectConfig.adamDataset || 'ADSL',
            } as any);
        }

        console.log('Specification file synced to projectStore:', specDoc.storage_path);
        return true;
    } else {
        console.log('No specification document found for study:', studyId);
        return false;
    }
}

/**
 * Setup event listeners to automatically sync specification files
 * when study documents are loaded.
 */
export function setupStudyDocumentSync(): () => void {
    const handleStudyChanged = (event: CustomEvent<{ studyId: string }>) => {
        const { studyId } = event.detail;
        console.log('Study changed event received:', studyId);

        // Wait a short time for documents to be loaded
        setTimeout(() => {
            syncStudySpecificationToProjectStore(studyId);
        }, 500);
    };

    const handleDocumentsUpdated = (event: CustomEvent<{ studyId: string }>) => {
        const { studyId } = event.detail;
        console.log('Study documents updated event received:', studyId);

        // Only sync if this is the current study
        const currentStudyId = useStudyStore.getState().currentStudyId;
        if (studyId === currentStudyId) {
            syncStudySpecificationToProjectStore(studyId);
        }
    };

    const handleDocumentsReady = (event: CustomEvent<{ studyId: string; documents: StudyDocument[] }>) => {
        const { studyId, documents } = event.detail;
        console.log('Study documents ready event received:', studyId, 'with', documents?.length || 0, 'documents');

        // Sync immediately
        syncStudySpecificationToProjectStore(studyId);
    };

    // Add listeners
    window.addEventListener('study-changed', handleStudyChanged as EventListener);
    window.addEventListener('study-documents-updated', handleDocumentsUpdated as EventListener);
    window.addEventListener('study-documents-ready', handleDocumentsReady as EventListener);

    console.log('Study document sync listeners set up');

    // Return cleanup function
    return () => {
        window.removeEventListener('study-changed', handleStudyChanged as EventListener);
        window.removeEventListener('study-documents-updated', handleDocumentsUpdated as EventListener);
        window.removeEventListener('study-documents-ready', handleDocumentsReady as EventListener);
    };
}
