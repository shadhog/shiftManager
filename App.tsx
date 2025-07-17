import React, { useState, useCallback, useMemo } from 'react';
import { Schedule, WeekView, AvailabilityStatus, TableView, EmployeeAvailability } from './types';
import { createInitialSchedule, INITIAL_EMPLOYEES, DAYS_OF_WEEK } from './constants';
import { parseAvailability, generateOptimalSchedule, generateUnfilledShiftsMessage } from './services/geminiService';
import Header from './components/Header';
import InputArea from './components/InputArea';
import ShiftTable from './components/ShiftTable';
import Suggestions from './components/Suggestions';
import LoadingSpinner from './components/LoadingSpinner';
import ManageEmployeesModal from './components/ManageEmployeesModal';
import useLocalStorage from './hooks/useLocalStorage';

const App: React.FC = () => {
    const [employees, setEmployees] = useLocalStorage<string[]>('employees', INITIAL_EMPLOYEES);

    const [schedules, setSchedules] = useLocalStorage<{ [key in WeekView]: Schedule }>('schedules', {
        current: createInitialSchedule(employees),
        next: createInitialSchedule(employees),
    });

    const [activeWeek, setActiveWeek] = useState<WeekView>('current');
    const [viewMode, setViewMode] = useState<TableView>('full');
    const [userInput, setUserInput] = useState<string>('');
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [unfilledShiftsMessage, setUnfilledShiftsMessage] = useState<string>('');
    const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

    const activeSchedule = schedules[activeWeek];

    const handleUpdateAvailability = useCallback(async () => {
        const textToParse = selectedEmployee ? `${selectedEmployee}: ${userInput}` : userInput;

        if (!textToParse.trim()) {
            setError('אנא הכנס טקסט עם זמינות העובדים.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setUnfilledShiftsMessage('');
        try {
            const updatedSchedule = await parseAvailability(textToParse, activeSchedule, employees);
            setSchedules(prev => ({ ...prev, [activeWeek]: updatedSchedule }));
            setUserInput('');
            setSelectedEmployee('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [userInput, selectedEmployee, activeSchedule, activeWeek, employees, setSchedules]);

    const handleGenerateSchedule = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setUnfilledShiftsMessage('');
        try {
            const finalSchedule = await generateOptimalSchedule(activeSchedule, employees);
            setSchedules(prev => ({ ...prev, [activeWeek]: finalSchedule }));

            const unfilled = [];
            for (const day of DAYS_OF_WEEK) {
                const daySchedule = finalSchedule[day];
                if (daySchedule) {
                    if ('morning' in daySchedule && !daySchedule.morning.some(e => e.status === AvailabilityStatus.Assigned)) {
                        unfilled.push({ day, shift: 'בוקר' });
                    }
                    if ('evening' in daySchedule && !daySchedule.evening.some(e => e.status === AvailabilityStatus.Assigned)) {
                        unfilled.push({ day, shift: 'ערב' });
                    }
                }
            }
            if (unfilled.length > 0) {
                const generatedMessage = await generateUnfilledShiftsMessage(unfilled);
                setUnfilledShiftsMessage(generatedMessage || "ישנן משמרות לא מאוישות. אנא בדוק את הלוח.");
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [activeSchedule, activeWeek, employees, setSchedules]);
    
    const handleGenerateUnfilledMessage = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setUnfilledShiftsMessage('');

        const unfilled = [];
        for (const day of DAYS_OF_WEEK) {
            const daySchedule = activeSchedule[day];
            if (daySchedule) {
                if ('morning' in daySchedule && !daySchedule.morning.some(e => e.status === AvailabilityStatus.Assigned)) {
                    unfilled.push({ day, shift: 'בוקר' });
                }
                if ('evening' in daySchedule && 'evening' in daySchedule && !daySchedule.evening.some(e => e.status === AvailabilityStatus.Assigned)) {
                    unfilled.push({ day, shift: 'ערב' });
                }
            }
        }
        
        if (unfilled.length > 0) {
            try {
                const generatedMessage = await generateUnfilledShiftsMessage(unfilled);
                setUnfilledShiftsMessage(generatedMessage || "ישנן משמרות לא מאוישות. אנא בדוק את הלוח.");
            } catch (e: any) {
                setError(e.message);
            }
        } else {
            setUnfilledShiftsMessage("כל המשמרות מאוישות, כל הכבוד!");
        }
        
        setIsLoading(false);
    }, [activeSchedule]);


    const handleClearSchedule = useCallback(() => {
        if (window.confirm('האם לאשר את ניקוי המשמרות עבור שבוע זה? הפעולה תאפס את כל הנתונים שהוזנו.')) {
            setSchedules(prev => ({
                ...prev,
                [activeWeek]: createInitialSchedule(employees)
            }));
            setUnfilledShiftsMessage('');
            setError(null);
        }
    }, [activeWeek, employees, setSchedules]);
    
    const handleAddEmployee = (name: string) => {
        const newEmployees = [...employees, name];
        setEmployees(newEmployees);

        const newSchedules = JSON.parse(JSON.stringify(schedules));
        for (const week in newSchedules) {
            for (const day in newSchedules[week as WeekView]) {
                const scheduleDay = newSchedules[week as WeekView][day];
                if(scheduleDay.morning) {
                    scheduleDay.morning.push({ name, status: AvailabilityStatus.Unknown, notes: ''});
                }
                if(scheduleDay.evening) {
                    scheduleDay.evening.push({ name, status: AvailabilityStatus.Unknown, notes: ''});
                }
            }
        }
        setSchedules(newSchedules);
    };
    
    const handleDeleteEmployee = (name: string) => {
        if (window.confirm(`האם למחוק את ${name}? פעולה זו תסיר את העובד/ת מכל המשמרות.`)) {
            const newEmployees = employees.filter(emp => emp !== name);
            setEmployees(newEmployees);

            const newSchedules = JSON.parse(JSON.stringify(schedules));
            for (const week in newSchedules) {
                for (const day in newSchedules[week as WeekView]) {
                    const scheduleDay = newSchedules[week as WeekView][day];
                    if(scheduleDay.morning) {
                        scheduleDay.morning = scheduleDay.morning.filter((emp: any) => emp.name !== name);
                    }
                    if(scheduleDay.evening) {
                        scheduleDay.evening = scheduleDay.evening.filter((emp: any) => emp.name !== name);
                    }
                }
            }
            setSchedules(newSchedules);
        }
    };

    const handleCardClick = useCallback((day: string, shiftType: 'morning' | 'evening', employeeName: string) => {
        setSchedules(prev => {
            const newSchedules = { ...prev };
            const scheduleToUpdate = JSON.parse(JSON.stringify(newSchedules[activeWeek]));
            
            const dayData = scheduleToUpdate[day];
            if (!dayData) return prev;

            const shift = shiftType === 'morning' ? dayData.morning : dayData.evening;
            if (!shift) return prev;

            const employeeIndex = shift.findIndex((e: any) => e.name === employeeName);
            if (employeeIndex === -1) return prev;
            
            const currentStatus = shift[employeeIndex].status;
            let nextStatus: AvailabilityStatus;

            switch (currentStatus) {
                case AvailabilityStatus.Available: nextStatus = AvailabilityStatus.Unavailable; break;
                case AvailabilityStatus.Unavailable: nextStatus = AvailabilityStatus.Unknown; break;
                case AvailabilityStatus.Unknown: nextStatus = AvailabilityStatus.Available; break;
                case AvailabilityStatus.Assigned: nextStatus = AvailabilityStatus.Available; break; // Allow un-assigning
                default: nextStatus = AvailabilityStatus.Unknown;
            }
            
            shift[employeeIndex].status = nextStatus;
            newSchedules[activeWeek] = scheduleToUpdate;
            return newSchedules;
        });
    }, [activeWeek, setSchedules]);

    const handleAssignEmployee = useCallback((day: string, shiftType: 'morning' | 'evening', employeeName: string) => {
        setSchedules(prev => {
            const newSchedules = { ...prev };
            const scheduleToUpdate = JSON.parse(JSON.stringify(newSchedules[activeWeek]));
            
            const shift = scheduleToUpdate[day]?.[shiftType];
            if (!shift) return prev;

            const employeeToAssign = shift.find((e: EmployeeAvailability) => e.name === employeeName);
            if (!employeeToAssign) return prev;

            const isCurrentlyAssigned = employeeToAssign.status === AvailabilityStatus.Assigned;

            // Un-assign any other employee in this shift
            shift.forEach((emp: EmployeeAvailability) => {
                if (emp.status === AvailabilityStatus.Assigned && emp.name !== employeeName) {
                    emp.status = AvailabilityStatus.Available;
                }
            });

            // Toggle the assignment status for the target employee
            employeeToAssign.status = isCurrentlyAssigned ? AvailabilityStatus.Available : AvailabilityStatus.Assigned;

            newSchedules[activeWeek] = scheduleToUpdate;
            return newSchedules;
        });
    }, [activeWeek, setSchedules]);
    
    const handleAddEmployeeToShift = useCallback((day: string, shiftType: 'morning' | 'evening', employeeName: string) => {
        setSchedules(prev => {
            const newSchedules = { ...prev };
            const scheduleToUpdate = JSON.parse(JSON.stringify(newSchedules[activeWeek]));
            const shift = scheduleToUpdate[day]?.[shiftType];
            if (!shift) return prev;
            
            const employee = shift.find((e: any) => e.name === employeeName);
            if(employee) {
                employee.status = AvailabilityStatus.Available;
            }
            
            newSchedules[activeWeek] = scheduleToUpdate;
            return newSchedules;
        });
    }, [activeWeek, setSchedules]);

    const handleMoveEmployee = useCallback((
        source: { day: string; shiftType: 'morning' | 'evening'; employeeName: string; },
        destination: { day: string; shiftType: 'morning' | 'evening'; }
    ) => {
        if (source.day === destination.day && source.shiftType === destination.shiftType) {
            return; // No change if dropped in the same cell
        }

        setSchedules(prev => {
            const newSchedules = { ...prev };
            const scheduleToUpdate = JSON.parse(JSON.stringify(newSchedules[activeWeek]));

            // Set destination employee to 'Available'
            const destShift = scheduleToUpdate[destination.day]?.[destination.shiftType];
            if (destShift) {
                const destEmployee = destShift.find((e: any) => e.name === source.employeeName);
                if (destEmployee) {
                    destEmployee.status = AvailabilityStatus.Available;
                }
            } else { return prev; }

            // Set source employee to 'Unknown'
            const sourceShift = scheduleToUpdate[source.day]?.[source.shiftType];
            if (sourceShift) {
                const sourceEmployee = sourceShift.find((e: any) => e.name === source.employeeName);
                if (sourceEmployee) {
                    sourceEmployee.status = AvailabilityStatus.Unknown;
                    sourceEmployee.notes = '';
                }
            } else { return prev; }

            newSchedules[activeWeek] = scheduleToUpdate;
            return newSchedules;
        });
    }, [activeWeek, setSchedules]);

    const hasUnfilledShifts = useMemo(() => {
        for (const day of DAYS_OF_WEEK) {
            const daySchedule = activeSchedule[day];
            if (daySchedule) {
                if ('morning' in daySchedule && !daySchedule.morning.some(e => e.status === AvailabilityStatus.Assigned)) {
                    return true;
                }
                if ('evening' in daySchedule && 'evening' in daySchedule && !daySchedule.evening.some(e => e.status === AvailabilityStatus.Assigned)) {
                    return true;
                }
            }
        }
        return false;
    }, [activeSchedule]);


    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 p-2 sm:p-4 md:p-6" dir="rtl">
            {isEmployeeModalOpen && (
                <ManageEmployeesModal 
                    employees={employees}
                    onClose={() => setIsEmployeeModalOpen(false)}
                    onAddEmployee={handleAddEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                />
            )}
            <div className="max-w-screen-2xl mx-auto bg-white rounded-2xl shadow-lg p-4 md:p-6 relative">
                {isLoading && <LoadingSpinner />}
                <Header 
                    activeWeek={activeWeek} 
                    setActiveWeek={setActiveWeek}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    onClearSchedule={handleClearSchedule}
                    onManageEmployees={() => setIsEmployeeModalOpen(true)}
                />
                
                <main className="mt-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1">
                        <InputArea
                            userInput={userInput}
                            setUserInput={setUserInput}
                            selectedEmployee={selectedEmployee}
                            setSelectedEmployee={setSelectedEmployee}
                            employees={employees}
                            onUpdate={handleUpdateAvailability}
                            onGenerate={handleGenerateSchedule}
                            onGenerateMessage={handleGenerateUnfilledMessage}
                            isLoading={isLoading}
                            hasUnfilledShifts={hasUnfilledShifts}
                        />
                         {error && (
                            <div className="mt-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
                                <p className="font-bold">שגיאה</p>
                                <p>{error}</p>
                            </div>
                        )}
                        <Suggestions message={unfilledShiftsMessage} />
                    </div>
                    <div className="lg:col-span-3">
                        <ShiftTable 
                            schedule={activeSchedule}
                            viewMode={viewMode}
                            onCardClick={handleCardClick}
                            onAssignEmployee={handleAssignEmployee}
                            onAddEmployeeToShift={handleAddEmployeeToShift}
                            onMoveEmployee={handleMoveEmployee}
                        />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;
