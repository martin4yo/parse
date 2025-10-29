import React from 'react';
import { DocumentViewerModal } from '@/components/rendiciones/modals/DocumentViewerModal';
import { useDocumentViewer } from '@/hooks/useDocumentViewer';

interface DocumentViewerProviderProps {
  documentViewer: ReturnType<typeof useDocumentViewer>;
}

export function DocumentViewerProvider({ documentViewer }: DocumentViewerProviderProps) {
  return (
    <DocumentViewerModal
      isOpen={documentViewer.isOpen}
      onClose={documentViewer.closeViewer}
      documentId={documentViewer.viewingDocumentId || undefined}
      itemData={documentViewer.viewingDocument}
    />
  );
}