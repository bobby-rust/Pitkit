export default function formatDate(date: string) {
	// Manually parse the date part before the comma
	const [datePart] = date.split(","); // "4/1/2025"
	const [month, day, year] = datePart
		.split("/")
		.map((num) => parseInt(num, 10));

	// Ensure MM/DD/YYYY format with leading zeros
	const mm = String(month).padStart(2, "0");
	const dd = String(day).padStart(2, "0");
	const yyyy = String(year);

	return `${mm}/${dd}/${yyyy}`;
}
