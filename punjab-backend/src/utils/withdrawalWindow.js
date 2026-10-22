const INDIA_TIME_ZONE = "Asia/Kolkata";

function getIndiaDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(value.year), month: Number(value.month), day: Number(value.day) };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getWithdrawalWindow(date = new Date()) {
  const { year, month } = getIndiaDateParts(date);
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }

  return {
    isOpen: true,
    withdrawalMonth: `${year}-${pad(month)}-01`,
    nextWithdrawalDate: `${nextYear}-${pad(nextMonth)}-01`,
  };
}

module.exports = {
  INDIA_TIME_ZONE,
  getWithdrawalWindow,
};
