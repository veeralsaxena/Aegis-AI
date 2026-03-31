/**
 * Crater Billing API helpers
 * Crater is the invoicing/billing service integrated with Bahmni Lite.
 * Runs on port 444 (HTTPS) inside Docker, proxied via /crater-api/ in next.config.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CraterInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  status: string;
  paid_status: string;
  total: number;
  due_amount: number;
  sub_total: number;
  tax: number;
  discount: number;
  notes?: string;
  user?: { name: string };
  items?: CraterInvoiceItem[];
  customer?: { name: string; email?: string; phone?: string };
}

export interface CraterInvoiceItem {
  id: number;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  total: number;
  unit_name?: string;
}

export interface CraterCustomer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  contact_name?: string;
  billing_address?: any;
}

// ─── Auth Token ─────────────────────────────────────────────────────────────

let craterToken: string | null = null;

/** Authenticate with Crater and get a bearer token */
export async function craterLogin(
  email: string = "superman@bahmni.org",
  password: string = "Crater123"
): Promise<string> {
  const res = await fetch("/crater-api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password, device_name: "omnicare-web" }),
  });
  const data = await res.json();
  craterToken = data.token;
  return data.token;
}

/** Get or refresh the Crater bearer token */
async function getCraterToken(): Promise<string> {
  if (!craterToken) {
    return craterLogin();
  }
  return craterToken;
}

/** Helper to make authenticated Crater API calls */
async function craterFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getCraterToken();
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...options, headers });
}

// ─── Invoices ───────────────────────────────────────────────────────────────

/** List invoices with optional pagination */
export async function listInvoices(
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<{ data: CraterInvoice[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.set("status", status);
  const res = await craterFetch(`/crater-api/invoices?${params}`);
  const data = await res.json();
  return { data: data.invoices?.data || data.data || [], total: data.invoices?.total || data.total || 0 };
}

/** Get a single invoice by ID */
export async function getInvoice(id: number): Promise<CraterInvoice> {
  const res = await craterFetch(`/crater-api/invoices/${id}`);
  const data = await res.json();
  return data.invoice || data;
}

/** Create a new invoice */
export async function createInvoice(invoice: {
  invoice_date: string;
  due_date: string;
  customer_id: number;
  items: { name: string; quantity: number; price: number; description?: string }[];
  notes?: string;
  discount?: number;
}): Promise<CraterInvoice> {
  const res = await craterFetch("/crater-api/invoices", {
    method: "POST",
    body: JSON.stringify(invoice),
  });
  const data = await res.json();
  return data.invoice || data;
}

/** Send invoice via email */
export async function sendInvoice(invoiceId: number): Promise<any> {
  const res = await craterFetch(`/crater-api/invoices/${invoiceId}/send`, { method: "POST" });
  return res.json();
}

/** Mark invoice as paid */
export async function markInvoicePaid(invoiceId: number): Promise<any> {
  const res = await craterFetch(`/crater-api/invoices/${invoiceId}/mark-as-paid`, { method: "POST" });
  return res.json();
}

// ─── Customers ──────────────────────────────────────────────────────────────

/** List Crater customers */
export async function listCustomers(page: number = 1): Promise<CraterCustomer[]> {
  const res = await craterFetch(`/crater-api/customers?page=${page}`);
  const data = await res.json();
  return data.customers?.data || data.data || [];
}

/** Create a Crater customer (typically when a patient is registered) */
export async function createCustomer(customer: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<CraterCustomer> {
  const res = await craterFetch("/crater-api/customers", {
    method: "POST",
    body: JSON.stringify(customer),
  });
  const data = await res.json();
  return data.customer || data;
}
