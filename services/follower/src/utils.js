function isNewRelease(dateString, months = 12) {
    if (!dateString) return false;

    const now = new Date();
    const currentYear = now.getFullYear();

    if (dateString.length === 4) {
        const year = parseInt(dateString);
        return year === currentYear || (year === currentYear - 1 && now.getMonth() < months);
    }

    let parsedDate;

    if (dateString.length === 7) {
        parsedDate = new Date(`${dateString}-01`);
    } else {
        parsedDate = new Date(dateString);
    }

    if (isNaN(parsedDate)) return false;

    const threshold = new Date();
    threshold.setMonth(now.getMonth() - months);

    return parsedDate >= threshold;
}

module.exports = { isNewRelease };
