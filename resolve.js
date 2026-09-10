const fs = require('fs');

// 1. db.go
let dbPath = 'golang-backend/internal/config/db.go';
let dbContent = fs.readFileSync(dbPath, 'utf8');
let dbRegex = /<<<<<<< HEAD\n\s*database\.AutoMigrate\([\s\S]*?>>>>>>> origin\/main/m;
let dbResolved = `		database.AutoMigrate(
			&models.Medicine{},
			&models.PatientMedicine{},
			&models.BillingQueue{},
			&models.MedicineQueue{},
			&models.QueueCounter{},
			&models.Appointment{},
			&models.SystemAccess{},
			&models.TreatmentRight{},
			&models.Billing{},
			&models.BillingHistory{},
			&models.QRPayment{},
			&models.Dispensing{},
			&models.Document{},
			&models.DocumentForward{},
		)`;
dbContent = dbContent.replace(dbRegex, dbResolved);
fs.writeFileSync(dbPath, dbContent);

// 2. Topbar.tsx
let topbarPath = 'react-frontend/src/components/Topbar/Topbar.tsx';
let topbarContent = fs.readFileSync(topbarPath, 'utf8');
let topbarRegex1 = /<<<<<<< HEAD\n\s*const \[isAckLoading, setIsAckLoading\] = useState\(false\);\n\n=======\n([\s\S]*?)>>>>>>> origin\/main/m;
topbarContent = topbarContent.replace(topbarRegex1, (match, p1) => {
  return `  const [isAckLoading, setIsAckLoading] = useState(false);\n\n${p1}`;
});

let topbarRegex2 = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/main/m;
topbarContent = topbarContent.replace(topbarRegex2, (match, head, main) => {
  return main; // accept main completely for the second conflict
});
fs.writeFileSync(topbarPath, topbarContent);

// 3. LoginPage.tsx
let loginPath = 'react-frontend/src/pages/Login/LoginPage.tsx';
let loginContent = fs.readFileSync(loginPath, 'utf8');
let loginRegex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/main/m;
loginContent = loginContent.replace(loginRegex, (match, head, main) => {
  return main; // accept main completely
});
fs.writeFileSync(loginPath, loginContent);

// 4. api.ts
let apiPath = 'react-frontend/src/services/api.ts';
let apiContent = fs.readFileSync(apiPath, 'utf8');
let apiRegex = /<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> origin\/main/m;
apiContent = apiContent.replace(apiRegex, (match, head, main) => {
  return main; // accept main completely
});
fs.writeFileSync(apiPath, apiContent);

console.log('Resolved conflicts');
