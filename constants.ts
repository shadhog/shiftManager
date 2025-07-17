import { Schedule, AvailabilityStatus, EmployeeAvailability } from './types';

export const INITIAL_EMPLOYEES = ['עדי', 'הילה', 'נועה', 'ליאור'];
export const DAYS_OF_WEEK = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
export const SHIFT_TYPES = {
    MORNING: 'בוקר',
    EVENING: 'ערב'
};

const createInitialAvailability = (employees: string[]): EmployeeAvailability[] => 
    employees.map(name => ({
        name,
        status: AvailabilityStatus.Unknown,
        notes: ''
    }));

export const createInitialSchedule = (employees: string[]): Schedule => {
    const schedule: Schedule = {};
    DAYS_OF_WEEK.forEach(day => {
        if (day === 'שישי') {
            schedule[day] = {
                morning: createInitialAvailability(employees)
            };
        } else {
            schedule[day] = {
                morning: createInitialAvailability(employees),
                evening: createInitialAvailability(employees)
            };
        }
    });
    return schedule;
};
