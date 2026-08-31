// ข้อมูลคลังยา (Medicine Table DB Model - B6741990)
export interface MedicineDB {
  id: number;
  medicine_code: string;
  name: string;
  stock_quantity: number;
  unit_price: number;
  created_at?: string;
  updated_at?: string;
}

// รายการจ่ายยา (Dispensing Table DB Model - B6741990)
export interface DispensingDB {
  id: number;
  visit_id: number;
  medicine_id: number;
  doctor_id: number;
  quantity: number;
  dosage: string;
  instructions: string;
  created_at?: string;
  updated_at?: string;
  medicine?: MedicineDB;
}
