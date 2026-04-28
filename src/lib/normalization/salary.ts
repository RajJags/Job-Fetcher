export function parseLpaFromText(value: string): {
  minLpa: number | null;
  maxLpa: number | null;
} {
  const text = value.toLowerCase();
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-to]+\s*(\d+(?:\.\d+)?)\s*lpa/);
  if (rangeMatch) {
    return {
      minLpa: Number(rangeMatch[1]),
      maxLpa: Number(rangeMatch[2])
    };
  }

  const singleMatch = text.match(/(\d+(?:\.\d+)?)\s*lpa/);
  if (singleMatch) {
    const amount = Number(singleMatch[1]);
    return {
      minLpa: amount,
      maxLpa: amount
    };
  }

  return {
    minLpa: null,
    maxLpa: null
  };
}

export function formatSalary(minLpa: number | null, maxLpa: number | null): string {
  if (minLpa === null && maxLpa === null) {
    return "Salary unavailable";
  }

  if (minLpa !== null && maxLpa !== null && minLpa !== maxLpa) {
    return `${minLpa.toFixed(0)} - ${maxLpa.toFixed(0)} LPA`;
  }

  const amount = minLpa ?? maxLpa;
  return `${amount?.toFixed(0)} LPA`;
}
