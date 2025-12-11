export class Serializer {
  static serializeInvoice(invoice) {
    const serialized = {
      id: invoice.id || invoice.name,
      doctype: invoice.doctype || 'Sales Invoice',
      name: invoice.name,
      customer: invoice.customer,
      customer_name: invoice.customer_name || '',
      status: invoice.status || 'Draft',
      posting_date: invoice.posting_date || new Date().toISOString().split('T')[0],
      due_date: invoice.due_date || '',
      total_quantity: invoice.total_quantity || 0,
      base_total: invoice.base_total || 0,
      base_grand_total: invoice.base_grand_total || 0,
      outstanding_amount: invoice.outstanding_amount || 0,
      paid_amount: invoice.paid_amount || 0,
      remarks: invoice.remarks || '',
      erpnext_data: JSON.stringify(invoice),
      sync_status: invoice.sync_status || 'pending',
      local_modified: invoice.local_modified ? 1 : 0,
      erpnext_modified: invoice.modified || null,
    };
    return serialized;
  }

  static deserializeInvoice(row) {
    if (!row) return null;
    const parsed = {
      id: row.id,
      doctype: row.doctype,
      name: row.name,
      customer: row.customer,
      customer_name: row.customer_name,
      status: row.status,
      posting_date: row.posting_date,
      due_date: row.due_date,
      total_quantity: row.total_quantity,
      base_total: row.base_total,
      base_grand_total: row.base_grand_total,
      outstanding_amount: row.outstanding_amount,
      paid_amount: row.paid_amount,
      remarks: row.remarks,
      sync_status: row.sync_status,
      local_modified: row.local_modified === 1,
      erpnext_modified: row.erpnext_modified,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.erpnext_data) {
      try {
        parsed.erpnext_data = JSON.parse(row.erpnext_data);
      } catch {
        parsed.erpnext_data = {};
      }
    }

    return parsed;
  }

  static serializeInvoiceItem(item) {
    const serialized = {
      id: item.id || `${item.invoice_id}-${item.idx}`,
      invoice_id: item.invoice_id || item.parent,
      item_code: item.item_code,
      item_name: item.item_name || item.description || '',
      description: item.description || '',
      quantity: item.qty || item.quantity || 0,
      stock_qty: item.stock_qty || 0,
      uom: item.uom || 'Nos',
      rate: item.rate || 0,
      amount: item.amount || (item.qty || 0) * (item.rate || 0),
      discount_percentage: item.discount_percentage || 0,
      discount_amount: item.discount_amount || 0,
      tax_rate: item.tax_rate || 0,
      tax_amount: item.tax_amount || 0,
      serial_number: item.serial_number || '',
      batch_no: item.batch_no || '',
      warehouse: item.warehouse || '',
      erpnext_data: JSON.stringify(item),
    };
    return serialized;
  }

  static deserializeInvoiceItem(row) {
    if (!row) return null;
    const parsed = {
      id: row.id,
      invoice_id: row.invoice_id,
      item_code: row.item_code,
      item_name: row.item_name,
      description: row.description,
      quantity: row.quantity,
      stock_qty: row.stock_qty,
      uom: row.uom,
      rate: row.rate,
      amount: row.amount,
      discount_percentage: row.discount_percentage,
      discount_amount: row.discount_amount,
      tax_rate: row.tax_rate,
      tax_amount: row.tax_amount,
      serial_number: row.serial_number,
      batch_no: row.batch_no,
      warehouse: row.warehouse,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.erpnext_data) {
      try {
        parsed.erpnext_data = JSON.parse(row.erpnext_data);
      } catch {
        parsed.erpnext_data = {};
      }
    }

    return parsed;
  }

  static serializeCustomer(customer) {
    const serialized = {
      id: customer.id || customer.name,
      doctype: customer.doctype || 'Customer',
      name: customer.name,
      customer_name: customer.customer_name || customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      mobile_no: customer.mobile_no || '',
      customer_group: customer.customer_group || '',
      territory: customer.territory || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      country: customer.country || '',
      pincode: customer.pincode || '',
      credit_limit: customer.credit_limit || 0,
      outstanding_amount: customer.outstanding_amount || 0,
      disabled: customer.disabled ? 1 : 0,
      erpnext_data: JSON.stringify(customer),
      sync_status: customer.sync_status || 'pending',
      erpnext_modified: customer.modified || null,
    };
    return serialized;
  }

  static deserializeCustomer(row) {
    if (!row) return null;
    const parsed = {
      id: row.id,
      doctype: row.doctype,
      name: row.name,
      customer_name: row.customer_name,
      email: row.email,
      phone: row.phone,
      mobile_no: row.mobile_no,
      customer_group: row.customer_group,
      territory: row.territory,
      address: row.address,
      city: row.city,
      state: row.state,
      country: row.country,
      pincode: row.pincode,
      credit_limit: row.credit_limit,
      outstanding_amount: row.outstanding_amount,
      disabled: row.disabled === 1,
      sync_status: row.sync_status,
      erpnext_modified: row.erpnext_modified,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.erpnext_data) {
      try {
        parsed.erpnext_data = JSON.parse(row.erpnext_data);
      } catch {
        parsed.erpnext_data = {};
      }
    }

    return parsed;
  }

  static serializeQueuedRequest(request) {
    const serialized = {
      id: request.id,
      request_type: request.request_type || request.operation || 'create',
      entity_type: request.entity_type,
      entity_id: request.entity_id,
      operation: request.operation || 'insert',
      payload: typeof request.payload === 'string' ? request.payload : JSON.stringify(request.payload),
      status: request.status || 'pending',
      priority: request.priority || 5,
      retry_count: request.retry_count || 0,
      max_retries: request.max_retries || 3,
      error_message: request.error_message || '',
      response_data: request.response_data ? (typeof request.response_data === 'string' ? request.response_data : JSON.stringify(request.response_data)) : null,
    };
    return serialized;
  }

  static deserializeQueuedRequest(row) {
    if (!row) return null;
    const parsed = {
      id: row.id,
      request_type: row.request_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      operation: row.operation,
      status: row.status,
      priority: row.priority,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
      processed_at: row.processed_at,
    };

    if (row.payload) {
      try {
        parsed.payload = JSON.parse(row.payload);
      } catch {
        parsed.payload = {};
      }
    }

    if (row.response_data) {
      try {
        parsed.response_data = JSON.parse(row.response_data);
      } catch {
        parsed.response_data = null;
      }
    }

    return parsed;
  }

  static serializeConflictLog(log) {
    const serialized = {
      id: log.id,
      conflict_type: log.conflict_type,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      local_data: log.local_data ? (typeof log.local_data === 'string' ? log.local_data : JSON.stringify(log.local_data)) : null,
      remote_data: log.remote_data ? (typeof log.remote_data === 'string' ? log.remote_data : JSON.stringify(log.remote_data)) : null,
      merged_data: log.merged_data ? (typeof log.merged_data === 'string' ? log.merged_data : JSON.stringify(log.merged_data)) : null,
      resolution_status: log.resolution_status || 'pending',
      resolution_method: log.resolution_method || '',
      resolved_by: log.resolved_by || '',
      notes: log.notes || '',
    };
    return serialized;
  }

  static deserializeConflictLog(row) {
    if (!row) return null;
    const parsed = {
      id: row.id,
      conflict_type: row.conflict_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      resolution_status: row.resolution_status,
      resolution_method: row.resolution_method,
      resolved_by: row.resolved_by,
      notes: row.notes,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
    };

    if (row.local_data) {
      try {
        parsed.local_data = JSON.parse(row.local_data);
      } catch {
        parsed.local_data = null;
      }
    }

    if (row.remote_data) {
      try {
        parsed.remote_data = JSON.parse(row.remote_data);
      } catch {
        parsed.remote_data = null;
      }
    }

    if (row.merged_data) {
      try {
        parsed.merged_data = JSON.parse(row.merged_data);
      } catch {
        parsed.merged_data = null;
      }
    }

    return parsed;
  }
}
