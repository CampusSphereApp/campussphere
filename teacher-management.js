const supported = new Set(['classes', 'subjects', 'timetable', 'students']);
const target = supported.has(location.hash.slice(1)) ? location.hash : '#overview';
location.replace(`teacher-dashboard.html${target}`);
