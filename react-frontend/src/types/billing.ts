// บิล/ใบเสร็จรับเงิน (Billing Table DB Model - B6741990)
export interface BillingDB {
  id: number;
  visit_id: number;
  total_amount: number;
  discount_from_eligibility: number;
  net_amount: number;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'cancelled';
  receipt_number?: string;
  created_at?: string;
  updated_at?: string;
}

// QR Code สำหรับชำระเงิน (QRPayment Table DB Model - B6741990)
export interface QRPaymentDB {
  id: number;
  billing_id: number;
  qr_code_data: string;
  promptpay_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'expired';
  expired_at: string;
  created_at?: string;
  updated_at?: string;
}
