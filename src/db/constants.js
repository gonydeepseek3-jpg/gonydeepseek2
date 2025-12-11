export const TABLES = {
  INVOICES: 'invoices',
  INVOICE_ITEMS: 'invoice_items',
  CUSTOMERS: 'customers',
  QUEUED_REQUESTS: 'queued_requests',
  SYNC_METADATA: 'sync_metadata',
  CONFLICT_LOGS: 'conflict_logs',
};

export const INVOICE_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  CANCELLED: 'Cancelled',
};

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed',
};

export const QUEUE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

export const CONFLICT_TYPE = {
  VERSION_MISMATCH: 'version_mismatch',
  CONCURRENT_EDIT: 'concurrent_edit',
  DATA_CORRUPTION: 'data_corruption',
  MERGE_REQUIRED: 'merge_required',
};
