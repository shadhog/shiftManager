
export enum AvailabilityStatus {
    Available = 'זמין',
    Unavailable = 'לא זמין',
    Unknown = 'לא ידוע',
    Assigned = 'משובץ'
}

export interface EmployeeAvailability {
    name: string;
    status: AvailabilityStatus;
    notes: string;
}

export interface Shift {
    morning: EmployeeAvailability[];
    evening: EmployeeAvailability[];
}

export interface FridayShift {
    morning: EmployeeAvailability[];
}

export type Schedule = {
    [day: string]: Shift | FridayShift;
};

export type WeekView = 'current' | 'next';
export type TableView = 'full' | 'compact';