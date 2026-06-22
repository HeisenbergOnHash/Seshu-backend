"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarDaysDiff = exports.parseCalendarDate = exports.toCalendarDate = exports.APP_TZ = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
exports.APP_TZ = 'Asia/Kolkata';
/** Normalize any Date to a calendar day in IST (for lending date math). */
const toCalendarDate = (date) => {
    return (0, dayjs_1.default)(date).tz(exports.APP_TZ).startOf('day');
};
exports.toCalendarDate = toCalendarDate;
/** Parse YYYY-MM-DD from forms as an IST calendar date. */
const parseCalendarDate = (dateStr) => {
    return dayjs_1.default.tz(dateStr, exports.APP_TZ).startOf('day').toDate();
};
exports.parseCalendarDate = parseCalendarDate;
const calendarDaysDiff = (from, to) => {
    return (0, exports.toCalendarDate)(to).diff((0, exports.toCalendarDate)(from), 'day');
};
exports.calendarDaysDiff = calendarDaysDiff;
