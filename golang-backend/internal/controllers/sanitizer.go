package controllers

import "strings"

// CleanDosage removes question marks or corrupt data and provides clean Thai dosage
func CleanDosage(d, medName string) string {
	d = strings.TrimSpace(d)
	if d == "" || strings.Contains(d, "?") || strings.Contains(d, "เม็ดเม็ด") {
		lower := strings.ToLower(medName)
		if strings.Contains(lower, "amoxicillin") {
			return "ครั้งละ 1 แคปซูล วันละ 3 ครั้ง หลังอาหาร"
		}
		if strings.Contains(lower, "paracetamol") {
			return "ครั้งละ 1-2 เม็ด ทุก 4-6 ชม."
		}
		return "ครั้งละ 1 เม็ด วันละ 3 ครั้ง หลังอาหาร"
	}
	return d
}

// CleanInstructions removes question marks and returns clean usage advice
func CleanInstructions(inst, medName string) string {
	inst = strings.TrimSpace(inst)
	if inst == "" || strings.Contains(inst, "?") || strings.Contains(inst, "เม็ดเม็ด") {
		lower := strings.ToLower(medName)
		if strings.Contains(lower, "amoxicillin") {
			return "ควรรับประทานติดต่อกันจนยาหมดตามแพทย์สั่งอย่างเคร่งครัด"
		}
		if strings.Contains(lower, "paracetamol") {
			return "รับประทานเมื่อมีอาการปวดหรือมีไข้ ไม่ควรเกินวันละ 8 เม็ด"
		}
		return "รับประทานหลังอาหาร เช้า กลางวัน เย็น ดื่มน้ำตามมากๆ"
	}
	return inst
}

// CleanDoctorAdvice removes question marks and corrupt text
func CleanDoctorAdvice(adv string) string {
	adv = strings.TrimSpace(adv)
	if adv == "" || strings.Contains(adv, "?") || strings.Contains(adv, "เม็ดเม็ด") {
		return "พักผ่อนให้เพียงพอ ดื่มน้ำมากๆ รับประทานยาตามที่แพทย์สั่งอย่างเคร่งครัด หากอาการไม่ดีขึ้นให้กลับมาพบแพทย์"
	}
	return adv
}

// CleanAllergies removes question marks
func CleanAllergies(all string) string {
	all = strings.TrimSpace(all)
	if all == "" || strings.Contains(all, "?") {
		return "ไม่มีประวัติแพ้ยา"
	}
	return all
}

// CleanChronicDiseases removes question marks
func CleanChronicDiseases(cd string) string {
	cd = strings.TrimSpace(cd)
	if cd == "" || strings.Contains(cd, "?") {
		return "ไม่มี"
	}
	return cd
}
